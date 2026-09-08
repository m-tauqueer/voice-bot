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
            member_authenticated=True,
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
            member_authenticated=False,
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
            member_authenticated=False,
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
            member_authenticated=False,
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
            "member_authenticated": False,
            "engram_credential": "org",
            "text": "should never be logged",
        },
    )
    assert fields["retrieve_hits"] == 25
    assert fields["retrieve_hits_grounded"] == 0
    assert fields["retrieve_hits_dropped"] == 25
    assert fields["member_authenticated"] is False
    assert fields["engram_credential"] == "org"
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
        loaded = settings.model_copy(
            update={"engram_member_session_auth": authenticated},
        )
        runner = TurnRunner(loaded)
        runner._brains = _Brains()  # type: ignore[assignment]
        runner._bound_engram_user_id = (  # type: ignore[method-assign]
            lambda app_user_id, claimed: MEMBER
        )
        fake = runner._brains.get(MEMBER)
        runner._resolve_member_client = (  # type: ignore[method-assign]
            lambda **kwargs: (
                fake,
                authenticated,
                loaded.engram_credential_member
                if authenticated
                else loaded.engram_credential_org,
            )
        )
        runner._run_member_op = (  # type: ignore[method-assign]
            lambda brain, op, **kwargs: op(brain) if brain is not None else None
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


def test_write_back_follows_plan_not_global_flag(
    settings: WorkerSettings,
) -> None:
    settings.engram_converse_writeback = True
    settings.engram_member_session_auth = True
    runner = TurnRunner(settings)
    plan = _retrieve_plan()
    try:
        assert runner._should_write_back(plan) is False
        plan.member_authenticated = True
        assert runner._should_write_back(plan) is True
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


class _KindBrain:
    def __init__(self, kind: str) -> None:
        self.kind = kind
        self.retrieves = 0
        self.chats = 0
        self.converses = 0

    def retrieve(self, persona_id: str, query: str, *, top_k: int = 10):
        self.retrieves += 1
        return RetrieveOutcome(results=[], raw={})

    def chat(self, persona_id: str, message: str, session_id: str | None = None):
        self.chats += 1
        return None

    def converse(self, *args: object, **kwargs: object) -> dict[str, bool]:
        self.converses += 1
        return {"ok": True}

    def close(self) -> None:
        return None


class _KindRegistry:
    def __init__(self, kind: str) -> None:
        self.kind = kind
        self.brain = _KindBrain(kind)
        self.api_keys: list[str | None] = []

    def get(self, engram_user_id: str, *, api_key: str | None = None) -> _KindBrain:
        self.api_keys.append(api_key)
        return self.brain

    def forget(self, engram_user_id: str) -> None:
        return None

    def close(self) -> None:
        return None


def test_flag_off_resolves_org_even_when_a_password_exists(
    settings: WorkerSettings,
) -> None:
    runner = TurnRunner(settings)
    org = _KindRegistry("org")
    runner._brains = org  # type: ignore[assignment]
    runner._load_member_password = lambda _uid: "pw"  # type: ignore[method-assign]
    try:
        brain, authenticated, credential = runner._resolve_member_client(
            app_user_id=uuid4(),
            engram_user_id=MEMBER,
            email="a@example.com",
        )
        assert authenticated is False
        assert credential == settings.engram_credential_org
        assert brain.kind == "org"
        assert runner._conversation_mode(False) == "retrieve"
        plan = _retrieve_plan()
        plan.member_authenticated = False
        assert runner._should_write_back(plan) is False
    finally:
        runner.close()


def test_flag_on_with_member_client_grounds_and_writes(
    settings: WorkerSettings,
) -> None:
    loaded = settings.model_copy(update={"engram_member_session_auth": True})
    runner = TurnRunner(loaded)
    member = _KindBrain("member")
    runner._resolve_member_client = (  # type: ignore[method-assign]
        lambda **kwargs: (member, True, loaded.engram_credential_member)
    )
    shared, own, other = _mixed_hits()
    try:
        memories, _outcome, counts = runner._ground_retrieve(
            RetrieveOutcome(results=[shared, own, other], raw={}),
            engram_user_id=MEMBER,
            prior_sid=None,
            brain_ms=1,
            member_authenticated=True,
        )
        assert own.text in memories
        assert other.text not in memories
        assert counts == (3, 2, 1)
        assert runner._conversation_mode(True) == "retrieve"
        chatty = TurnRunner(
            loaded.model_copy(update={"brain_mode": "chat"}),
        )
        try:
            assert chatty._conversation_mode(True) == "chat"
            assert chatty._conversation_mode(False) == "retrieve"
        finally:
            chatty.close()
        plan = _retrieve_plan()
        plan.member_authenticated = True
        loaded.engram_converse_writeback = True
        assert runner._should_write_back(plan) is True
    finally:
        runner.close()


def test_flag_on_null_secret_degrades_to_shared_retrieve(
    settings: WorkerSettings,
) -> None:
    loaded = settings.model_copy(
        update={"engram_member_session_auth": True, "brain_mode": "chat"},
    )
    runner = TurnRunner(loaded)
    org = _KindRegistry("org")
    runner._brains = org  # type: ignore[assignment]
    runner._load_member_password = lambda _uid: None  # type: ignore[method-assign]
    try:
        brain, authenticated, credential = runner._resolve_member_client(
            app_user_id=uuid4(),
            engram_user_id=MEMBER,
            email="a@example.com",
        )
        assert authenticated is False
        assert credential == loaded.engram_credential_org
        assert brain.kind == "org"
        assert runner._conversation_mode(False) == "retrieve"
        shared, own, other = _mixed_hits()
        memories, _outcome, _counts = runner._ground_retrieve(
            RetrieveOutcome(results=[shared, own, other], raw={}),
            engram_user_id=MEMBER,
            prior_sid=None,
            brain_ms=1,
            member_authenticated=False,
        )
        assert memories == [shared.text]
        plan = _retrieve_plan()
        plan.member_authenticated = False
        assert runner._should_write_back(plan) is False
    finally:
        runner.close()


def test_flag_on_login_failure_is_unauthenticated_org(
    settings: WorkerSettings,
) -> None:
    loaded = settings.model_copy(update={"engram_member_session_auth": True})
    runner = TurnRunner(loaded)
    org = _KindRegistry("org")
    runner._brains = org  # type: ignore[assignment]
    runner._load_member_password = lambda _uid: "pw"  # type: ignore[method-assign]
    runner._sessions.token = (  # type: ignore[method-assign]
        lambda **kwargs: None
    )
    try:
        brain, authenticated, credential = runner._resolve_member_client(
            app_user_id=uuid4(),
            engram_user_id=MEMBER,
            email="a@example.com",
        )
        assert authenticated is False
        assert credential == loaded.engram_credential_org
        assert brain.kind == "org"
        assert runner._conversation_mode(False) == "retrieve"
        plan = _retrieve_plan()
        plan.member_authenticated = False
        assert runner._should_write_back(plan) is False
    finally:
        runner.close()


def test_authenticated_op_uses_member_token_not_org(
    settings: WorkerSettings,
) -> None:
    from worker.engram.session import MemberSessionCache

    loaded = settings.model_copy(update={"engram_member_session_auth": True})
    runner = TurnRunner(loaded)
    org = _KindRegistry("org")
    member = _KindRegistry("member")
    runner._brains = org  # type: ignore[assignment]
    runner._member_brains = member  # type: ignore[assignment]
    runner._load_member_password = lambda _uid: "pw"  # type: ignore[method-assign]
    runner._sessions = MemberSessionCache(
        loaded,
        login=lambda _email, _password: {
            "token": "jwt-member",
            "expires_in": 43200,
        },
    )
    try:
        brain, authenticated, credential = runner._resolve_member_client(
            app_user_id=uuid4(),
            engram_user_id=MEMBER,
            email="a@example.com",
        )
        assert authenticated is True
        assert credential == loaded.engram_credential_member
        assert brain.kind == "member"
        used: list[str] = []
        result = runner._run_member_op(
            brain,
            member_authenticated=True,
            app_user_id=uuid4(),
            engram_user_id=MEMBER,
            email="a@example.com",
            op=lambda active: used.append(active.kind) or active.kind,
        )
        assert result == "member"
        assert used == ["member"]
        assert "jwt-member" in member.api_keys
    finally:
        runner.close()


def test_forget_member_session_drops_cached_token(
    settings: WorkerSettings,
) -> None:
    from worker.engram.session import MemberSessionCache

    runner = TurnRunner(settings)
    logins = {"n": 0}

    def login(_email: str, _password: str) -> dict[str, object]:
        logins["n"] += 1
        return {"token": f"tok-{logins['n']}", "expires_in": 43200}

    runner._sessions = MemberSessionCache(settings, login=login)
    try:
        first = runner._sessions.token(
            engram_user_id=MEMBER,
            email="a@example.com",
            password_provider=lambda: "pw",
        )
        assert first == "tok-1"
        runner.forget_member_session(MEMBER)
        second = runner._sessions.token(
            engram_user_id=MEMBER,
            email="a@example.com",
            password_provider=lambda: "pw",
        )
        assert second == "tok-2"
        assert logins["n"] == 2
    finally:
        runner.close()


def test_degraded_write_back_never_converses(
    settings: WorkerSettings,
    monkeypatch,
) -> None:
    from worker.turn import service as turn_mod

    class _Conn:
        def commit(self) -> None:
            return None

    class _Borrow:
        def __enter__(self) -> _Conn:
            return _Conn()

        def __exit__(self, *args: object) -> bool:
            return False

    monkeypatch.setattr(turn_mod, "claim_writeback", lambda *_a, **_k: True)
    monkeypatch.setattr(turn_mod, "borrow", lambda _s: _Borrow())
    settings.engram_converse_writeback = True
    settings.engram_member_session_auth = True
    runner = TurnRunner(settings)
    called: list[str] = []
    runner._run_member_op = (  # type: ignore[method-assign]
        lambda *a, **k: called.append("converse") or {"ok": True}
    )
    plan = _retrieve_plan()
    plan.member_authenticated = False
    plan.spoken = "hi"
    plan.app_user_id = uuid4()
    try:
        runner._write_back(plan)
        assert called == []
    finally:
        runner.close()
