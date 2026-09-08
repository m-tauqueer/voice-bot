"""Live Engram wrapper probe against a dashboard-created persona."""

from __future__ import annotations

import sys
from collections.abc import Callable
from typing import Any

from worker.admin.store import connect, write_probe_persona
from worker.config import load_settings
from worker.engram.engram_brain import EngramBrain
from worker.engram.errors import BrainError, ForbiddenError


def _try(label: str, op: Callable[[], Any]) -> Any:
    try:
        result = op()
        print(f"{label}=ok")
        return result
    except ForbiddenError as exc:
        print(f"{label}=SKIP {exc} status={exc.status}")
        return None


def main() -> int:
    settings = load_settings()
    if not settings.engram_api_key or not settings.engram_org_id:
        print("engram=SKIP Engram is not configured")
        print("PROBE_OK")
        return 0
    persona_id = settings.engram_persona_id
    if not persona_id:
        print(
            "FAIL: set ENGRAM_PERSONA_ID to the dashboard-created persona",
            file=sys.stderr,
        )
        return 1
    brain = EngramBrain(settings, "")
    try:
        persona = brain.get_persona(persona_id)
        print(f"persona_id={persona.id}")
        print(f"persona_handle={persona.handle}")
        print(f"persona_tenant={persona.tenant}")
        _try("questions", lambda: brain.questions(persona.id))
        _try(
            "retrieve",
            lambda: brain.retrieve(persona.id, "who are you"),
        )
        if not settings.probe_persona_id:
            print(f"chat=SKIP {settings.probe_write_skip}")
            print("PROBE_OK")
            return 0
        conn = connect(settings)
        try:
            write_row = write_probe_persona(conn, settings)
        finally:
            conn.close()
        if write_row is None:
            print(
                "FAIL: PROBE_PERSONA_ID is missing or unpublished locally",
                file=sys.stderr,
            )
            return 1
        write_id = write_row["engram_persona_id"]
        if not isinstance(write_id, str) or not write_id:
            print("FAIL: throwaway persona is missing Engram id", file=sys.stderr)
            return 1
        outcome = brain.chat(write_id, "Who are you?")
        print(f"session_id={outcome.session_id}")
        print(f"brain_ms={outcome.brain_ms}")
        print(f"messages={outcome.messages!r}")
        print(f"text={outcome.text!r}")
        print(f"memories_used_count={len(outcome.memories_used)}")
        if not outcome.messages:
            print("FAIL: chat returned no messages", file=sys.stderr)
            return 1
        if not outcome.session_id:
            print("FAIL: chat did not return session_id", file=sys.stderr)
            return 1
        print("PROBE_OK")
        return 0
    except BrainError as exc:
        print(f"FAIL: {exc} status={exc.status}", file=sys.stderr)
        return 1
    except Exception as exc:
        print(f"FAIL: {exc}", file=sys.stderr)
        return 1
    finally:
        brain.close()


if __name__ == "__main__":
    raise SystemExit(main())
