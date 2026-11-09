# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""Run a whole product stack (many services) in one process on an in-memory Nexus — for e2e tests and demos.

The wiring is the same as in production (grepx_service.serve): each service's request table plus the reactions it
lists under `subscriptions:` in its config.yaml.
"""
from __future__ import annotations

from pathlib import Path
from typing import Iterable, Optional

from grepx_config.workspace import read_yaml
from grepx_service.serve import reactions

from .harness import ServiceHarness, load_service

def start_stack(root: Path, layers: Iterable[str] = ("common-services", "product-services"),
                settings: Optional[dict] = None) -> ServiceHarness:
    """settings: deployment values laid over every service's config (e.g. another product's person table and plugins)."""
    harness = ServiceHarness()
    for layer in layers:
        for config in sorted((root / layer).glob("**/config/config.yaml")):
            service_dir = config.parent.parent
            if "snapshot_table" not in read_yaml(config):
                continue                                    # a watch-only service (e.g. a live monitor) handles no requests
            handle, cfg, modules = load_service(service_dir, settings)
            harness.add(cfg, cfg.snapshot_table, handle, cfg.live_criteria)
            find = lambda path, m=modules: getattr(m[path.rpartition(".")[0]], path.rpartition(".")[2])  # noqa: E731
            for s in reactions(cfg, find):
                if s.table != "ticks":                      # tests drive time themselves; no scheduler ticks
                    harness.add(cfg, s.table, s.handler, s.live_criteria)
    return harness
