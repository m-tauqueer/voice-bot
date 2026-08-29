from __future__ import annotations

from typing import Any

import psycopg
from psycopg.rows import dict_row
from psycopg.types.json import Json

from worker.admin.errors import AdminError
from worker.config import WorkerSettings

PersonaRow = dict[str, Any]
UserRow = dict[str, Any]


def connect(settings: WorkerSettings) -> psycopg.Connection:
    return psycopg.connect(settings.database_url, row_factory=dict_row)


def list_personas(conn: psycopg.Connection) -> list[PersonaRow]:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, engram_persona_id, handle, display_name, description,
                   voice_config, created_at, updated_at
            FROM personas
            ORDER BY created_at
            """,
        )
        return list(cur.fetchall())


def resolve_active_persona(
    conn: psycopg.Connection,
    settings: WorkerSettings,
) -> PersonaRow | None:
    rows = list_personas(conn)
    if len(rows) == 0:
        return None
    if len(rows) == 1:
        return rows[0]
    if settings.engram_persona_id:
        matches = [
            row
            for row in rows
            if row["engram_persona_id"] == settings.engram_persona_id
        ]
        if len(matches) == 1:
            return matches[0]
    raise AdminError(
        "multiple personas are stored; set ENGRAM_PERSONA_ID to select one",
        status=409,
        reason="multiple_personas",
    )


def upsert_persona(
    conn: psycopg.Connection,
    *,
    engram_persona_id: str,
    handle: str,
    display_name: str,
    description: str | None,
    voice_config: dict[str, Any],
) -> PersonaRow:
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO personas (
                  engram_persona_id, handle, display_name, description, voice_config
                )
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (engram_persona_id) DO UPDATE
                SET handle = EXCLUDED.handle,
                    display_name = EXCLUDED.display_name,
                    description = EXCLUDED.description,
                    voice_config = EXCLUDED.voice_config,
                    updated_at = now()
                RETURNING id, engram_persona_id, handle, display_name, description,
                          voice_config, created_at, updated_at
                """,
                (
                    engram_persona_id,
                    handle,
                    display_name,
                    description,
                    Json(voice_config),
                ),
            )
            row = cur.fetchone()
        conn.commit()
    except psycopg.errors.UniqueViolation as exc:
        conn.rollback()
        raise AdminError(
            "handle is already used by another persona",
            status=409,
            reason="handle_conflict",
        ) from exc
    if row is None:
        raise AdminError("persona upsert returned no row", status=500)
    return row


def find_user(conn: psycopg.Connection, identifier: str) -> UserRow | None:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, google_sub, email, engram_user_id
            FROM users
            WHERE email = %s
               OR id::text = %s
               OR engram_user_id = %s
            """,
            (identifier, identifier, identifier),
        )
        return cur.fetchone()


def upsert_subscription(
    conn: psycopg.Connection,
    *,
    user_id: str,
    persona_id: str,
    status: str,
) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO subscriptions (user_id, persona_id, status)
            VALUES (%s, %s, %s)
            ON CONFLICT (user_id, persona_id) DO UPDATE
            SET status = EXCLUDED.status
            """,
            (user_id, persona_id, status),
        )
    conn.commit()


def list_subscriptions(
    conn: psycopg.Connection,
    persona_id: str,
) -> list[dict[str, Any]]:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT s.id, s.status, s.created_at,
                   u.id AS user_id, u.email, u.engram_user_id
            FROM subscriptions s
            JOIN users u ON u.id = s.user_id
            WHERE s.persona_id = %s
            ORDER BY s.created_at
            """,
            (persona_id,),
        )
        return list(cur.fetchall())
