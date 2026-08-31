import type { FastifyInstance } from "fastify";
import type { Redis } from "ioredis";
import type postgres from "postgres";
import WebSocket from "ws";
import { createRequireAppUser } from "../auth/guard.js";
import { createVoiceSession } from "../chat/sessions.js";
import {
  type GatewayConfig,
  suppressedWarningCodes,
  voiceAudioPersistEnabled,
  voiceAudioReady,
  voiceCallReady,
} from "../config.js";
import {
  DeepgramAgentError,
  type DeepgramVoiceAgent,
  openVoiceAgentSessionWithRetry,
  reconnectVoiceAgentSession,
  socketDataToBuffer,
} from "../deepgram/agent.js";
import { buildVoiceAgentSettings } from "../deepgram/settings.js";
import { MultiplePersonasError, resolveActivePersona } from "../personas.js";
import {
  type Utterance,
  VoiceAudioCapture,
  VoiceAudioStore,
} from "../voice/audio.js";
import { createVoiceBargeIn } from "../voice/bargeIn.js";
import {
  type PendingLatency,
  clearVoiceCallState,
  setPendingLatency,
  setVoiceBargeIn,
  writeVoiceCallState,
} from "../voice/callState.js";
import {
  deepgramRecoveryAction,
  failureMessage,
  isFatalFailure,
  voiceFailurePayload,
} from "../voice/failures.js";
import { applyVoiceLatency, readVoiceLatency } from "../voice/latency.js";
import { createVoiceNoticeHub } from "../voice/notices.js";
import {
  endVoiceSession,
  recordSttMeta,
  recordTtsMeta,
  sttMeta,
  ttsMeta,
} from "../voice/record.js";
import { redisQuiet } from "../voice/redisSafe.js";
import { pcmDurationMs } from "../voice/wav.js";

type Sql = ReturnType<typeof postgres>;

function sendJson(socket: WebSocket, payload: Record<string, unknown>): void {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(payload));
  }
}

function closeClient(socket: WebSocket): void {
  if (
    socket.readyState === WebSocket.OPEN ||
    socket.readyState === WebSocket.CONNECTING
  ) {
    socket.close();
  }
}

function eventText(event: Record<string, unknown>): string | null {
  if (typeof event.content === "string") {
    return event.content;
  }
  if (typeof event.text === "string") {
    return event.text;
  }
  return null;
}

function eventRole(event: Record<string, unknown>): string | null {
  if (typeof event.role === "string" && event.role.length > 0) {
    return event.role;
  }
  if (typeof event.speaker === "string" && event.speaker.length > 0) {
    return event.speaker;
  }
  return null;
}

export async function registerVoiceRoutes(
  app: FastifyInstance,
  deps: { config: GatewayConfig; sql: Sql; redis: Redis },
): Promise<void> {
  const { config, sql, redis } = deps;
  const requireAppUser = createRequireAppUser(deps);
  const suppressed = suppressedWarningCodes(config);
  const notices = createVoiceNoticeHub(redis, config, app.log);
  app.addHook("onClose", async () => {
    await notices.close();
  });

  app.get(
    config.VOICE_WS_PATH,
    { websocket: true, preHandler: requireAppUser },
    (socket, request) => {
      const user = request.appUser;
      if (!user) {
        sendJson(socket, {
          type: config.VOICE_CLIENT_ERROR_TYPE,
          error: "unauthorized",
        });
        closeClient(socket);
        return;
      }

      const readyError = voiceCallReady(config);
      if (readyError) {
        request.log.warn({ reason: readyError }, "voice call refused");
        sendJson(socket, {
          type: config.VOICE_CLIENT_ERROR_TYPE,
          error: readyError,
        });
        closeClient(socket);
        return;
      }

      void (async () => {
        let agent: DeepgramVoiceAgent | null = null;
        let sessionId: string | null = null;
        let settingsApplied = false;
        let clientGone = false;
        const markClientGone = () => {
          clientGone = true;
        };
        socket.on("close", markClientGone);
        socket.on("error", markClientGone);
        try {
          let persona: Awaited<ReturnType<typeof resolveActivePersona>>;
          try {
            persona = await resolveActivePersona(sql, config);
          } catch (error) {
            if (error instanceof MultiplePersonasError) {
              sendJson(socket, {
                type: config.VOICE_CLIENT_ERROR_TYPE,
                error: "multiple personas",
              });
            } else {
              request.log.error({ err: error }, "voice persona lookup failed");
              sendJson(
                socket,
                voiceFailurePayload(config, config.FAILURE_CODE_DATABASE),
              );
            }
            closeClient(socket);
            return;
          }
          if (!persona) {
            sendJson(socket, {
              type: config.VOICE_CLIENT_ERROR_TYPE,
              error: "persona not recorded",
            });
            closeClient(socket);
            return;
          }

          let session: Awaited<ReturnType<typeof createVoiceSession>>;
          try {
            session = await createVoiceSession(sql, user.id, persona.id);
          } catch (error) {
            request.log.error({ err: error }, "voice session create failed");
            sendJson(
              socket,
              voiceFailurePayload(config, config.FAILURE_CODE_DATABASE),
            );
            closeClient(socket);
            return;
          }
          sessionId = session.id;
          const settings = buildVoiceAgentSettings(config, {
            appUserId: user.id,
            engramUserId: user.engramUserId,
            personaId: persona.id,
            sessionId: session.id,
          });
          let opened: Awaited<
            ReturnType<typeof openVoiceAgentSessionWithRetry>
          >;
          try {
            opened = await openVoiceAgentSessionWithRetry(
              config,
              request.log,
              settings,
            );
          } catch (error) {
            request.log.error({ err: error }, "deepgram connect failed");
            sendJson(
              socket,
              voiceFailurePayload(config, config.FAILURE_CODE_DEEPGRAM),
            );
            closeClient(socket);
            await endVoiceSession(sql, session.id).catch(
              (endError: unknown) => {
                request.log.error(
                  { err: endError, sessionId: session.id },
                  "voice session not closed",
                );
              },
            );
            return;
          }
          agent = opened.agent;
          if (clientGone || socket.readyState !== WebSocket.OPEN) {
            agent.close();
            await redisQuiet(
              request.log,
              config,
              "clearVoiceCallState",
              session.id,
              () => clearVoiceCallState(redis, config, session.id),
            );
            await endVoiceSession(sql, session.id).catch((error: unknown) => {
              request.log.error(
                { err: error, sessionId: session.id },
                "voice session not closed",
              );
            });
            return;
          }
          const redisOk = await redisQuiet(
            request.log,
            config,
            "writeVoiceCallState",
            session.id,
            () =>
              writeVoiceCallState(redis, config, {
                request_id: opened.requestId,
                session_id: session.id,
                barge_in: false,
                pending_latency: [],
              }),
          );
          settingsApplied = true;

          const sendFailure = (code: string) => {
            sendJson(socket, voiceFailurePayload(config, code));
          };
          let redisWarned = false;
          const noteRedisFail = () => {
            if (redisWarned) {
              return;
            }
            redisWarned = true;
            sendFailure(config.FAILURE_CODE_REDIS);
          };
          if (redisOk === null) {
            noteRedisFail();
          }
          let recordWarned = false;
          const noteRecordLost = () => {
            if (recordWarned) {
              return;
            }
            recordWarned = true;
            sendFailure(config.FAILURE_CODE_RECORD);
          };

          // Audio persistence is optional to boot but never silently skipped.
          let audioStore: VoiceAudioStore | null = null;
          const audioError = voiceAudioReady(config);
          if (voiceAudioPersistEnabled(config) && audioError) {
            request.log.warn(
              { sessionId: session.id, reason: audioError },
              "voice audio will not be stored",
            );
            sendJson(socket, {
              ...voiceFailurePayload(config, config.FAILURE_CODE_BLOB),
              reason: audioError,
            });
          } else if (voiceAudioPersistEnabled(config)) {
            // Storage is a secondary record: if it is unreachable the call
            // still runs, loudly, rather than dropping the conversation.
            try {
              const store = new VoiceAudioStore(config, sql, request.log);
              await store.ensureContainer();
              audioStore = store;
            } catch (error) {
              request.log.error(
                { err: error, sessionId: session.id },
                "voice audio store unavailable",
              );
              sendJson(socket, {
                ...voiceFailurePayload(config, config.FAILURE_CODE_BLOB),
                reason:
                  error instanceof Error ? error.message : "blob store failed",
              });
            }
          }

          sendJson(socket, {
            type: config.VOICE_CLIENT_READY_TYPE,
            session_id: session.id,
            request_id: opened.requestId,
          });

          const bargeIn = createVoiceBargeIn();
          const capture = new VoiceAudioCapture(config);
          capture.openUser();
          let pending: PendingLatency[] = [];
          let userTranscript: string[] = [];
          let interrupted = false;
          let agentSpeaking = false;
          // The transport sends one latency field per message, so a turn's
          // numbers are merged and written once the turn is over.
          let turnLatency: PendingLatency | null = null;

          const live = {
            agent: opened.agent,
            requestId: opened.requestId,
            unbind: () => {},
            closedByUs: false,
            recovering: false,
            ignoreAgentClose: false,
          };
          agent = live.agent;

          const storeUtterance = async (utterance: Utterance) => {
            if (!audioStore) {
              return;
            }
            try {
              const stored = await audioStore.store(session.id, utterance);
              if (stored) {
                request.log.info(
                  {
                    sessionId: session.id,
                    turnId: stored.turnId,
                    direction: stored.direction,
                    durationMs: stored.durationMs,
                    sizeBytes: stored.sizeBytes,
                    truncated: utterance.truncated,
                  },
                  "voice audio stored",
                );
              }
            } catch (error) {
              request.log.error(
                { err: error, sessionId: session.id },
                "voice audio upload failed",
              );
              sendFailure(config.FAILURE_CODE_BLOB);
            }
          };

          // Ends the caller's side of the exchange. Safe to call more than
          // once: a second call finds nothing buffered and does nothing.
          const closeUserTurn = () => {
            const utterance = capture.closeUser();
            capture.openUser();
            const transcript = userTranscript.join(" ").trim();
            userTranscript = [];
            if (!utterance && !transcript) {
              return;
            }
            void (async () => {
              if (transcript) {
                const turnId = await recordSttMeta(
                  sql,
                  session.id,
                  sttMeta(config, transcript, live.requestId),
                ).catch((error: unknown) => {
                  request.log.error(
                    { err: error, sessionId: session.id },
                    "stt metadata not recorded",
                  );
                  noteRecordLost();
                  return null;
                });
                if (turnId) {
                  request.log.info(
                    { sessionId: session.id, turnId },
                    "voice stt recorded",
                  );
                }
              }
              if (utterance) {
                await storeUtterance(utterance);
              }
            })();
          };

          const flushAgent = () => {
            const utterance = capture.closeAgent();
            const wasInterrupted = interrupted;
            interrupted = false;
            if (!utterance) {
              return;
            }
            const durationMs = pcmDurationMs(utterance.pcm.length, {
              sampleRate: config.DEEPGRAM_AUDIO_OUTPUT_SAMPLE_RATE,
              channels: 1,
              bitsPerSample: config.VOICE_AUDIO_BITS_PER_SAMPLE,
            });
            void (async () => {
              const turnId = await recordTtsMeta(
                sql,
                session.id,
                ttsMeta(
                  config,
                  {
                    bytes: utterance.pcm.length,
                    durationMs,
                    interrupted: wasInterrupted,
                  },
                  live.requestId,
                ),
              ).catch((error: unknown) => {
                request.log.error(
                  { err: error, sessionId: session.id },
                  "tts metadata not recorded",
                );
                noteRecordLost();
                return null;
              });
              if (turnId) {
                request.log.info(
                  { sessionId: session.id, turnId, durationMs },
                  "voice tts recorded",
                );
              }
              await storeUtterance(utterance);
            })();
          };

          const collectLatency = (event: Record<string, unknown>) => {
            const latency = readVoiceLatency(event, config);
            const merged: PendingLatency = turnLatency ?? {
              stt_ms: null,
              tts_first_byte_ms: null,
              report: {},
            };
            merged.stt_ms = latency.sttMs ?? merged.stt_ms;
            merged.tts_first_byte_ms =
              latency.ttsFirstByteMs ?? merged.tts_first_byte_ms;
            merged.report = { ...merged.report, ...latency.report };
            turnLatency = merged;
          };

          const closeLatencyTurn = () => {
            if (!turnLatency) {
              return;
            }
            pending.push(turnLatency);
            turnLatency = null;
          };

          const drainLatency = async () => {
            if (pending.length === 0) {
              return;
            }
            const queue = pending;
            pending = [];
            const unmatched: PendingLatency[] = [];
            for (const item of queue) {
              const turnId = await applyVoiceLatency(sql, session.id, {
                sttMs: item.stt_ms,
                ttsFirstByteMs: item.tts_first_byte_ms,
                report: item.report,
              }).catch((error: unknown) => {
                request.log.error(
                  { err: error, sessionId: session.id },
                  "voice latency not recorded",
                );
                noteRecordLost();
                return null;
              });
              if (turnId) {
                request.log.info(
                  {
                    sessionId: session.id,
                    turnId,
                    sttMs: item.stt_ms,
                    ttsFirstByteMs: item.tts_first_byte_ms,
                  },
                  "voice latency spans",
                );
              } else {
                unmatched.push(item);
              }
            }
            pending = [...unmatched, ...pending];
            const saved = await redisQuiet(
              request.log,
              config,
              "setPendingLatency",
              session.id,
              () => setPendingLatency(redis, config, session.id, pending),
            );
            if (saved === null) {
              noteRedisFail();
            }
          };

          const rememberBargeIn = (value: boolean) => {
            void redisQuiet(
              request.log,
              config,
              "setVoiceBargeIn",
              session.id,
              () => setVoiceBargeIn(redis, config, session.id, value),
            ).then((saved) => {
              if (saved === null) {
                noteRedisFail();
              }
            });
          };

          let cleaned = false;
          const cleanup = () => {
            if (cleaned) {
              return;
            }
            cleaned = true;
            live.closedByUs = true;
            live.unbind();
            live.ignoreAgentClose = true;
            live.agent.close();
            closeLatencyTurn();
            const trailing = capture.drain();
            void (async () => {
              for (const utterance of trailing) {
                await storeUtterance(utterance);
              }
              await drainLatency();
              if (sessionId) {
                const id = sessionId;
                const cleared = await redisQuiet(
                  request.log,
                  config,
                  "clearVoiceCallState",
                  id,
                  () => clearVoiceCallState(redis, config, id),
                );
                if (cleared === null) {
                  noteRedisFail();
                }
                const ended = await endVoiceSession(sql, sessionId).catch(
                  (error: unknown) => {
                    request.log.error(
                      { err: error, sessionId },
                      "voice session not closed",
                    );
                    noteRecordLost();
                    return false;
                  },
                );
                request.log.info({ sessionId, ended }, "voice call ended");
              }
            })();
          };

          const endCall = (code: string) => {
            sendFailure(code);
            cleanup();
            closeClient(socket);
          };

          let bindAgent: (next: DeepgramVoiceAgent) => void = () => {};

          const recoverAgent = async (deepgramCode: string | null) => {
            if (
              live.closedByUs ||
              live.recovering ||
              clientGone ||
              socket.readyState !== WebSocket.OPEN
            ) {
              return;
            }
            const recovery = deepgramRecoveryAction(config, deepgramCode);
            if (recovery === "think") {
              endCall(config.FAILURE_CODE_THINK);
              return;
            }
            if (recovery !== "reconnect") {
              endCall(config.FAILURE_CODE_DEEPGRAM);
              return;
            }
            live.recovering = true;
            settingsApplied = false;
            live.unbind();
            live.ignoreAgentClose = true;
            live.agent.close();
            live.ignoreAgentClose = false;
            sendFailure(config.FAILURE_CODE_RECONNECTING);
            let lastError: unknown = null;
            for (
              let attempt = 1;
              attempt <= config.DEEPGRAM_RECONNECT_ATTEMPTS;
              attempt += 1
            ) {
              if (live.closedByUs || clientGone) {
                live.recovering = false;
                return;
              }
              request.log.warn(
                { sessionId: session.id, attempt, deepgramCode },
                "deepgram reconnect",
              );
              try {
                const next = await reconnectVoiceAgentSession(
                  config,
                  request.log,
                  settings,
                );
                if (live.closedByUs || clientGone) {
                  next.agent.close();
                  live.recovering = false;
                  return;
                }
                live.agent = next.agent;
                live.requestId = next.requestId;
                agent = next.agent;
                bindAgent(next.agent);
                settingsApplied = true;
                sendFailure(config.FAILURE_CODE_RECONNECTED);
                live.recovering = false;
                request.log.info(
                  { sessionId: session.id, requestId: next.requestId },
                  "deepgram reconnected",
                );
                return;
              } catch (error) {
                lastError = error;
              }
            }
            request.log.error(
              { err: lastError, sessionId: session.id },
              "deepgram reconnect exhausted",
            );
            live.recovering = false;
            if (!live.closedByUs) {
              endCall(config.FAILURE_CODE_DEEPGRAM);
            }
          };

          bindAgent = (next: DeepgramVoiceAgent) => {
            live.unbind();
            const offJson = next.onJson((event) => {
              const eventType =
                typeof event.type === "string" ? event.type : null;
              if (eventType === config.DEEPGRAM_MSG_ERROR) {
                const code =
                  typeof event.code === "string" && event.code.length > 0
                    ? event.code
                    : null;
                request.log.error(
                  { sessionId: session.id, event },
                  "deepgram error",
                );
                void recoverAgent(code);
                return;
              }
              if (eventType === config.DEEPGRAM_MSG_WARNING) {
                // Routine transport chatter (it tells us every few seconds that
                // the brain is slow) is logged by the client, not shown to it.
                const code = typeof event.code === "string" ? event.code : "";
                if (!suppressed.has(code)) {
                  const description =
                    typeof event.description === "string" &&
                    event.description.length > 0
                      ? event.description
                      : config.FAILURE_MESSAGE_UNKNOWN;
                  sendJson(socket, {
                    type: config.VOICE_CLIENT_WARNING_TYPE,
                    ...(code ? { code } : {}),
                    warning: description,
                    event,
                  });
                }
                return;
              }
              if (eventType === config.DEEPGRAM_MSG_CONVERSATION_TEXT) {
                const role = eventRole(event);
                const text = eventText(event);
                if (role === config.VOICE_TRANSCRIPT_USER_ROLE && text) {
                  userTranscript.push(text);
                }
              }
              if (eventType === config.DEEPGRAM_MSG_USER_STARTED) {
                if (bargeIn.onUserStarted()) {
                  interrupted = true;
                  rememberBargeIn(true);
                  request.log.info({ sessionId: session.id }, "voice barge-in");
                  flushAgent();
                  agentSpeaking = false;
                }
              }
              if (eventType === config.DEEPGRAM_MSG_AGENT_THINKING) {
                bargeIn.onAgentThinking();
                rememberBargeIn(false);
                closeUserTurn();
              }
              if (eventType === config.DEEPGRAM_MSG_AGENT_AUDIO_DONE) {
                bargeIn.onAgentAudioDone();
                rememberBargeIn(false);
                // Some turns never announce thinking, so close the user side here
                // too. Both paths are safe to run twice.
                closeUserTurn();
                flushAgent();
                agentSpeaking = false;
                closeLatencyTurn();
                void drainLatency();
              }
              if (eventType === config.DEEPGRAM_MSG_LATENCY_REPORT) {
                collectLatency(event);
              }
              sendJson(socket, {
                type: config.VOICE_CLIENT_AGENT_EVENT_TYPE,
                event,
              });
            });
            const offBinary = next.onBinary((chunk) => {
              if (!bargeIn.acceptBinary()) {
                return;
              }
              if (!agentSpeaking) {
                // First audio of a reply: whatever the caller said is now over.
                agentSpeaking = true;
                closeUserTurn();
              }
              capture.pushAgent(chunk);
              if (socket.readyState === WebSocket.OPEN) {
                socket.send(chunk);
              }
            });
            const offAgentClose = next.onClose(() => {
              if (live.ignoreAgentClose || live.closedByUs || live.recovering) {
                return;
              }
              void recoverAgent(null);
            });
            live.unbind = () => {
              offJson();
              offBinary();
              offAgentClose();
              live.unbind = () => {};
            };
          };

          bindAgent(live.agent);

          const unwatch = notices.watch(session.id, (notice) => {
            request.log.error(
              { sessionId: session.id, code: notice.code },
              "voice notice",
            );
            if (isFatalFailure(config, notice.code)) {
              live.closedByUs = true;
              sendJson(socket, {
                type: config.VOICE_CLIENT_ERROR_TYPE,
                code: notice.code,
                error: notice.message,
              });
              cleanup();
              closeClient(socket);
              return;
            }
            sendJson(socket, {
              type: config.VOICE_CLIENT_WARNING_TYPE,
              code: notice.code,
              warning: notice.message,
            });
          });

          socket.on("message", (data, isBinary) => {
            if (!settingsApplied || !live.agent.ready) {
              return;
            }
            if (isBinary) {
              const frame = socketDataToBuffer(data);
              capture.pushUser(frame);
              live.agent.sendBinary(frame);
              return;
            }
            let parsed: unknown;
            try {
              parsed = JSON.parse(
                socketDataToBuffer(data).toString("utf8"),
              ) as unknown;
            } catch {
              return;
            }
            if (
              typeof parsed !== "object" ||
              parsed === null ||
              Array.isArray(parsed)
            ) {
              return;
            }
            const body = parsed as Record<string, unknown>;
            if (body.type !== config.DEEPGRAM_MSG_INJECT_USER) {
              return;
            }
            if (typeof body.content !== "string") {
              return;
            }
            live.agent.sendJson({
              type: config.DEEPGRAM_MSG_INJECT_USER,
              content: body.content,
            });
          });

          const finishClient = () => {
            unwatch();
            cleanup();
          };
          socket.off("close", markClientGone);
          socket.off("error", markClientGone);
          socket.on("close", finishClient);
          socket.on("error", finishClient);
        } catch (error) {
          const deepgramFailed = error instanceof DeepgramAgentError;
          const message = deepgramFailed
            ? failureMessage(config, config.FAILURE_CODE_DEEPGRAM)
            : error instanceof Error
              ? error.message
              : "voice session failed";
          request.log.error({ err: error }, "voice session failed");
          sendJson(
            socket,
            deepgramFailed
              ? voiceFailurePayload(config, config.FAILURE_CODE_DEEPGRAM)
              : {
                  type: config.VOICE_CLIENT_ERROR_TYPE,
                  error: message,
                },
          );
          agent?.close();
          closeClient(socket);
          if (sessionId) {
            const id = sessionId;
            await redisQuiet(
              request.log,
              config,
              "clearVoiceCallState",
              id,
              () => clearVoiceCallState(redis, config, id),
            );
            await endVoiceSession(sql, id).catch((error: unknown) => {
              request.log.error(
                { err: error, sessionId: id },
                "voice session not closed",
              );
            });
          }
        }
      })();
    },
  );
}
