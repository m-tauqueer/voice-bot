from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import structlog
import uvicorn
from fastapi import FastAPI

from worker.api.admin import build_admin_router
from worker.api.chat_completions import build_chat_completions_router
from worker.api.subscribe import build_subscribe_router
from worker.api.turn import build_turn_router
from worker.config import WorkerSettings, load_settings
from worker.persistence.db import close_pool, pool
from worker.turn.service import TurnRunner

settings = load_settings()


def _configure_logging(loaded: WorkerSettings) -> None:
    level_name = loaded.log_level.upper()
    level = getattr(logging, level_name, logging.INFO)
    logging.basicConfig(level=level)
    renderer: structlog.typing.Processor
    if loaded.node_env == "production":
        renderer = structlog.processors.JSONRenderer()
    else:
        renderer = structlog.dev.ConsoleRenderer()
    structlog.configure(
        processors=[
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            renderer,
        ],
        wrapper_class=structlog.make_filtering_bound_logger(level),
    )


_configure_logging(settings)

# One runner for the whole process: the database pool, the Engram clients and
# the reframe client all stay warm between turns.
runner = TurnRunner(settings)


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    pool(settings)
    try:
        yield
    finally:
        runner.close()
        close_pool()


app = FastAPI(title="voice-bot-worker", lifespan=lifespan)
app.include_router(build_subscribe_router(settings))
app.include_router(build_admin_router(settings))
app.include_router(build_turn_router(settings, runner))
app.include_router(build_chat_completions_router(settings, runner))


@app.get("/health")
def health() -> dict[str, bool | str]:
    return {"ok": True, "service": "worker"}


def run() -> None:
    uvicorn.run(
        app,
        host=settings.worker_host,
        port=settings.worker_port,
    )
