# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""Gateway — the BFF's single door to Nexus: commands (request → verdict), reads, secrets, storage.

API-gateway concerns live here once: idempotency keys, a circuit breaker around the bus, rate limits.
"""
from __future__ import annotations

from contextvars import ContextVar
from typing import Any, Optional

from grepx_auth import SecretBox, TokenService
from grepx_config.deployment import site_url
from grepx_service.plugins import person_table
from grepx_service import CircuitBreaker, CircuitOpen, RateLimiter, Reader, RequestClient, Verdict
from grepx_storage import Storage, storage_from_env

from grepx_bff.errors import ApiError
from grepx_bff.vocabulary import TranslatingReader, Vocabulary

CURRENT_TRACE: ContextVar[str] = ContextVar("trace_id", default="")


class Gateway:
    def __init__(self, client, cfg: Any, tokens: Optional[TokenService] = None, box: Optional[SecretBox] = None,
                 storage: Optional[Storage] = None, timeout: float = 15.0):
        self.client, self.cfg = client, cfg
        self.requests = RequestClient(client, cfg.service_name, cfg.get("bot_username", ""), timeout=timeout,
                                      interval=0.001 if hasattr(client, "drain") else 0.05)
        self.vocab = Vocabulary.from_config(cfg)            # product words <-> generic services' words
        self.read = TranslatingReader(Reader(client), self.vocab)
        self.tokens, self.box = tokens or TokenService.from_env(), box or SecretBox.from_env()
        self.storage = storage or storage_from_env()
        self.tenant = cfg.get("tenant_id", "")
        self.people = person_table(cfg)                     # the deployment's person table (donors, staff, members …)
        self.site = site_url()
        self.breaker = CircuitBreaker("nexus", failure_threshold=5, reset_seconds=10)
        self.limits: dict[str, RateLimiter] = {}

    def command(self, table: str, service: str, fields: dict, key: Optional[str] = None, ok_only: bool = True) -> Verdict:
        try:
            verdict = self.breaker.call(lambda: self.requests.call(table, service, self._out(table, fields), key=key,
                                                                   trace_id=CURRENT_TRACE.get() or None))
        except CircuitOpen:
            raise ApiError("SERVICE_UNAVAILABLE", 503)
        return self._back(table, verdict, ok_only)

    def commands(self, calls: list[tuple[str, str, dict]], ok_only: bool = True) -> list[Verdict]:
        """Independent commands at once - [(table, service, fields), ...] -> their verdicts in order. A screen that
        needs several answers (a dashboard) waits for the slowest one instead of each in turn."""
        if not calls:
            return []
        try:
            verdicts = self.breaker.call(lambda: self.requests.call_many([(t, s, self._out(t, f)) for t, s, f in calls],
                                                                         trace_id=CURRENT_TRACE.get() or None))
        except CircuitOpen:
            raise ApiError("SERVICE_UNAVAILABLE", 503)
        return [self._back(t, v, ok_only) for (t, _, _), v in zip(calls, verdicts)]

    def _out(self, table: str, fields: dict) -> dict:
        return {"tenant_id": self.tenant, **(self.vocab.fields_in(fields) if self.vocab.speaks(table) else fields)}

    def _back(self, table: str, verdict: Verdict, ok_only: bool) -> Verdict:
        if self.vocab.speaks(table):
            verdict = Verdict(verdict.ok, verdict.key, self.vocab.fields_out(verdict.fields))
        if ok_only and not verdict.ok:
            raise ApiError(verdict.reason, 504 if verdict.reason.endswith("_TIMEOUT") else 409, str(verdict.fields.get("detail") or ""))
        return verdict

    def trace(self, trace_id: str) -> dict:
        from grepx_service.tracing import explain
        return explain(trace_id, self.client.trace(trace_id))

    def limit(self, bucket: str, rate: float = 5, per: float = 60) -> None:
        if not self.limits.setdefault(bucket, RateLimiter(rate, per)).try_acquire():
            raise ApiError("RATE_LIMITED", 429)

    def one(self, table: str, key: str) -> Optional[dict]:
        return self.read.accepted_one(table, key) if key else None

    def rows(self, table: str, criteria: str = "", **eq) -> list[dict]:
        return self.read.accepted(table, criteria, **eq)
