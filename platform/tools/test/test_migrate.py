"""Migration 001 moves blood-drive data onto the generic services' names, and is safe to run twice."""
import sqlite3
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "grepx_tools"))

import migrate  # noqa: E402
from nexus_api.codec.values import decode_value, encode_value  # noqa: E402

SCHEMA = """
CREATE TABLE nexus_rows (table_name VARCHAR NOT NULL, row_key VARCHAR NOT NULL, fields VARCHAR NOT NULL, version INTEGER NOT NULL,
                         PRIMARY KEY (table_name, row_key));
CREATE TABLE outbox (id INTEGER PRIMARY KEY AUTOINCREMENT, table_name VARCHAR NOT NULL, transaction_id VARCHAR NOT NULL,
    from_status VARCHAR, to_status VARCHAR NOT NULL, from_service VARCHAR, to_service VARCHAR, fields VARCHAR NOT NULL,
    occurred_at VARCHAR NOT NULL, published_at VARCHAR);
"""


def enc(fields: dict) -> str:
    return migrate.encode([[k, encode_value(v)] for k, v in fields.items()])


def dec(text: str) -> dict:
    return {k: decode_value(v) for k, v in migrate.decode(text)}


def rows(con) -> dict:
    return {(t, k): dec(f) for t, k, f in con.execute("SELECT table_name, row_key, fields FROM nexus_rows")}


def test_generic_services_migration(tmp_path):
    db = tmp_path / "nexus.db"
    con = sqlite3.connect(db)
    con.executescript(SCHEMA)
    seed = {
        ("drives", "d1"): {"title": "Town Hall", "drive_date": "2026-11-01", "status": "ACCEPTED", "from_service": "drive-service"},
        ("registrations", "d1-p1"): {"drive_id": "d1", "donor_id": "p1", "state": "donated", "status": "ACCEPTED"},
        ("certificates", "c1"): {"drive_id": "d1", "donor_id": "p1", "drive_title": "Town Hall", "donated_on": "2026-11-01"},
        ("referral_scores", "p0"): {"donor_id": "p0", "joined": 1, "donated": 1, "points": 3},
        ("drive_reports", "d1"): {"drive_id": "d1", "stats": {"donated": 1, "drive": {"title": "Town Hall"}, "no_show": 0}},
        ("notifications", "n1"): {"template": "drive_reminder", "values": {"drive_title": "Town Hall 🩸", "venue": "Hall"}},
        ("templates", "drive_reminder"): {"bodies": {"text": "See you at {drive_title} on {drive_date}"}, "placeholders": ["drive_title"]},
        ("tasks", "t1"): {"ref_type": "drive", "ref_id": "d1"},
        ("schedules", "drive-reminders"): {"schedule_id": "drive-reminders", "job": "drive-reminders", "target_service": "registration-service"},
        ("donations", "x1"): {"donor_id": "p1", "drive_id": "d1", "donated_on": "2026-11-01"},
        ("_health", "drive-service"): {"service": "drive-service"},
    }
    for (t, k), f in seed.items():
        con.execute("INSERT INTO nexus_rows VALUES (?, ?, ?, 1)", (t, k, enc(f)))
    con.execute("INSERT INTO outbox (table_name, transaction_id, to_status, from_service, to_service, fields, occurred_at) "
                "VALUES ('registration_requests', 'r1', 'NEW', 'blood-donation-bff', 'registration-service', ?, 'now')",
                (enc({"action": "MARK", "registration_id": "d1-p1", "state": "donated"}),))
    con.commit()
    con.close()

    spec = migrate.load("001-generic-services")
    first = migrate.apply(db, spec)
    assert first["rows"] == 9 and first["outbox"] == 1 and first["dropped"] == 1 and not first["conflicts"]
    assert migrate.apply(db, spec) == {"rows": 0, "outbox": 0, "dropped": 0, "conflicts": []}     # idempotent

    con = sqlite3.connect(db)
    got = rows(con)
    assert got[("events", "d1")]["event_date"] == "2026-11-01" and got[("events", "d1")]["from_service"] == "event-service"
    assert got[("bookings", "d1-p1")] == {"event_id": "d1", "person_id": "p1", "state": "attended", "status": "ACCEPTED"}
    assert got[("certificates", "c1")] == {"event_id": "d1", "person_id": "p1", "event_title": "Town Hall", "attended_on": "2026-11-01"}
    assert got[("referral_scores", "p0")] == {"person_id": "p0", "joined": 1, "converted": 1, "points": 3}
    assert got[("event_reports", "d1")]["stats"] == {"attended": 1, "event": {"title": "Town Hall"}, "no_show": 0}
    assert got[("notifications", "n1")]["values"] == {"event_title": "Town Hall 🩸", "venue": "Hall"}
    assert got[("templates", "drive_reminder")] == {"bodies": {"text": "See you at {event_title} on {event_date}"}, "placeholders": ["event_title"]}
    assert got[("tasks", "t1")]["ref_type"] == "event"
    assert got[("schedules", "event-reminders")] == {"schedule_id": "event-reminders", "job": "event-reminders", "target_service": "booking-service"}
    assert got[("donations", "x1")] == seed[("donations", "x1")]          # product table: untouched
    assert not any(t == "_health" for t, _ in got)
    table, src, dst, fields = con.execute("SELECT table_name, from_service, to_service, fields FROM outbox").fetchone()
    assert (table, src, dst) == ("booking_requests", "blood-donation-bff", "booking-service")
    assert dec(fields) == {"action": "MARK", "booking_id": "d1-p1", "state": "attended"}


def test_people_service_migration(tmp_path):
    db = tmp_path / "nexus.db"
    con = sqlite3.connect(db)
    con.executescript(SCHEMA)
    ann = {"donor_id": "u1", "name": "Ann Tan", "email": "ann@x.sg", "blood_group": "O-", "ref_code": "abc", "status": "ACCEPTED"}
    con.execute("INSERT INTO nexus_rows VALUES ('donors', 'u1', ?, 3)", (enc(ann),))
    con.execute("INSERT INTO nexus_rows VALUES ('donations', 'x1', ?, 1)", (enc({"donor_id": "u1", "drive_id": "d1"}),))
    con.execute("INSERT INTO nexus_rows VALUES ('donor_segments', 's1', ?, 1)", (enc({"name": "Rare"}),))
    con.commit()
    con.close()
    spec = migrate.load("002-people-service")
    assert migrate.apply(db, spec)["rows"] == 1
    assert migrate.apply(db, spec)["rows"] == 0
    got = rows(sqlite3.connect(db))
    person = got[("people", "u1")]
    assert person["person_id"] == "u1" and "donor_id" not in person and (person["blood_group"], person["ref_code"]) == ("O-", "abc")
    assert got[("donations", "x1")] == {"donor_id": "u1", "drive_id": "d1"} and ("donor_segments", "s1") in got
    assert not any(t == "donors" for t, _ in got)
