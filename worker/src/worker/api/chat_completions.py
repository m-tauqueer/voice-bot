from __future__ import annotations

import time
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, ConfigDict, Field

from worker.api.http import raise_turn
from worker.api.internal_auth import require_internal_secret
from worker.config import WorkerSettings
from worker.turn.errors import TurnError
from worker.turn.openai_completion import (
    completion_payload,
    iter_sse_chunks,
    new_completion_id,
)
from worker.turn.openai_messages import last_user_text
from worker.turn.service import TurnRunner


class ChatMessage(BaseModel):
    model_config = ConfigDict(extra="allow")

    role: str
    content: Any = None


class ChatCompletionsIn(BaseModel):
    model_config = ConfigDict(extra="allow")

    messages: list[ChatMessage] = Field(min_length=1)
    model: str | None = None
    stream: bool = False


def _header(request: Request, name: str) -> str:
    value = request.headers.get(name)
    if value is None or not value.strip():
        raise HTTPException(
            status_code=400,
            detail={"error": "missing identity header", "header": name},
        )
    return value.strip()


def _uuid_header(request: Request, name: str) -> UUID:
    raw = _header(request, name)
    try:
        return UUID(raw)
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail={"error": "invalid identity header", "header": name},
        ) from exc


def build_chat_completions_router(settings: WorkerSettings) -> APIRouter:
    guard = require_internal_secret(settings)
    router = APIRouter(dependencies=[Depends(guard)])
    runner = TurnRunner(settings)
    path = settings.byo_llm_chat_completions_path

    @router.post(path, response_model=None)
    def chat_completions(
        request: Request,
        body: ChatCompletionsIn,
    ) -> dict[str, Any] | StreamingResponse:
        app_user_id = _uuid_header(request, settings.byo_llm_app_user_header)
        persona_id = _uuid_header(request, settings.byo_llm_persona_header)
        session_id = _uuid_header(request, settings.byo_llm_session_header)
        engram_user_id = _header(request, settings.byo_llm_engram_user_header)
        text = last_user_text(
            [message.model_dump() for message in body.messages],
            user_role=settings.byo_llm_user_role,
            text_part_type=settings.byo_llm_text_part_type,
        )
        try:
            result = runner.run(
                app_user_id=app_user_id,
                engram_user_id=engram_user_id,
                persona_id=persona_id,
                session_id=session_id,
                text=text,
            )
        except TurnError as exc:
            raise_turn(exc)

        content = result.reply_text or ""
        completion_id = new_completion_id(settings)
        created = int(time.time())
        model = body.model or settings.openai_model
        if body.stream:
            return StreamingResponse(
                iter_sse_chunks(
                    settings,
                    completion_id=completion_id,
                    created=created,
                    model=model,
                    content=content,
                ),
                media_type=settings.byo_llm_sse_media_type,
            )
        return completion_payload(
            settings,
            completion_id=completion_id,
            created=created,
            model=model,
            content=content,
        )

    return router
