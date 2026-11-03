# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""Reader — read-only access to any table, with safe criteria building."""
from __future__ import annotations

import re

from typing import Any, Optional

from nexus_api.criteria import compile_criteria
from nexus_api import RowField, RowStatus

from .wire import plain, quote


class Reader:
    def __init__(self, client):
        self.client = client

    @staticmethod
    def where(**equals: Any) -> str:
        parts = []
        for name, value in equals.items():
            if isinstance(value, (list, tuple, set)):
                parts.append(f"{name} IN ({','.join(quote(v) for v in value) or quote('')})")
            elif value is None:
                parts.append(f"{name} IS NULL")
            else:
                parts.append(f"{name} = {quote(value)}")
        return " AND ".join(parts)

    def rows(self, table: str, criteria: str = "", **equals: Any) -> list[dict]:
        """The C++ nexus_server understands only `field op value` joined by AND/OR (no parentheses,
        IN, LIKE, IS NULL, NOT). So plain equalities go to the server, the rest is applied here."""
        on_server = {k: v for k, v in equals.items() if server_value(v)}
        server = [f"{name} = {quote(value)}" for name, value in on_server.items()]
        local = " AND ".join(p for p in (
            self.where(**{k: v for k, v in equals.items() if k not in on_server}),
            f"({criteria})" if criteria else "") if p)
        if criteria and server_safe(criteria) and not local.replace(f"({criteria})", ""):
            server.append(criteria)            # simple enough for the server: filter there
            local = ""
        rows = self.client.select(table, " AND ".join(server))
        keep = compile_criteria(local) if local else None
        return [{**r.fields, "_key": r.key} for r in rows if keep is None or keep(r.fields)]

    def accepted(self, table: str, criteria: str = "", **equals: Any) -> list[dict]:
        return self.rows(table, criteria, **{RowField.STATUS.value: RowStatus.ACCEPTED.value, **equals})

    def one(self, table: str, key: str) -> Optional[dict]:
        found = self.rows(table, f"transaction_id = {quote(key)}")
        return found[0] if found else None

    def accepted_one(self, table: str, key: str) -> Optional[dict]:
        row = self.one(table, key)
        return row if row and row.get(RowField.STATUS.value) == RowStatus.ACCEPTED.value else None

    @staticmethod
    def value(row: Optional[dict], field: Any, default: Any = None) -> Any:
        return default if row is None else row.get(plain(field), default)


_UNSAFE = re.compile(r"[()]|\b(IN|LIKE|IS|NOT|NULL|WHERE)\b", re.IGNORECASE)


def server_safe(criteria: str) -> bool:
    """True when the C++ server's parser reads this criteria exactly as the Python one does."""
    return "''" not in criteria and not _UNSAFE.search(re.sub(r"'[^']*'", "''", criteria))


def server_value(value: Any) -> bool:
    """An equality the server can match: a scalar whose wire form is the plain value
    (text with a quote, ';', '=' or a newline is stored escaped, so compare it here instead)."""
    if value is None or isinstance(value, (list, tuple, set, dict)):
        return False
    return not (isinstance(value, str) and any(ch in value for ch in "';=\n\r") or str(value).startswith("~"))
