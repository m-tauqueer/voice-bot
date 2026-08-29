from __future__ import annotations

import os
from pathlib import Path
from typing import Literal

from pydantic import Field, HttpUrl, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


def env_file_path() -> Path:
    override = os.environ.get("ENV_FILE")
    if override:
        return Path(override)
    return Path(__file__).resolve().parents[3] / ".env"


def _empty_to_none(value: str | None) -> str | None:
    if value is None:
        return None
    stripped = value.strip()
    return stripped or None


class WorkerSettings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=env_file_path(),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    node_env: Literal["development", "production", "test"]
    log_level: str
    worker_host: str
    worker_port: int = Field(gt=0)
    database_url: str = Field(min_length=1)
    internal_api_secret: str = Field(min_length=16)
    internal_secret_header: str = Field(default="x-internal-secret")
    engram_api_key: str | None = None
    engram_org_id: str | None = None
    engram_base_url: HttpUrl | None = None
    engram_timeout_seconds: int = Field(default=120, gt=0)
    engram_message_join: str = Field(default=" ")
    engram_read_max_retries: int = Field(default=2, ge=0)
    engram_persona_id: str | None = None
    admin_ingest_max_bytes: int = Field(default=8388608, gt=0)
    openai_api_key: str | None = None
    openai_model: str | None = None
    openai_base_url: str | None = None

    @field_validator("internal_secret_header", mode="before")
    @classmethod
    def default_internal_header(cls, value: object) -> object:
        if isinstance(value, str) and value.strip() == "":
            return "x-internal-secret"
        return value

    @field_validator(
        "engram_api_key",
        "engram_org_id",
        "engram_persona_id",
        "openai_api_key",
        "openai_model",
        "openai_base_url",
        mode="before",
    )
    @classmethod
    def blank_optional(cls, value: object) -> object:
        if not isinstance(value, str):
            return value
        return _empty_to_none(value)

    @field_validator("engram_base_url", mode="before")
    @classmethod
    def blank_engram_url(cls, value: object) -> object:
        if not isinstance(value, str):
            return value
        return _empty_to_none(value)

    @field_validator("engram_message_join", mode="before")
    @classmethod
    def default_message_join(cls, value: object) -> object:
        if value is None:
            return " "
        if isinstance(value, str) and value == "":
            return " "
        return value


def load_settings() -> WorkerSettings:
    try:
        return WorkerSettings()
    except Exception as exc:
        raise RuntimeError(f"Invalid worker environment: {exc}") from exc
