# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""One Nexus login per service: state tables owned by their service, request tables open to all."""
import sqlite3
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "grepx_tools"))

import nexus_accounts  # noqa: E402
from workspace import registry  # noqa: E402


def test_owned_tables_exclude_request_tables():
    owners = nexus_accounts.ownership(registry())
    assert owners["event-service"] == ["events"] and owners["people-service"] == ["people"]
    assert owners["notification-service"] == []          # `notifications` is its request table: everyone submits there
    all_owned = [t for tables in owners.values() for t in tables]
    assert len(all_owned) == len(set(all_owned)), "a table must have one owner"


def test_accounts_written_with_derived_passwords(tmp_path):
    db = tmp_path / "nexus.db"
    with sqlite3.connect(db) as con:
        con.execute("CREATE TABLE users (username VARCHAR PRIMARY KEY, password_hash VARCHAR NOT NULL)")
    assert nexus_accounts.write(db, "s3cret", {"event-service": ["events"], "slot-service": ["slots"]}) == 2
    assert nexus_accounts.service_password("s3cret", "event-service") != nexus_accounts.service_password("s3cret", "slot-service")
    with sqlite3.connect(db) as con:
        assert con.execute("SELECT username FROM table_owners WHERE table_name = 'events'").fetchall() == [("event-service",)]
        assert {u for (u,) in con.execute("SELECT username FROM users")} == {"event-service", "slot-service"}
