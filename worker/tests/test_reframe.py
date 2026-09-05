import json
from types import SimpleNamespace

import httpx
import pytest
from openai import (
    APIConnectionError,
    APIStatusError,
    APITimeoutError,
    AuthenticationError,
    OpenAIError,
)

from worker.config import WorkerSettings
from worker.reframe.answerer import Answerer
from worker.reframe.defaults import (
    DEFAULT_ANSWER_SYSTEM_PROMPT,
    DEFAULT_REFRAME_SYSTEM_PROMPT,
)
from worker.reframe.errors import (
    ReframeEmptyInputError,
    ReframeEmptyOutputError,
    ReframeError,
    ReframeUnavailableError,
)
from worker.reframe.reframer import Reframer, translate_openai_error
from worker.reframe.types import HistoryTurn


class DummyClient:
    pass


def test_reframe_request_uses_fact_lock_prompt(settings: WorkerSettings) -> None:
    reframer = Reframer(settings, DummyClient())
    model, messages = reframer._request(
        ["I kept a diary by the Thames."],
        [HistoryTurn(speaker="user", text="What did you keep?")],
        {"pace": "calm"},
    )
    assert model == settings.openai_model
    assert messages[0]["role"] == "system"
    assert messages[0]["content"] == DEFAULT_REFRAME_SYSTEM_PROMPT
    payload = json.loads(messages[1]["content"])
    assert set(payload.keys()) == {"messages", "history", "voice_config"}
    assert payload["messages"] == ["I kept a diary by the Thames."]
    assert payload["history"] == [
        {"speaker": "user", "text": "What did you keep?"},
    ]
    assert payload["voice_config"] == {"pace": "calm"}


def test_reframe_uses_configured_prompt(settings: WorkerSettings) -> None:
    settings.reframe_system_prompt = "configured fact lock"
    reframer = Reframer(settings, DummyClient())
    _, messages = reframer._request(["fact"], [], {})
    assert messages[0]["content"] == "configured fact lock"


def test_reframe_rejects_empty_messages(settings: WorkerSettings) -> None:
    reframer = Reframer(settings, DummyClient())
    with pytest.raises(ReframeEmptyInputError):
        reframer._request(["", "  "], [], {})


def test_answer_request_uses_memories_as_only_facts(
    settings: WorkerSettings,
) -> None:
    answerer = Answerer(settings, DummyClient())
    _, messages = answerer._request(
        ["I taught in Oxford."],
        [HistoryTurn(speaker="user", text="Where did you teach?")],
        "Where did you teach?",
        {},
    )
    assert messages[0]["content"] == DEFAULT_ANSWER_SYSTEM_PROMPT
    payload = json.loads(messages[1]["content"])
    assert set(payload.keys()) == {
        "memories",
        "history",
        "question",
        "voice_config",
    }
    assert payload["memories"] == ["I taught in Oxford."]
    assert payload["question"] == "Where did you teach?"


def test_answer_rejects_empty_memories(settings: WorkerSettings) -> None:
    answerer = Answerer(settings, DummyClient())
    with pytest.raises(ReframeEmptyInputError):
        answerer._request([], [], "hello", {})


def test_translate_openai_errors() -> None:
    request = httpx.Request("POST", "https://api.openai.com/v1/chat/completions")
    unauthorized = httpx.Response(401, request=request)
    failed = httpx.Response(500, request=request)
    assert isinstance(
        translate_openai_error(
            AuthenticationError("bad key", response=unauthorized, body=None),
        ),
        ReframeUnavailableError,
    )
    assert isinstance(
        translate_openai_error(APITimeoutError(request)),
        ReframeUnavailableError,
    )
    assert isinstance(
        translate_openai_error(APIConnectionError(request=request)),
        ReframeUnavailableError,
    )
    mapped = translate_openai_error(
        APIStatusError("fail", response=failed, body=None),
    )
    assert isinstance(mapped, ReframeError)
    assert mapped.status == 500
    assert isinstance(translate_openai_error(OpenAIError("other")), ReframeError)


def test_reframe_returns_spoken_text(settings: WorkerSettings) -> None:
    class Completions:
        def create(self, **_kwargs):
            message = SimpleNamespace(content="  spoken  ")
            return SimpleNamespace(choices=[SimpleNamespace(message=message)])

    client = SimpleNamespace(chat=SimpleNamespace(completions=Completions()))
    spoken = Reframer(settings, client).reframe(["I kept a diary."], [], {})
    assert spoken == "spoken"


def test_reframe_empty_output(settings: WorkerSettings) -> None:
    class Completions:
        def create(self, **_kwargs):
            return SimpleNamespace(choices=[])

    client = SimpleNamespace(chat=SimpleNamespace(completions=Completions()))
    with pytest.raises(ReframeEmptyOutputError):
        Reframer(settings, client).reframe(["I kept a diary."], [], {})


def test_reframe_stream_yields_tokens(settings: WorkerSettings) -> None:
    class Completions:
        def create(self, **_kwargs):
            first = SimpleNamespace(delta=SimpleNamespace(content="Hi"))
            last = SimpleNamespace(delta=SimpleNamespace(content=" there"))
            return [
                SimpleNamespace(choices=[first]),
                SimpleNamespace(choices=[]),
                SimpleNamespace(choices=[last]),
            ]

    client = SimpleNamespace(chat=SimpleNamespace(completions=Completions()))
    spoken = "".join(Reframer(settings, client).stream(["I kept a diary."], [], {}))
    assert spoken == "Hi there"


def test_answer_returns_spoken_text(settings: WorkerSettings) -> None:
    class Completions:
        def create(self, **_kwargs):
            return SimpleNamespace(
                choices=[SimpleNamespace(message=SimpleNamespace(content="Oxford"))],
            )

    client = SimpleNamespace(chat=SimpleNamespace(completions=Completions()))
    spoken = Answerer(settings, client).answer(
        ["I taught in Oxford."],
        [],
        "Where?",
        {},
    )
    assert spoken == "Oxford"


def test_reframe_rejects_non_object_voice_config(settings: WorkerSettings) -> None:
    with pytest.raises(ReframeError):
        Reframer(settings, DummyClient())._request(["fact"], [], "not-an-object")  # type: ignore[arg-type]
