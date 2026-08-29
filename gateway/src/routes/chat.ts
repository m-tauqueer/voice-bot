import type { FastifyInstance, FastifyReply } from "fastify";
import type { Redis } from "ioredis";
import type postgres from "postgres";
import { z } from "zod";
import { touchChatActivity } from "../chat/activity.js";
import { createTextSession, getSessionForUser } from "../chat/sessions.js";
import { callWorker } from "../clients/worker.js";
import type { GatewayConfig } from "../config.js";
import { resolveActivePersona } from "../personas.js";

type Sql = ReturnType<typeof postgres>;

const chatBodySchema = z.object({
  text: z.string().min(1),
  session_id: z.string().uuid().optional(),
});

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
    } catch {
      return reply.code(409).send({ error: "multiple personas" });
    }
    if (!persona) {
      return reply.code(404).send({ error: "persona not recorded" });
    }

    let session: Awaited<ReturnType<typeof getSessionForUser>>;
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

    await touchChatActivity(redis, config, session.id);

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
