from __future__ import annotations

from typing import NoReturn
from uuid import UUID

from fastapi import HTTPException, Request

from worker.config import WorkerSettings
from worker.turn.errors import TurnError


def raise_turn(exc: TurnError) -> NoReturn:
    raise HTTPException(
        status_code=exc.status,
        detail={
            "error": str(exc),
            "reason": exc.reason,
            "code": exc.code,
        },
    ) from exc


def read_correlation_id(
    request: Request,
    settings: WorkerSettings,
) -> UUID | None:
    raw = request.headers.get(settings.correlation_id_header)
    if raw is None or not raw.strip():
        return None
    try:
        return UUID(raw.strip())
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail={"error": "invalid correlation header"},
        ) from exc
