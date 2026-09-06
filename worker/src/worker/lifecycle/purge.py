from __future__ import annotations

from typing import Any, Protocol

import structlog

from worker.config import WorkerSettings
from worker.engram.errors import BrainError
from worker.engram.factory import create_org_engram
from worker.lifecycle.gids import memory_gids, next_cursor

log = structlog.get_logger(__name__)


class PersonaForgetSurface(Protocol):
    def user_memories(self, persona_id: str, user_id: str, **params: Any) -> Any: ...

    def forget_user_memory(
        self,
        persona_id: str,
        user_id: str,
        gid: int | str,
    ) -> Any: ...

    def unsubscribe(self, persona_id: str, user_id: str) -> Any: ...


def purge_private_pool(
    settings: WorkerSettings,
    *,
    engram_user_id: str,
    engram_persona_id: str,
    personas: PersonaForgetSurface | None = None,
) -> dict[str, object]:
    if personas is None and (
        not settings.engram_api_key
        or not settings.engram_org_id
        or settings.engram_base_url is None
    ):
        return {
            "engram": "skipped",
            "forgotten": 0,
            "unsubscribed": False,
        }
    client = None
    surface = personas
    if surface is None:
        client = create_org_engram(settings)
        surface = client.personas
    forgotten = 0
    failed = 0
    try:
        cursor: str | None = None
        while True:
            params: dict[str, object] = {
                "limit": settings.lifecycle_memory_page_size,
            }
            if cursor:
                params["cursor"] = cursor
            page = surface.user_memories(
                engram_persona_id,
                engram_user_id,
                **params,
            )
            for gid in memory_gids(page):
                try:
                    surface.forget_user_memory(
                        engram_persona_id,
                        engram_user_id,
                        gid,
                    )
                    forgotten += 1
                except BrainError:
                    failed += 1
                    log.warning(
                        "engram forget failed",
                        gid=str(gid),
                        user_id=engram_user_id,
                    )
                except Exception:
                    failed += 1
                    log.warning(
                        "engram forget failed",
                        gid=str(gid),
                        user_id=engram_user_id,
                    )
            cursor = next_cursor(page)
            if not cursor:
                break
        unsubscribed = False
        try:
            surface.unsubscribe(engram_persona_id, engram_user_id)
            unsubscribed = True
        except Exception:
            log.warning("engram unsubscribe failed", user_id=engram_user_id)
        status = "ok" if failed == 0 else "partial"
        return {
            "engram": status,
            "forgotten": forgotten,
            "unsubscribed": unsubscribed,
        }
    finally:
        if client is not None:
            client.close()
