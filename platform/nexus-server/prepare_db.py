# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""Prepare the C++ nexus_server database: its schema + one Nexus user (stdlib only).

    python3 prepare_db.py bin/nexus_data.db USERNAME PASSWORD

Same tables as grepx-core-platform/platform/nexus-db (create_schema.py + seed_user.py).
"""
import hashlib
import sqlite3
import sys
from pathlib import Path

SCHEMA = """
CREATE TABLE IF NOT EXISTS nexus_rows (table_name VARCHAR NOT NULL, row_key VARCHAR NOT NULL, fields VARCHAR NOT NULL,
    version INTEGER NOT NULL, PRIMARY KEY (table_name, row_key));
CREATE TABLE IF NOT EXISTS outbox (id INTEGER PRIMARY KEY AUTOINCREMENT, table_name VARCHAR NOT NULL, transaction_id VARCHAR NOT NULL,
    from_status VARCHAR, to_status VARCHAR NOT NULL, from_service VARCHAR, to_service VARCHAR, fields VARCHAR NOT NULL,
    occurred_at VARCHAR NOT NULL, published_at VARCHAR);
CREATE INDEX IF NOT EXISTS idx_outbox_unpublished ON outbox (published_at) WHERE published_at IS NULL;
CREATE TABLE IF NOT EXISTS users (username VARCHAR PRIMARY KEY, password_hash VARCHAR NOT NULL);
CREATE TABLE IF NOT EXISTS table_owners (table_name VARCHAR NOT NULL, username VARCHAR NOT NULL, PRIMARY KEY (table_name, username));
CREATE TABLE IF NOT EXISTS user_login (id INTEGER PRIMARY KEY AUTOINCREMENT, username VARCHAR NOT NULL, application_name VARCHAR NOT NULL,
    access_mode VARCHAR NOT NULL, auth_method VARCHAR NOT NULL, login_time VARCHAR NOT NULL, logout_time VARCHAR, status VARCHAR NOT NULL);
"""


def prepare(path: str, username: str, password: str) -> None:
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(path) as db:
        db.executescript(SCHEMA)
        db.execute("INSERT OR REPLACE INTO users VALUES (?, ?)", (username, hashlib.sha256(password.encode()).hexdigest()))


if __name__ == "__main__":
    if len(sys.argv) != 4:
        sys.exit(__doc__)
    prepare(*sys.argv[1:])
    print(f"database ready: {sys.argv[1]} (user {sys.argv[2]})")
