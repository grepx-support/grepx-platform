# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""Counting per key (an address) in a sliding window, in memory: failed sign-ins, CSP reports. Bounded under a flood."""
from __future__ import annotations

import threading
import time
from collections import deque

MAX_KEYS = 50_000


class RateWindow:
    """At most `limit` events per key in `window` seconds."""

    def __init__(self, limit: int, window: float, clock=time.monotonic):
        self.limit, self.window, self.clock, self.seen, self.lock = limit, window, clock, {}, threading.Lock()

    def _trim(self, key: str) -> deque:
        hits, floor = self.seen.setdefault(key, deque()), self.clock() - self.window
        while hits and hits[0] < floor:
            hits.popleft()
        return hits

    def full(self, key: str) -> bool:
        with self.lock:
            hits = self._trim(key)
            if not hits:
                self.seen.pop(key, None)
            return len(hits) >= self.limit

    def add(self, key: str) -> None:
        with self.lock:
            self._trim(key).append(self.clock())
            if len(self.seen) > MAX_KEYS:
                for stale in [k for k in self.seen if not self._trim(k)]:
                    self.seen.pop(stale, None)

    def take(self, key: str) -> bool:
        """Count one event; False when the key was already at its limit (the event is refused, not counted)."""
        if self.full(key):
            return False
        self.add(key)
        return True


class FailureWindow(RateWindow):
    """Failed attempts per key; a key with `limit` of them is blocked until they age out (successes never count)."""
    blocked = RateWindow.full
    fail = RateWindow.add
