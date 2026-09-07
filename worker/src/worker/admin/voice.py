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
