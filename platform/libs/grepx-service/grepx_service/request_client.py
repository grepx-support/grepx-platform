"""RequestClient — the BFF side of the request/response pattern.

submit a NEW row addressed to the owning service, then wait for ACCEPTED/REJECTED.
Never reports success on submit; a timeout is its own reason (<TABLE>_TIMEOUT).
"""
from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Optional

from nexus_api import RowField, RowStatus

from .wire import new_key, now_iso, plain_fields, quote

TERMINAL = {RowStatus.ACCEPTED.value, RowStatus.REJECTED.value}


@dataclass
class Verdict:
    ok: bool
    key: str
    fields: dict = field(default_factory=dict)

    @property
    def reason(self) -> str:
        return str(self.fields.get("reason") or ("" if self.ok else "TIMEOUT"))


class RequestClient:
    def __init__(self, client, service_name: str, username: str = "", timeout: float = 15.0, interval: float = 0.05):
        self.client, self.service_name, self.username = client, service_name, username or service_name
        self.timeout, self.interval = timeout, interval

    def send(self, table: str, to_service: str, fields: dict, key: Optional[str] = None, trace_id: Optional[str] = None) -> str:
        key = key or new_key()
        fields = {"trace_id": trace_id or key, "parent": f"{self.service_name}/request", "hop": 0, **fields}
        self.client.submit(table, key, {
            **plain_fields(fields), RowField.STATUS.value: RowStatus.NEW.value, "transaction_id": key,
            RowField.FROM_SERVICE.value: self.service_name, RowField.TO_SERVICE.value: to_service,
            "application": self.service_name, "username": self.username, "occurred_at": now_iso()})
        return key

    def wait(self, table: str, key: str, timeout: Optional[float] = None) -> Verdict:
        deadline = time.time() + (timeout or self.timeout)
        criteria = f"transaction_id = {quote(key)}"
        last: dict = {}
        while time.time() < deadline:
            drain = getattr(self.client, "drain", None)
            if drain:
                drain()
            rows = self.client.select(table, criteria)
            if rows:
                last = dict(rows[0].fields)
                if last.get(RowField.STATUS.value) in TERMINAL:
                    return Verdict(last[RowField.STATUS.value] == RowStatus.ACCEPTED.value, key, last)
            time.sleep(self.interval)
        return Verdict(False, key, {**last, "reason": f"{table.upper()}_TIMEOUT"})

    def call(self, table: str, to_service: str, fields: dict, key: Optional[str] = None, timeout: Optional[float] = None,
             trace_id: Optional[str] = None) -> Verdict:
        """A stable key makes the call idempotent: an earlier ACCEPTED answer is returned without sending again, a
        request still in flight is waited for, and an earlier REJECTED one is retried under a fresh derived key."""
        if key:
            key = self._idempotent_key(table, key)
            earlier = self._row(table, key)
            if earlier and earlier.get(RowField.STATUS.value) == RowStatus.ACCEPTED.value:
                return Verdict(True, key, earlier)
            if earlier:                                    # NEW / CLAIMED: someone already sent it - wait for the answer
                return self.wait(table, key, timeout)
        return self.wait(table, self.send(table, to_service, fields, key, trace_id), timeout)

    def _row(self, table: str, key: str) -> Optional[dict]:
        rows = self.client.select(table, f"transaction_id = {quote(key)}")
        return dict(rows[0].fields) if rows else None

    def _idempotent_key(self, table: str, key: str) -> str:
        """The key itself, or - when it (and its retries) were REJECTED - the next unused retry key."""
        attempt, candidate = 0, key
        while True:
            row = self._row(table, candidate)
            if not row or row.get(RowField.STATUS.value) != RowStatus.REJECTED.value:
                return candidate
            attempt += 1
            candidate = f"{key}~{attempt}"
