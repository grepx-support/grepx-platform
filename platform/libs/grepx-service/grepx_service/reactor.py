"""Reactor — subscriber that reacts to other services' verdicts (projections, side effects).

No claim (it does not own the row); handlers must be idempotent, typically by
writing deterministic keys. Routes are predicates → handler, first match wins.
"""
from __future__ import annotations

import logging
from typing import Any, Callable, Sequence

from nexus_api import NexusApplication, Row

from nexus_logging import TRACE_ID

from . import metrics
from .emitter import Emitter
from .reader import Reader

logger = logging.getLogger(__name__)
Match = Callable[[dict], bool]
React = Callable[["ReactorContext"], None]


class ReactorContext:
    def __init__(self, app: NexusApplication, row: Row, cfg: Any):
        self.app, self.row, self.cfg = app, row, cfg
        self.fields = dict(row.fields)
        self.emitter = Emitter(app, cfg, cause=row)
        self.read = Reader(app.client)

    def get(self, field: Any, default: Any = None) -> Any:
        value = self.fields.get(getattr(field, "value", field), default)
        return default if value is None else value


class Reactor:
    def __init__(self, routes: Sequence[tuple[Match, React]]):
        self.routes = list(routes)

    def __call__(self, app: NexusApplication, row: Row, cfg: Any = None) -> None:
        for match, react in self.routes:
            if match(row.fields):
                TRACE_ID.set(str(row.fields.get("trace_id") or row.key))
                try:
                    react(ReactorContext(app, row, cfg))
                except Exception as exc:
                    logger.exception("reaction failed key=%s", row.key)
                    metrics.count("errors", f"{type(exc).__name__}: {exc}")
                return
