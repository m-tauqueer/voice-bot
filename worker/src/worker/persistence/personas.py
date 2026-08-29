from __future__ import annotations

from typing import Any
from uuid import UUID

import psycopg

PersonaRow = dict[str, Any]


def get_persona(conn: psycopg.Connection, persona_id: UUID) -> PersonaRow | None:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, engram_persona_id, handle, display_name, description,
                   voice_config
            FROM personas
            WHERE id = %s
            """,
            (str(persona_id),),
        )
        return cur.fetchone()
