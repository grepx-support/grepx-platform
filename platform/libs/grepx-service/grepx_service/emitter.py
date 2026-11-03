# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""Emitter — every outbound submit goes through here (conventions rule 12).

from_service is always this service's name; to_service only when directed.
application/username come from config, never from a literal.
"""
from __future__ import annotations

import logging
from typing import Any, Optional

from nexus_api import NexusApplication, RowField, RowStatus

from .wire import new_key, plain, plain_fields

TRACE_ID, PARENT, HOP = "trace_id", "parent", "hop"

logger = logging.getLogger(__name__)


GUARDED_STATUSES = {RowStatus.NEW.value, RowStatus.CLAIMED.value}


class Emitter:
    def __init__(self, app: NexusApplication, cfg: Any, cause: Any = None, table: str = ""):
        """cause = the row being handled; its trace_id flows into every row written here."""
        self.app = app
        fields = getattr(cause, "fields", None) or {}
        self.trace_id = str(fields.get(TRACE_ID) or (getattr(cause, "key", "") if cause is not None else "") or new_key())
        self.parent = f"{table or fields.get('_table', '')}/{getattr(cause, 'key', '')}" if cause is not None else ""
        self.hop = int(fields.get(HOP) or 0) + 1 if cause is not None else 0
        self.cfg = cfg
        self.service_name = str(cfg.get("service_name", "") or "")
        self.username = str(cfg.get("bot_username", "") or self.service_name)

    def stamp(self, fields: dict, to_service: Optional[str]) -> dict:
        routed = {RowField.FROM_SERVICE.value: self.service_name, TRACE_ID: self.trace_id, PARENT: self.parent, HOP: self.hop}
        if to_service:
            routed[RowField.TO_SERVICE.value] = to_service
        return {**plain_fields(fields), **routed}

    def submit(self, table: str, key: str, status: str, fields: dict, to_service: Optional[str] = None,
               guarded: Optional[bool] = None) -> int:
        """Write any row (own verdicts or a request to another service). 0 when the server refuses.

        guarded=True  -> SUBMIT: the C++ server checks the request lifecycle
                         (NEW -> CLAIMED -> ACCEPTED | REJECTED); used to create, claim and answer requests.
        guarded=False -> INSERT: plain upsert of a state row (donors, drives, tasks, ...) with any status.
        Default: guarded only for NEW and CLAIMED."""
        if guarded is None:
            guarded = plain(status) in GUARDED_STATUSES
        row = {**self.stamp(fields, to_service), "transaction_id": key, RowField.STATUS.value: plain(status),
               "application": self.service_name, "username": self.username}
        try:
            if guarded:
                version = self.app.client.submit(table, key, row)
            else:
                self.app.client.insert(table, key, row)
                version = 1
            logger.info("emit trace=%s table=%s key=%s status=%s version=%s to=%s", self.trace_id, table, key, plain(status), version, to_service)
            return version
        except RuntimeError as exc:
            logger.warning("emit refused trace=%s table=%s key=%s status=%s: %s", self.trace_id, table, key, plain(status), exc)
            return 0

    def request(self, table: str, key: str, fields: dict, to_service: str) -> int:
        return self.submit(table, key, RowStatus.NEW, fields, to_service)
