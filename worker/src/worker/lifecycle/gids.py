from __future__ import annotations

from typing import Any


def memory_rows(payload: object) -> list[dict[str, Any]]:
    if isinstance(payload, list):
        return [row for row in payload if isinstance(row, dict)]
    if not isinstance(payload, dict):
        return []
    for key in ("memories", "results", "items"):
        value = payload.get(key)
        if isinstance(value, list):
            return [row for row in value if isinstance(row, dict)]
    return []


def memory_gids(payload: object) -> list[int | str]:
    gids: list[int | str] = []
    seen: set[str] = set()
    for row in memory_rows(payload):
        gid = row.get("gid")
        if gid is None:
            gid = row.get("id")
        if isinstance(gid, bool) or not isinstance(gid, (int, str)):
            continue
        key = str(gid)
        if key in seen:
            continue
        seen.add(key)
        gids.append(gid)
    return gids


def next_cursor(payload: object) -> str | None:
    if not isinstance(payload, dict):
        return None
    value = payload.get("next_cursor")
    return value if isinstance(value, str) and value.strip() else None
