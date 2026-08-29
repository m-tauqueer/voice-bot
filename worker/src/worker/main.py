from __future__ import annotations

import logging

import structlog
import uvicorn
from fastapi import FastAPI

from worker.api.admin import build_admin_router
from worker.api.subscribe import build_subscribe_router
from worker.config import WorkerSettings, load_settings

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

app = FastAPI(title="voice-bot-worker")
app.include_router(build_subscribe_router(settings))
app.include_router(build_admin_router(settings))


@app.get("/health")
def health() -> dict[str, bool | str]:
    return {"ok": True, "service": "worker"}


def run() -> None:
    uvicorn.run(
        app,
        host=settings.worker_host,
        port=settings.worker_port,
    )
