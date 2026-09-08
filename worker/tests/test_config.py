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


def test_retrieve_scope_settings_load_and_version_path_must_be_absolute(
    settings: WorkerSettings,
) -> None:
    loaded = WorkerSettings(_env_file=None, **settings.model_dump())
    assert loaded.engram_api_version_path == "/v1"
    assert loaded.engram_retrieve_scope_shared == "shared"
    assert loaded.engram_retrieve_scope_private == "private"
    assert loaded.engram_retrieve_scope_both == "both"
    assert loaded.engram_retrieve_top_k_shared == 25
    assert loaded.engram_retrieve_top_k_private == 25
    assert loaded.answer_payload_persona_memories_key == "persona_memories"
    assert loaded.answer_payload_caller_memories_key == "caller_memories"
    assert loaded.memory_ref_pool_key == "pool"
    assert loaded.memory_ref_pool_persona == "persona"
    assert loaded.memory_ref_pool_caller == "caller"
    kwargs = settings.model_dump()
    kwargs["engram_api_version_path"] = "v1"
    with pytest.raises(ValidationError) as caught:
        WorkerSettings(_env_file=None, **kwargs)
    assert "ENGRAM_API_VERSION_PATH" in str(caught.value)


def test_answer_payload_keys_must_be_distinct(settings: WorkerSettings) -> None:
    kwargs = settings.model_dump()
    kwargs["answer_payload_persona_memories_key"] = "memories"
    kwargs["answer_payload_caller_memories_key"] = "memories"
    with pytest.raises(ValidationError) as caught:
        WorkerSettings(_env_file=None, **kwargs)
    assert "ANSWER_PAYLOAD" in str(caught.value)


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
