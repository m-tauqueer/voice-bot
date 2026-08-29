from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Any
from uuid import UUID

from worker.config import WorkerSettings
from worker.controller.controller import Controller
from worker.controller.decision import Action, Decision, TurnSignals
from worker.engram.engram_brain import EngramBrain
from worker.engram.errors import (
    BrainError,
    ConflictError,
    ForbiddenError,
    NotFoundError,
    NotSubscribedError,
    PaymentRequiredError,
    RetryableReadError,
    ServerError,
    UnauthorizedError,
    ValidationError,
)
from worker.engram.interface import ChatOutcome
from worker.persistence.db import connect
from worker.persistence.personas import get_persona
from worker.persistence.sessions import (
    get_session,
    set_engram_session_id,
    user_engram_id,
)
from worker.persistence.turns import (
    insert_latency_spans,
    insert_memory_refs,
    insert_turn,
    next_ordinal,
    recent_history,
)
from worker.reframe.errors import ReframeError
from worker.reframe.reframer import Reframer
from worker.schema import TURN_SPEAKER_PERSONA, TURN_SPEAKER_USER
from worker.turn.errors import TurnError

_BRAIN_HTTP: list[tuple[type[BrainError], int]] = [
    (NotSubscribedError, 403),
    (UnauthorizedError, 401),
    (PaymentRequiredError, 402),
    (ForbiddenError, 403),
    (NotFoundError, 404),
    (ValidationError, 422),
    (ConflictError, 409),
    (ServerError, 503),
    (RetryableReadError, 503),
]


def _brain_status(error: BrainError) -> int:
    for cls, status in _BRAIN_HTTP:
        if isinstance(error, cls):
            return status
    return error.status if error.status is not None else 502


def _voice_config(raw: object) -> dict[str, Any]:
    if isinstance(raw, dict):
        return raw
    return {}


@dataclass(frozen=True)
class TurnResult:
    action: str
    reply_text: str | None
    session_id: UUID
    engram_session_id: str | None
    turn_ids: list[UUID]
    reasons: list[str]


class TurnRunner:
    def __init__(self, settings: WorkerSettings) -> None:
        self._settings = settings
        self._controller = Controller()

    def run(
        self,
        *,
        app_user_id: UUID,
        engram_user_id: str,
        persona_id: UUID,
        session_id: UUID,
        text: str,
    ) -> TurnResult:
        started = time.perf_counter()
        conn = connect(self._settings)
        brain: EngramBrain | None = None
        try:
            session = get_session(conn, session_id, for_update=True)
            if session is None:
                raise TurnError(
                    "session not found",
                    status=404,
                    reason="session_not_found",
                )
            if session["ended_at"] is not None:
                raise TurnError("session has ended", status=409, reason="session_ended")
            if UUID(str(session["user_id"])) != app_user_id:
                raise TurnError("forbidden", status=403, reason="session_mismatch")
            if UUID(str(session["persona_id"])) != persona_id:
                raise TurnError("forbidden", status=403, reason="persona_mismatch")
            stored_engram = user_engram_id(conn, app_user_id)
            if stored_engram is None or stored_engram != engram_user_id:
                raise TurnError("forbidden", status=403, reason="identity_mismatch")

            persona = get_persona(conn, persona_id)
            if persona is None:
                raise TurnError(
                    "persona not found",
                    status=404,
                    reason="persona_not_found",
                )
            engram_persona_id = persona["engram_persona_id"]
            if not isinstance(engram_persona_id, str) or not engram_persona_id:
                raise TurnError("persona is missing Engram id", status=500)

            signals = TurnSignals(has_inbound_text=bool(text.strip()))
            halted = self._controller.pre(signals)
            if halted is not None:
                turn_ids = self._persist(
                    conn,
                    session_id=session_id,
                    user_text=text,
                    decision=halted,
                    spoken=None,
                    outcome=None,
                    engram_session_id=session["engram_session_id"],
                    brain_ms=None,
                    reframe_ms=None,
                    total_ms=int((time.perf_counter() - started) * 1000),
                )
                conn.commit()
                return TurnResult(
                    action=halted.action.value,
                    reply_text=None,
                    session_id=session_id,
                    engram_session_id=session["engram_session_id"],
                    turn_ids=turn_ids,
                    reasons=[reason.value for reason in halted.reasons],
                )

            prior_sid = session["engram_session_id"]
            if prior_sid is not None and not isinstance(prior_sid, str):
                prior_sid = None

            brain = EngramBrain(self._settings, engram_user_id)
            try:
                outcome: ChatOutcome | BrainError
                outcome = brain.chat(engram_persona_id, text, session_id=prior_sid)
            except BrainError as exc:
                outcome = exc

            decision = self._controller.decide(outcome, signals)
            if isinstance(outcome, BrainError):
                turn_ids = self._persist(
                    conn,
                    session_id=session_id,
                    user_text=text,
                    decision=decision,
                    spoken=None,
                    outcome=None,
                    engram_session_id=prior_sid,
                    brain_ms=None,
                    reframe_ms=None,
                    total_ms=int((time.perf_counter() - started) * 1000),
                )
                conn.commit()
                raise TurnError(
                    str(outcome),
                    status=_brain_status(outcome),
                    reason=(
                        decision.reasons[0].value
                        if decision.reasons
                        else "brain_error"
                    ),
                )

            spoken: str | None = None
            reframe_ms: int | None = None
            if decision.action is Action.SPEAK:
                history = recent_history(
                    conn,
                    session_id,
                    self._settings.reframe_history_turns,
                )
                reframe_started = time.perf_counter()
                try:
                    spoken = Reframer(self._settings).reframe(
                        outcome.messages,
                        history,
                        _voice_config(persona["voice_config"]),
                    )
                except ReframeError as exc:
                    turn_ids = self._persist(
                        conn,
                        session_id=session_id,
                        user_text=text,
                        decision=decision,
                        spoken=None,
                        outcome=outcome,
                        engram_session_id=outcome.session_id or prior_sid,
                        brain_ms=outcome.brain_ms,
                        reframe_ms=None,
                        total_ms=int((time.perf_counter() - started) * 1000),
                    )
                    conn.commit()
                    raise TurnError(
                        str(exc),
                        status=exc.status or 502,
                        reason="reframe_failed",
                    ) from exc
                reframe_ms = int((time.perf_counter() - reframe_started) * 1000)

            next_sid = outcome.session_id or prior_sid
            if isinstance(next_sid, str) and next_sid:
                set_engram_session_id(conn, session_id, next_sid)
            else:
                next_sid = prior_sid

            turn_ids = self._persist(
                conn,
                session_id=session_id,
                user_text=text,
                decision=decision,
                spoken=spoken,
                outcome=outcome,
                engram_session_id=next_sid,
                brain_ms=outcome.brain_ms,
                reframe_ms=reframe_ms,
                total_ms=int((time.perf_counter() - started) * 1000),
            )
            conn.commit()
            return TurnResult(
                action=decision.action.value,
                reply_text=spoken,
                session_id=session_id,
                engram_session_id=next_sid if isinstance(next_sid, str) else None,
                turn_ids=turn_ids,
                reasons=[reason.value for reason in decision.reasons],
            )
        except TurnError:
            raise
        except Exception:
            conn.rollback()
            raise
        finally:
            if brain is not None:
                brain.close()
            conn.close()

    def _persist(
        self,
        conn: Any,
        *,
        session_id: UUID,
        user_text: str,
        decision: Decision,
        spoken: str | None,
        outcome: ChatOutcome | None,
        engram_session_id: str | None,
        brain_ms: int | None,
        reframe_ms: int | None,
        total_ms: int,
    ) -> list[UUID]:
        reasons = [reason.value for reason in decision.reasons]
        user_ordinal = next_ordinal(conn, session_id)
        user_turn_id = insert_turn(
            conn,
            session_id=session_id,
            ordinal=user_ordinal,
            speaker=TURN_SPEAKER_USER,
            text=user_text,
            controller_action=decision.action.value,
            controller_reasons=reasons,
        )
        ids = [user_turn_id]
        span_turn = user_turn_id
        if spoken is not None and outcome is not None:
            persona_turn_id = insert_turn(
                conn,
                session_id=session_id,
                ordinal=user_ordinal + 1,
                speaker=TURN_SPEAKER_PERSONA,
                text=spoken,
                messages=outcome.messages,
                controller_action=decision.action.value,
                controller_reasons=reasons,
            )
            ids.append(persona_turn_id)
            span_turn = persona_turn_id
            if engram_session_id:
                insert_memory_refs(
                    conn,
                    turn_id=persona_turn_id,
                    memories_used=list(outcome.memories_used),
                    engram_session_id=engram_session_id,
                )
        insert_latency_spans(
            conn,
            turn_id=span_turn,
            brain_ms=brain_ms,
            reframe_ms=reframe_ms,
            total_ms=total_ms,
        )
        return ids
