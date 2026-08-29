from __future__ import annotations

from collections.abc import Callable
from contextlib import AbstractContextManager, contextmanager
from dataclasses import asdict
from datetime import datetime
from pathlib import Path
from typing import Any
from uuid import UUID

from worker.admin.errors import AdminError
from worker.admin.store import (
    connect,
    find_user,
    list_subscriptions,
    resolve_active_persona,
    upsert_persona,
    upsert_subscription,
)
from worker.config import WorkerSettings
from worker.engram.engram_brain import EngramBrain
from worker.engram.errors import BrainError, ConflictError, ForbiddenError
from worker.engram.interface import IngestOutcome, PersonaBrain, PersonaRecord
from worker.schema import SUBSCRIPTION_ACTIVE


def _jsonable(value: Any) -> Any:
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, UUID):
        return str(value)
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, Path):
        return str(value)
    if isinstance(value, dict):
        return {str(key): _jsonable(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_jsonable(item) for item in value]
    if isinstance(value, PersonaRecord):
        return asdict(value)
    if isinstance(value, IngestOutcome):
        return asdict(value)
    return str(value)


def _row(value: dict[str, Any]) -> dict[str, Any]:
    return _jsonable(value)


def _brain_error(exc: BrainError) -> AdminError:
    status = exc.status if exc.status is not None else 502
    return AdminError(str(exc), status=status, reason="brain_error")


def _require_handle(handle: str | None, fallback: str | None) -> str:
    resolved = handle or fallback
    if not resolved:
        raise AdminError("handle is required", reason="missing_handle")
    return resolved


class PersonaAdmin:
    def __init__(
        self,
        settings: WorkerSettings,
        brain_factory: Callable[[WorkerSettings, str], PersonaBrain] | None = None,
    ) -> None:
        self._settings = settings
        self._brain_factory = brain_factory or (
            lambda loaded, user_id: EngramBrain(loaded, user_id)
        )

    def _brain(self) -> AbstractContextManager[PersonaBrain]:
        @contextmanager
        def _open() -> Any:
            brain = self._brain_factory(self._settings, "")
            try:
                yield brain
            finally:
                brain.close()

        return _open()

    def _require_active(self) -> dict[str, Any]:
        with connect(self._settings) as conn:
            row = resolve_active_persona(conn, self._settings)
        if row is None:
            raise AdminError(
                "no persona is recorded yet",
                status=404,
                reason="persona_missing",
            )
        return row

    def show(self) -> dict[str, Any]:
        with connect(self._settings) as conn:
            local = resolve_active_persona(conn, self._settings)
            subscriptions: list[dict[str, Any]] = []
            if local is not None:
                subscriptions = list_subscriptions(conn, str(local["id"]))
        remote = None
        if local is not None:
            try:
                with self._brain() as brain:
                    remote = brain.get_persona(local["engram_persona_id"])
            except BrainError as exc:
                raise _brain_error(exc) from exc
        return {
            "persona": _row(local) if local else None,
            "engram": _jsonable(remote) if remote else None,
            "subscriptions": _jsonable(subscriptions),
        }

    def register(
        self,
        *,
        engram_persona_id: str,
        handle: str | None,
        display_name: str | None,
        description: str | None,
        voice_config: dict[str, Any],
    ) -> dict[str, Any]:
        try:
            with self._brain() as brain:
                remote = brain.get_persona(engram_persona_id)
        except BrainError as exc:
            raise _brain_error(exc) from exc
        resolved_handle = _require_handle(handle, remote.handle)
        resolved_name = display_name or remote.name
        resolved_description = (
            description if description is not None else remote.description
        )
        with connect(self._settings) as conn:
            local = upsert_persona(
                conn,
                engram_persona_id=remote.id,
                handle=resolved_handle,
                display_name=resolved_name,
                description=resolved_description,
                voice_config=voice_config,
            )
        return {"persona": _row(local), "engram": _jsonable(remote)}

    def create_remote(
        self,
        *,
        name: str,
        handle: str,
        description: str,
        voice_config: dict[str, Any],
    ) -> dict[str, Any]:
        try:
            with self._brain() as brain:
                remote = brain.create_persona(name, handle, description)
        except ForbiddenError as exc:
            raise AdminError(
                "Engram refused create; record a dashboard persona id instead",
                status=403,
                reason="create_forbidden",
            ) from exc
        except BrainError as exc:
            raise _brain_error(exc) from exc
        with connect(self._settings) as conn:
            local = upsert_persona(
                conn,
                engram_persona_id=remote.id,
                handle=handle,
                display_name=name,
                description=description,
                voice_config=voice_config,
            )
        return {"persona": _row(local), "engram": _jsonable(remote)}

    def update_local(
        self,
        *,
        handle: str | None,
        display_name: str | None,
        description: str | None,
        voice_config: dict[str, Any] | None,
    ) -> dict[str, Any]:
        current = self._require_active()
        with connect(self._settings) as conn:
            local = upsert_persona(
                conn,
                engram_persona_id=current["engram_persona_id"],
                handle=handle or current["handle"],
                display_name=display_name or current["display_name"],
                description=(
                    current["description"] if description is None else description
                ),
                voice_config=(
                    current["voice_config"]
                    if voice_config is None
                    else voice_config
                ),
            )
        return {"persona": _row(local)}

    def teach(self, text: str) -> dict[str, Any]:
        persona = self._require_active()
        try:
            with self._brain() as brain:
                result = brain.teach(persona["engram_persona_id"], text)
        except BrainError as exc:
            raise _brain_error(exc) from exc
        return {"ok": True, "result": _jsonable(result)}

    def questions(self) -> dict[str, Any]:
        persona = self._require_active()
        try:
            with self._brain() as brain:
                result = brain.questions(persona["engram_persona_id"])
        except BrainError as exc:
            raise _brain_error(exc) from exc
        payload = result if isinstance(result, dict) else {"value": result}
        questions = payload.get("questions")
        return {
            "questions": _jsonable(questions if isinstance(questions, list) else []),
            "coverage": _jsonable(payload.get("coverage")),
            "raw": _jsonable(payload),
        }

    def answer(self, question_key: str, text: str) -> dict[str, Any]:
        persona = self._require_active()
        try:
            with self._brain() as brain:
                result = brain.answer(
                    persona["engram_persona_id"],
                    question_key,
                    text,
                )
        except BrainError as exc:
            raise _brain_error(exc) from exc
        return {"ok": True, "result": _jsonable(result)}

    def ingest_document(
        self,
        source: Any,
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        persona = self._require_active()
        try:
            with self._brain() as brain:
                result = brain.ingest_shared_document(
                    persona["engram_persona_id"],
                    source,
                    metadata,
                )
        except BrainError as exc:
            raise _brain_error(exc) from exc
        return {"ok": True, "ingest": _jsonable(result)}

    def subscribe(
        self,
        identifier: str,
        *,
        record_local: bool = False,
    ) -> dict[str, Any]:
        persona = self._require_active()
        with connect(self._settings) as conn:
            user = find_user(conn, identifier)
        if user is None:
            raise AdminError(
                "no signed-in user matches that identifier",
                status=404,
                reason="user_missing",
            )
        try:
            with self._brain() as brain:
                result = brain.subscribe(
                    persona["engram_persona_id"],
                    str(user["engram_user_id"]),
                )
        except ConflictError:
            result = {"already": True}
        except ForbiddenError as exc:
            if not record_local:
                raise AdminError(
                    "Engram refused subscribe; use the dashboard then record locally",
                    status=403,
                    reason="subscribe_forbidden",
                ) from exc
            result = {"recorded_local": True}
        except BrainError as exc:
            raise _brain_error(exc) from exc
        with connect(self._settings) as conn:
            upsert_subscription(
                conn,
                user_id=str(user["id"]),
                persona_id=str(persona["id"]),
                status=SUBSCRIPTION_ACTIVE,
            )
        return {
            "ok": True,
            "user": _row(user),
            "result": _jsonable(result),
        }
