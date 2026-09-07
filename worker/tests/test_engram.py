import pytest
from engram_sdk.errors import ForbiddenError as SdkForbiddenError
from engram_sdk.errors import ServerError as SdkServerError
from engram_sdk.errors import UnauthorizedError as SdkUnauthorizedError
from engram_sdk.models import Persona, PersonaReply

from worker.config import WorkerSettings
from worker.engram import errors as app
from worker.engram.engram_brain import EngramBrain, _map_sdk_error


def _persona() -> Persona:
    return Persona(
        id="p1",
        org_id="org",
        name="Ada",
        handle="ada",
        description="desc",
        avatar_url="",
        status="active",
        tenant="org:ada",
        created_at=None,
        raw={"ok": True},
    )


class FakePersonas:
    def __init__(self) -> None:
        self.retrieves: list[tuple[str, str, int]] = []
        self.converses: list[dict[str, object]] = []
        self.retrieve_errors: list[Exception] = []
        self.chat_error: Exception | None = None
        self.subscribed: list[tuple[str, str]] = []
        self.unsubscribed: list[tuple[str, str]] = []

    def retrieve(self, persona_id: str, query: str, top_k: int = 10):
        if self.retrieve_errors:
            raise self.retrieve_errors.pop(0)
        self.retrieves.append((persona_id, query, top_k))
        return {
            "results": [
                {"tenant": "org:persona:user-1", "text": "I kept a diary"},
                {"tenant": 1, "text": 2},
            ]
        }

    def chat(self, persona_id: str, message: str, session_id: str | None = None):
        if self.chat_error is not None:
            raise self.chat_error
        return PersonaReply(
            messages=["The river was high."],
            memories_used=[{"gid": 1}],
            session_id=session_id or "sess-1",
            raw={"ok": True},
        )

    def converse(
        self,
        persona_id: str,
        text: str,
        session_id: str | None = None,
        speaker: str | None = None,
    ):
        self.converses.append(
            {
                "persona_id": persona_id,
                "text": text,
                "session_id": session_id,
                "speaker": speaker,
            }
        )
        return {"ok": True}

    def create(self, name: str, handle: str, description: str):
        return _persona()

    def get(self, persona_id: str):
        return _persona()

    def delete(self, persona_id: str) -> None:
        return None

    def teach(self, persona_id: str, text: str):
        return {"taught": True}

    def answer(self, persona_id: str, question_key: str, text: str):
        return {"answered": True}

    def questions(self, persona_id: str):
        return [{"key": "q1"}]

    def subscribe(self, persona_id: str, user_id: str):
        self.subscribed.append((persona_id, user_id))
        return {"subscribed": True}

    def unsubscribe(self, persona_id: str, user_id: str):
        self.unsubscribed.append((persona_id, user_id))
        return {"unsubscribed": True}

    def subscribers(self, persona_id: str):
        return [{"user_id": "u1"}]


class FakeClient:
    def __init__(self) -> None:
        self.personas = FakePersonas()

    def close(self) -> None:
        return None


def test_retrieve_maps_hits_and_ignores_non_strings(
    settings: WorkerSettings,
) -> None:
    client = FakeClient()
    brain = EngramBrain(settings, "user-1", client=client)
    outcome = brain.retrieve("persona-1", "what do you remember", top_k=7)
    assert client.personas.retrieves == [("persona-1", "what do you remember", 7)]
    assert outcome.results[0].tenant == "org:persona:user-1"
    assert outcome.results[0].text == "I kept a diary"
    assert outcome.results[1].tenant is None


def test_chat_and_persona_helpers(settings: WorkerSettings) -> None:
    client = FakeClient()
    brain = EngramBrain(settings, "user-1", client=client)
    created = brain.create_persona("Ada", "ada", "desc")
    assert created.id == "p1"
    assert brain.get_persona("p1").handle == "ada"
    brain.delete_persona("p1")
    assert brain.teach("p1", "fact") == {"taught": True}
    assert brain.answer("p1", "q", "a") == {"answered": True}
    assert brain.questions("p1") == [{"key": "q1"}]
    assert brain.subscribe("p1", "u1") == {"subscribed": True}
    assert brain.unsubscribe("p1", "u1") == {"unsubscribed": True}
    hyphenated = "3a07018e-b5c2-483a-b80f-07e90488b5f4"
    assert brain.subscribe("p1", hyphenated) == {"subscribed": True}
    assert client.personas.subscribed == [
        ("p1", "u1"),
        ("p1", "3a07018eb5c2483ab80f07e90488b5f4"),
    ]
    assert brain.subscribers("p1") == [{"user_id": "u1"}]
    outcome = brain.chat("persona-1", "hello", session_id="sess-9")
    assert outcome.messages == ["The river was high."]
    brain.converse("persona-1", "hi", session_id="sess-9", speaker="user")
    brain.close()


def test_retrieve_retries_then_maps_error(
    settings: WorkerSettings,
    monkeypatch,
) -> None:
    settings.engram_read_max_retries = 1
    monkeypatch.setattr("worker.engram.engram_brain.time.sleep", lambda _s: None)
    client = FakeClient()
    client.personas.retrieve_errors = [
        SdkServerError(503, "busy"),
        SdkUnauthorizedError(401, "no key"),
    ]
    brain = EngramBrain(settings, "user-1", client=client)
    with pytest.raises(app.UnauthorizedError):
        brain.retrieve("persona-1", "q")


def test_chat_forbidden_is_not_subscribed(settings: WorkerSettings) -> None:
    client = FakeClient()
    client.personas.chat_error = SdkForbiddenError(403, "no sub")
    brain = EngramBrain(settings, "user-1", client=client)
    with pytest.raises(app.NotSubscribedError):
        brain.chat("persona-1", "hello")


def test_map_sdk_error_statuses() -> None:
    assert isinstance(
        _map_sdk_error(SdkUnauthorizedError(401, "x")),
        app.UnauthorizedError,
    )
    forbidden = _map_sdk_error(SdkForbiddenError(403, "x"), chat=False)
    assert isinstance(forbidden, app.ForbiddenError)
    retryable = _map_sdk_error(SdkServerError(503, "busy"))
    assert isinstance(retryable, app.RetryableReadError)
    server = _map_sdk_error(SdkServerError(500, "down"))
    assert isinstance(server, app.ServerError)
