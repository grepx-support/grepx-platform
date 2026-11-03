"""Small wire helpers: keys, timestamps, criteria quoting."""
from __future__ import annotations

import uuid
from datetime import date, datetime, timezone
from enum import Enum
from typing import Any
from zoneinfo import ZoneInfo


def new_key() -> str:
    return uuid.uuid4().hex


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def local_tz() -> ZoneInfo:
    from grepx_config.deployment import timezone
    return timezone()


def local_today() -> date:
    """Today in the deployment's time zone (TIMEZONE), not the server clock's."""
    return datetime.now(local_tz()).date()


def today_iso() -> str:
    return local_today().isoformat()


def plain(value: Any) -> Any:
    return value.value if isinstance(value, Enum) else value


def plain_fields(fields: dict) -> dict:
    return {plain(k): (plain(v) if not isinstance(v, (list, tuple)) else [plain(x) for x in v]) for k, v in fields.items()}


def quote(value: Any) -> str:
    """Criteria literal: numbers as-is, everything else single-quoted with '' escaping."""
    value = plain(value)
    if isinstance(value, bool):
        return "'true'" if value else "'false'"
    if isinstance(value, (int, float)):
        return str(value)
    if isinstance(value, date):
        value = value.isoformat()
    return "'" + str(value).replace("'", "''") + "'"


# Fields Nexus / the kit put on every row around the business data (request lifecycle + routing + bookkeeping).
ENVELOPE = frozenset({"status", "from_service", "to_service", "application", "username", "occurred_at", "transaction_id",
                      "action", "reason", "detail", "trace_id", "parent", "hop", "actor_id", "actor_is_manager"})


def state_of(row):
    """The business fields of a row (without the request envelope and reader extras like "_key"); None stays None."""
    if row is None:
        return None
    return {k: v for k, v in row.items() if not k.startswith("_") and k not in ENVELOPE}
