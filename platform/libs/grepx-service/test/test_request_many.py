# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""Several requests at once are answered together, in order; answers are picked up within milliseconds."""
import time
from types import SimpleNamespace

from grepx_service import RequestClient
from nexus_api import RowField, RowStatus


class Bus:
    """A Nexus stand-in: each request is answered the second time it is looked for (ACCEPTED, or REJECTED for 'bad')."""

    def __init__(self, never=()):
        self.rows, self.looks, self.never = {}, {}, set(never)

    def submit(self, table, key, fields):
        self.rows[key] = dict(fields)

    def select(self, table, criteria):
        key = criteria.split("'")[1]
        self.looks[key] = self.looks.get(key, 0) + 1
        row = self.rows[key]
        if self.looks[key] >= 2 and row.get("action") not in self.never:
            row[RowField.STATUS.value] = RowStatus.REJECTED.value if row.get("action") == "bad" else RowStatus.ACCEPTED.value
        return [SimpleNamespace(key=key, fields=dict(row))]


def test_many_requests_are_answered_together_in_order():
    client = RequestClient(Bus(), "test-bff")
    started = time.perf_counter()
    got = client.call_many([("a_requests", "a-service", {"action": "one"}), ("b_requests", "b-service", {"action": "bad"}),
                            ("a_requests", "a-service", {"action": "two"})])
    assert [v.ok for v in got] == [True, False, True] and got[2].fields["action"] == "two"
    assert time.perf_counter() - started < 0.04                 # picked up after ~2 ms, not a fixed 50 ms per call


def test_one_slow_answer_times_out_alone():
    client = RequestClient(Bus(never={"stuck"}), "test-bff", interval=0.01)
    ok, stuck = client.call_many([("a_requests", "a", {"action": "fine"}), ("a_requests", "a", {"action": "stuck"})], timeout=0.1)
    assert ok.ok and not stuck.ok and stuck.reason == "A_REQUESTS_TIMEOUT"
    assert client.call("a_requests", "a", {"action": "x"}).ok   # the single call is the same path
