"""Heartbeat — every service reports itself to Nexus (`_health` table) so one place shows what is up.

Row per service: pid, host, port, started_at, last_seen, plus counters supplied by the service
kit (handled / rejected / errors / last_error). A row older than STALE_SECONDS means DOWN —
works across machines, no extra monitoring server needed. Tables starting with "_" are not
written to the outbox, so heartbeats never flood the history.
"""
from __future__ import annotations

import logging
import os
import socket
import threading
import time
from datetime import datetime, timezone
from typing import Callable, Optional

HEALTH_TABLE = "_health"
INTERVAL_SECONDS = 15
STALE_SECONDS = 45
logger = logging.getLogger(__name__)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


class Heartbeat:
    def __init__(self, client, service: str, stats: Optional[Callable[[], dict]] = None, interval: float = INTERVAL_SECONDS):
        self.client, self.service, self.stats, self.interval = client, service, stats or (lambda: {}), interval
        self.started = _now()

    def beat(self) -> None:
        self.client.insert(HEALTH_TABLE, self.service, {
            "status": "UP", "service": self.service, "pid": os.getpid(), "project": os.environ.get("GREPX_PROJECT", "platform"), "host": socket.gethostname(),
            "port": int(os.environ.get("GREPX_PORT", "0") or 0), "started_at": self.started, "last_seen": _now(), **self.stats()})

    def start(self) -> "Heartbeat":
        def loop():
            while True:
                try:
                    self.beat()
                except Exception as exc:
                    logger.warning("heartbeat failed: %s", exc)
                time.sleep(self.interval)
        threading.Thread(target=loop, daemon=True, name="heartbeat").start()
        return self


def is_stale(last_seen: str, now: Optional[datetime] = None) -> bool:
    try:
        seen = datetime.fromisoformat(last_seen)
    except (TypeError, ValueError):
        return True
    return ((now or datetime.now(timezone.utc)) - seen).total_seconds() > STALE_SECONDS
