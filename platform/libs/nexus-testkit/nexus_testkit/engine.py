"""NexusEngine - rows, transitions, subscriptions. Transport-agnostic.

The TCP server (server.py) and the in-process MemoryClient (memory.py) both
drive this one engine, so tests exercise exactly the production semantics.
"""
from __future__ import annotations

import hashlib
import itertools
import logging
import threading
from dataclasses import dataclass
from typing import Callable, Optional

from nexus_api.criteria import Predicate, compile_criteria
from .policy import TransitionPolicy
from .store import SnapshotStore

logger = logging.getLogger(__name__)
Listener = Callable[[str, str, dict], None]


class TransitionError(RuntimeError):
    pass


@dataclass
class _Subscription:
    sub_id: str
    table: str
    predicate: Predicate
    listener: Listener


def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()


class NexusEngine:
    def __init__(self, store: Optional[SnapshotStore] = None, policy: Optional[TransitionPolicy] = None,
                 open_auth: bool = True):
        self.store = store or SnapshotStore()
        self.policy = policy or TransitionPolicy()
        self.open_auth = open_auth
        self._subs: dict[str, _Subscription] = {}
        self._lock = threading.RLock()
        self._ids = itertools.count(1)

    def authenticate(self, username: str, password: str, application: str, mode: str) -> bool:
        known = self.store.check_user(username, hash_password(password))
        ok = known is True or (known is None and self.open_auth)
        self.store.log_login(username, application, mode, "OK" if ok else "DENIED")
        return ok

    def select(self, table: str, criteria: str = "") -> list[tuple[str, dict]]:
        predicate = compile_criteria(criteria)
        return [(k, f) for k, f in self.store.scan(table) if predicate(f)]

    def insert(self, table: str, key: str, fields: dict) -> int:
        with self._lock:
            current = self.store.get(table, key)
            version = self.store.write(table, key, fields, from_status=current[0].get("status") if current else None)
        self._publish(table, key, fields)
        return version

    def submit(self, table: str, key: str, fields: dict) -> int:
        with self._lock:
            current = self.store.get(table, key)
            from_status = current[0].get("status") if current else None
            error = self.policy.check(from_status, fields.get("status"))
            if error:
                raise TransitionError(error)
            version = self.store.write(table, key, fields, from_status=from_status)
        self._publish(table, key, fields)
        return version

    def transition(self, table: str, key: str, from_status: str, to_status: str, expected_version: int, fields: dict) -> int:
        with self._lock:
            current = self.store.get(table, key)
            if current is None or current[1] != expected_version or current[0].get("status") != from_status:
                raise TransitionError("CONFLICT")
            return self.submit(table, key, {**fields, "status": to_status})

    def delete(self, table: str, key: str) -> None:
        self.store.delete(table, key)

    def subscribe(self, table: str, criteria: str, listener: Listener, sub_id: Optional[str] = None) -> str:
        sub_id = sub_id or f"sub-{next(self._ids)}"
        with self._lock:
            self._subs[sub_id] = _Subscription(sub_id, table, compile_criteria(criteria), listener)
        return sub_id

    def unsubscribe(self, sub_id: str) -> None:
        with self._lock:
            self._subs.pop(sub_id, None)

    def _publish(self, table: str, key: str, fields: dict) -> None:
        with self._lock:
            targets = [s for s in self._subs.values() if s.table == table and s.predicate(fields)]
        for sub in targets:
            try:
                sub.listener(table, key, dict(fields))
            except Exception:
                logger.exception("listener failed sub=%s table=%s key=%s", sub.sub_id, table, key)
