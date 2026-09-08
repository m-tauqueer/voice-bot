from __future__ import annotations

from contextlib import contextmanager
from typing import Any
from uuid import uuid4

import pytest

from worker.admin.errors import AdminError
from worker.admin.service import PersonaAdmin
from worker.admin.voice import as_voice_config, merge_persona_voices, merge_tts_voice
from worker.config import WorkerSettings
from worker.engram.errors import ForbiddenError, NotFoundError, ValidationError
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

    def set_engram_user_id(
        self,
        _conn: object,
        user_id: str,
        engram_user_id: str,
        *,
        member_secret: str | None = None,
    ) -> None:
        for user in self.users:
            if user["id"] == user_id:
                user["engram_user_id"] = engram_user_id
                if member_secret is not None:
                    user["engram_member_secret"] = member_secret

    def delete_persona_cascade(
        self,
        _conn: object,
        persona_id: str,
    ) -> dict[str, int]:
        subscriptions = [
            row for row in self.subscriptions if row.get("persona_id") == persona_id
        ]
        self.subscriptions = [
            row for row in self.subscriptions if row.get("persona_id") != persona_id
        ]
        before = len(self.rows)
        self.rows = [row for row in self.rows if str(row["id"]) != str(persona_id)]
        return {
            "subscriptions": len(subscriptions),
            "sessions": 0,
            "personas": before - len(self.rows),
        }


class FakeRoster:
    def __init__(self, user_id: str = "e-user-1") -> None:
        self.user_id = user_id
        self.added: list[tuple[str, str, str, bool]] = []
        self.closed = False

    def add_member(
        self,
        email: str,
        *,
        name: str,
        role: str,
        password: str,
    ) -> str:
        self.added.append((email, name, role, bool(password)))
        return self.user_id

    def list_members(self) -> list[tuple[str, str]]:
        return []

    def login(self, email: str, password: str) -> None:
        del email, password
        return None

    def close(self) -> None:
        self.closed = True


class FakeBrain:
    def __init__(self) -> None:
        self.created: list[PersonaRecord] = []
        self.taught: list[tuple[str, str]] = []
        self.deleted: list[str] = []
        self.answered: list[tuple[str, str, str]] = []
        self.ingested: list[str] = []
        self.subscribed: list[tuple[str, str]] = []
        self.subscribe_errors: list[Exception] = []
        self.create_error: Exception | None = None
        self.delete_error: Exception | None = None
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
        if self.delete_error is not None:
            raise self.delete_error
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
        if self.subscribe_errors:
            raise self.subscribe_errors.pop(0)
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
    monkeypatch.setattr(
        "worker.admin.service.set_engram_user_id",
        catalog.set_engram_user_id,
    )
    monkeypatch.setattr(
        "worker.admin.service.delete_persona_cascade",
        catalog.delete_persona_cascade,
    )


def _admin(
    settings: WorkerSettings,
    monkeypatch: pytest.MonkeyPatch,
    catalog: Catalog,
    brain: FakeBrain,
    roster: FakeRoster | None = None,
) -> PersonaAdmin:
    _bind(monkeypatch, catalog)
    org = roster or FakeRoster()
    return PersonaAdmin(
        settings,
        brain_factory=lambda _s, _u: brain,
        roster_factory=lambda _s: org,
    )


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


def test_merge_persona_voices_writes_fish_on_its_own_key() -> None:
    merged = merge_persona_voices(
        {"pace": "calm"},
        tts_voice="aura-2-thalia-en",
        tts_key="tts_voice",
        fish_voice="fish-ref-1",
        fish_key="fish_voice",
    )
    assert merged == {
        "pace": "calm",
        "tts_voice": "aura-2-thalia-en",
        "fish_voice": "fish-ref-1",
    }
    cleared = merge_persona_voices(
        merged,
        tts_voice=None,
        tts_key="tts_voice",
        fish_voice=" ",
        fish_key="fish_voice",
    )
    assert cleared == {"pace": "calm", "tts_voice": "aura-2-thalia-en"}


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
        fish_voice="fish-ref-nova",
    )
    assert created["persona"]["published"] is False
    assert created["persona"]["voice_config"]["tts_voice"] == "aura-2-aries-en"
    assert created["persona"]["voice_config"]["fish_voice"] == "fish-ref-nova"
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
        fish_voice="fish-ref-nova",
    )
    assert catalog.rows[0]["display_name"] == "Nova Two"
    assert catalog.rows[0]["voice_config"]["tts_voice"] == "aura-2-aries-en"
    assert catalog.rows[0]["voice_config"]["fish_voice"] == "fish-ref-nova"
    assert catalog.rows[0]["voice_config"]["tts_voice"] != "fish-ref-nova"
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


def test_subscribe_persists_engram_people_id(
    settings: WorkerSettings,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    catalog = Catalog([_row()])
    brain = FakeBrain()
    roster = FakeRoster(user_id="8de1b2b278724e0bba19000086f8bef2")
    admin = _admin(settings, monkeypatch, catalog, brain, roster)
    admin.subscribe("a@example.com")
    assert catalog.users[0]["engram_user_id"] == "8de1b2b278724e0bba19000086f8bef2"
    assert catalog.users[0]["engram_member_secret"]
    assert catalog.users[0]["engram_member_secret"] != "tok"
    assert brain.subscribed == [("eng-ada", "8de1b2b278724e0bba19000086f8bef2")]
    assert roster.added == [("a@example.com", "a@example.com", "member", True)]


def test_seed_persona_id_only_fills_an_empty_catalog(
    settings: WorkerSettings,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    seeded = settings.model_copy(update={"engram_persona_id": "eng-seed"})
    empty = _admin(seeded, monkeypatch, Catalog([]), FakeBrain())
    assert empty.seed_persona_id() == "eng-seed"

    stocked = _admin(seeded, monkeypatch, Catalog([_row()]), FakeBrain())
    assert stocked.seed_persona_id() is None

    unset = _admin(settings, monkeypatch, Catalog([]), FakeBrain())
    assert unset.seed_persona_id() is None


def test_destroy_wipes_engram_then_local_rows(
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
    catalog.subscriptions.append({"persona_id": ADA, "user_id": "user-1"})
    brain = FakeBrain()
    admin = _admin(settings, monkeypatch, catalog, brain)
    result = admin.destroy(confirmation="ada", persona_id=ADA)
    assert brain.deleted == ["eng-ada"]
    assert result["engram"] == "deleted"
    assert result["removed"]["personas"] == 1
    assert result["removed"]["subscriptions"] == 1
    assert [row["handle"] for row in catalog.rows] == ["nova"]


def test_destroy_refuses_a_handle_that_does_not_match(
    settings: WorkerSettings,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    catalog = Catalog([_row()])
    brain = FakeBrain()
    admin = _admin(settings, monkeypatch, catalog, brain)
    for typed in ("Ada", "ad", "", "  "):
        with pytest.raises(AdminError) as caught:
            admin.destroy(confirmation=typed, persona_id=ADA)
        assert caught.value.reason == "confirmation_mismatch"
        assert caught.value.status == 400
    # Nothing was touched on either side.
    assert brain.deleted == []
    assert [row["handle"] for row in catalog.rows] == ["ada"]


def test_destroy_still_clears_local_rows_when_engram_lost_it(
    settings: WorkerSettings,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    catalog = Catalog([_row()])
    brain = FakeBrain()
    brain.delete_error = NotFoundError("no such persona", status=404)
    admin = _admin(settings, monkeypatch, catalog, brain)
    result = admin.destroy(confirmation=" ada ", persona_id=ADA)
    assert result["engram"] == "missing"
    assert catalog.rows == []


def test_destroy_keeps_local_rows_when_engram_refuses(
    settings: WorkerSettings,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    catalog = Catalog([_row()])
    brain = FakeBrain()
    brain.delete_error = ForbiddenError("not allowed", status=403)
    admin = _admin(settings, monkeypatch, catalog, brain)
    with pytest.raises(AdminError) as caught:
        admin.destroy(confirmation="ada", persona_id=ADA)
    assert caught.value.status == 403
    assert [row["handle"] for row in catalog.rows] == ["ada"]


def test_subscribe_retries_join_on_validation(
    settings: WorkerSettings,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    catalog = Catalog([_row()])
    brain = FakeBrain()
    brain.subscribe_errors = [ValidationError("not a member", status=422)]
    roster = FakeRoster(user_id="8de1b2b278724e0bba19000086f8bef2")
    admin = _admin(settings, monkeypatch, catalog, brain, roster)
    admin.subscribe("a@example.com")
    assert brain.subscribed == [("eng-ada", "8de1b2b278724e0bba19000086f8bef2")]
    assert len(roster.added) == 2
