import type postgres from "postgres";
import type { GatewayConfig } from "./config.js";

type Sql = ReturnType<typeof postgres>;

export type ActivePersona = {
  id: string;
  engramPersonaId: string;
  handle: string;
  displayName: string;
  description: string | null;
};

function mapPersona(row: {
  id: string;
  engram_persona_id: string;
  handle: string;
  display_name: string;
  description: string | null;
}): ActivePersona {
  return {
    id: row.id,
    engramPersonaId: row.engram_persona_id,
    handle: row.handle,
    displayName: row.display_name,
    description: row.description,
  };
}

export async function resolveActivePersona(
  sql: Sql,
  config: GatewayConfig,
): Promise<ActivePersona | null> {
  const rows = await sql<
    {
      id: string;
      engram_persona_id: string;
      handle: string;
      display_name: string;
      description: string | null;
    }[]
  >`
    SELECT id, engram_persona_id, handle, display_name, description
    FROM personas
    ORDER BY created_at
  `;
  if (rows.length === 0) {
    return null;
  }
  if (rows.length === 1 && rows[0]) {
    return mapPersona(rows[0]);
  }
  if (config.ENGRAM_PERSONA_ID) {
    const matches = rows.filter(
      (row) => row.engram_persona_id === config.ENGRAM_PERSONA_ID,
    );
    if (matches.length === 1 && matches[0]) {
      return mapPersona(matches[0]);
    }
  }
  throw new Error("multiple personas are stored; set ENGRAM_PERSONA_ID");
}
