# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""MemoryClient - an in-process nexus_api ClientInterface over a NexusEngine.

Used by tests and single-process dev runs: real criteria, real state
machine, real fan-out; events are delivered on a worker thread so handlers
never re-enter each other (same as TCP), and drain() waits for quiet.
"""
from __future__ import annotations

import queue
import threading
from typing import Callable, Optional

from nexus_api.interfaces.client_interface import ClientInterface
from nexus_api.models.row import Row

from .engine import NexusEngine


class _Bus:
    """One delivery thread per engine: deterministic order, no re-entrancy."""

    def __init__(self):
        self.q: queue.Queue = queue.Queue()
        self.pending = 0
        self.cv = threading.Condition()
        threading.Thread(target=self._run, daemon=True).start()

    def put(self, fn: Callable[[], None]) -> None:
        with self.cv:
            self.pending += 1
        self.q.put(fn)

    def _run(self) -> None:
        while True:
            fn = self.q.get()
            try:
                fn()
            finally:
                with self.cv:
                    self.pending -= 1
                    self.cv.notify_all()

    def drain(self, timeout: float = 10.0) -> None:
        with self.cv:
            self.cv.wait_for(lambda: self.pending == 0, timeout)


class _Handle:
    def __init__(self, engine: NexusEngine, sub_id: str):
        self.engine, self.sub_id = engine, sub_id

    def close(self) -> None:
        self.engine.unsubscribe(self.sub_id)


class MemoryClient(ClientInterface):
    _buses: dict[int, _Bus] = {}

    def __init__(self, engine: Optional[NexusEngine] = None, application_name: str = "memory"):
        self.engine = engine or NexusEngine()
        self.application_name = application_name
        self.bus = MemoryClient._buses.setdefault(id(self.engine), _Bus())

    def insert(self, table: str, key: str, fields: dict) -> None:
        self.engine.insert(table, key, fields)

    def delete(self, table: str, key: str) -> None:
        self.engine.delete(table, key)

    def select(self, table: str, criteria: str = "") -> list[Row]:
        return [Row(k, dict(f)) for k, f in self.engine.select(table, criteria)]

    def transition(self, table, key, from_status, to_status, expected_version, fields) -> int:
        try:
            return self.engine.transition(table, key, from_status, to_status, expected_version, fields)
        except Exception as exc:
            raise RuntimeError(str(exc)) from exc

    def submit(self, table: str, key: str, fields: dict) -> int:
        try:
            return self.engine.submit(table, key, fields)
        except Exception as exc:
            raise RuntimeError(f"submit failed: {exc}") from exc

    def subscribe(self, table: str, criteria: str, on_event, subscription_id: Optional[str] = None):
        def listener(_table: str, key: str, fields: dict) -> None:
            self.bus.put(lambda: on_event(Row(key, fields)))
        return _Handle(self.engine, self.engine.subscribe(table, criteria, listener, subscription_id))

    def drain(self, timeout: float = 10.0) -> None:
        self.bus.drain(timeout)

    def trace(self, trace_id: str) -> list[dict]:
        self.drain()
        return self.engine.store.trace(trace_id)

    def close(self) -> None:
        pass
