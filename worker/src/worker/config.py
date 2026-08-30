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
    engram_client_cache_size: int = Field(default=8, gt=0)
    # "retrieve" reads memory and lets the answer model compose the reply,
    # writing the turn back with converse. "chat" lets Engram compose it, which
    # costs about ten more seconds a turn.
    brain_mode: Literal["chat", "retrieve"] = "retrieve"
    engram_retrieve_top_k: int = Field(default=25, gt=0)
    engram_converse_writeback: bool = Field(default=True)
    engram_writeback_workers: int = Field(default=2, gt=0)
    engram_converse_user_speaker: str = Field(default="user", min_length=1)
    engram_converse_persona_speaker: str = Field(default="persona", min_length=1)
    engram_persona_id: str | None = None
    db_pool_min_size: int = Field(default=1, ge=0)
    db_pool_max_size: int = Field(default=8, gt=0)
    db_pool_timeout_seconds: float = Field(default=10, gt=0)
    db_pool_max_idle_seconds: float = Field(default=300, gt=0)
    admin_ingest_max_bytes: int = Field(default=8388608, gt=0)
    openai_api_key: str | None = None
    openai_model: str = Field(default="gpt-4o-mini")
    openai_base_url: str | None = None
    openai_api_base_url: str | None = None
    reframe_history_turns: int = Field(default=8, ge=0)
    reframe_temperature: float = Field(default=0.2, ge=0, le=2)
    reframe_max_tokens: int = Field(default=256, gt=0)
    reframe_timeout_seconds: float = Field(default=30, gt=0)
    reframe_stream_enabled: bool = Field(default=True)
    reframe_system_prompt: str | None = None
    answer_system_prompt: str | None = None
    answer_max_tokens: int = Field(default=320, gt=0)
    byo_llm_chat_completions_path: str = Field(
        default="/v1/chat/completions",
        min_length=1,
    )
    byo_llm_app_user_header: str = Field(default="x-app-user-id", min_length=1)
    byo_llm_engram_user_header: str = Field(
        default="x-engram-user-id",
        min_length=1,
    )
    byo_llm_persona_header: str = Field(default="x-persona-id", min_length=1)
    byo_llm_session_header: str = Field(default="x-session-id", min_length=1)
    byo_llm_user_role: str = Field(default="user", min_length=1)
    byo_llm_assistant_role: str = Field(default="assistant", min_length=1)
    byo_llm_text_part_type: str = Field(default="text", min_length=1)
    byo_llm_completion_object: str = Field(
        default="chat.completion",
        min_length=1,
    )
    byo_llm_chunk_object: str = Field(
        default="chat.completion.chunk",
        min_length=1,
    )
    byo_llm_finish_reason: str = Field(default="stop", min_length=1)
    byo_llm_completion_id_prefix: str = Field(default="chatcmpl-", min_length=1)
    byo_llm_sse_done: str = Field(default="[DONE]", min_length=1)
    byo_llm_sse_media_type: str = Field(
        default="text/event-stream",
        min_length=1,
    )

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
        "openai_base_url",
        "openai_api_base_url",
        "reframe_system_prompt",
        "answer_system_prompt",
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

    @field_validator("openai_model", mode="before")
    @classmethod
    def default_openai_model(cls, value: object) -> object:
        if value is None:
            return "gpt-4o-mini"
        if isinstance(value, str) and value.strip() == "":
            return "gpt-4o-mini"
        return value

    @field_validator("byo_llm_chat_completions_path")
    @classmethod
    def completions_path_absolute(cls, value: str) -> str:
        if not value.startswith("/"):
            raise ValueError("BYO_LLM_CHAT_COMPLETIONS_PATH must start with /")
        return value


def load_settings() -> WorkerSettings:
    try:
        return WorkerSettings()
    except Exception as exc:
        raise RuntimeError(f"Invalid worker environment: {exc}") from exc
