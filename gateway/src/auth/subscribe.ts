import type { FastifyBaseLogger } from "fastify";
import type postgres from "postgres";
import { z } from "zod";
import type { GatewayConfig } from "../config.js";
import type { AppUser } from "./types.js";
import {
  findPersonaIdByEngramId,
  hasActiveSubscription,
  upsertActiveSubscription,
} from "./users.js";

type Sql = ReturnType<typeof postgres>;

const subscribeResponseSchema = z.object({
  subscribed: z.boolean(),
  reason: z.string().nullable().optional(),
});

export async function requestPersonaSubscribe(
  config: GatewayConfig,
  params: { engramUserId: string; personaId: string },
): Promise<{ subscribed: boolean; reason?: string | null }> {
  const url = new URL("/internal/subscribe", config.WORKER_URL);
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      [config.INTERNAL_SECRET_HEADER]: config.INTERNAL_API_SECRET,
    },
    body: JSON.stringify({
      engram_user_id: params.engramUserId,
      persona_id: params.personaId,
    }),
    signal: AbortSignal.timeout(config.WORKER_HTTP_TIMEOUT_MS),
  });
  if (!response.ok) {
    return { subscribed: false, reason: `http_${response.status}` };
  }
  const parsed = subscribeResponseSchema.safeParse(await response.json());
  if (!parsed.success) {
    return { subscribed: false, reason: "invalid_response" };
  }
  return parsed.data;
}

export async function subscribeUserToActivePersona(
  sql: Sql,
  config: GatewayConfig,
  user: AppUser,
  log: FastifyBaseLogger,
): Promise<void> {
  const engramPersonaId = config.ENGRAM_PERSONA_ID;
  if (!engramPersonaId) {
    return;
  }
  const localPersonaId = await findPersonaIdByEngramId(sql, engramPersonaId);
  if (
    localPersonaId &&
    (await hasActiveSubscription(sql, user.id, localPersonaId))
  ) {
    return;
  }
  try {
    const result = await requestPersonaSubscribe(config, {
      engramUserId: user.engramUserId,
      personaId: engramPersonaId,
    });
    if (result.subscribed && localPersonaId) {
      await upsertActiveSubscription(sql, user.id, localPersonaId);
    }
    if (!result.subscribed) {
      log.warn(
        { reason: result.reason ?? undefined },
        "persona subscribe skipped",
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    log.warn({ err: message }, "persona subscribe failed");
  }
}
