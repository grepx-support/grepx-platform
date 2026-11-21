# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

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
        return self.wait_many([(table, key)], timeout)[0]

    def wait_many(self, pending: list[tuple[str, str]], timeout: Optional[float] = None) -> list[Verdict]:
        """The answers to requests already sent, in their order. Looks again soon, then less often (2 ms, 4, 8 ...
        up to the interval): most answers come in a few milliseconds, and a fixed 50 ms step made every call pay it."""
        deadline = time.time() + (timeout or self.timeout)
        done: dict[int, Verdict] = {}
        last: dict[int, dict] = {}
        delay = min(0.002, self.interval)
        while time.time() < deadline:
            drain = getattr(self.client, "drain", None)
            if drain:
                drain()
            for i, (table, key) in enumerate(pending):
                if i in done:
                    continue
                rows = self.client.select(table, f"transaction_id = {quote(key)}")
                if rows:
                    last[i] = dict(rows[0].fields)
                    if last[i].get(RowField.STATUS.value) in TERMINAL:
                        done[i] = Verdict(last[i][RowField.STATUS.value] == RowStatus.ACCEPTED.value, key, last[i])
            if len(done) == len(pending):
                break
            time.sleep(delay)
            delay = min(self.interval, delay * 2)
        return [done.get(i) or Verdict(False, key, {**last.get(i, {}), "reason": f"{table.upper()}_TIMEOUT"}) for i, (table, key) in enumerate(pending)]

    def call_many(self, calls: list[tuple[str, str, dict]], timeout: Optional[float] = None, trace_id: Optional[str] = None) -> list[Verdict]:
        """Several independent requests at once - (table, to_service, fields) each - sent together and waited for
        together, so a page that needs five answers waits for the slowest, not for the sum."""
        keys = [self.send(table, to_service, fields, None, trace_id) for table, to_service, fields in calls]
        return self.wait_many([(table, key) for (table, _, _), key in zip(calls, keys)], timeout)

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
