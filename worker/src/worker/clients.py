from __future__ import annotations

import psycopg
from engram_sdk import EngramClient
from openai import OpenAI

from worker.config import WorkerSettings


def create_postgres(settings: WorkerSettings) -> psycopg.Connection:
    return psycopg.connect(settings.database_url)


def create_engram(settings: WorkerSettings, user_id: str) -> EngramClient:
    if (
        not settings.engram_api_key
        or not settings.engram_org_id
        or settings.engram_base_url is None
    ):
        raise RuntimeError(
            "Engram is not configured (ENGRAM_API_KEY, ENGRAM_ORG_ID, ENGRAM_BASE_URL)",
        )
    return EngramClient(
        settings.engram_org_id,
        user_id,
        api_key=settings.engram_api_key,
        base_url=str(settings.engram_base_url),
        timeout=float(settings.engram_timeout_seconds),
    )


def create_openai(settings: WorkerSettings) -> OpenAI:
    if not settings.openai_api_key or not settings.openai_model:
        raise RuntimeError("OpenAI is not configured (OPENAI_API_KEY, OPENAI_MODEL)")
    if settings.openai_base_url:
        return OpenAI(
            api_key=settings.openai_api_key,
            base_url=settings.openai_base_url,
        )
    return OpenAI(api_key=settings.openai_api_key)
