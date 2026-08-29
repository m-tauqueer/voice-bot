from __future__ import annotations

from engram_sdk import EngramClient

from worker.config import WorkerSettings


def create_engram(settings: WorkerSettings, user_id: str) -> EngramClient:
    if (
        not settings.engram_api_key
        or not settings.engram_org_id
        or settings.engram_base_url is None
    ):
        raise RuntimeError(
            "Engram is not configured (ENGRAM_API_KEY, ENGRAM_ORG_ID, ENGRAM_BASE_URL)",
        )
    # max_retries=0: write retries are never delegated to the SDK.
    return EngramClient(
        settings.engram_org_id,
        user_id,
        api_key=settings.engram_api_key,
        base_url=str(settings.engram_base_url),
        timeout=float(settings.engram_timeout_seconds),
        max_retries=0,
    )
