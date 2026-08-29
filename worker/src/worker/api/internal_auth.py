from __future__ import annotations

import secrets
from collections.abc import Callable

from fastapi import HTTPException, Request

from worker.config import WorkerSettings


def require_internal_secret(
    settings: WorkerSettings,
) -> Callable[[Request], None]:
    def _guard(request: Request) -> None:
        provided = request.headers.get(settings.internal_secret_header)
        expected = settings.internal_api_secret
        if provided is None or not _digest_equal(provided, expected):
            raise HTTPException(status_code=401, detail="unauthorized")

    return _guard


def _digest_equal(provided: str, expected: str) -> bool:
    if len(provided) != len(expected):
        secrets.compare_digest(expected, expected)
        return False
    return secrets.compare_digest(provided, expected)
