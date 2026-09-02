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
    redis_url: str | None = None
    voice_notice_redis_channel: str = Field(default="voice-notice", min_length=1)
    redis_command_timeout_ms: int = Field(default=500, gt=0)
    internal_api_secret: str = Field(min_length=16)
    failure_code_engram: str = Field(default="engram_unavailable", min_length=1)
    failure_code_speaking_llm: str = Field(
        default="speaking_llm_failed",
        min_length=1,
    )
    failure_code_record: str = Field(default="record_lost", min_length=1)
    failure_code_database: str = Field(
        default="database_unavailable",
        min_length=1,
    )
    failure_message_engram: str = Field(
        default=(
            "The persona's memory is unavailable. "
            "Nothing was invented in its place."
        ),
        min_length=1,
    )
    failure_message_speaking_llm: str = Field(
        default=(
            "The reply stopped early. "
            "You heard only the words that were produced."
        ),
        min_length=1,
    )
    failure_message_record: str = Field(
        default=(
            "The reply was delivered but the conversation record "
            "could not be saved."
        ),
        min_length=1,
    )
    failure_message_database: str = Field(
        default=(
            "The conversation record is unavailable. "
            "This turn could not start."
        ),
        min_length=1,
    )
    internal_secret_header: str = Field(default="x-internal-secret")
    correlation_id_header: str = Field(default="x-correlation-id")
    log_turn_fields: str = Field(
        default=(
            "correlation_id,session_id,turn_ids,action,reasons,"
            "brain_ms,reframe_ms,reframe_first_token_ms,brain_mode,recorded"
        ),
        min_length=1,
    )
    log_turn_event: str = Field(default="turn", min_length=1)
    voice_notice_kind_trace: str = Field(default="trace", min_length=1)
    voice_notice_trace_code: str = Field(default="turn_traced", min_length=1)
    voice_notice_trace_message: str = Field(default="Turn recorded.", min_length=1)
    engram_logs_limit: int = Field(default=50, gt=0)
    engram_log_result_denied: str = Field(default="denied", min_length=1)
    engram_log_result_error: str = Field(default="error", min_length=1)
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
    memory_panel_query: str = Field(min_length=1)
    memory_panel_top_k: int = Field(default=25, gt=0)
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

    @field_validator("correlation_id_header", mode="before")
    @classmethod
    def default_correlation_header(cls, value: object) -> object:
        if isinstance(value, str) and value.strip() == "":
            return "x-correlation-id"
        return value

    @field_validator("log_turn_fields")
    @classmethod
    def turn_fields_required(cls, value: str) -> str:
        fields = {
            item.strip()
            for item in value.replace("\n", ",").split(",")
            if item.strip()
        }
        if "correlation_id" not in fields or "session_id" not in fields:
            raise ValueError(
                "LOG_TURN_FIELDS must include correlation_id and session_id",
            )
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
        "redis_url",
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
