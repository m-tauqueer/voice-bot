from __future__ import annotations

import structlog
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from worker.api.internal_auth import require_internal_secret
from worker.config import WorkerSettings
from worker.engram.engram_brain import EngramBrain
from worker.engram.errors import BrainError, ConflictError, ForbiddenError

log = structlog.get_logger("worker.subscribe")


class SubscribeIn(BaseModel):
    engram_user_id: str = Field(min_length=1)
    persona_id: str = Field(min_length=1)


class SubscribeOut(BaseModel):
    subscribed: bool
    reason: str | None = None


def build_subscribe_router(settings: WorkerSettings) -> APIRouter:
    guard = require_internal_secret(settings)
    router = APIRouter(dependencies=[Depends(guard)])

    @router.post("/internal/subscribe", response_model=SubscribeOut)
    def subscribe(body: SubscribeIn) -> SubscribeOut:
        if (
            not settings.engram_api_key
            or not settings.engram_org_id
            or settings.engram_base_url is None
        ):
            return SubscribeOut(subscribed=False, reason="engram_not_configured")

        brain = EngramBrain(settings, "")
        try:
            brain.subscribe(body.persona_id, body.engram_user_id)
            return SubscribeOut(subscribed=True)
        except ConflictError:
            return SubscribeOut(subscribed=True, reason="already")
        except ForbiddenError:
            log.warning("subscribe_forbidden")
            return SubscribeOut(subscribed=False, reason="forbidden")
        except BrainError as exc:
            log.warning("subscribe_failed", status=exc.status)
            return SubscribeOut(subscribed=False, reason="brain_error")
        except Exception:
            log.exception("subscribe_unexpected")
            return SubscribeOut(subscribed=False, reason="error")
        finally:
            brain.close()

    return router
