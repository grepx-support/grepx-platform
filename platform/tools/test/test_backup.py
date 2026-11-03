# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""Backup / restore of the platform's SQLite databases (consistent copy + readable JSON)."""
import json
import sqlite3
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "grepx_tools"))

import backup  # noqa: E402


def test_export_writes_a_consistent_copy_and_json(tmp_path):
    src = tmp_path / "svc.db"
    with sqlite3.connect(src) as db:
        db.execute("CREATE TABLE donors (key TEXT PRIMARY KEY, doc TEXT)")
        db.execute("INSERT INTO donors VALUES ('d1', ?)", (json.dumps({"name": "Ann"}),))
    out = tmp_path / "backup"
    assert backup.export_sqlite("donor-service", src, out) == 1
    assert json.loads((out / "tables/donor-service/donors.json").read_text())[0]["doc"] == {"name": "Ann"}
    with sqlite3.connect(out / "databases/donor-service.db") as db:
        assert db.execute("SELECT COUNT(*) FROM donors").fetchone()[0] == 1


def test_restore_puts_databases_back(tmp_path, monkeypatch):
    live = tmp_path / "live" / "svc.db"
    folder = tmp_path / "bk"
    (folder / "databases").mkdir(parents=True)
    with sqlite3.connect(folder / "databases" / "donor-service.db") as db:
        db.execute("CREATE TABLE t (x)")
    monkeypatch.setattr(backup, "databases", lambda: [("donor-service", f"sqlite:///{live}")])
    import processes
    import workspace
    monkeypatch.setattr(processes, "pid_of", lambda name: None)
    monkeypatch.setattr(workspace, "registry", lambda: {})
    assert backup.restore(str(folder)) == 0 and live.exists()
