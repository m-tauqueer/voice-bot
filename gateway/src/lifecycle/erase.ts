import type { FastifyBaseLogger } from "fastify";
import type postgres from "postgres";
import type { AppUser } from "../auth/types.js";
import { callWorker } from "../clients/worker.js";
import type { GatewayConfig } from "../config.js";
import { listPersonasUsedByMember } from "../personas.js";
import { deleteAudioBlobs } from "./blobs.js";
import { listUserAudioUrls, wipeMemberRows } from "./wipe.js";

type Sql = ReturnType<typeof postgres>;

export function mergeEngramStatus(current: string, next: string): string {
  if (current === "skipped") {
    return next;
  }
  if (next === "skipped") {
    return current;
  }
  if (current === "ok" && next === "ok") {
    return "ok";
  }
  if (current === "failed" && next === "failed") {
    return "failed";
  }
  return "partial";
}

export async function eraseMemberAccount(
  sql: Sql,
  config: GatewayConfig,
  log: FastifyBaseLogger,
  user: AppUser,
): Promise<{ sessions: number; engram: string }> {
  let engram = "skipped";
  try {
    const personas = await listPersonasUsedByMember(sql, user.id);
    for (const persona of personas) {
      try {
        const response = await callWorker(config, "/internal/lifecycle/purge", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            engram_user_id: user.engramUserId,
            engram_persona_id: persona.engramPersonaId,
          }),
        });
        if (response.ok) {
          const body = (await response.json()) as { engram?: string };
          const next = typeof body.engram === "string" ? body.engram : "ok";
          engram = mergeEngramStatus(engram, next);
        } else {
          log.warn(
            {
              status: response.status,
              userId: user.id,
              personaId: persona.id,
            },
            "engram purge request failed",
          );
          engram = mergeEngramStatus(engram, "failed");
        }
      } catch (error) {
        log.warn(
          { err: error, userId: user.id, personaId: persona.id },
          "engram purge unavailable",
        );
        engram = mergeEngramStatus(engram, "failed");
      }
    }
  } catch (error) {
    log.warn(
      { err: error, userId: user.id },
      "engram purge persona lookup failed",
    );
  }
  const urls = await listUserAudioUrls(sql, user.id);
  await deleteAudioBlobs(config, urls, log);
  const wiped = await wipeMemberRows(sql, user.id);
  return { sessions: wiped.sessions, engram };
}
