from __future__ import annotations

import psycopg
from openai import OpenAI

from worker.config import WorkerSettings


def create_postgres(settings: WorkerSettings) -> psycopg.Connection:
    return psycopg.connect(settings.database_url)


def create_openai(settings: WorkerSettings) -> OpenAI:
    if not settings.openai_api_key or not settings.openai_model:
        raise RuntimeError("OpenAI is not configured (OPENAI_API_KEY, OPENAI_MODEL)")
    if settings.openai_base_url:
        return OpenAI(
            api_key=settings.openai_api_key,
            base_url=settings.openai_base_url,
        )
    return OpenAI(api_key=settings.openai_api_key)
