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


def test_answer_request_uses_labelled_lists_as_only_facts(
    settings: WorkerSettings,
) -> None:
    answerer = Answerer(settings, DummyClient())
    _, messages = answerer._request(
        persona_memories=["I taught in Oxford."],
        caller_memories=["They sail."],
        history=[HistoryTurn(speaker="user", text="Where did you teach?")],
        question="Where did you teach?",
        voice_config={},
    )
    assert messages[0]["content"] == DEFAULT_ANSWER_SYSTEM_PROMPT
    payload = json.loads(messages[1]["content"])
    assert set(payload.keys()) == {
        settings.answer_payload_persona_memories_key,
        settings.answer_payload_caller_memories_key,
        settings.answer_payload_history_key,
        settings.answer_payload_question_key,
        settings.answer_payload_voice_config_key,
    }
    assert payload[settings.answer_payload_persona_memories_key] == [
        "I taught in Oxford.",
    ]
    assert payload[settings.answer_payload_caller_memories_key] == ["They sail."]
    assert payload[settings.answer_payload_question_key] == "Where did you teach?"


def test_answer_rejects_both_lists_empty(settings: WorkerSettings) -> None:
    answerer = Answerer(settings, DummyClient())
    with pytest.raises(ReframeEmptyInputError):
        answerer._request(
            persona_memories=[],
            caller_memories=["", "  "],
            history=[],
            question="hello",
            voice_config={},
        )


def test_answer_keeps_empty_caller_list_when_persona_has_facts(
    settings: WorkerSettings,
) -> None:
    answerer = Answerer(settings, DummyClient())
    _, messages = answerer._request(
        persona_memories=["I taught in Oxford."],
        caller_memories=[],
        history=[],
        question="hello",
        voice_config={},
    )
    payload = json.loads(messages[1]["content"])
    assert payload[settings.answer_payload_persona_memories_key] == [
        "I taught in Oxford.",
    ]
    assert payload[settings.answer_payload_caller_memories_key] == []


def test_answer_payload_keys_come_from_config(settings: WorkerSettings) -> None:
    loaded = settings.model_copy(
        update={
            "answer_payload_persona_memories_key": "p_facts",
            "answer_payload_caller_memories_key": "c_facts",
            "answer_payload_history_key": "turns",
            "answer_payload_question_key": "ask",
            "answer_payload_voice_config_key": "voice",
        },
    )
    answerer = Answerer(loaded, DummyClient())
    _, messages = answerer._request(
        persona_memories=["persona"],
        caller_memories=["caller"],
        history=[],
        question="q",
        voice_config={"pace": "calm"},
    )
    payload = json.loads(messages[1]["content"])
    assert set(payload.keys()) == {
        "p_facts",
        "c_facts",
        "turns",
        "ask",
        "voice",
    }


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
        persona_memories=["I taught in Oxford."],
        caller_memories=[],
        history=[],
        question="Where?",
        voice_config={},
    )
    assert spoken == "Oxford"


def test_reframe_rejects_non_object_voice_config(settings: WorkerSettings) -> None:
    with pytest.raises(ReframeError):
        Reframer(settings, DummyClient())._request(["fact"], [], "not-an-object")  # type: ignore[arg-type]
