import type { FastifyInstance, FastifyReply } from "fastify";
import type { Redis } from "ioredis";
import type postgres from "postgres";
import { z } from "zod";
import { touchChatActivity } from "../chat/activity.js";
import { createTextSession, getSessionForUser } from "../chat/sessions.js";
import { listTurnsForUser } from "../chat/turns.js";
import { callWorker } from "../clients/worker.js";
import type { GatewayConfig } from "../config.js";
import { MultiplePersonasError, resolveActivePersona } from "../personas.js";
import { redisQuiet } from "../voice/redisSafe.js";

type Sql = ReturnType<typeof postgres>;

const chatBodySchema = z.object({
  text: z.string().min(1),
  session_id: z.string().uuid().optional(),
});

const chatQuerySchema = z.object({
  session_id: z.string().uuid().optional(),
});

function personaPayload(
  persona: NonNullable<Awaited<ReturnType<typeof resolveActivePersona>>>,
) {
  return {
    id: persona.id,
    handle: persona.handle,
    display_name: persona.displayName,
    description: persona.description,
  };
}

async function sendWorker(reply: FastifyReply, response: Response) {
  const text = await response.text();
  let body: unknown = null;
  if (text.length > 0) {
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      body = { error: "worker_error" };
    }
  }
  if (body && typeof body === "object" && "detail" in body) {
    const detail = (body as { detail: unknown }).detail;
    if (detail && typeof detail === "object") {
      body = detail;
    } else if (typeof detail === "string") {
      body = { error: detail };
    }
  }
  return reply.code(response.status).send(body);
}

export async function registerChatRoutes(
  app: FastifyInstance,
  deps: { config: GatewayConfig; sql: Sql; redis: Redis },
): Promise<void> {
  const { config, sql, redis } = deps;

  app.get("/api/chat", async (request, reply) => {
    const user = request.appUser;
    if (!user) {
      return reply.code(401).send({ error: "unauthorized" });
    }
    const parsed = chatQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid query" });
    }
    let persona: Awaited<ReturnType<typeof resolveActivePersona>>;
    try {
      persona = await resolveActivePersona(sql, config);
    } catch (error) {
      if (error instanceof MultiplePersonasError) {
        return reply.code(409).send({ error: "multiple personas" });
      }
      request.log.error({ err: error }, "chat persona lookup failed");
      return reply.code(503).send({
        error: config.FAILURE_MESSAGE_DATABASE,
        code: config.FAILURE_CODE_DATABASE,
      });
    }
    if (!persona) {
      return reply.code(404).send({ error: "persona not recorded" });
    }
    if (!parsed.data.session_id) {
      return { persona: personaPayload(persona), turns: [] as const };
    }
    let turns: Awaited<ReturnType<typeof listTurnsForUser>>;
    try {
      turns = await listTurnsForUser(sql, parsed.data.session_id, user.id);
    } catch (error) {
      request.log.error({ err: error }, "chat history lookup failed");
      return reply.code(503).send({
        error: config.FAILURE_MESSAGE_DATABASE,
        code: config.FAILURE_CODE_DATABASE,
      });
    }
    if (turns === null) {
      return reply.code(404).send({ error: "session not found" });
    }
    return {
      persona: personaPayload(persona),
      session_id: parsed.data.session_id,
      turns,
    };
  });

  app.post("/api/chat", async (request, reply) => {
    const user = request.appUser;
    if (!user) {
      return reply.code(401).send({ error: "unauthorized" });
    }
    const parsed = chatBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid body" });
    }

    let persona: Awaited<ReturnType<typeof resolveActivePersona>>;
    try {
      persona = await resolveActivePersona(sql, config);
    } catch (error) {
      if (error instanceof MultiplePersonasError) {
        return reply.code(409).send({ error: "multiple personas" });
      }
      request.log.error({ err: error }, "chat persona lookup failed");
      return reply.code(503).send({
        error: config.FAILURE_MESSAGE_DATABASE,
        code: config.FAILURE_CODE_DATABASE,
      });
    }
    if (!persona) {
      return reply.code(404).send({ error: "persona not recorded" });
    }

    let session: Awaited<ReturnType<typeof getSessionForUser>>;
    try {
      if (parsed.data.session_id) {
        session = await getSessionForUser(sql, parsed.data.session_id, user.id);
        if (!session) {
          return reply.code(404).send({ error: "session not found" });
        }
        if (session.endedAt) {
          return reply.code(409).send({ error: "session has ended" });
        }
        if (session.personaId !== persona.id) {
          return reply.code(409).send({ error: "session persona mismatch" });
        }
      } else {
        session = await createTextSession(sql, user.id, persona.id);
      }
    } catch (error) {
      request.log.error({ err: error }, "chat session lookup failed");
      return reply.code(503).send({
        error: config.FAILURE_MESSAGE_DATABASE,
        code: config.FAILURE_CODE_DATABASE,
      });
    }

    const activity = await redisQuiet(
      request.log,
      config,
      "touchChatActivity",
      session.id,
      () => touchChatActivity(redis, config, session.id),
    );
    if (activity === null) {
      request.log.error({ sessionId: session.id }, "chat activity not stored");
    }

    const response = await callWorker(config, "/internal/turn", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        app_user_id: user.id,
        engram_user_id: user.engramUserId,
        persona_id: persona.id,
        session_id: session.id,
        text: parsed.data.text,
      }),
    });
    return sendWorker(reply, response);
  });
}
