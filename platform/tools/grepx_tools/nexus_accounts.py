# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""One Nexus login per service, and which tables each one may write (least privilege).

    scripts/run.sh nexus-accounts      write them into the Nexus database (nexus-server setup.sh runs it too)

Each service logs in as its own name; its password is derived from NEXUS_SERVICE_SECRET (.env), so there is one secret
to keep, not one per service. table_owners lists every state table a service owns (`owns:` in its config.yaml): the
C++ server then refuses writes to it from any other login. Request tables (every service's `snapshot_table`) stay open -
anyone may submit a request. Without NEXUS_SERVICE_SECRET nothing changes: every service uses NEXUS_USERNAME as before.
"""
from __future__ import annotations

import hashlib
import hmac
import os
import sqlite3
import sys
from pathlib import Path

import yaml

from log import say
from root import ROOT  # noqa: E402

DB = ROOT / "platform" / "nexus-server" / "bin" / "nexus_data.db"


def service_secret(env: dict | None = None) -> str:
    env = env if env is not None else os.environ
    return env.get("NEXUS_SERVICE_SECRET", "")


def service_password(secret: str, service: str) -> str:
    return hmac.new(secret.encode(), service.encode(), hashlib.sha256).hexdigest()


def ownership(registry: dict) -> dict[str, list[str]]:
    """service -> the state tables only it may write (its owns:, minus every request table)."""
    configs = {}
    for name, svc in registry.items():
        path = svc["path"] / "config" / "config.yaml"
        if svc["enabled"] and path.exists():
            configs[name] = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    request_tables = {c.get("snapshot_table") for c in configs.values()}
    return {name: sorted(set(c.get("owns") or []) - request_tables) for name, c in configs.items()}


def write(db: Path, secret: str, owners: dict[str, list[str]]) -> int:
    with sqlite3.connect(db) as con:
        con.execute("CREATE TABLE IF NOT EXISTS table_owners (table_name VARCHAR NOT NULL, username VARCHAR NOT NULL, "
                    "PRIMARY KEY (table_name, username))")
        con.execute("DELETE FROM table_owners")
        for service, tables in owners.items():
            password_hash = hashlib.sha256(service_password(secret, service).encode()).hexdigest()
            con.execute("INSERT OR REPLACE INTO users VALUES (?, ?)", (service, password_hash))
            con.executemany("INSERT OR IGNORE INTO table_owners VALUES (?, ?)", [(t, service) for t in tables])
        return con.execute("SELECT COUNT(*) FROM table_owners").fetchone()[0]


def main() -> int:
    from workspace import dotenv, registry
    secret = service_secret({**dotenv(), **os.environ})
    if not secret:
        say("WARN", "nexus-accounts", "NEXUS_SERVICE_SECRET not set in .env - services keep sharing one Nexus login")
        return 0
    if not DB.exists():
        say("ERROR", "nexus-accounts", f"no Nexus database at {DB} - run platform/nexus-server/setup.sh first")
        return 1
    owners = ownership(registry())
    n = write(DB, secret, owners)
    say("OK", "nexus-accounts", f"{len(owners)} service logins, {n} owned tables (writes from any other login are refused)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
