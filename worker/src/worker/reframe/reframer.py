from __future__ import annotations

import json
from typing import Any

from openai import (
    APIConnectionError,
    APIStatusError,
    APITimeoutError,
    AuthenticationError,
    OpenAIError,
)

from worker.clients import create_openai
from worker.config import WorkerSettings
from worker.reframe.defaults import DEFAULT_REFRAME_SYSTEM_PROMPT
from worker.reframe.errors import (
    ReframeEmptyInputError,
    ReframeEmptyOutputError,
    ReframeError,
    ReframeUnavailableError,
)
from worker.reframe.types import HistoryTurn


def _payload(
    messages: list[str],
    history: list[HistoryTurn],
    voice_config: dict[str, Any],
) -> str:
    return json.dumps(
        {
            "messages": messages,
            "history": [
                {"speaker": turn.speaker, "text": turn.text} for turn in history
            ],
            "voice_config": voice_config,
        },
        ensure_ascii=False,
    )


class Reframer:
    def __init__(self, settings: WorkerSettings) -> None:
        self._settings = settings
        try:
            self._client = create_openai(settings)
        except RuntimeError as exc:
            raise ReframeUnavailableError(str(exc)) from exc

    def reframe(
        self,
        messages: list[str],
        history: list[HistoryTurn],
        voice_config: dict[str, Any],
    ) -> str:
        bubbles = [item for item in messages if isinstance(item, str) and item.strip()]
        if not bubbles:
            raise ReframeEmptyInputError("reframe requires at least one Engram message")
        if not isinstance(voice_config, dict):
            raise ReframeError("voice_config must be an object")

        limit = self._settings.reframe_history_turns
        recent = history[-limit:] if limit > 0 else []
        system = self._settings.reframe_system_prompt or DEFAULT_REFRAME_SYSTEM_PROMPT
        model = self._settings.openai_model
        if not model:
            raise ReframeUnavailableError("OPENAI_MODEL is not set")

        try:
            user_content = _payload(bubbles, recent, voice_config)
            completion = self._client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": user_content},
                ],
                temperature=self._settings.reframe_temperature,
                max_completion_tokens=self._settings.reframe_max_tokens,
                timeout=self._settings.reframe_timeout_seconds,
            )
        except AuthenticationError as exc:
            raise ReframeUnavailableError(
                "reframe LLM rejected the API key",
                status=getattr(exc, "status_code", 401),
                detail=str(exc),
            ) from exc
        except APITimeoutError as exc:
            raise ReframeUnavailableError(
                "reframe LLM timed out",
                detail=str(exc),
            ) from exc
        except APIConnectionError as exc:
            raise ReframeUnavailableError(
                "reframe LLM is unreachable",
                detail=str(exc),
            ) from exc
        except APIStatusError as exc:
            raise ReframeError(
                "reframe LLM request failed",
                status=exc.status_code,
                detail=str(exc),
            ) from exc
        except OpenAIError as exc:
            raise ReframeError("reframe LLM request failed", detail=str(exc)) from exc

        spoken = ""
        if completion.choices:
            content = completion.choices[0].message.content
            if isinstance(content, str):
                spoken = content.strip()
        if not spoken:
            raise ReframeEmptyOutputError("reframe LLM returned no text")
        return spoken
