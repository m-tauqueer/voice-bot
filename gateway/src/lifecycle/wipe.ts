import type postgres from "postgres";

type Sql = ReturnType<typeof postgres>;

export async function listUserAudioUrls(
  sql: Sql,
  userId: string,
): Promise<string[]> {
  const rows = await sql<{ blob_url: string }[]>`
    SELECT a.blob_url
    FROM audio_assets a
    INNER JOIN turns t ON t.id = a.turn_id
    INNER JOIN sessions s ON s.id = t.session_id
    WHERE s.user_id = ${userId}
  `;
  return rows.map((row) => row.blob_url);
}

export async function listPersonaAudioUrls(
  sql: Sql,
  personaId: string,
): Promise<string[]> {
  const rows = await sql<{ blob_url: string }[]>`
    SELECT a.blob_url
    FROM audio_assets a
    INNER JOIN turns t ON t.id = a.turn_id
    INNER JOIN sessions s ON s.id = t.session_id
    WHERE s.persona_id = ${personaId}
  `;
  return rows.map((row) => row.blob_url);
}

export async function wipeMemberRows(
  sql: Sql,
  userId: string,
): Promise<{ sessions: number }> {
  const deleted = await sql`
    DELETE FROM sessions
    WHERE user_id = ${userId}
    RETURNING id
  `;
  await sql`
    DELETE FROM subscriptions
    WHERE user_id = ${userId}
  `;
  await sql`
    DELETE FROM users
    WHERE id = ${userId}
  `;
  return { sessions: deleted.length };
}
