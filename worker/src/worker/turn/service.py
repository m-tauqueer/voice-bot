from __future__ import annotations

import time
from collections.abc import Iterator
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from typing import Any, NoReturn
from uuid import UUID, uuid4

import structlog
from structlog.contextvars import bind_contextvars, clear_contextvars

from worker.clients import create_openai
from worker.config import WorkerSettings
from worker.controller.controller import Controller
from worker.controller.decision import Action, Decision, TurnSignals
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
from worker.engram.org_member import (
    ensure_org_member,
    open_org_roster,
    skip_org_join,
)
from worker.engram.registry import BrainRegistry
from worker.engram.user_id import persona_engine_user_id
from worker.notices import publish_notice, publish_trace
from worker.observe.fields import turn_log_fields
from worker.persistence.db import borrow
from worker.persistence.personas import get_persona, visible_to_members
from worker.persistence.receipts import (
    claim_write_receipt,
    claim_writeback,
    load_receipt_turn_ids,
    store_receipt_turn_ids,
)
from worker.persistence.sessions import (
    get_session,
    set_engram_session_id,
    set_user_engram_id,
    user_email,
    user_engram_id,
)
from worker.persistence.subscriptions import (
    has_active_subscription,
    upsert_active_subscription,
)
from worker.persistence.turns import (
    insert_latency_spans,
    insert_memory_refs,
    insert_turn,
    next_ordinal,
    recent_history,
)
from worker.quota.decision import is_owner_email, quota_applies_to_caller
from worker.quota.store import (
    load_quota_usage,
    log_quota_warn,
    refuse_quota,
    resolve_live_quota_limits,
)
from worker.reframe.answerer import Answerer
from worker.reframe.errors import ReframeError, ReframeUnavailableError
from worker.reframe.reframer import Reframer
from worker.reframe.types import HistoryTurn
from worker.schema import TURN_SPEAKER_PERSONA, TURN_SPEAKER_USER
from worker.turn.errors import TurnError
from worker.turn.grant import grant_persona_access, should_attempt_grant
from worker.turn.identity import (
    claimed_is_admit_placeholder,
    session_identity_reason,
    stored_engram_matches,
)

log = structlog.get_logger(__name__)

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
    correlation_id: UUID
    recorded: bool = True
    warning: str | None = None
    warning_code: str | None = None


@dataclass
class TurnPlan:
    """Everything a turn needs after the brain has answered.

    Held between `begin` and `finish` so no database connection and no session
    lock is held across the Engram call or the reframe.
    """

    session_id: UUID
    text: str
    started: float
    decision: Decision
    prior_sid: str | None
    voice_config: dict[str, Any]
    history: list[HistoryTurn]
    correlation_id: UUID
    mode: str = "chat"
    memories: list[str] = field(default_factory=list)
    engram_user_id: str | None = None
    engram_persona_id: str | None = None
    outcome: ChatOutcome | None = None
    reframe_ms: int | None = None
    reframe_first_token_ms: int | None = None
    spoken: str | None = None
    speaks: bool = field(init=False)

    def __post_init__(self) -> None:
        self.speaks = self.decision.action is Action.SPEAK

    @property
    def brain_ms(self) -> int | None:
        return self.outcome.brain_ms if self.outcome is not None else None

    @property
    def engram_session_id(self) -> str | None:
        if self.outcome is not None and self.outcome.session_id:
            return self.outcome.session_id
        return self.prior_sid

    def total_ms(self) -> int:
        return int((time.perf_counter() - self.started) * 1000)


class TurnRunner:
    def __init__(self, settings: WorkerSettings) -> None:
        self._settings = settings
        self._controller = Controller()
        self._brains = BrainRegistry(settings)
        # The write-back must not hold the reply's connection open, so it runs
        # on its own small pool once the words are already out.
        self._writers = ThreadPoolExecutor(
            max_workers=settings.engram_writeback_workers,
            thread_name_prefix="engram-writeback",
        )
        self._openai: Any | None = None
        self._reframer: Reframer | None = None
        self._answerer: Answerer | None = None
        self._grant_tried: set[tuple[str, str]] = set()

    def _llm(self) -> Any:
        if self._openai is None:
            try:
                self._openai = create_openai(self._settings)
            except RuntimeError as exc:
                raise ReframeUnavailableError(str(exc)) from exc
        return self._openai

    def _reframe_client(self) -> Reframer:
        if self._reframer is None:
            self._reframer = Reframer(self._settings, self._llm())
        return self._reframer

    def _answer_client(self) -> Answerer:
        if self._answerer is None:
            self._answerer = Answerer(self._settings, self._llm())
        return self._answerer

    def run(
        self,
        *,
        app_user_id: UUID,
        engram_user_id: str,
        persona_id: UUID,
        session_id: UUID,
        text: str,
        correlation_id: UUID | None = None,
    ) -> TurnResult:
        plan = self.begin(
            app_user_id=app_user_id,
            engram_user_id=engram_user_id,
            persona_id=persona_id,
            session_id=session_id,
            text=text,
            correlation_id=correlation_id,
        )
        if plan.speaks:
            self.speak(plan)
        return self.finish(plan)

    def begin(
        self,
        *,
        app_user_id: UUID,
        engram_user_id: str,
        persona_id: UUID,
        session_id: UUID,
        text: str,
        correlation_id: UUID | None = None,
    ) -> TurnPlan:
        """Validate, ask the brain, and decide. Raises `TurnError` before any
        reply byte is produced, so the caller can still choose a status code."""
        started = time.perf_counter()
        traced = correlation_id or uuid4()
        bind_contextvars(
            correlation_id=str(traced),
            session_id=str(session_id),
        )
        try:
            return self._begin(
                app_user_id=app_user_id,
                engram_user_id=engram_user_id,
                persona_id=persona_id,
                session_id=session_id,
                text=text,
                started=started,
                correlation_id=traced,
            )
        except Exception:
            clear_contextvars()
            raise

    def _begin(
        self,
        *,
        app_user_id: UUID,
        engram_user_id: str,
        persona_id: UUID,
        session_id: UUID,
        text: str,
        started: float,
        correlation_id: UUID,
    ) -> TurnPlan:
        mirrored = False
        try:
            with borrow(self._settings) as conn:
                # Locked only for these local reads: it makes two turns that start
                # at once share one Engram thread instead of minting one each.
                session = get_session(conn, session_id, for_update=True)
                if session is None:
                    raise TurnError(
                        "session not found",
                        status=404,
                        reason="session_not_found",
                    )
                if session["ended_at"] is not None:
                    raise TurnError(
                        "session has ended",
                        status=409,
                        reason="session_ended",
                    )
                stored_engram = user_engram_id(conn, app_user_id)
                mismatch = session_identity_reason(
                    session_user_id=UUID(str(session["user_id"])),
                    session_persona_id=UUID(str(session["persona_id"])),
                    stored_engram_user_id=stored_engram,
                    claimed_app_user_id=app_user_id,
                    claimed_persona_id=persona_id,
                    claimed_engram_user_id=engram_user_id,
                )
                if mismatch is not None or not stored_engram:
                    raise TurnError(
                        "forbidden",
                        status=403,
                        reason=mismatch or "identity_mismatch",
                    )
                # Bind the stored People id, not a stale voice header.
                engram_user_id = persona_engine_user_id(stored_engram)

                email = user_email(conn, app_user_id)
                if quota_applies_to_caller(
                    owner=is_owner_email(email or "", self._settings.owner_emails),
                ):
                    limits = resolve_live_quota_limits(conn, self._settings)
                    usage = load_quota_usage(conn, app_user_id, limits)
                    refused = refuse_quota(self._settings, usage, limits)
                    if refused is not None:
                        log.warning(
                            self._settings.quota_log_refused,
                            user_id=str(app_user_id),
                            kind=refused["kind"],
                            used=refused["used"],
                            limit=refused["limit"],
                        )
                        raise TurnError(
                            str(refused["error"]),
                            status=429,
                            reason=str(refused["code"]),
                            code=str(refused["code"]),
                            reset_at=usage.reset_at,
                        )
                    log_quota_warn(self._settings, app_user_id, usage, limits)

                persona = visible_to_members(get_persona(conn, persona_id))
                if persona is None:
                    raise TurnError(
                        self._settings.persona_error_not_found,
                        status=404,
                        reason="persona_not_found",
                    )
                engram_persona_id = persona["engram_persona_id"]
                if not isinstance(engram_persona_id, str) or not engram_persona_id:
                    raise TurnError("persona is missing Engram id", status=500)

                prior_sid = session["engram_session_id"]
                if prior_sid is not None and not isinstance(prior_sid, str):
                    prior_sid = None
                if not prior_sid:
                    # Engram treats the conversation id as an opaque caller-chosen
                    # key. Claiming it here keeps one thread per app session.
                    prior_sid = uuid4().hex
                    set_engram_session_id(conn, session_id, prior_sid)
                    conn.commit()
                voice_config = _voice_config(persona["voice_config"])
                history = recent_history(
                    conn,
                    session_id,
                    self._settings.reframe_history_turns,
                )
                mirrored = has_active_subscription(
                    conn,
                    app_user_id,
                    persona_id,
                )
        except TurnError:
            raise
        except Exception as exc:
            log.exception("turn could not start", session_id=str(session_id))
            raise TurnError(
                self._settings.failure_message_database,
                status=503,
                reason="database_unavailable",
                code=self._settings.failure_code_database,
            ) from exc

        signals = TurnSignals(has_inbound_text=bool(text.strip()))
        halted = self._controller.pre(signals)
        if halted is not None:
            return TurnPlan(
                session_id=session_id,
                text=text,
                started=started,
                decision=halted,
                prior_sid=prior_sid,
                voice_config=voice_config,
                history=history,
                correlation_id=correlation_id,
                mode=self._settings.brain_mode,
            )

        brain = self._brains.get(engram_user_id)
        pair = (str(app_user_id), str(persona_id))
        if should_attempt_grant(
            mirrored=mirrored,
            already_tried=pair in self._grant_tried,
        ):
            engine_user_id = self._join_and_subscribe(
                app_user_id=app_user_id,
                email=email or "",
                stored_engram_user_id=engram_user_id,
                engram_persona_id=engram_persona_id,
                persona_id=persona_id,
            )
            self._grant_tried.add(pair)
            engram_user_id = engine_user_id
            brain = self._brains.get(engram_user_id)

        mode = self._settings.brain_mode
        memories: list[str] = []
        outcome: ChatOutcome | BrainError
        try:
            if mode == "retrieve":
                # Read memory and compose here. The controller still gates on
                # whether anything grounded came back.
                started_read = time.perf_counter()
                found = brain.retrieve(
                    engram_persona_id,
                    text,
                    top_k=self._settings.engram_retrieve_top_k,
                )
                memories = [
                    hit.text.strip()
                    for hit in found.results
                    if isinstance(hit.text, str) and hit.text.strip()
                ]
                outcome = ChatOutcome(
                    messages=memories,
                    text=self._settings.engram_message_join.join(memories),
                    memories_used=[hit.raw for hit in found.results],
                    session_id=prior_sid,
                    raw=found.raw,
                    brain_ms=int((time.perf_counter() - started_read) * 1000),
                )
            else:
                outcome = brain.chat(engram_persona_id, text, session_id=prior_sid)
        except BrainError as exc:
            outcome = exc

        decision = self._controller.decide(outcome, signals)
        if isinstance(outcome, BrainError):
            plan = TurnPlan(
                session_id=session_id,
                text=text,
                started=started,
                decision=decision,
                prior_sid=prior_sid,
                voice_config=voice_config,
                history=history,
                correlation_id=correlation_id,
                mode=mode,
            )
            log.error(
                "engram failed",
                session_id=str(session_id),
                error=str(outcome),
                status=_brain_status(outcome),
            )
            recorded = self.finish(plan)
            if not recorded.recorded:
                log.error(
                    "silence turn was not recorded after brain failure",
                    session_id=str(session_id),
                )
            publish_notice(
                self._settings,
                session_id,
                self._settings.failure_code_engram,
                self._settings.failure_message_engram,
            )
            raise TurnError(
                self._settings.failure_message_engram,
                status=_brain_status(outcome),
                reason=(
                    decision.reasons[0].value if decision.reasons else "brain_error"
                ),
                code=self._settings.failure_code_engram,
            ) from outcome

        return TurnPlan(
            session_id=session_id,
            text=text,
            started=started,
            decision=decision,
            prior_sid=prior_sid,
            voice_config=voice_config,
            history=history,
            correlation_id=correlation_id,
            mode=mode,
            memories=memories,
            outcome=outcome,
            engram_user_id=engram_user_id,
            engram_persona_id=engram_persona_id,
        )

    def speak(self, plan: TurnPlan) -> str:
        """Reframe in one shot. Used where nothing is waiting on first token."""
        if not plan.speaks or plan.outcome is None:
            raise TurnError("turn does not speak", status=500, reason="not_speaking")
        started = time.perf_counter()
        try:
            if plan.mode == "retrieve":
                spoken = self._answer_client().answer(
                    plan.memories,
                    plan.history,
                    plan.text,
                    plan.voice_config,
                )
            else:
                spoken = self._reframe_client().reframe(
                    plan.outcome.messages,
                    plan.history,
                    plan.voice_config,
                )
        except ReframeError as exc:
            self._fail_reframe(plan, exc)
        plan.reframe_ms = int((time.perf_counter() - started) * 1000)
        plan.reframe_first_token_ms = plan.reframe_ms
        plan.spoken = spoken
        return spoken

    def stream_speak(self, plan: TurnPlan) -> Iterator[str]:
        """Reframe token by token so the listener hears the first words sooner.

        The caller must drain this fully and then call `finish`.
        """
        if not plan.speaks or plan.outcome is None:
            raise TurnError("turn does not speak", status=500, reason="not_speaking")
        started = time.perf_counter()
        pieces: list[str] = []
        pieces_source = (
            self._answer_client().stream(
                plan.memories,
                plan.history,
                plan.text,
                plan.voice_config,
            )
            if plan.mode == "retrieve"
            else self._reframe_client().stream(
                plan.outcome.messages,
                plan.history,
                plan.voice_config,
            )
        )
        try:
            for piece in pieces_source:
                if plan.reframe_first_token_ms is None:
                    plan.reframe_first_token_ms = int(
                        (time.perf_counter() - started) * 1000
                    )
                pieces.append(piece)
                yield piece
        finally:
            # Keep whatever was actually spoken, even if the stream broke.
            plan.reframe_ms = int((time.perf_counter() - started) * 1000)
            spoken = "".join(pieces).strip()
            plan.spoken = spoken or None

    def _fail_reframe(self, plan: TurnPlan, exc: ReframeError) -> NoReturn:
        log.error(
            "speaking llm failed",
            session_id=str(plan.session_id),
            error=str(exc),
        )
        plan.spoken = None
        self.finish(plan)
        publish_notice(
            self._settings,
            plan.session_id,
            self._settings.failure_code_speaking_llm,
            self._settings.failure_message_speaking_llm,
        )
        raise TurnError(
            self._settings.failure_message_speaking_llm,
            status=exc.status or 502,
            reason="reframe_failed",
            code=self._settings.failure_code_speaking_llm,
        ) from exc

    def finish(self, plan: TurnPlan) -> TurnResult:
        """Write the canonical record. Runs after the reply has been delivered.

        A persist failure is logged and returned, never raised: the reply has
        already gone out.
        """
        total_ms = plan.total_ms()
        outcome = plan.outcome
        spoken = plan.spoken
        next_sid = plan.engram_session_id
        turn_ids: list[UUID] = []
        recorded = True
        warning: str | None = None
        warning_code: str | None = None
        try:
            with borrow(self._settings) as conn:
                # Lock only for the ordinal + insert window, never across the brain.
                get_session(conn, plan.session_id, for_update=True)
                if outcome is not None and isinstance(next_sid, str) and next_sid:
                    set_engram_session_id(conn, plan.session_id, next_sid)
                turn_ids = self._persist(
                    conn,
                    session_id=plan.session_id,
                    user_text=plan.text,
                    decision=plan.decision,
                    spoken=spoken,
                    outcome=outcome,
                    engram_session_id=next_sid,
                    brain_ms=plan.brain_ms,
                    reframe_ms=plan.reframe_ms,
                    reframe_first_token_ms=plan.reframe_first_token_ms,
                    total_ms=total_ms,
                    mode=plan.mode,
                    correlation_id=plan.correlation_id,
                )
                conn.commit()
        except Exception:
            recorded = False
            warning = self._settings.failure_message_record
            warning_code = self._settings.failure_code_record
            log.exception(
                "turn was not recorded",
                session_id=str(plan.session_id),
            )
        if recorded:
            publish_trace(
                self._settings,
                plan.session_id,
                plan.correlation_id,
                turn_ids,
            )
        if self._should_write_back(plan):
            self._writers.submit(self._write_back, plan)
        result = TurnResult(
            action=plan.decision.action.value,
            reply_text=spoken,
            session_id=plan.session_id,
            engram_session_id=next_sid if isinstance(next_sid, str) else None,
            turn_ids=turn_ids,
            reasons=[reason.value for reason in plan.decision.reasons],
            correlation_id=plan.correlation_id,
            recorded=recorded,
            warning=warning,
            warning_code=warning_code,
        )
        log.info(
            self._settings.log_turn_event,
            **turn_log_fields(
                self._settings,
                {
                    "correlation_id": str(result.correlation_id),
                    "session_id": str(plan.session_id),
                    "action": result.action,
                    "reasons": result.reasons,
                    "turn_ids": [str(turn_id) for turn_id in result.turn_ids],
                    "brain_ms": plan.brain_ms,
                    "reframe_ms": plan.reframe_ms,
                    "reframe_first_token_ms": plan.reframe_first_token_ms,
                    "brain_mode": plan.mode,
                    "recorded": result.recorded,
                },
            ),
        )
        clear_contextvars()
        return result

    def _join_and_subscribe(
        self,
        *,
        app_user_id: UUID,
        email: str,
        stored_engram_user_id: str,
        engram_persona_id: str,
        persona_id: UUID,
    ) -> str:
        if skip_org_join(self._settings, email) or not email.strip():
            raise TurnError(
                self._settings.failure_message_engram_join,
                status=403,
                reason="engram_join_skipped",
                code=self._settings.failure_code_engram_join,
            )
        engine_id = self._ensure_member_id(email)
        engine_id = self._persist_engram_user_id(
            app_user_id,
            stored_engram_user_id,
            engine_id,
        )
        granted = grant_persona_access(
            self._brains.get(engine_id),
            self._settings,
            engram_persona_id=engram_persona_id,
            engram_user_id=engine_id,
        )
        if granted.reason == "validation":
            engine_id = self._ensure_member_id(email)
            engine_id = self._persist_engram_user_id(
                app_user_id,
                stored_engram_user_id,
                engine_id,
            )
            granted = grant_persona_access(
                self._brains.get(engine_id),
                self._settings,
                engram_persona_id=engram_persona_id,
                engram_user_id=engine_id,
            )
        if not granted.subscribed:
            raise TurnError(
                self._settings.failure_message_engram_join,
                status=granted.status if granted.status is not None else 502,
                reason=granted.reason or "engram_join_failed",
                code=self._settings.failure_code_engram_join,
            )
        if granted.mirror:
            try:
                with borrow(self._settings) as conn:
                    upsert_active_subscription(
                        conn,
                        app_user_id,
                        persona_id,
                    )
                    conn.commit()
            except Exception:
                log.warning(self._settings.log_subscribe_failed)
        return engine_id

    def _ensure_member_id(self, email: str) -> str:
        try:
            with open_org_roster(self._settings) as roster:
                return ensure_org_member(roster, self._settings, email=email)
        except BrainError as exc:
            log.warning(self._settings.log_engram_join_failed, status=exc.status)
            raise TurnError(
                self._settings.failure_message_engram_join,
                status=exc.status if exc.status is not None else 502,
                reason="engram_join_failed",
                code=self._settings.failure_code_engram_join,
            ) from exc

    def _persist_engram_user_id(
        self,
        app_user_id: UUID,
        stored_engram_user_id: str,
        engine_id: str,
    ) -> str:
        engine_id = persona_engine_user_id(engine_id)
        if engine_id == persona_engine_user_id(stored_engram_user_id):
            return engine_id
        try:
            with borrow(self._settings) as conn:
                set_user_engram_id(conn, app_user_id, engine_id)
                conn.commit()
        except Exception as exc:
            log.warning(self._settings.log_engram_join_failed)
            raise TurnError(
                self._settings.failure_message_database,
                status=503,
                reason="database_unavailable",
                code=self._settings.failure_code_database,
            ) from exc
        return engine_id

    def _should_write_back(self, plan: TurnPlan) -> bool:
        # chat writes the caller's private pool itself; only retrieve owes one.
        if plan.mode != "retrieve":
            return False
        if not self._settings.engram_converse_writeback:
            return False
        return bool(plan.engram_user_id and plan.engram_persona_id)

    def _write_back(self, plan: TurnPlan) -> None:
        """Record the exchange in Engram after the reply has been delivered.

        Runs off the reply path, so a slow or failing write costs the
        conversation nothing. Writes are never retried (TRD §3).
        """
        if not plan.engram_user_id or not plan.engram_persona_id:
            return
        try:
            with borrow(self._settings) as conn:
                claimed = claim_writeback(
                    conn,
                    plan.session_id,
                    plan.correlation_id,
                )
                conn.commit()
            if not claimed:
                return
        except Exception:
            log.warning(
                "engram write-back claim failed",
                session_id=str(plan.session_id),
            )
            return
        sid = plan.engram_session_id
        entries: list[tuple[str, str]] = [
            (plan.text, self._settings.engram_converse_user_speaker),
        ]
        if plan.spoken:
            entries.append(
                (plan.spoken, self._settings.engram_converse_persona_speaker),
            )
        brain = self._brains.get(plan.engram_user_id)
        for body, speaker in entries:
            if not body.strip():
                continue
            try:
                brain.converse(
                    plan.engram_persona_id,
                    body,
                    session_id=sid,
                    speaker=speaker,
                )
            except BrainError as exc:
                log.warning(
                    "engram write-back failed",
                    session_id=str(plan.session_id),
                    speaker=speaker,
                    error=str(exc),
                )
                return
            except Exception as exc:  # noqa: BLE001 - a writer thread must not die
                log.warning(
                    "engram write-back raised",
                    session_id=str(plan.session_id),
                    error=str(exc),
                )
                return

    def retrieve_memories(
        self,
        *,
        app_user_id: UUID,
        engram_user_id: str,
        engram_persona_id: str,
    ) -> list[dict[str, str | None]]:
        bound = self._bound_engram_user_id(app_user_id, engram_user_id)
        brain = self._brains.get(bound)
        outcome = brain.retrieve(
            engram_persona_id,
            self._settings.memory_panel_query,
            top_k=self._settings.memory_panel_top_k,
        )
        memories: list[dict[str, str | None]] = []
        for hit in outcome.results:
            if not hit.text:
                continue
            memories.append({"text": hit.text, "tenant": hit.tenant})
        return memories

    def _bound_engram_user_id(self, app_user_id: UUID, claimed: str) -> str:
        """Refuse a caller whose stored Engram id does not match the header.

        The turn path already checks this inline in `_begin`; the memory panel
        needs the same gate so a valid internal secret alone can never read
        another user's private pool. After join, bind the stored People id
        even if the header is still the admit placeholder.
        """
        try:
            with borrow(self._settings) as conn:
                stored = user_engram_id(conn, app_user_id)
        except Exception as exc:
            raise TurnError(
                self._settings.failure_message_database,
                status=503,
                reason="database_unavailable",
                code=self._settings.failure_code_database,
            ) from exc
        if stored_engram_matches(stored, claimed) and stored:
            return persona_engine_user_id(stored)
        if stored and claimed_is_admit_placeholder(
            app_user_id=app_user_id,
            claimed=claimed,
        ):
            return persona_engine_user_id(stored)
        raise TurnError(
            "forbidden",
            status=403,
            reason="identity_mismatch",
        )

    def close(self) -> None:
        self._writers.shutdown(wait=True)
        self._brains.close()

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
        reframe_first_token_ms: int | None,
        total_ms: int,
        mode: str,
        correlation_id: UUID,
    ) -> list[UUID]:
        if not claim_write_receipt(conn, session_id, correlation_id):
            return load_receipt_turn_ids(conn, session_id, correlation_id)
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
            brain_mode=mode,
            correlation_id=correlation_id,
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
                brain_mode=mode,
                correlation_id=correlation_id,
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
            reframe_first_token_ms=reframe_first_token_ms,
            total_ms=total_ms,
        )
        store_receipt_turn_ids(
            conn,
            session_id,
            correlation_id,
            user_turn_id,
            ids[1] if len(ids) > 1 else None,
        )
        return ids
