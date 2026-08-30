from __future__ import annotations

import threading
from collections import OrderedDict

from worker.config import WorkerSettings
from worker.engram.engram_brain import EngramBrain


class BrainRegistry:
    """Keeps one open Engram client per user so no turn pays a TLS handshake.

    The SDK client wraps a thread-safe HTTP client, so a single instance is
    shared across concurrent turns for the same user. Least-recently-used
    entries are closed when the cache is full.
    """

    def __init__(self, settings: WorkerSettings) -> None:
        self._settings = settings
        self._lock = threading.Lock()
        self._brains: OrderedDict[str, EngramBrain] = OrderedDict()

    def get(self, engram_user_id: str) -> EngramBrain:
        with self._lock:
            existing = self._brains.get(engram_user_id)
            if existing is not None:
                self._brains.move_to_end(engram_user_id)
                return existing
        brain = EngramBrain(self._settings, engram_user_id)
        evicted: EngramBrain | None = None
        with self._lock:
            racer = self._brains.get(engram_user_id)
            if racer is not None:
                self._brains.move_to_end(engram_user_id)
                evicted = brain
                brain = racer
            else:
                self._brains[engram_user_id] = brain
                while len(self._brains) > self._settings.engram_client_cache_size:
                    _, evicted = self._brains.popitem(last=False)
        if evicted is not None:
            _close(evicted)
        return brain

    def close(self) -> None:
        with self._lock:
            brains = list(self._brains.values())
            self._brains.clear()
        for brain in brains:
            _close(brain)


def _close(brain: EngramBrain) -> None:
    try:
        brain.close()
    except Exception:  # noqa: BLE001 - closing must never break a turn
        pass
