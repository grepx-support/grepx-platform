# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""DocumentStore strategy: the same five calls on SQLite, PostgreSQL, MongoDB or memory."""
from __future__ import annotations

import json
import re
import sqlite3
import threading
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Any, Optional

_NAME = re.compile(r"^[a-z_][a-z0-9_]{0,62}$")


def _check(collection: str) -> str:
    if not _NAME.match(collection):
        raise ValueError(f"bad collection name: {collection!r}")
    return collection


class DocumentStore(ABC):
    """Documents (dicts) by key inside named collections."""

    @abstractmethod
    def put(self, collection: str, key: str, doc: dict) -> None: ...

    @abstractmethod
    def get(self, collection: str, key: str) -> Optional[dict]: ...

    @abstractmethod
    def find(self, collection: str, **equals: Any) -> list[dict]: ...

    @abstractmethod
    def delete(self, collection: str, key: str) -> None: ...

    def ensure(self, collection: str, indexes: tuple = ()) -> None:
        """Create the table/collection and its field indexes if missing (run by setup.sh)."""

    def close(self) -> None:
        pass


class MemoryStore(DocumentStore):
    def __init__(self):
        self.data: dict[str, dict[str, dict]] = {}

    def put(self, collection, key, doc):
        self.data.setdefault(_check(collection), {})[key] = json.loads(json.dumps(doc, default=str))

    def get(self, collection, key):
        return self.data.get(collection, {}).get(key)

    def find(self, collection, **equals):
        return [d for d in self.data.get(collection, {}).values() if all(d.get(k) == v for k, v in equals.items())]

    def delete(self, collection, key):
        self.data.get(collection, {}).pop(key, None)


class SqliteStore(DocumentStore):
    def __init__(self, path: str):
        if path != ":memory:":
            Path(path).parent.mkdir(parents=True, exist_ok=True)
        self.path = path
        self.db = sqlite3.connect(path, check_same_thread=False)
        self.lock, self.ready = threading.Lock(), set()

    def _table(self, collection: str) -> str:
        if collection not in self.ready:
            self.db.execute(f'CREATE TABLE IF NOT EXISTS "{_check(collection)}" (key TEXT PRIMARY KEY, doc TEXT NOT NULL)')
            columns = [row[1] for row in self.db.execute(f'PRAGMA table_info("{collection}")')]
            if not {"key", "doc"} <= set(columns):
                raise RuntimeError(
                    f'table "{collection}" in {self.path} already exists with other columns {columns} - this database '
                    f"belongs to something else (an old app?). Give the service its own database: the default is "
                    f"data/<service>.db; check GREPX_DATABASE_URL / DATABASE_URL_<SERVICE> in .env.")
            self.ready.add(collection)
        return collection

    def ensure(self, collection, indexes=()):
        with self.lock:
            table = self._table(collection)
            for field in indexes:
                self.db.execute(f'CREATE INDEX IF NOT EXISTS "{table}_{_check(field)}" ON "{table}" (json_extract(doc, \'$.{field}\'))')
            self.db.commit()

    def put(self, collection, key, doc):
        with self.lock:
            self.db.execute(f'INSERT OR REPLACE INTO "{self._table(collection)}" VALUES (?, ?)', (key, json.dumps(doc, default=str)))
            self.db.commit()

    def get(self, collection, key):
        with self.lock:
            row = self.db.execute(f'SELECT doc FROM "{self._table(collection)}" WHERE key = ?', (key,)).fetchone()
        return json.loads(row[0]) if row else None

    def find(self, collection, **equals):
        where = " AND ".join(f"json_extract(doc, '$.{_check(k)}') = ?" for k in equals) or "1 = 1"
        with self.lock:
            rows = self.db.execute(f'SELECT doc FROM "{self._table(collection)}" WHERE {where}', tuple(equals.values())).fetchall()
        return [json.loads(r[0]) for r in rows]

    def delete(self, collection, key):
        with self.lock:
            self.db.execute(f'DELETE FROM "{self._table(collection)}" WHERE key = ?', (key,))
            self.db.commit()


class PostgresStore(DocumentStore):
    """One table per collection: key text primary key, doc jsonb (GIN-indexed for find)."""

    def __init__(self, url: str):
        import psycopg
        from psycopg.types.json import Jsonb
        self.Jsonb, self.conn, self.ready = Jsonb, psycopg.connect(url, autocommit=True), set()
        self.lock = threading.Lock()

    def _table(self, collection: str) -> str:
        if collection not in self.ready:
            name = _check(collection)
            self.conn.execute(f'CREATE TABLE IF NOT EXISTS "{name}" (key text PRIMARY KEY, doc jsonb NOT NULL)')
            self.conn.execute(f'CREATE INDEX IF NOT EXISTS "{name}_doc" ON "{name}" USING gin (doc)')
            self.ready.add(collection)
        return collection

    def ensure(self, collection, indexes=()):
        with self.lock:
            table = self._table(collection)
            for field in indexes:
                self.conn.execute(f'CREATE INDEX IF NOT EXISTS "{table}_{_check(field)}" ON "{table}" ((doc->>\'{field}\'))')

    def put(self, collection, key, doc):
        with self.lock:
            self.conn.execute(f'INSERT INTO "{self._table(collection)}" (key, doc) VALUES (%s, %s) ON CONFLICT (key) DO UPDATE SET doc = EXCLUDED.doc',
                              (key, self.Jsonb(doc)))

    def get(self, collection, key):
        with self.lock:
            row = self.conn.execute(f'SELECT doc FROM "{self._table(collection)}" WHERE key = %s', (key,)).fetchone()
        return row[0] if row else None

    def find(self, collection, **equals):
        with self.lock:
            rows = self.conn.execute(f'SELECT doc FROM "{self._table(collection)}" WHERE doc @> %s', (self.Jsonb(equals),)).fetchall()
        return [r[0] for r in rows]

    def delete(self, collection, key):
        with self.lock:
            self.conn.execute(f'DELETE FROM "{self._table(collection)}" WHERE key = %s', (key,))

    def close(self):
        self.conn.close()


class MongoStore(DocumentStore):
    def __init__(self, url: str):
        from pymongo import MongoClient
        self.client = MongoClient(url)
        self.db = self.client.get_default_database() if "/" in url.split("//", 1)[1] else self.client["grepx"]

    def ensure(self, collection, indexes=()):
        if _check(collection) not in self.db.list_collection_names():
            self.db.create_collection(collection)
        for field in indexes:
            self.db[collection].create_index(_check(field))

    def put(self, collection, key, doc):
        self.db[_check(collection)].replace_one({"_id": key}, {**doc, "_id": key}, upsert=True)

    def get(self, collection, key):
        doc = self.db[_check(collection)].find_one({"_id": key})
        return {k: v for k, v in doc.items() if k != "_id"} if doc else None

    def find(self, collection, **equals):
        return [{k: v for k, v in d.items() if k != "_id"} for d in self.db[_check(collection)].find(equals)]

    def delete(self, collection, key):
        self.db[_check(collection)].delete_one({"_id": key})

    def close(self):
        self.client.close()


def open_store(url: str) -> DocumentStore:
    from .resolve import engine_of
    engine = engine_of(url)
    if engine == "memory":
        return MemoryStore()
    if engine == "sqlite":
        return SqliteStore(url.split("sqlite:///", 1)[1] if "sqlite:///" in url else ":memory:")
    if engine == "postgres":
        return PostgresStore(url)
    if engine == "mongo":
        return MongoStore(url)
    raise ValueError(f"unsupported database url: {url}")
