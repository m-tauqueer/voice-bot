from __future__ import annotations

from worker.engram.user_id import persona_engine_user_id

# Engram pools under a persona: `{org}:{persona}` is shared knowledge the owner
# taught, `{org}:{persona}:{user}` is one member's own history. We read these
# off retrieve rows and never build them (see docs/ENGRAM.md).
_PRIVATE_TENANT_SEGMENTS = 3
_TENANT_SEPARATOR = ":"


def private_pool_owner(tenant: str | None) -> str | None:
    """Return the member a private pool belongs to, or None for shared pools."""
    if not tenant:
        return None
    parts = tenant.split(_TENANT_SEPARATOR)
    if len(parts) != _PRIVATE_TENANT_SEGMENTS:
        return None
    owner = parts[-1].strip()
    return persona_engine_user_id(owner) if owner else None


def is_own_private_pool(tenant: str | None, *, engram_user_id: str) -> bool:
    """True when this row came from that member's own private pool."""
    owner = private_pool_owner(tenant)
    if owner is None:
        return False
    return owner == persona_engine_user_id(engram_user_id)
