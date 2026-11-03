# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""ActionDispatcher — claim → route by action → handler decides (Template Method + Strategy map).

    ROUTES = {DriveAction.CREATE: create.handle, ...}
    handle = ActionDispatcher(ROUTES, DriveAction, table="drives")
    (wired by grepx_service.serve from the service's config.yaml)
Handlers receive a RequestContext and must end with ctx.accept(...) or ctx.reject(...).
NEW rows are claimed first (one winner across replicas); CLAIMED rows resume after a crash.
"""
from __future__ import annotations

import logging
from enum import Enum
from typing import Any, Callable, Mapping, Optional

from nexus_api import NexusApplication, Row, RowField, RowStatus

from nexus_logging import TRACE_ID

from . import metrics
from .context import RequestContext

logger = logging.getLogger(__name__)
DEAD_LETTERS = "dead_letters"


def dead_letter(app: NexusApplication, row: Row, table: str, exc: Exception, cfg: Any) -> None:
    """Dead-letter queue: keep the failed request + error for inspection and replay."""
    try:
        app.client.insert(DEAD_LETTERS, f"{table}-{row.key}", {"status": "NEW", "transaction_id": f"{table}-{row.key}", "table": table,
                                                               "row_key": row.key, "service": (cfg or {}).get("service_name", ""), "trace_id": row.fields.get("trace_id", ""),
                                                               "error": f"{type(exc).__name__}: {exc}"[:300], "request": dict(row.fields)})
    except Exception:
        logger.exception("dead-letter write failed key=%s", row.key)
Handler = Callable[[RequestContext], None]


class ActionDispatcher:
    def __init__(self, routes: Mapping[Enum, Handler], action_enum: type[Enum], table: str,
                 action_field: str = "action", unknown_reason: str = "UNKNOWN_ACTION",
                 own_statuses: tuple[str, ...] = (RowStatus.NEW.value, RowStatus.CLAIMED.value),
                 default: Optional[Handler] = None):
        self.routes = {a.value: h for a, h in routes.items()}
        self.action_enum, self.table, self.action_field = action_enum, table, action_field
        self.unknown_reason, self.own_statuses, self.default = unknown_reason, own_statuses, default

    def __call__(self, app: NexusApplication, row: Row, cfg: Any = None) -> None:
        status = row.fields.get(RowField.STATUS.value)
        if status not in self.own_statuses:
            return
        to_service = row.fields.get(RowField.TO_SERVICE.value)
        if to_service and cfg is not None and to_service != cfg.get("service_name"):
            return
        TRACE_ID.set(str(row.fields.get("trace_id") or row.key))
        metrics.count("handled")
        ctx = RequestContext(app, row, cfg, self.table)
        if status == RowStatus.NEW.value:
            if not ctx.emitter.submit(self.table, row.key, RowStatus.CLAIMED, row.fields):
                return
            ctx.fields[RowField.STATUS.value] = RowStatus.CLAIMED.value
        handler: Optional[Handler] = self.routes.get(str(row.fields.get(self.action_field, ""))) or self.default
        if handler is None:
            ctx.reject(self.unknown_reason)
            return
        try:
            handler(ctx)
        except Exception as exc:
            logger.exception("handler failed table=%s key=%s", self.table, row.key)
            dead_letter(app, row, self.table, exc, cfg)
            metrics.count("errors", f"{type(exc).__name__}: {exc}")
            ctx.reject("INTERNAL_ERROR")
            return
        if not ctx.done:
            ctx.accept()
        metrics.count("rejected" if ctx.rejected else "accepted")
