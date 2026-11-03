"""Durable snapshot store: nexus_rows (latest row per key) + outbox (every transition).

SQLite on disk with an in-memory mirror for fast criteria scans. Field text is
stored in the wire encoding, so any nexus_api client decodes it unchanged.
"""
from __future__ import annotations

import sqlite3
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterator, Optional

from nexus_api.codec.fields import decode_fields, encode_fields

SCHEMA = """
CREATE TABLE IF NOT EXISTS nexus_rows (table_name TEXT, row_key TEXT, fields TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1, PRIMARY KEY (table_name, row_key));
CREATE TABLE IF NOT EXISTS outbox (id INTEGER PRIMARY KEY AUTOINCREMENT, table_name TEXT NOT NULL,
    transaction_id TEXT NOT NULL, from_status TEXT, to_status TEXT, from_service TEXT, to_service TEXT,
    fields TEXT NOT NULL, occurred_at TEXT NOT NULL, published_at TEXT, trace_id TEXT);
CREATE TABLE IF NOT EXISTS users (username TEXT PRIMARY KEY, password_hash TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS user_login (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL,
    application_name TEXT NOT NULL, access_mode TEXT NOT NULL, auth_method TEXT NOT NULL,
    login_time TEXT NOT NULL, logout_time TEXT, status TEXT NOT NULL);
"""


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class SnapshotStore:
    def __init__(self, path: str | Path = ":memory:"):
        self.path = str(path)
        if self.path != ":memory:":
            Path(self.path).parent.mkdir(parents=True, exist_ok=True)
        self._db = sqlite3.connect(self.path, check_same_thread=False)
        self._db.executescript(SCHEMA)
        if "trace_id" not in [c[1] for c in self._db.execute("PRAGMA table_info(outbox)")]:
            self._db.execute("ALTER TABLE outbox ADD COLUMN trace_id TEXT")
        self._db.execute("CREATE INDEX IF NOT EXISTS idx_outbox_trace ON outbox(trace_id)")
        if self.path != ":memory:":
            self._db.execute("PRAGMA journal_mode=WAL")
        self._lock = threading.RLock()
        self._rows: dict[str, dict[str, tuple[dict, int]]] = {}
        for table, key, text, version in self._db.execute("SELECT table_name, row_key, fields, version FROM nexus_rows"):
            self._rows.setdefault(table, {})[key] = (decode_fields(text), version)

    def get(self, table: str, key: str) -> Optional[tuple[dict, int]]:
        return self._rows.get(table, {}).get(key)

    def scan(self, table: str) -> Iterator[tuple[str, dict]]:
        for key, (fields, _version) in list(self._rows.get(table, {}).items()):
            yield key, fields

    def write(self, table: str, key: str, fields: dict, *, from_status: Optional[str]) -> int:
        with self._lock:
            current = self.get(table, key)
            version = (current[1] + 1) if current else 1
            text = encode_fields(fields)
            self._db.execute("INSERT OR REPLACE INTO nexus_rows VALUES (?,?,?,?)", (table, key, text, version))
            if not table.startswith("_"):  # "_" tables (heartbeats, caches) are state only, no history
                self._db.execute(
                    "INSERT INTO outbox (table_name, transaction_id, from_status, to_status, from_service, to_service, fields, occurred_at, trace_id)"
                    " VALUES (?,?,?,?,?,?,?,?,?)",
                    (table, key, from_status, fields.get("status"), fields.get("from_service"), fields.get("to_service"), text, _now(),
                     fields.get("trace_id")))
            self._db.commit()
            self._rows.setdefault(table, {})[key] = (dict(fields), version)
            return version

    def delete(self, table: str, key: str) -> None:
        with self._lock:
            self._db.execute("DELETE FROM nexus_rows WHERE table_name=? AND row_key=?", (table, key))
            self._db.commit()
            self._rows.get(table, {}).pop(key, None)

    def check_user(self, username: str, password_hash: str) -> Optional[bool]:
        row = self._db.execute("SELECT password_hash FROM users WHERE username=?", (username,)).fetchone()
        return None if row is None else row[0] == password_hash

    def add_user(self, username: str, password_hash: str) -> None:
        with self._lock:
            self._db.execute("INSERT OR REPLACE INTO users VALUES (?,?)", (username, password_hash))
            self._db.commit()

    def log_login(self, username: str, application: str, mode: str, status: str) -> None:
        with self._lock:
            self._db.execute("INSERT INTO user_login (username, application_name, access_mode, auth_method, login_time, status)"
                             " VALUES (?,?,?,?,?,?)", (username, application, mode, "PASSWORD", _now(), status))
            self._db.commit()

    def trace(self, trace_id: str) -> list[dict]:
        """Every transition of every row that carried this trace id, in commit order."""
        rows = self._db.execute("SELECT id, table_name, transaction_id, from_status, to_status, fields, occurred_at FROM outbox"
                                " WHERE trace_id=? ORDER BY id", (trace_id,)).fetchall()
        return [{"seq": i, "table": t, "key": k, "from": a, "to": b, "fields": decode_fields(f), "at": at} for i, t, k, a, b, f, at in rows]

    def history(self, table: str, key: str) -> list[dict]:
        rows = self._db.execute("SELECT from_status, to_status, fields, occurred_at FROM outbox WHERE table_name=? AND transaction_id=? ORDER BY id",
                                (table, key)).fetchall()
        return [{"from": a, "to": b, "fields": decode_fields(c), "at": d} for a, b, c, d in rows]
