from __future__ import annotations

import pytest

from worker.config import WorkerSettings


@pytest.fixture
def settings() -> WorkerSettings:
    return WorkerSettings(
        _env_file=None,
        node_env="test",
        log_level="warning",
        worker_host="127.0.0.1",
        worker_port=9,
        database_url="postgresql://voice:voice@127.0.0.1:5434/voice",
        internal_api_secret="x" * 16,
        memory_panel_query="what do you remember",
        redis_url=None,
        openai_model="gpt-4o-mini",
    )
