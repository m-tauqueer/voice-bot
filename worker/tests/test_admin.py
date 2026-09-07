from __future__ import annotations

from contextlib import contextmanager
from typing import Any
from uuid import uuid4

import pytest

from worker.admin.errors import AdminError
from worker.admin.service import PersonaAdmin
from worker.admin.voice import as_voice_config, merge_tts_voice
from worker.config import WorkerSettings
from worker.engram.errors import ForbiddenError
from worker.engram.interface import IngestOutcome, PersonaRecord

ADA = "11111111-1111-1111-1111-111111111111"
NOVA = "22222222-2222-2222-2222-222222222222"


def _row(**overrides: Any) -> dict[str, Any]:
    row = {
        "id": ADA,
        "engram_persona_id": "eng-ada",
        "handle": "ada",
        "display_name": "Ada",
        "description": "first",
        "voice_config": {},
        "published": True,
        "created_at": None,
        "updated_at": None,
    }
    row.update(overrides)
    return row


def _record(
    persona_id: str,
    name: str,
    handle: str,
    description: str | None,
) -> PersonaRecord:
    return PersonaRecord(
        id=persona_id,
        org_id="org",
        name=name,
        handle=handle,
        description=description,
        avatar_url=None,
        status="active",
        tenant=None,
        created_at=None,
        raw={},
    )


class Catalog:
    def __init__(self, rows: list[dict[str, Any]] | None = None) -> None:
        self.rows = [dict(row) for row in (rows or [])]
        self.subscriptions: list[dict[str, Any]] = []
        self.users = [
            {
                "id": "user-1",
                "google_sub": "sub",
                "email": "a@example.com",
                "engram_user_id": "e-user-1",
            }
        ]

    def list_personas(self, _conn: object) -> list[dict[str, Any]]:
        return list(self.rows)

    def get_persona(self, _conn: object, persona_id: str) -> dict[str, Any] | None:
        for row in self.rows:
            if str(row["id"]) == str(persona_id):
                return row
        return None

    def upsert_persona(self, _conn: object, **kwargs: Any) -> dict[str, Any]:
        published_arg = kwargs.get("published")
        for row in self.rows:
            if row["engram_persona_id"] == kwargs["engram_persona_id"]:
                row["handle"] = kwargs["handle"]
                row["display_name"] = kwargs["display_name"]
                row["description"] = kwargs["description"]
                row["voice_config"] = kwargs["voice_config"]
                if published_arg is not None:
                    row["published"] = published_arg
                return row
        inserted = _row(
            id=str(uuid4()),
            engram_persona_id=kwargs["engram_persona_id"],
            handle=kwargs["handle"],
            display_name=kwargs["display_name"],
            description=kwargs["description"],
            voice_config=kwargs["voice_config"],
            published=False if published_arg is None else published_arg,
        )
        self.rows.append(inserted)
        return inserted

    def set_persona_published(
        self,
        _conn: object,
        persona_id: str,
        published: bool,
    ) -> dict[str, Any] | None:
        row = self.get_persona(_conn, persona_id)
        if row is None:
            return None
        row["published"] = published
        return row

    def list_subscriptions(
        self,
        _conn: object,
        persona_id: str,
    ) -> list[dict[str, Any]]:
        return [
            row for row in self.subscriptions if row.get("persona_id") == persona_id
        ]

    def find_user(self, _conn: object, identifier: str) -> dict[str, Any] | None:
        for user in self.users:
            if identifier in {user["email"], user["id"], user["engram_user_id"]}:
                return user
        return None

    def upsert_subscription(self, _conn: object, **kwargs: Any) -> None:
        self.subscriptions.append(kwargs)


class FakeBrain:
    def __init__(self) -> None:
        self.created: list[PersonaRecord] = []
        self.taught: list[tuple[str, str]] = []
        self.deleted: list[str] = []
        self.answered: list[tuple[str, str, str]] = []
        self.ingested: list[str] = []
        self.subscribed: list[tuple[str, str]] = []
        self.create_error: Exception | None = None
        self.remote: dict[str, PersonaRecord] = {
            "eng-ada": _record("eng-ada", "Ada", "ada", "first"),
            "eng-nova": _record("eng-nova", "Nova", "nova", None),
        }

    def close(self) -> None:
        return None

    def create_persona(self, name: str, handle: str, description: str) -> PersonaRecord:
        if self.create_error is not None:
            raise self.create_error
        record = _record(f"eng-{handle}", name, handle, description)
        self.created.append(record)
        self.remote[record.id] = record
        return record

    def get_persona(self, persona_id: str) -> PersonaRecord:
        if persona_id in self.remote:
            return self.remote[persona_id]
        return _record(persona_id, "Remote", "remote", "from engram")

    def delete_persona(self, persona_id: str) -> None:
        self.deleted.append(persona_id)

    def teach(self, persona_id: str, text: str) -> dict[str, bool]:
        self.taught.append((persona_id, text))
        return {"taught": True}

    def answer(self, persona_id: str, question_key: str, text: str) -> dict[str, bool]:
        self.answered.append((persona_id, question_key, text))
        return {"answered": True}

    def questions(self, persona_id: str) -> dict[str, object]:
        return {"questions": [{"key": f"q-{persona_id}"}], "coverage": 1}

    def ingest_shared_document(
        self,
        persona_id: str,
        document: object,
        metadata: dict[str, Any] | None = None,
    ) -> IngestOutcome:
        self.ingested.append(persona_id)
        return IngestOutcome(gid=1, perception=None, incomplete=None, raw={})

    def subscribe(self, persona_id: str, user_id: str) -> dict[str, bool]:
        self.subscribed.append((persona_id, user_id))
        return {"subscribed": True}


def _bind(monkeypatch: pytest.MonkeyPatch, catalog: Catalog) -> None:
    @contextmanager
    def fake_connect(_settings: WorkerSettings):
        yield object()

    monkeypatch.setattr("worker.admin.service.connect", fake_connect)
    monkeypatch.setattr("worker.admin.service.list_personas", catalog.list_personas)
    monkeypatch.setattr("worker.admin.service.get_persona", catalog.get_persona)
    monkeypatch.setattr("worker.admin.service.upsert_persona", catalog.upsert_persona)
    monkeypatch.setattr(
        "worker.admin.service.set_persona_published",
        catalog.set_persona_published,
    )
    monkeypatch.setattr(
        "worker.admin.service.list_subscriptions",
        catalog.list_subscriptions,
    )
    monkeypatch.setattr("worker.admin.service.find_user", catalog.find_user)
    monkeypatch.setattr(
        "worker.admin.service.upsert_subscription",
        catalog.upsert_subscription,
    )


def _admin(
    settings: WorkerSettings,
    monkeypatch: pytest.MonkeyPatch,
    catalog: Catalog,
    brain: FakeBrain,
) -> PersonaAdmin:
    _bind(monkeypatch, catalog)
    return PersonaAdmin(settings, brain_factory=lambda _s, _u: brain)


def test_merge_tts_voice_writes_configured_key() -> None:
    merged = merge_tts_voice(
        {"pace": "calm"},
        tts_voice="aura-2-thalia-en",
        key="tts_voice",
    )
    assert merged == {"pace": "calm", "tts_voice": "aura-2-thalia-en"}
    cleared = merge_tts_voice(merged, tts_voice=" ", key="tts_voice")
    assert cleared == {"pace": "calm"}
    assert merge_tts_voice({"pace": "calm"}, tts_voice=None, key="tts_voice") == {
        "pace": "calm",
    }
    assert as_voice_config(None) == {}
    assert as_voice_config("nope") == {}


def test_show_unknown_pin_is_missing(
    settings: WorkerSettings,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    catalog = Catalog([_row()])
    admin = _admin(settings, monkeypatch, catalog, FakeBrain())
    with pytest.raises(AdminError) as caught:
        admin.show(NOVA)
    assert caught.value.status == 404
    assert caught.value.reason == "persona_missing"


def test_single_row_does_not_need_a_pin(
    settings: WorkerSettings,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    catalog = Catalog([_row()])
    brain = FakeBrain()
    admin = _admin(settings, monkeypatch, catalog, brain)
    shown = admin.show()
    assert shown["persona"]["handle"] == "ada"
    admin.teach("one fact")
    assert brain.taught == [("eng-ada", "one fact")]


def test_show_lists_many_without_guessing(
    settings: WorkerSettings,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    catalog = Catalog(
        [
            _row(),
            _row(
                id=NOVA,
                engram_persona_id="eng-nova",
                handle="nova",
                display_name="Nova",
            ),
        ]
    )
    admin = _admin(settings, monkeypatch, catalog, FakeBrain())
    shown = admin.show()
    assert shown["persona"] is None
    assert [row["handle"] for row in shown["personas"]] == ["ada", "nova"]
    pinned = admin.show(NOVA)
    assert pinned["persona"]["handle"] == "nova"
    assert pinned["engram"]["id"] == "eng-nova"


def test_teach_requires_a_pin_when_several_exist(
    settings: WorkerSettings,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    catalog = Catalog(
        [
            _row(),
            _row(
                id=NOVA,
                engram_persona_id="eng-nova",
                handle="nova",
                display_name="Nova",
            ),
        ]
    )
    brain = FakeBrain()
    admin = _admin(settings, monkeypatch, catalog, brain)
    with pytest.raises(AdminError) as caught:
        admin.teach("a fact")
    assert caught.value.status == 409
    assert caught.value.reason == "persona_pin_required"
    admin.teach("a nova fact", persona_id=NOVA)
    assert brain.taught == [("eng-nova", "a nova fact")]
    assert brain.deleted == []


def test_create_and_link_start_unpublished(
    settings: WorkerSettings,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    catalog = Catalog([_row()])
    brain = FakeBrain()
    admin = _admin(settings, monkeypatch, catalog, brain)
    created = admin.create_remote(
        name="Nova",
        handle="nova",
        description="second",
        voice_config={"pace": "calm"},
        tts_voice="aura-2-aries-en",
    )
    assert created["persona"]["published"] is False
    assert created["persona"]["voice_config"]["tts_voice"] == "aura-2-aries-en"
    assert created["persona"]["engram_persona_id"] == "eng-nova"
    assert brain.deleted == []

    brain.create_error = ForbiddenError("missing org:manage", status=403)
    with pytest.raises(AdminError) as caught:
        admin.create_remote(
            name="Blocked",
            handle="blocked",
            description="",
            voice_config={},
        )
    assert caught.value.status == 403
    assert caught.value.reason == "create_forbidden"
    assert str(caught.value) == settings.admin_error_create_forbidden

    linked = admin.register(
        engram_persona_id="eng-linked",
        handle="linked",
        display_name="Linked",
        description=None,
        voice_config={},
        tts_voice="aura-2-thalia-en",
    )
    assert linked["persona"]["published"] is False
    assert linked["persona"]["voice_config"]["tts_voice"] == "aura-2-thalia-en"
    assert catalog.rows[0]["published"] is True


def test_publish_is_local_only(
    settings: WorkerSettings,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    catalog = Catalog(
        [_row(id=NOVA, engram_persona_id="eng-nova", handle="nova", published=False)]
    )
    brain = FakeBrain()
    admin = _admin(settings, monkeypatch, catalog, brain)
    published = admin.publish(published=True, persona_id=NOVA)
    assert published["persona"]["published"] is True
    hidden = admin.publish(published=False, persona_id=NOVA)
    assert hidden["persona"]["published"] is False
    assert brain.deleted == []
    admin.update_local(
        persona_id=NOVA,
        handle=None,
        display_name="Nova Two",
        description=None,
        voice_config=None,
        tts_voice="aura-2-aries-en",
    )
    assert catalog.rows[0]["display_name"] == "Nova Two"
    assert catalog.rows[0]["voice_config"]["tts_voice"] == "aura-2-aries-en"
    assert catalog.rows[0]["published"] is False


def test_questions_ingest_and_subscribe_follow_the_pin(
    settings: WorkerSettings,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    catalog = Catalog(
        [
            _row(),
            _row(
                id=NOVA,
                engram_persona_id="eng-nova",
                handle="nova",
                display_name="Nova",
            ),
        ]
    )
    brain = FakeBrain()
    admin = _admin(settings, monkeypatch, catalog, brain)
    questions = admin.questions(persona_id=NOVA)
    assert questions["questions"][0]["key"] == "q-eng-nova"
    admin.answer("q1", "because", persona_id=NOVA)
    assert brain.answered == [("eng-nova", "q1", "because")]
    admin.ingest_document("doc", persona_id=NOVA)
    assert brain.ingested == ["eng-nova"]
    admin.subscribe("a@example.com", persona_id=NOVA)
    assert brain.subscribed == [("eng-nova", "e-user-1")]
    assert catalog.subscriptions[0]["persona_id"] == NOVA
    assert brain.deleted == []
