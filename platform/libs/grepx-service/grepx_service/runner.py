# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""Run a service: its database ready, its health app, one subscription per table it handles, a heartbeat.

Every service has its request table; some also react to other tables (booking-service reacts to completed
drives and to scheduler ticks). Each table's rows go to their own handler(app, row, cfg).
"""
from __future__ import annotations

import logging
import threading
import time
from dataclasses import dataclass
from typing import Any, Callable

from pathlib import Path

from grepx_config import resolve_log_dir
from nexus_api import Heartbeat, RecoveringSubscriber, create_app
from nexus_logging import configure_logging, timestamped_log_path

from .metrics import snapshot

logger = logging.getLogger(__name__)


@dataclass
class Subscription:
    table: str
    handler: Callable
    live_criteria: str
    recovery_criteria: str


def _guarded(handler, app, row, cfg) -> None:
    """Reactions (jobs) get the same trace context and error accounting as request handlers."""
    from nexus_logging import TRACE_ID
    from . import metrics
    TRACE_ID.set(str(row.fields.get("trace_id") or row.key))
    try:
        handler(app, row, cfg)
    except Exception as exc:
        logger.exception("reaction failed key=%s", row.key)
        metrics.count("errors", f"{type(exc).__name__}: {exc}")


def run_subscriptions(cfg: Any, subscriptions: list[Subscription], web_app_factory: Callable | None = None) -> None:
    """Blocks forever."""
    import os
    os.environ.setdefault("GREPX_SERVICE", cfg.service_name)
    configure_logging(log_file=timestamped_log_path(resolve_log_dir(cfg.logging.log_dir, Path(cfg.workspace)), cfg.service_name))
    prepare(cfg)  # this service's database + tables exist before it subscribes
    if web_app_factory is not None:
        from grepx_web_bootstrap import run_server
        threading.Thread(target=run_server, args=(web_app_factory(),), kwargs={"service": cfg.service_name}, daemon=True).start()
    subs = []
    for attempt in range(60):
        try:
            for s in subscriptions:
                app = create_app(f"{cfg.service_name}:{s.table}", s.table, host=cfg.nexus.host, port=cfg.nexus.port)
                subs.append(RecoveringSubscriber(app.client, s.table, s.recovery_criteria,
                                                 lambda row, a=app, h=s.handler: _guarded(h, a, row, cfg), s.live_criteria).start())
                logger.info("%s live: table=%s", cfg.service_name, s.table)
            break
        except (ConnectionError, OSError, RuntimeError) as exc:
            logger.warning("%s waiting for nexus (%d): %s", cfg.service_name, attempt + 1, exc)
            for sub in subs:
                sub.close()
            subs = []
            time.sleep(1)
    else:
        raise RuntimeError(f"{cfg.service_name} could not connect to nexus")
    Heartbeat(subs[0]._client, cfg.service_name, snapshot).start()
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        for sub in subs:
            sub.close()


def prepare(cfg: Any) -> None:
    """Before a service subscribes: its own database and tables exist."""
    from grepx_store import ensure_schema
    logger.info("schema ready: %d table(s)", len(ensure_schema(cfg, install_driver=False)))
