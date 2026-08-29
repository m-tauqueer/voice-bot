from __future__ import annotations

import psycopg
from psycopg.rows import dict_row

from worker.config import WorkerSettings


def connect(settings: WorkerSettings) -> psycopg.Connection:
    return psycopg.connect(settings.database_url, row_factory=dict_row)
