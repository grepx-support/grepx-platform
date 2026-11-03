# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""A service's own database is a projection of the state rows it publishes - one write path, no dual writes.

The Emitter writes state only to Nexus. Each service also subscribes to the tables it owns (`owns:` in config.yaml)
and copies them into its private database here. If the service stops between the two, recovery replays the rows
on the next start, so the copy always catches up; nothing can be in the database that Nexus does not have.
"""
from __future__ import annotations

from functools import partial
from typing import Any

from .runner import Subscription
from .wire import state_of

ACCEPTED = "ACCEPTED"


def persist(table: str, app: Any, row: Any, cfg: Any) -> None:
    from grepx_store import store_for
    store, status = store_for(cfg), row.fields.get("status")
    if status == ACCEPTED:
        store.put(table, row.key, {**state_of(row.fields), "status": status})
    else:
        store.delete(table, row.key)


def subscriptions(cfg: Any) -> list[Subscription]:
    """One subscription per owned table, for the rows this service wrote."""
    mine = f"from_service = '{cfg.get('service_name', '')}'"
    return [Subscription(t, partial(persist, t), mine, mine) for t in cfg.get("owns") or []]
