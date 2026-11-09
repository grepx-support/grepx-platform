# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""The one entry point every service uses. A service's main.py is only:

    from grepx_service.serve import serve
    serve(__file__)

Everything else comes from the service's config.yaml:
    snapshot_table / live_criteria / recovery_criteria   its request table (handled by routes.handle)
    subscriptions:                                       reactions to other tables, e.g.
      - {table: drives, handler: jobs.handle_drive, when: "status = 'ACCEPTED' AND state = 'completed'"}
      - {table: ticks,  handler: jobs.handle_tick,  when: "to_service = '{service}' AND status = 'NEW'"}
    on_start: ticker.start                               optional background work started first (called with cfg)

A read-only "edge" service (one that only watches, e.g. a live monitor) may leave out snapshot_table and routes, and use:
    discover: feed.subscriptions                         more subscriptions worked out at start: fn(cfg) -> [Subscription]
    web_app: web.create_app                              its own HTTP app instead of the plain /health one:
                                                         fn(cfg, health_app) -> any app run_server can serve
"""
from __future__ import annotations

import importlib
import re
import sys
from pathlib import Path
from typing import Any, Callable

from .runner import Subscription, run_subscriptions


def resolve(path: str) -> Callable:
    """'jobs.handle_drive' -> the function (imported from the service's own src/)."""
    module, _, name = path.rpartition(".")
    return getattr(importlib.import_module(module), name)


def setting(cfg: Any, path: str) -> str:
    """'referral.conversion.table' -> that value from the merged config."""
    node = cfg
    for part in path.split("."):
        node = node.get(part) if hasattr(node, "get") else None
    if node is None:
        raise KeyError(f"config has no {path!r} (needed by {cfg.get('service_name')})")
    return str(node)


def fill(text: str, cfg: Any) -> str:
    """{service} and {any.config.path} in a subscription's table / when come from the config."""
    return re.sub(r"\{([a-z_.]+)\}", lambda m: cfg.service_name if m.group(1) == "service" else setting(cfg, m.group(1)), str(text))


def reactions(cfg: Any, find: Callable[[str], Callable] = resolve) -> list[Subscription]:
    """The subscriptions a service declares in config.yaml, besides its request table.
    One whose table comes from a setting the deployment left empty (e.g. no referral conversion) is skipped."""
    out = []
    for s in cfg.get("subscriptions") or []:
        table = fill(s["table"], cfg)
        if not table:
            continue
        when = fill(s["when"], cfg)
        recovery = fill(s.get("recover") or s["when"], cfg)
        out.append(Subscription(table, find(s["handler"]), when, recovery))
    return out


def plan(cfg: Any, find: Callable[[str], Callable] = resolve) -> tuple[list[Subscription], Callable[[], Any]]:
    """Every subscription the service runs and the factory of its web app, from its config."""
    from grepx_web_bootstrap import create_health_app
    from .metrics import snapshot
    from .projection import subscriptions as projections

    subs = []
    if cfg.get("snapshot_table"):                       # a request table, handled by src/routes
        subs.append(Subscription(cfg.snapshot_table, find("routes.handle"), cfg.live_criteria, cfg.recovery_criteria))
    subs += reactions(cfg, find)
    if cfg.get("discover"):
        subs += list(find(cfg.discover)(cfg))
    subs += projections(cfg)
    if not subs:
        raise ValueError(f"{cfg.get('service_name')}: nothing to run - no snapshot_table, subscriptions, discover or owns in config.yaml")

    def web_app():
        health = create_health_app(cfg.service_name, metrics=snapshot)
        return find(cfg.web_app)(cfg, health) if cfg.get("web_app") else health
    return subs, web_app


def serve(main_file: str) -> None:
    """Run the service whose src/main.py is main_file: request table + declared reactions + health endpoint."""
    src = Path(main_file).resolve().parent
    sys.path.insert(0, str(src))
    from grepx_config import load_config

    cfg = load_config(src.parent / "config")
    if cfg.get("on_start"):
        resolve(cfg.on_start)(cfg)
    subs, web_app = plan(cfg)
    run_subscriptions(cfg, subs, web_app_factory=web_app)
