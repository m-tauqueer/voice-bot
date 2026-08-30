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
  openVoiceAgentSession,
  socketDataToBuffer,
} from "../deepgram/agent.js";
import { buildVoiceAgentSettings } from "../deepgram/settings.js";
import { resolveActivePersona } from "../personas.js";
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
import { applyVoiceLatency, readVoiceLatency } from "../voice/latency.js";
import {
  endVoiceSession,
  recordSttMeta,
  recordTtsMeta,
  sttMeta,
  ttsMeta,
} from "../voice/record.js";
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
          } catch {
            sendJson(socket, {
              type: config.VOICE_CLIENT_ERROR_TYPE,
              error: "multiple personas",
            });
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

          const session = await createVoiceSession(sql, user.id, persona.id);
          sessionId = session.id;
          const settings = buildVoiceAgentSettings(config, {
            appUserId: user.id,
            engramUserId: user.engramUserId,
            personaId: persona.id,
            sessionId: session.id,
          });
          const opened = await openVoiceAgentSession(
            config,
            request.log,
            settings,
          );
          agent = opened.agent;
          if (clientGone || socket.readyState !== WebSocket.OPEN) {
            agent.close();
            await clearVoiceCallState(redis, config, session.id);
            await endVoiceSession(sql, session.id);
            return;
          }
          await writeVoiceCallState(redis, config, {
            request_id: opened.requestId,
            session_id: session.id,
            barge_in: false,
            pending_latency: [],
          });
          settingsApplied = true;

          // Audio persistence is optional to boot but never silently skipped.
          let audioStore: VoiceAudioStore | null = null;
          const audioError = voiceAudioReady(config);
          if (voiceAudioPersistEnabled(config) && audioError) {
            request.log.warn(
              { sessionId: session.id, reason: audioError },
              "voice audio will not be stored",
            );
            sendJson(socket, {
              type: config.VOICE_CLIENT_WARNING_TYPE,
              warning: "audio not stored",
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
                type: config.VOICE_CLIENT_WARNING_TYPE,
                warning: "audio not stored",
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
                  sttMeta(config, transcript, opened.requestId),
                ).catch((error: unknown) => {
                  request.log.error(
                    { err: error, sessionId: session.id },
                    "stt metadata not recorded",
                  );
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
                  opened.requestId,
                ),
              ).catch((error: unknown) => {
                request.log.error(
                  { err: error, sessionId: session.id },
                  "tts metadata not recorded",
                );
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
            await setPendingLatency(redis, config, session.id, pending);
          };

          const offJson = agent.onJson((event) => {
            const eventType =
              typeof event.type === "string" ? event.type : null;
            if (eventType === config.DEEPGRAM_MSG_ERROR) {
              sendJson(socket, {
                type: config.VOICE_CLIENT_ERROR_TYPE,
                event,
              });
              agent?.close();
              closeClient(socket);
              return;
            }
            if (eventType === config.DEEPGRAM_MSG_WARNING) {
              // Routine transport chatter (it tells us every few seconds that
              // the brain is slow) is logged by the client, not shown to it.
              const code = typeof event.code === "string" ? event.code : "";
              if (!suppressed.has(code)) {
                sendJson(socket, {
                  type: config.VOICE_CLIENT_WARNING_TYPE,
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
                void setVoiceBargeIn(redis, config, session.id, true);
                request.log.info({ sessionId: session.id }, "voice barge-in");
                flushAgent();
                agentSpeaking = false;
              }
            }
            if (eventType === config.DEEPGRAM_MSG_AGENT_THINKING) {
              bargeIn.onAgentThinking();
              void setVoiceBargeIn(redis, config, session.id, false);
              closeUserTurn();
            }
            if (eventType === config.DEEPGRAM_MSG_AGENT_AUDIO_DONE) {
              bargeIn.onAgentAudioDone();
              void setVoiceBargeIn(redis, config, session.id, false);
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
          const offBinary = agent.onBinary((chunk) => {
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
          const offAgentClose = agent.onClose(() => {
            closeClient(socket);
          });

          socket.on("message", (data, isBinary) => {
            if (!settingsApplied || !agent?.ready) {
              return;
            }
            if (isBinary) {
              const frame = socketDataToBuffer(data);
              capture.pushUser(frame);
              agent.sendBinary(frame);
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
            agent.sendJson({
              type: config.DEEPGRAM_MSG_INJECT_USER,
              content: body.content,
            });
          });

          let cleaned = false;
          const cleanup = () => {
            if (cleaned) {
              return;
            }
            cleaned = true;
            offJson();
            offBinary();
            offAgentClose();
            agent?.close();
            closeLatencyTurn();
            const trailing = capture.drain();
            void (async () => {
              for (const utterance of trailing) {
                await storeUtterance(utterance);
              }
              await drainLatency();
              if (sessionId) {
                await clearVoiceCallState(redis, config, sessionId);
                const ended = await endVoiceSession(sql, sessionId).catch(
                  (error: unknown) => {
                    request.log.error(
                      { err: error, sessionId },
                      "voice session not closed",
                    );
                    return false;
                  },
                );
                request.log.info({ sessionId, ended }, "voice call ended");
              }
            })();
          };
          socket.off("close", markClientGone);
          socket.off("error", markClientGone);
          socket.on("close", cleanup);
          socket.on("error", cleanup);
        } catch (error) {
          const message =
            error instanceof DeepgramAgentError
              ? error.message
              : error instanceof Error
                ? error.message
                : "voice session failed";
          request.log.error({ err: error }, "voice session failed");
          sendJson(socket, {
            type: config.VOICE_CLIENT_ERROR_TYPE,
            error: message,
          });
          agent?.close();
          closeClient(socket);
          if (sessionId) {
            await clearVoiceCallState(redis, config, sessionId);
            await endVoiceSession(sql, sessionId);
          }
        }
      })();
    },
  );
}
