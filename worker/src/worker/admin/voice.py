from __future__ import annotations

from typing import Any


def as_voice_config(raw: object) -> dict[str, Any]:
    if isinstance(raw, dict):
        return dict(raw)
    return {}


def merge_tts_voice(
    voice_config: dict[str, Any],
    *,
    tts_voice: str | None,
    key: str,
) -> dict[str, Any]:
    merged = as_voice_config(voice_config)
    if tts_voice is None:
        return merged
    trimmed = tts_voice.strip()
    if trimmed:
        merged[key] = trimmed
    else:
        merged.pop(key, None)
    return merged


def merge_persona_voices(
    voice_config: dict[str, Any],
    *,
    tts_voice: str | None,
    tts_key: str,
    fish_voice: str | None,
    fish_key: str,
) -> dict[str, Any]:
    merged = merge_tts_voice(voice_config, tts_voice=tts_voice, key=tts_key)
    return merge_tts_voice(merged, tts_voice=fish_voice, key=fish_key)
