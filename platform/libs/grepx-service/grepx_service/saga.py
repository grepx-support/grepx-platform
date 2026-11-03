"""Saga orchestrator — a multi-service transaction as a sequence of request rows with compensations.

    saga = Saga("create-account", [
        Step("donor", "donor_requests", "donor-service", lambda s: {...}, compensate=lambda s: {...}),
        Step("login", "auth_requests", "auth-service", lambda s: {...}),
    ])
    outcome = SagaRunner(requests, emitter).run(saga, context={...})
Each step waits for its verdict; on a REJECTED step, earlier steps are compensated in reverse
order. Progress is written to the `sagas` table (one row per saga instance) so it can be
inspected, resumed or audited — the saga log.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Callable, Optional

from .request_client import RequestClient, Verdict
from .wire import new_key, now_iso

SAGAS_TABLE = "sagas"
Build = Callable[[dict], dict]


@dataclass
class Step:
    name: str
    table: str
    service: str
    build: Build
    compensate: Optional[Build] = None


@dataclass
class Saga:
    name: str
    steps: list[Step]


@dataclass
class SagaOutcome:
    ok: bool
    results: dict = field(default_factory=dict)
    failed_step: str = ""
    reason: str = ""
    compensated: list[str] = field(default_factory=list)


class SagaRunner:
    def __init__(self, requests: RequestClient, log_client=None):
        self.requests, self.log_client = requests, log_client or requests.client

    def _log(self, saga_id: str, name: str, state: str, data: dict) -> None:
        self.log_client.insert(SAGAS_TABLE, saga_id, {"status": state, "transaction_id": saga_id, "saga": name, "updated_at": now_iso(), "trace_id": getattr(self, "trace_id", saga_id), **data})

    def run(self, saga: Saga, context: dict, saga_id: Optional[str] = None, trace_id: Optional[str] = None) -> SagaOutcome:
        saga_id = saga_id or new_key()
        self.trace_id = trace_id or saga_id
        state, done = dict(context), []
        self._log(saga_id, saga.name, "RUNNING", {"steps_done": []})
        for step in saga.steps:
            verdict: Verdict = self.requests.call(step.table, step.service, step.build(state), key=f"{saga_id}-{step.name}", trace_id=self.trace_id)
            if not verdict.ok:
                compensated = self._compensate(saga_id, done, state)
                self._log(saga_id, saga.name, "COMPENSATED", {"failed_step": step.name, "reason": verdict.reason, "compensated": compensated})
                return SagaOutcome(False, state, step.name, verdict.reason, compensated)
            state[step.name] = verdict.fields
            done.append(step)
            self._log(saga_id, saga.name, "RUNNING", {"steps_done": [s.name for s in done]})
        self._log(saga_id, saga.name, "COMPLETED", {"steps_done": [s.name for s in done]})
        return SagaOutcome(True, state)

    def _compensate(self, saga_id: str, done: list[Step], state: dict) -> list[str]:
        undone = []
        for step in reversed(done):
            if step.compensate:
                self.requests.call(step.table, step.service, step.compensate(state), key=f"{saga_id}-{step.name}-undo", trace_id=self.trace_id)
                undone.append(step.name)
        return undone
