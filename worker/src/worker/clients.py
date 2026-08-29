from __future__ import annotations

import psycopg
from openai import OpenAI

from worker.config import WorkerSettings


def create_postgres(settings: WorkerSettings) -> psycopg.Connection:
    return psycopg.connect(settings.database_url)


def openai_base_url(settings: WorkerSettings) -> str | None:
    return settings.openai_base_url or settings.openai_api_base_url


def create_openai(settings: WorkerSettings) -> OpenAI:
    if not settings.openai_api_key:
        raise RuntimeError("OpenAI is not configured (OPENAI_API_KEY)")
    base_url = openai_base_url(settings)
    if base_url:
        return OpenAI(api_key=settings.openai_api_key, base_url=base_url)
    return OpenAI(api_key=settings.openai_api_key)
