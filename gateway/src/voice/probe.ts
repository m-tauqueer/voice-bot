import WebSocket from "ws";
import { persistAuthSession, signSessionCookieValue } from "../auth/session.js";
import { createPostgres, createRedis } from "../clients.js";
import {
  clientVoiceWsUrl,
  loadGatewayConfig,
  thinkEndpointUrl,
  voiceCallReady,
  voiceTunnelCommand,
} from "../config.js";
import { socketDataToBuffer } from "../deepgram/agent.js";
import { SESSION_CHANNEL } from "../schema.js";
import { readVoiceCallState } from "./callState.js";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function expectUnauthorized(url: string, timeoutMs: number): Promise<number> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const socket = new WebSocket(url);
    const finish = (fn: () => void) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      fn();
    };
    const timer = setTimeout(() => {
      finish(() => {
        socket.terminate();
        reject(new Error("unauth connect timed out"));
      });
    }, timeoutMs);
    socket.on("unexpected-response", (_req, res) => {
      finish(() => {
        const status = res.statusCode ?? 0;
        res.resume();
        resolve(status);
      });
    });
    socket.on("open", () => {
      finish(() => {
        socket.close();
        reject(new Error("voice socket opened without a session cookie"));
      });
    });
    socket.on("error", (error) => {
      finish(() => {
        reject(error);
      });
    });
  });
}

async function main(): Promise<number> {
  const config = loadGatewayConfig();
  const readyError = voiceCallReady(config);
  console.log(`tunnel_command=${voiceTunnelCommand(config)}`);
  console.log(`byo_llm_public_url=${config.BYO_LLM_PUBLIC_URL ?? ""}`);
  if (readyError) {
    console.error(`FAIL: ${readyError}`);
    return 1;
  }
  if (!config.VOICE_INJECT_TEXT) {
    console.error("FAIL: VOICE_INJECT_TEXT is not set");
    return 1;
  }
  const thinkUrl = thinkEndpointUrl(config);
  const publicBase = (config.BYO_LLM_PUBLIC_URL ?? "").replace(/\/$/, "");
  console.log(`think_endpoint_url=${thinkUrl}`);
  if (!publicBase || !thinkUrl.startsWith(publicBase)) {
    console.error("FAIL: think endpoint is not built from BYO_LLM_PUBLIC_URL");
    return 1;
  }

  const voiceUrl = clientVoiceWsUrl(config);
  let failed = 0;
  try {
    const unauthStatus = await expectUnauthorized(
      voiceUrl,
      config.DEEPGRAM_AGENT_HANDSHAKE_TIMEOUT_MS,
    );
    if (unauthStatus !== 401) {
      console.error(`unauth status=${unauthStatus} FAIL`);
      failed += 1;
    } else {
      console.log("unauth=401 ok");
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error(`unauth FAIL ${detail}`);
    failed += 1;
  }

  const sql = createPostgres(config);
  const redis = createRedis(config);
  let socket: WebSocket | null = null;
  try {
    const users = await sql<
      { id: string; email: string }[]
    >`SELECT id, email FROM users ORDER BY created_at LIMIT 1`;
    const user = users[0];
    if (!user) {
      console.error("FAIL: no app user in the database");
      return 1;
    }
    const authSessionId = await persistAuthSession(redis, config, user.id);
    const cookie = `${config.SESSION_COOKIE_NAME}=${signSessionCookieValue(config, authSessionId)}`;
    console.log(`user=${user.email}`);

    const opened = await new Promise<{
      socket: WebSocket;
      sessionId: string;
      requestId: string | null;
    }>((resolve, reject) => {
      const client = new WebSocket(voiceUrl, { headers: { Cookie: cookie } });
      const timer = setTimeout(() => {
        client.terminate();
        reject(new Error("timed out waiting for voice ready"));
      }, config.DEEPGRAM_AGENT_HANDSHAKE_TIMEOUT_MS);
      client.on("unexpected-response", (_req, res) => {
        clearTimeout(timer);
        const status = res.statusCode ?? 0;
        res.resume();
        reject(new Error(`authed connect HTTP ${status}`));
      });
      client.on("error", (error) => {
        clearTimeout(timer);
        reject(error);
      });
      client.on("message", (data, isBinary) => {
        if (isBinary) {
          return;
        }
        const message = asRecord(
          JSON.parse(socketDataToBuffer(data).toString("utf8")) as unknown,
        );
        if (!message) {
          return;
        }
        if (message.type === config.VOICE_CLIENT_ERROR_TYPE) {
          clearTimeout(timer);
          reject(new Error(`voice error: ${JSON.stringify(message)}`));
          return;
        }
        if (message.type !== config.VOICE_CLIENT_READY_TYPE) {
          return;
        }
        const sessionId =
          typeof message.session_id === "string" ? message.session_id : null;
        if (!sessionId) {
          clearTimeout(timer);
          reject(new Error("voice ready missing session_id"));
          return;
        }
        clearTimeout(timer);
        resolve({
          socket: client,
          sessionId,
          requestId:
            typeof message.request_id === "string" ? message.request_id : null,
        });
      });
    });
    socket = opened.socket;
    console.log(`session_id=${opened.sessionId}`);
    console.log(`request_id=${opened.requestId ?? ""}`);

    const call = await readVoiceCallState(redis, config, opened.sessionId);
    if (!call || call.session_id !== opened.sessionId) {
      console.error("redis_call_state=FAIL");
      failed += 1;
    } else {
      console.log(
        `redis_call_state=ok request_id=${call.request_id ?? ""} barge_in=${call.barge_in}`,
      );
    }

    const sessions = await sql<
      { channel: string }[]
    >`SELECT channel FROM sessions WHERE id = ${opened.sessionId}`;
    const channel = sessions[0]?.channel;
    if (channel !== SESSION_CHANNEL.VOICE) {
      console.error(`session_channel=${channel ?? "missing"} FAIL`);
      failed += 1;
    } else {
      console.log("session_channel=voice ok");
    }

    const audio = await new Promise<{ bytes: number; events: string[] }>(
      (resolve, reject) => {
        const events: string[] = [];
        let bytes = 0;
        const timer = setTimeout(() => {
          reject(
            new Error(
              `timed out waiting for spoken audio events=${events.join(",")}`,
            ),
          );
        }, config.VOICE_INJECT_TIMEOUT_MS);
        socket?.on("message", (data, isBinary) => {
          if (isBinary) {
            bytes += socketDataToBuffer(data).length;
            if (bytes > 0) {
              clearTimeout(timer);
              resolve({ bytes, events });
            }
            return;
          }
          const message = asRecord(
            JSON.parse(socketDataToBuffer(data).toString("utf8")) as unknown,
          );
          if (!message) {
            return;
          }
          if (message.type === config.VOICE_CLIENT_ERROR_TYPE) {
            clearTimeout(timer);
            reject(new Error(`voice error: ${JSON.stringify(message)}`));
            return;
          }
          if (message.type === config.VOICE_CLIENT_WARNING_TYPE) {
            console.log(`warning=${JSON.stringify(message.event ?? message)}`);
            return;
          }
          if (message.type === config.VOICE_CLIENT_AGENT_EVENT_TYPE) {
            const event = asRecord(message.event);
            const eventType =
              event && typeof event.type === "string" ? event.type : "unknown";
            events.push(eventType);
            console.log(`agent_event=${eventType}`);
          }
        });
        socket?.on("close", () => {
          clearTimeout(timer);
          reject(
            new Error(`socket closed before audio events=${events.join(",")}`),
          );
        });
        socket?.send(
          JSON.stringify({
            type: config.DEEPGRAM_MSG_INJECT_USER,
            content: config.VOICE_INJECT_TEXT,
          }),
        );
        console.log("inject=sent");
      },
    );
    console.log(`audio_bytes=${audio.bytes}`);

    const turns = await sql<
      { ordinal: number; speaker: string; controller_action: string | null }[]
    >`
      SELECT ordinal, speaker, text, controller_action
      FROM turns
      WHERE session_id = ${opened.sessionId}
      ORDER BY ordinal
    `;
    for (const row of turns) {
      console.log(
        `row ordinal=${row.ordinal} speaker=${row.speaker} action=${row.controller_action}`,
      );
    }
    if (turns.length < 2) {
      console.error(
        "FAIL: expected persisted user and persona turns on the voice session",
      );
      failed += 1;
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error(`FAIL: ${detail}`);
    failed += 1;
  } finally {
    socket?.close();
    await redis.quit();
    await sql.end({ timeout: 5 });
  }

  if (failed) {
    console.error(`FAIL: ${failed} check(s)`);
    return 1;
  }
  console.log("PROBE_OK");
  return 0;
}

const code = await main();
process.exit(code);
