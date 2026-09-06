from uuid import uuid4

from worker.turn.identity import session_identity_reason, stored_engram_matches


def test_matching_identity_is_ok() -> None:
    user = uuid4()
    persona = uuid4()
    assert (
        session_identity_reason(
            session_user_id=user,
            session_persona_id=persona,
            stored_engram_user_id="engram-a",
            claimed_app_user_id=user,
            claimed_persona_id=persona,
            claimed_engram_user_id="engram-a",
        )
        is None
    )


def test_session_mismatch() -> None:
    assert (
        session_identity_reason(
            session_user_id=uuid4(),
            session_persona_id=uuid4(),
            stored_engram_user_id="engram-a",
            claimed_app_user_id=uuid4(),
            claimed_persona_id=uuid4(),
            claimed_engram_user_id="engram-a",
        )
        == "session_mismatch"
    )


def test_persona_mismatch() -> None:
    user = uuid4()
    assert (
        session_identity_reason(
            session_user_id=user,
            session_persona_id=uuid4(),
            stored_engram_user_id="engram-a",
            claimed_app_user_id=user,
            claimed_persona_id=uuid4(),
            claimed_engram_user_id="engram-a",
        )
        == "persona_mismatch"
    )


def test_identity_mismatch_when_stored_engram_differs() -> None:
    user = uuid4()
    persona = uuid4()
    assert (
        session_identity_reason(
            session_user_id=user,
            session_persona_id=persona,
            stored_engram_user_id="engram-a",
            claimed_app_user_id=user,
            claimed_persona_id=persona,
            claimed_engram_user_id="engram-b",
        )
        == "identity_mismatch"
    )
    assert (
        session_identity_reason(
            session_user_id=user,
            session_persona_id=persona,
            stored_engram_user_id=None,
            claimed_app_user_id=user,
            claimed_persona_id=persona,
            claimed_engram_user_id="engram-a",
        )
        == "identity_mismatch"
    )


def test_stored_engram_matches() -> None:
    assert stored_engram_matches("abc", "abc") is True
    assert stored_engram_matches(None, "abc") is False
    assert stored_engram_matches("abc", "xyz") is False
