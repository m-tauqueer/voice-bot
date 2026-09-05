from __future__ import annotations

from uuid import UUID


def session_identity_reason(
    *,
    session_user_id: UUID,
    session_persona_id: UUID,
    stored_engram_user_id: str | None,
    claimed_app_user_id: UUID,
    claimed_persona_id: UUID,
    claimed_engram_user_id: str,
) -> str | None:
    """Return a refuse reason, or None when the claimed identity matches."""
    if session_user_id != claimed_app_user_id:
        return "session_mismatch"
    if session_persona_id != claimed_persona_id:
        return "persona_mismatch"
    if not stored_engram_matches(stored_engram_user_id, claimed_engram_user_id):
        return "identity_mismatch"
    return None


def stored_engram_matches(stored: str | None, claimed: str) -> bool:
    return stored is not None and stored == claimed
