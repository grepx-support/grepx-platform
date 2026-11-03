"""grepx_store: same behaviour on every backend; config resolution order."""
import os

import pytest
from grepx_store import MemoryStore, SqliteStore, database_url, engine_of, open_store

BACKENDS = [lambda tmp: MemoryStore(), lambda tmp: SqliteStore(str(tmp / "x.db"))]
if os.environ.get("TEST_POSTGRES_URL"):
    BACKENDS.append(lambda tmp: open_store(os.environ["TEST_POSTGRES_URL"]))
if os.environ.get("TEST_MONGO_URL"):
    BACKENDS.append(lambda tmp: open_store(os.environ["TEST_MONGO_URL"]))


@pytest.mark.parametrize("make", BACKENDS)
def test_put_get_find_delete(make, tmp_path):
    s = make(tmp_path)
    s.put("credentials", "u1", {"email": "a@x.sg", "n": 1})
    s.put("credentials", "u2", {"email": "b@x.sg", "n": 2})
    s.put("credentials", "u1", {"email": "a@x.sg", "n": 3})
    assert s.get("credentials", "u1")["n"] == 3 and s.get("credentials", "zz") is None
    assert [d["n"] for d in s.find("credentials", email="b@x.sg")] == [2]
    s.delete("credentials", "u2")
    assert s.find("credentials", email="b@x.sg") == []


def test_bad_collection_name_is_refused():
    with pytest.raises(ValueError):
        MemoryStore().put("drop table;", "k", {})


def test_resolution_order(monkeypatch):
    monkeypatch.delenv("GREPX_DATABASE_URL", raising=False)
    cfg = {"service_name": "auth-service", "database": {"url": "postgresql://db/{service_db}"}}
    assert database_url(cfg) == "postgresql://db/auth_service"
    assert database_url({"service_name": "x"}).endswith("/data/x.db")
    monkeypatch.setenv("DATABASE_URL_AUTH_SERVICE", "mongodb://m/auth")
    assert database_url(cfg) == "mongodb://m/auth" and engine_of(database_url(cfg)) == "mongo"


def test_setup_should_create_database_tables_and_indexes(tmp_path, monkeypatch):
    import sqlite3
    from grepx_store.setup import setup_service
    svc = tmp_path / "svc"
    (svc / "config").mkdir(parents=True)
    (svc / "config" / "config.yaml").write_text(
        f"service_name: demo-service\nowns: [things]\ntables:\n  people: [email]\ndatabase:\n  url: sqlite:///{tmp_path}/db/demo.db\n")
    monkeypatch.delenv("GREPX_DATABASE_URL", raising=False)
    assert sorted(setup_service(svc)) == ["people", "things"]
    names = {r[0] for r in sqlite3.connect(tmp_path / "db" / "demo.db").execute("SELECT name FROM sqlite_master")}
    assert {"people", "things", "people_email"} <= names
    assert sorted(setup_service(svc)) == ["people", "things"]  # idempotent
