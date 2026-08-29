from __future__ import annotations

from io import BytesIO
from typing import Any, NoReturn

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel, Field

from worker.admin.errors import AdminError
from worker.admin.service import PersonaAdmin
from worker.api.internal_auth import require_internal_secret
from worker.config import WorkerSettings


class PersonaWriteIn(BaseModel):
    engram_persona_id: str | None = None
    handle: str | None = None
    display_name: str | None = None
    description: str | None = None
    voice_config: dict[str, Any] = Field(default_factory=dict)
    create_remote: bool = False


class TeachIn(BaseModel):
    text: str = Field(min_length=1)


class AnswerIn(BaseModel):
    question_key: str = Field(min_length=1)
    text: str = Field(min_length=1)


class SubscribeIn(BaseModel):
    user: str = Field(min_length=1)
    record_local: bool = False


def _raise_admin(exc: AdminError) -> NoReturn:
    raise HTTPException(
        status_code=exc.status,
        detail={"error": str(exc), "reason": exc.reason},
    ) from exc


def build_admin_router(settings: WorkerSettings) -> APIRouter:
    guard = require_internal_secret(settings)
    router = APIRouter(prefix="/internal/admin", dependencies=[Depends(guard)])
    admin = PersonaAdmin(settings)

    @router.get("/persona")
    def show() -> dict[str, Any]:
        try:
            return admin.show()
        except AdminError as exc:
            _raise_admin(exc)

    @router.put("/persona")
    def write_persona(body: PersonaWriteIn) -> dict[str, Any]:
        try:
            if body.create_remote:
                if not body.display_name or not body.handle:
                    raise AdminError(
                        "create_remote requires display_name and handle",
                        reason="missing_fields",
                    )
                return admin.create_remote(
                    name=body.display_name,
                    handle=body.handle,
                    description=body.description or "",
                    voice_config=body.voice_config,
                )
            if body.engram_persona_id:
                return admin.register(
                    engram_persona_id=body.engram_persona_id,
                    handle=body.handle,
                    display_name=body.display_name,
                    description=body.description,
                    voice_config=body.voice_config,
                )
            return admin.update_local(
                handle=body.handle,
                display_name=body.display_name,
                description=body.description,
                voice_config=body.voice_config,
            )
        except AdminError as exc:
            _raise_admin(exc)

    @router.post("/teach")
    def teach(body: TeachIn) -> dict[str, Any]:
        try:
            return admin.teach(body.text)
        except AdminError as exc:
            _raise_admin(exc)

    @router.get("/questions")
    def questions() -> dict[str, Any]:
        try:
            return admin.questions()
        except AdminError as exc:
            _raise_admin(exc)

    @router.post("/answer")
    def answer(body: AnswerIn) -> dict[str, Any]:
        try:
            return admin.answer(body.question_key, body.text)
        except AdminError as exc:
            _raise_admin(exc)

    @router.post("/ingest")
    def ingest(file: UploadFile = File(...)) -> dict[str, Any]:
        data = file.file.read()
        if len(data) > settings.admin_ingest_max_bytes:
            raise HTTPException(status_code=413, detail={"error": "file too large"})
        metadata: dict[str, Any] = {}
        if file.filename:
            metadata["filename"] = file.filename
        if file.content_type:
            metadata["content_type"] = file.content_type
        source = BytesIO(data)
        if file.filename:
            source.name = file.filename
        try:
            return admin.ingest_document(source, metadata)
        except AdminError as exc:
            _raise_admin(exc)

    @router.post("/subscribe")
    def subscribe(body: SubscribeIn) -> dict[str, Any]:
        try:
            return admin.subscribe(body.user, record_local=body.record_local)
        except AdminError as exc:
            _raise_admin(exc)

    return router
