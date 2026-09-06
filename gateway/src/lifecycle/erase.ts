import type { FastifyBaseLogger } from "fastify";
import type postgres from "postgres";
import type { AppUser } from "../auth/types.js";
import { callWorker } from "../clients/worker.js";
import type { GatewayConfig } from "../config.js";
import { MultiplePersonasError, resolveActivePersona } from "../personas.js";
import { deleteAudioBlobs } from "./blobs.js";
import { listUserAudioUrls, wipeMemberRows } from "./wipe.js";

type Sql = ReturnType<typeof postgres>;

export async function eraseMemberAccount(
  sql: Sql,
  config: GatewayConfig,
  log: FastifyBaseLogger,
  user: AppUser,
): Promise<{ sessions: number; engram: string }> {
  let engram = "skipped";
  try {
    const persona = await resolveActivePersona(sql, config);
    if (persona) {
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
          engram = typeof body.engram === "string" ? body.engram : "ok";
        } else {
          log.warn(
            { status: response.status, userId: user.id },
            "engram purge request failed",
          );
          engram = "failed";
        }
      } catch (error) {
        log.warn({ err: error, userId: user.id }, "engram purge unavailable");
        engram = "failed";
      }
    }
  } catch (error) {
    if (error instanceof MultiplePersonasError) {
      log.warn({ userId: user.id }, "engram purge skipped: multiple personas");
    } else {
      log.warn(
        { err: error, userId: user.id },
        "engram purge persona lookup failed",
      );
    }
  }
  const urls = await listUserAudioUrls(sql, user.id);
  await deleteAudioBlobs(config, urls, log);
  const wiped = await wipeMemberRows(sql, user.id);
  return { sessions: wiped.sessions, engram };
}
