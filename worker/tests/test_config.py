import pytest
from pydantic import ValidationError

from worker.config import WorkerSettings


def test_boot_refuses_chat_while_member_session_auth_is_false(
    settings: WorkerSettings,
) -> None:
    kwargs = settings.model_dump()
    kwargs["brain_mode"] = "chat"
    kwargs["engram_member_session_auth"] = False
    with pytest.raises(ValidationError) as caught:
        WorkerSettings(_env_file=None, **kwargs)
    text = str(caught.value)
    assert "BRAIN_MODE" in text
    assert "ENGRAM_MEMBER_SESSION_AUTH" in text


def test_boot_accepts_retrieve_while_member_session_auth_is_false(
    settings: WorkerSettings,
) -> None:
    kwargs = settings.model_dump()
    kwargs["brain_mode"] = "retrieve"
    kwargs["engram_member_session_auth"] = False
    loaded = WorkerSettings(_env_file=None, **kwargs)
    assert loaded.brain_mode == "retrieve"
    assert loaded.engram_member_session_auth is False
