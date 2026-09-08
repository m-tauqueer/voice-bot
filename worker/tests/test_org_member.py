from engram_sdk.errors import ForbiddenError as SdkForbiddenError

from worker.config import WorkerSettings
from worker.engram.errors import (
    BrainError,
    ConflictError,
    ForbiddenError,
    ValidationError,
)
from worker.engram.org_member import (
    SdkOrgRoster,
    ensure_org_member,
    skip_org_join,
)


class FakeRoster:
    def __init__(
        self,
        *,
        user_id: str = "eng-1",
        add_error: Exception | None = None,
        listed: list[tuple[str, str]] | None = None,
        fail_empty_password: bool = False,
        add_error_after_password: Exception | None = None,
    ) -> None:
        self.user_id = user_id
        self.add_error = add_error
        self.add_error_after_password = add_error_after_password
        self.listed = listed or []
        self.fail_empty_password = fail_empty_password
        self.passwords: list[bool] = []
        self.closed = False

    def add_member(
        self,
        email: str,
        *,
        name: str,
        role: str,
        password: str,
    ) -> str:
        del email, name, role
        self.passwords.append(bool(password))
        if self.fail_empty_password and not password:
            raise ValidationError("password required", status=422)
        if password and self.add_error_after_password is not None:
            raise self.add_error_after_password
        if self.add_error is not None:
            raise self.add_error
        return self.user_id

    def list_members(self) -> list[tuple[str, str]]:
        return list(self.listed)

    def close(self) -> None:
        self.closed = True


def test_skip_probe_emails(settings: WorkerSettings) -> None:
    assert skip_org_join(settings, "probe-abc@example.test") is True
    assert skip_org_join(settings, "member@example.com") is False
    assert skip_org_join(settings, "probe-abc@gmail.com") is False


def test_ensure_add_without_password(settings: WorkerSettings) -> None:
    roster = FakeRoster(user_id="abc123")
    assert (
        ensure_org_member(roster, settings, email="sam@example.com") == "abc123"
    )
    assert roster.passwords == [False]


def test_ensure_new_member_retries_with_password(settings: WorkerSettings) -> None:
    roster = FakeRoster(user_id="new-id", fail_empty_password=True)
    assert ensure_org_member(roster, settings, email="new@example.com") == "new-id"
    assert roster.passwords == [False, True]


def test_ensure_conflict_resolves_from_list(settings: WorkerSettings) -> None:
    roster = FakeRoster(
        add_error=ConflictError("exists", status=409),
        listed=[("Sam@Example.com", "listed-id")],
    )
    assert (
        ensure_org_member(roster, settings, email="sam@example.com") == "listed-id"
    )


def test_ensure_skip_probe_raises(settings: WorkerSettings) -> None:
    roster = FakeRoster()
    try:
        ensure_org_member(roster, settings, email="probe-1@example.test")
    except BrainError as exc:
        assert str(exc) == settings.log_engram_join_skipped
    else:
        raise AssertionError("expected BrainError")
    assert roster.passwords == []


def test_ensure_conflict_without_roster_entry_raises(settings: WorkerSettings) -> None:
    roster = FakeRoster(add_error=ConflictError("exists", status=409), listed=[])
    try:
        ensure_org_member(roster, settings, email="nobody@example.com")
    except ConflictError:
        return
    raise AssertionError("expected ConflictError")


def test_ensure_conflict_after_password_resolves(settings: WorkerSettings) -> None:
    roster = FakeRoster(
        fail_empty_password=True,
        add_error_after_password=ConflictError("exists", status=409),
        listed=[("new@example.com", "listed-id")],
    )
    assert (
        ensure_org_member(roster, settings, email="new@example.com") == "listed-id"
    )
    assert roster.passwords == [False, True]


class _Member:
    def __init__(self, user_id: str, email: str) -> None:
        self.user_id = user_id
        self.email = email


class _Members:
    def __init__(self, *, boom: bool = False) -> None:
        self.boom = boom
        self.closed = False

    def add(self, email: str, name: str = "", role: str = "member", password: str = ""):
        del name, role, password
        if self.boom:
            raise SdkForbiddenError(403, "missing permission(s): ['members:manage']")
        return _Member("3a07018e-b5c2-483a-b80f-07e90488b5f4", email)

    def list(self):
        return [
            _Member("listed-id", "keep@example.com"),
            _Member("", "skip-empty-id@example.com"),
            _Member("skip-empty-email", ""),
        ]


class _Client:
    def __init__(self, *, boom: bool = False) -> None:
        self.members = _Members(boom=boom)
        self.closed = False

    def close(self) -> None:
        self.closed = True


def test_sdk_roster_add_list_and_close() -> None:
    client = _Client()
    roster = SdkOrgRoster(client)
    assert roster.add_member(
        "sam@example.com",
        name="sam@example.com",
        role="member",
        password="",
    ) == "3a07018eb5c2483ab80f07e90488b5f4"
    assert roster.list_members() == [("keep@example.com", "listed-id")]
    roster.close()
    assert client.closed is True


def test_sdk_roster_maps_forbidden() -> None:
    roster = SdkOrgRoster(_Client(boom=True))
    try:
        roster.add_member("a@b.com", name="a", role="member", password="")
    except ForbiddenError as exc:
        assert exc.status == 403
    else:
        raise AssertionError("expected ForbiddenError")
