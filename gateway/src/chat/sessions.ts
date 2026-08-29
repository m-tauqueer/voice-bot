import type postgres from "postgres";
import { SESSION_CHANNEL } from "../schema.js";

type Sql = ReturnType<typeof postgres>;

export type ChatSession = {
  id: string;
  userId: string;
  personaId: string;
  endedAt: Date | null;
};

export async function createTextSession(
  sql: Sql,
  userId: string,
  personaId: string,
): Promise<ChatSession> {
  const rows = await sql<
    {
      id: string;
      user_id: string;
      persona_id: string;
      ended_at: Date | null;
    }[]
  >`
    INSERT INTO sessions (user_id, persona_id, channel)
    VALUES (${userId}, ${personaId}, ${SESSION_CHANNEL.TEXT})
    RETURNING id, user_id, persona_id, ended_at
  `;
  const row = rows[0];
  if (!row) {
    throw new Error("session insert returned no row");
  }
  return {
    id: row.id,
    userId: row.user_id,
    personaId: row.persona_id,
    endedAt: row.ended_at,
  };
}

export async function getSessionForUser(
  sql: Sql,
  sessionId: string,
  userId: string,
): Promise<ChatSession | null> {
  const rows = await sql<
    {
      id: string;
      user_id: string;
      persona_id: string;
      ended_at: Date | null;
    }[]
  >`
    SELECT id, user_id, persona_id, ended_at
    FROM sessions
    WHERE id = ${sessionId}
  `;
  const row = rows[0];
  if (!row) {
    return null;
  }
  if (row.user_id !== userId) {
    return null;
  }
  return {
    id: row.id,
    userId: row.user_id,
    personaId: row.persona_id,
    endedAt: row.ended_at,
  };
}
