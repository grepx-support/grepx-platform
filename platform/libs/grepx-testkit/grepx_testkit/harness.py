# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""ServiceHarness — run one or more services against an in-memory Nexus in tests.

    h = ServiceHarness()
    h.add(cfg, "drives", handler, live="status = 'NEW'")
    v = h.call("events", "event-service", {"action": "CREATE", ...})
    assert v.ok
"""
from __future__ import annotations

from typing import Any, Callable, Optional

from nexus_api import NexusApplication
from nexus_testkit import MemoryClient, NexusEngine

from grepx_service import Reader, RequestClient, Verdict
from grepx_service.projection import subscriptions as projections


class ServiceHarness:
    def __init__(self, engine: Optional[NexusEngine] = None):
        self.engine = engine or NexusEngine()
        self.client = MemoryClient(self.engine, "harness")
        self.requests = RequestClient(self.client, "test-bff", timeout=5, interval=0.001)
        self.read = Reader(self.client)
        self._projected: set = set()

    def add(self, cfg: Any, table: str, handler: Callable, live: str = "status = 'NEW'") -> "ServiceHarness":
        app = NexusApplication(client=MemoryClient(self.engine, cfg.get("service_name", "svc")), snapshot_table=table)
        app.client.subscribe(table, live, lambda row: handler(app, row, cfg))
        name = cfg.get("service_name", "")
        if name not in self._projected:           # as in production: owned tables are copied into the service database
            self._projected.add(name)
            for s in projections(cfg):
                app.client.subscribe(s.table, s.live_criteria, lambda row, h=s.handler: h(app, row, cfg))
        return self

    def call(self, table: str, to_service: str, fields: dict, key: Optional[str] = None) -> Verdict:
        return self.requests.call(table, to_service, fields, key)

    def seed(self, table: str, key: str, fields: dict) -> None:
        self.client.insert(table, key, {"status": "ACCEPTED", "transaction_id": key, **fields})

    def settle(self) -> None:
        for _ in range(3):
            self.client.drain()

    def rows(self, table: str, criteria: str = "", **equals: Any) -> list[dict]:
        self.settle()
        return self.read.rows(table, criteria, **equals)


class FakeCfg(dict):
    def __getattr__(self, name):
        return self[name]


_LOCAL_PACKAGES = ("dto", "domain", "routes", "jobs", "repository", "channels", "reactions", "ticker", "processing")


def load_service(service_dir, settings: Optional[dict] = None) -> tuple[Callable, Any, dict]:
    """Import another service's routes in isolation (every service has its own `dto`, `routes`, …).
    settings: top-level config values laid over the service's own (another deployment's wiring).

    Returns (handle, cfg, modules) — modules holds that service's other top-level packages (e.g. jobs)
    so integration tests can run many services in one process.
    """
    import importlib
    import sys
    from pathlib import Path

    from grepx_config import load_config

    src = Path(service_dir) / "src"
    clashing = lambda name: name.split(".")[0] in _LOCAL_PACKAGES  # noqa: E731
    saved = {k: sys.modules.pop(k) for k in list(sys.modules) if clashing(k)}
    sys.path.insert(0, str(src))
    try:
        handle = importlib.import_module("routes").handle
        modules = {}
        for extra in ("jobs", "reactions"):
            if (src / extra).exists():
                modules[extra] = importlib.import_module(extra)
        cfg = load_config(src.parent / "config")
        if settings:
            cfg.update(settings)
        return handle, cfg, modules
    finally:
        sys.path.remove(str(src))
        for k in [k for k in sys.modules if clashing(k)]:
            sys.modules.pop(k)
        sys.modules.update(saved)
