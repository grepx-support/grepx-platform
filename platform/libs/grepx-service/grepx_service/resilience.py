# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""Resilience patterns for calls that leave the platform (SMTP, Twilio, social APIs, S3 …).

    breaker = CircuitBreaker("twilio", failure_threshold=5, reset_seconds=30)
    result = breaker.call(lambda: send(...))          # raises CircuitOpen while open
    Retry(attempts=3, base_delay=0.2).call(fn)        # exponential backoff + jitter
    limiter = RateLimiter(rate=10, per=1.0); limiter.acquire()   # token bucket
    with Bulkhead(4):  ...                            # at most 4 concurrent calls
"""
from __future__ import annotations

import random
import threading
import time
from typing import Callable, Optional, TypeVar

T = TypeVar("T")


class CircuitOpen(RuntimeError):
    pass


class CircuitBreaker:
    """closed → (N failures) → open → (reset_seconds) → half-open → one trial → closed/open."""

    def __init__(self, name: str, failure_threshold: int = 5, reset_seconds: float = 30.0, clock: Callable[[], float] = time.monotonic):
        self.name, self.threshold, self.reset_seconds, self.clock = name, failure_threshold, reset_seconds, clock
        self.failures, self.opened_at, self._lock = 0, None, threading.Lock()

    @property
    def state(self) -> str:
        if self.opened_at is None:
            return "closed"
        return "half_open" if self.clock() - self.opened_at >= self.reset_seconds else "open"

    def call(self, fn: Callable[[], T]) -> T:
        with self._lock:
            if self.state == "open":
                raise CircuitOpen(self.name)
        try:
            result = fn()
        except Exception:
            with self._lock:
                self.failures += 1
                if self.failures >= self.threshold or self.opened_at is not None:
                    self.opened_at = self.clock()
            raise
        with self._lock:
            self.failures, self.opened_at = 0, None
        return result


class Retry:
    def __init__(self, attempts: int = 3, base_delay: float = 0.2, max_delay: float = 5.0,
                 retry_on: tuple[type[BaseException], ...] = (Exception,), sleep: Callable[[float], None] = time.sleep):
        self.attempts, self.base_delay, self.max_delay, self.retry_on, self.sleep = attempts, base_delay, max_delay, retry_on, sleep

    def call(self, fn: Callable[[], T]) -> T:
        for attempt in range(1, self.attempts + 1):
            try:
                return fn()
            except CircuitOpen:
                raise
            except self.retry_on:
                if attempt == self.attempts:
                    raise
                self.sleep(min(self.max_delay, self.base_delay * 2 ** (attempt - 1)) * (0.5 + random.random() / 2))
        raise RuntimeError("unreachable")


class RateLimiter:
    """Token bucket: `rate` tokens per `per` seconds."""

    def __init__(self, rate: float, per: float = 1.0, clock: Callable[[], float] = time.monotonic):
        self.capacity, self.fill = rate, rate / per
        self.tokens, self.clock, self.last, self._lock = rate, clock, clock(), threading.Lock()

    def try_acquire(self) -> bool:
        with self._lock:
            now = self.clock()
            self.tokens = min(self.capacity, self.tokens + (now - self.last) * self.fill)
            self.last = now
            if self.tokens >= 1:
                self.tokens -= 1
                return True
            return False


class Bulkhead:
    def __init__(self, limit: int, timeout: Optional[float] = None):
        self._sem, self.timeout = threading.BoundedSemaphore(limit), timeout

    def __enter__(self):
        if not self._sem.acquire(timeout=self.timeout):
            raise RuntimeError("bulkhead full")
        return self

    def __exit__(self, *exc):
        self._sem.release()
        return False


class Resilient:
    """Bulkhead → breaker → retry, composed for one external dependency."""

    def __init__(self, name: str, attempts: int = 3, failure_threshold: int = 5, reset_seconds: float = 30.0, concurrency: int = 8):
        self.breaker = CircuitBreaker(name, failure_threshold, reset_seconds)
        self.retry, self.bulkhead = Retry(attempts), Bulkhead(concurrency, timeout=30)

    def call(self, fn: Callable[[], T]) -> T:
        with self.bulkhead:
            return self.breaker.call(lambda: self.retry.call(fn))
