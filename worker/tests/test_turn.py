from uuid import uuid4

from worker.config import WorkerSettings
from worker.controller.decision import Action, Decision, ReasonCode
from worker.engram.interface import RetrieveHit, RetrieveOutcome
from worker.observe.fields import turn_log_fields
from worker.turn.service import TurnPlan, TurnRunner

ORG = "100912164da2419885314c9fdb5358b7"
PERSONA = "3a07018eb5c2483ab80f07e90488b5f4"
MEMBER = "07b2b9f777c9446b86c5d593a374cc80"
OTHER = "8de1b2b278724e0bba19000086f8bef2"

SHARED = f"{ORG}:{PERSONA}"
OWN_PRIVATE = f"{ORG}:{PERSONA}:{MEMBER}"
OTHER_PRIVATE = f"{ORG}:{PERSONA}:{OTHER}"


def _mixed_hits() -> tuple[RetrieveHit, RetrieveHit, RetrieveHit]:
    shared = RetrieveHit(
        tenant=SHARED,
        text="Ada was taught this",
        raw={"tenant": SHARED, "text": "Ada was taught this", "gid": 1001},
    )
    own = RetrieveHit(
        tenant=OWN_PRIVATE,
        text="I told Ada my colour",
        raw={"tenant": OWN_PRIVATE, "text": "I told Ada my colour", "gid": 1002},
    )
    other = RetrieveHit(
        tenant=OTHER_PRIVATE,
        text="my name is Harish",
        raw={"tenant": OTHER_PRIVATE, "text": "my name is Harish", "gid": 1003},
    )
    return shared, own, other


def test_retrieve_grounds_shared_and_own_private_when_member_authenticates(
    settings: WorkerSettings,
) -> None:
    shared, own, other = _mixed_hits()
    runner = TurnRunner(
        settings.model_copy(update={"engram_member_session_auth": True}),
    )
    try:
        memories, outcome, counts = runner._ground_retrieve(
            RetrieveOutcome(results=[shared, own, other], raw={"ok": True}),
            engram_user_id=MEMBER,
            prior_sid="sess-1",
            brain_ms=12,
        )
        assert memories == [shared.text, own.text]
        assert outcome.messages == [shared.text, own.text]
        assert outcome.memories_used == [shared.raw, own.raw]
        assert other.raw not in outcome.memories_used
        assert counts == (3, 2, 1)
    finally:
        runner.close()


def test_retrieve_grounds_shared_only_without_member_auth(
    settings: WorkerSettings,
) -> None:
    # On one org key the "own" private pool is the key owner's, and it holds
    # every member's turns. Nobody grounds on it — not even its owner.
    shared, own, other = _mixed_hits()
    runner = TurnRunner(settings)
    try:
        memories, outcome, counts = runner._ground_retrieve(
            RetrieveOutcome(results=[shared, own, other], raw={"ok": True}),
            engram_user_id=MEMBER,
            prior_sid="sess-1",
            brain_ms=12,
        )
        assert memories == [shared.text]
        assert outcome.memories_used == [shared.raw]
        assert counts == (3, 1, 2)
    finally:
        runner.close()


def test_key_owner_is_not_handed_the_shared_admin_pool(
    settings: WorkerSettings,
) -> None:
    # The API key owner signing in maps to the admin People id, so the mixed
    # pool would look like their own memory. It must still be refused.
    shared, _own, other = _mixed_hits()
    runner = TurnRunner(settings)
    try:
        memories, outcome, counts = runner._ground_retrieve(
            RetrieveOutcome(results=[shared, other], raw={"ok": True}),
            engram_user_id=OTHER,
            prior_sid="sess-1",
            brain_ms=12,
        )
        assert memories == [shared.text]
        assert other.raw not in outcome.memories_used
        assert counts == (2, 1, 1)
    finally:
        runner.close()


def test_retrieve_drops_missing_tenant_from_memories_used(
    settings: WorkerSettings,
) -> None:
    runner = TurnRunner(settings)
    blank = RetrieveHit(
        tenant=None,
        text="ungrounded",
        raw={"text": "ungrounded"},
    )
    try:
        memories, outcome, counts = runner._ground_retrieve(
            RetrieveOutcome(results=[blank], raw={}),
            engram_user_id=MEMBER,
            prior_sid=None,
            brain_ms=1,
        )
        assert memories == []
        assert outcome.messages == []
        assert outcome.memories_used == []
        assert counts == (1, 0, 1)
    finally:
        runner.close()


def test_retrieve_counts_are_allowlisted_and_text_is_not(
    settings: WorkerSettings,
) -> None:
    fields = turn_log_fields(
        settings,
        {
            "correlation_id": "c",
            "session_id": "s",
            "retrieve_hits": 25,
            "retrieve_hits_grounded": 0,
            "retrieve_hits_dropped": 25,
            "text": "should never be logged",
        },
    )
    assert fields["retrieve_hits"] == 25
    assert fields["retrieve_hits_grounded"] == 0
    assert fields["retrieve_hits_dropped"] == 25
    assert "text" not in fields


def test_retrieve_memories_panel_keeps_own_private_only(
    settings: WorkerSettings,
) -> None:
    shared, own, other = _mixed_hits()

    class _Brain:
        def retrieve(self, persona_id: str, query: str, *, top_k: int = 10):
            return RetrieveOutcome(
                results=[shared, own, other],
                raw={"ok": True},
            )

    class _Brains:
        def get(self, engram_user_id: str) -> _Brain:
            return _Brain()

        def close(self) -> None:
            return None

    def _panel(authenticated: bool) -> list[dict[str, str | None]]:
        runner = TurnRunner(
            settings.model_copy(
                update={"engram_member_session_auth": authenticated},
            ),
        )
        runner._brains = _Brains()  # type: ignore[assignment]
        runner._bound_engram_user_id = (  # type: ignore[method-assign]
            lambda app_user_id, claimed: MEMBER
        )
        try:
            return runner.retrieve_memories(
                app_user_id=uuid4(),
                engram_user_id=MEMBER,
                engram_persona_id=PERSONA,
            )
        finally:
            runner.close()

    assert _panel(True) == [{"text": own.text, "tenant": OWN_PRIVATE}]
    # Without member session auth a private row is the shared admin pool, so
    # the panel shows nothing rather than someone else's memory.
    assert _panel(False) == []


def _retrieve_plan() -> TurnPlan:
    return TurnPlan(
        session_id=uuid4(),
        text="hello",
        started=0.0,
        decision=Decision(
            action=Action.SPEAK,
            reasons=(ReasonCode.HAS_GROUNDED_REPLY,),
            hints={},
        ),
        prior_sid="sess-1",
        voice_config={},
        history=[],
        correlation_id=uuid4(),
        mode="retrieve",
        engram_user_id=MEMBER,
        engram_persona_id=PERSONA,
    )


def test_write_back_suppressed_while_member_session_auth_is_false(
    settings: WorkerSettings,
) -> None:
    settings.engram_converse_writeback = True
    settings.engram_member_session_auth = False
    runner = TurnRunner(settings)
    try:
        assert runner._should_write_back(_retrieve_plan()) is False
    finally:
        runner.close()


def test_forget_grant_attempts_drops_the_cached_pair(
    settings: WorkerSettings,
) -> None:
    runner = TurnRunner(settings)
    user = uuid4()
    persona = uuid4()
    other = uuid4()
    runner._grant_tried.add((str(user), str(persona)))
    runner._grant_tried.add((str(other), str(persona)))
    try:
        runner.forget_grant_attempts(app_user_id=user, persona_id=persona)
        assert (str(user), str(persona)) not in runner._grant_tried
        assert (str(other), str(persona)) in runner._grant_tried
        runner.forget_grant_attempts(app_user_id=other)
        assert runner._grant_tried == set()
    finally:
        runner.close()
