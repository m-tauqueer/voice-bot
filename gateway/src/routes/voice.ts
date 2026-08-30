import type { FastifyInstance } from "fastify";
import type { Redis } from "ioredis";
import type postgres from "postgres";
import WebSocket from "ws";
import { createRequireAppUser } from "../auth/guard.js";
import { createVoiceSession } from "../chat/sessions.js";
import { type GatewayConfig, voiceCallReady } from "../config.js";
import {
  DeepgramAgentError,
  type DeepgramVoiceAgent,
  openVoiceAgentSession,
  socketDataToBuffer,
} from "../deepgram/agent.js";
import { buildVoiceAgentSettings } from "../deepgram/settings.js";
import { resolveActivePersona } from "../personas.js";
import {
  clearVoiceCallState,
  setVoiceBargeIn,
  writeVoiceCallState,
} from "../voice/callState.js";

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

export async function registerVoiceRoutes(
  app: FastifyInstance,
  deps: { config: GatewayConfig; sql: Sql; redis: Redis },
): Promise<void> {
  const { config, sql, redis } = deps;
  const requireAppUser = createRequireAppUser(deps);

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
            return;
          }
          await writeVoiceCallState(redis, config, {
            request_id: opened.requestId,
            session_id: session.id,
            barge_in: false,
          });
          settingsApplied = true;
          sendJson(socket, {
            type: config.VOICE_CLIENT_READY_TYPE,
            session_id: session.id,
            request_id: opened.requestId,
          });

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
              sendJson(socket, {
                type: config.VOICE_CLIENT_WARNING_TYPE,
                event,
              });
              return;
            }
            if (eventType === config.DEEPGRAM_MSG_USER_STARTED) {
              void setVoiceBargeIn(redis, config, session.id, true);
            }
            sendJson(socket, {
              type: config.VOICE_CLIENT_AGENT_EVENT_TYPE,
              event,
            });
          });
          const offBinary = agent.onBinary((chunk) => {
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
              agent.sendBinary(socketDataToBuffer(data));
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

          const cleanup = () => {
            offJson();
            offBinary();
            offAgentClose();
            agent?.close();
            if (sessionId) {
              void clearVoiceCallState(redis, config, sessionId);
            }
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
          }
        }
      })();
    },
  );
}
