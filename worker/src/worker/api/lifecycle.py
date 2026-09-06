from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from worker.api.internal_auth import require_internal_secret
from worker.config import WorkerSettings
from worker.lifecycle.purge import purge_private_pool


class PurgeIn(BaseModel):
    engram_user_id: str = Field(min_length=1)
    engram_persona_id: str = Field(min_length=1)


class PurgeOut(BaseModel):
    engram: str
    forgotten: int
    unsubscribed: bool


def build_lifecycle_router(settings: WorkerSettings) -> APIRouter:
    guard = require_internal_secret(settings)
    router = APIRouter(dependencies=[Depends(guard)])

    @router.post("/internal/lifecycle/purge", response_model=PurgeOut)
    def purge(body: PurgeIn) -> PurgeOut:
        result = purge_private_pool(
            settings,
            engram_user_id=body.engram_user_id,
            engram_persona_id=body.engram_persona_id,
        )
        return PurgeOut(
            engram=str(result["engram"]),
            forgotten=int(result["forgotten"]),
            unsubscribed=bool(result["unsubscribed"]),
        )

    return router
