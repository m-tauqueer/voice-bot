import type postgres from "postgres";
import type { GatewayConfig } from "./config.js";

type Sql = ReturnType<typeof postgres>;

export type ActivePersona = {
  id: string;
  engramPersonaId: string;
};

export async function resolveActivePersona(
  sql: Sql,
  config: GatewayConfig,
): Promise<ActivePersona | null> {
  const rows = await sql<{ id: string; engram_persona_id: string }[]>`
    SELECT id, engram_persona_id
    FROM personas
    ORDER BY created_at
  `;
  if (rows.length === 0) {
    return null;
  }
  if (rows.length === 1 && rows[0]) {
    return { id: rows[0].id, engramPersonaId: rows[0].engram_persona_id };
  }
  if (config.ENGRAM_PERSONA_ID) {
    const matches = rows.filter(
      (row) => row.engram_persona_id === config.ENGRAM_PERSONA_ID,
    );
    if (matches.length === 1 && matches[0]) {
      return {
        id: matches[0].id,
        engramPersonaId: matches[0].engram_persona_id,
      };
    }
  }
  throw new Error("multiple personas are stored; set ENGRAM_PERSONA_ID");
}
