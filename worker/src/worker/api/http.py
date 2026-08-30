from __future__ import annotations

from typing import NoReturn

from fastapi import HTTPException

from worker.turn.errors import TurnError


def raise_turn(exc: TurnError) -> NoReturn:
    raise HTTPException(
        status_code=exc.status,
        detail={"error": str(exc), "reason": exc.reason},
    ) from exc
