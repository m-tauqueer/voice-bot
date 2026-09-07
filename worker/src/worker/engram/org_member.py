from __future__ import annotations

import secrets
from collections.abc import Iterator
from contextlib import contextmanager
from typing import Any, Protocol

from engram_sdk.errors import EngramError as SdkEngramError

from worker.config import WorkerSettings
from worker.engram.engram_brain import _map_sdk_error
from worker.engram.errors import BrainError, ConflictError, ValidationError
from worker.engram.factory import create_org_engram
from worker.engram.user_id import persona_engine_user_id


class OrgRoster(Protocol):
    def add_member(
        self,
        email: str,
        *,
        name: str,
        role: str,
        password: str,
    ) -> str: ...

    def list_members(self) -> list[tuple[str, str]]: ...

    def close(self) -> None: ...


class SdkOrgRoster:
    def __init__(self, client: Any) -> None:
        self._client = client

    def add_member(
        self,
        email: str,
        *,
        name: str,
        role: str,
        password: str,
    ) -> str:
        try:
            member = self._client.members.add(
                email,
                name=name,
                role=role,
                password=password,
            )
        except SdkEngramError as exc:
            raise _map_sdk_error(exc) from exc
        return persona_engine_user_id(str(member.user_id))

    def list_members(self) -> list[tuple[str, str]]:
        try:
            rows = self._client.members.list()
        except SdkEngramError as exc:
            raise _map_sdk_error(exc) from exc
        found: list[tuple[str, str]] = []
        for row in rows:
            email = str(getattr(row, "email", "") or "")
            user_id = persona_engine_user_id(str(getattr(row, "user_id", "") or ""))
            if email and user_id:
                found.append((email, user_id))
        return found

    def close(self) -> None:
        closer = getattr(self._client, "close", None)
        if closer is not None:
            closer()


@contextmanager
def open_org_roster(settings: WorkerSettings) -> Iterator[SdkOrgRoster]:
    client = create_org_engram(settings)
    roster = SdkOrgRoster(client)
    try:
        yield roster
    finally:
        roster.close()


def skip_org_join(settings: WorkerSettings, email: str) -> bool:
    prefix = settings.engram_org_join_skip_email_prefix.lower()
    domain = settings.engram_org_join_skip_email_domain.lower()
    lowered = email.strip().lower()
    if not prefix or not domain or "@" not in lowered:
        return False
    local, _, host = lowered.partition("@")
    return local.startswith(prefix) and host == domain


def _member_id_for_email(roster: OrgRoster, email: str) -> str | None:
    wanted = email.strip().lower()
    for listed_email, user_id in roster.list_members():
        if listed_email.strip().lower() == wanted:
            return user_id
    return None


def ensure_org_member(
    roster: OrgRoster,
    settings: WorkerSettings,
    *,
    email: str,
) -> str:
    """Return the Engram People user_id for this Google email.

    Tries add without a password first (email already on Engram). A 422 means
    a new People row, which needs a one-time password we never log or keep.
    """
    if skip_org_join(settings, email):
        raise BrainError(settings.log_engram_join_skipped)
    role = settings.engram_org_member_role
    try:
        return roster.add_member(email, name=email, role=role, password="")
    except ConflictError:
        found = _member_id_for_email(roster, email)
        if found:
            return found
        raise
    except ValidationError:
        password = secrets.token_urlsafe(settings.engram_org_member_password_nbytes)
        try:
            return roster.add_member(
                email,
                name=email,
                role=role,
                password=password,
            )
        except ConflictError:
            found = _member_id_for_email(roster, email)
            if found:
                return found
            raise
        finally:
            password = ""
    raise BrainError(settings.log_engram_join_failed)
