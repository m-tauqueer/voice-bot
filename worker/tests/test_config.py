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
    kwargs["engram_member_secret_key"] = None
    loaded = WorkerSettings(_env_file=None, **kwargs)
    assert loaded.brain_mode == "retrieve"
    assert loaded.engram_member_session_auth is False
    assert loaded.engram_member_secret_key is None


def test_boot_allows_missing_fish_key_and_refuses_shared_voice_keys(
    settings: WorkerSettings,
) -> None:
    kwargs = settings.model_dump()
    kwargs["fish_api_key"] = None
    loaded = WorkerSettings(_env_file=None, **kwargs)
    assert loaded.fish_api_key is None
    assert loaded.persona_voice_tts_key == "tts_voice"
    assert loaded.persona_voice_fish_key == "fish_voice"
    assert loaded.persona_voice_provider_key == "voice_provider"
    assert loaded.fish_clone_train_mode == "fast"
    assert loaded.fish_clone_visibility == "private"
    assert loaded.admin_fish_clone_max_bytes == 10485760
    kwargs["persona_voice_tts_key"] = "voice"
    kwargs["persona_voice_fish_key"] = "voice"
    with pytest.raises(ValidationError) as caught:
        WorkerSettings(_env_file=None, **kwargs)
    assert "PERSONA_VOICE_FISH_KEY" in str(caught.value)
