"""Create a service's database and tables - by setup.sh, and again (create-if-missing) every time the service starts.

    python -m grepx_store <service-folder>

1. resolves the service's database URL from its config (platform <- project <- service <- env)
2. installs the driver into this Python if the engine needs one (psycopg / pymongo)
3. creates the database itself if it does not exist (PostgreSQL; SQLite file; MongoDB on first write)
4. creates every table listed under `tables:` in config.yaml, with its indexes
Safe to run again: everything is "create if missing".
"""
from __future__ import annotations

import importlib
import subprocess
import sys
from pathlib import Path
from urllib.parse import urlparse, urlunparse

from .resolve import database_url, engine_of
from .stores import open_store

DRIVERS = {"postgres": ("psycopg", "psycopg[binary]>=3.1"), "mongo": ("pymongo", "pymongo>=4.6")}


def ensure_driver(engine: str) -> None:
    if engine not in DRIVERS:
        return
    module, package = DRIVERS[engine]
    try:
        importlib.import_module(module)
    except ImportError:
        print(f"  installing {package}")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "-q", "--disable-pip-version-check", package])


def ensure_database(url: str) -> None:
    engine = engine_of(url)
    if engine == "sqlite" and "sqlite:///" in url:
        Path(url.split("sqlite:///", 1)[1]).parent.mkdir(parents=True, exist_ok=True)
    if engine == "postgres":
        import psycopg
        name = urlparse(url).path.lstrip("/")
        admin = urlunparse(urlparse(url)._replace(path="/postgres"))
        with psycopg.connect(admin, autocommit=True) as conn:
            if not conn.execute("SELECT 1 FROM pg_database WHERE datname = %s", (name,)).fetchone():
                conn.execute(f'CREATE DATABASE "{name}"')
                print(f"  created database {name}")


def tables_of(cfg) -> dict[str, list[str]]:
    """config.yaml `tables:` -> {table: [indexed fields]}; tables in `owns:` are included even if not listed."""
    declared = dict(cfg.get("tables") or {})
    for table in cfg.get("owns") or []:
        declared.setdefault(table, [])
    return {t: list(f or []) for t, f in declared.items()}


def setup_service(service_dir: Path) -> list[str]:
    from grepx_config import load_config
    return ensure_schema(load_config(Path(service_dir) / "config"))


def ensure_schema(cfg, install_driver: bool = True) -> list[str]:
    """Database + tables for this service; called by setup.sh AND at every service start (before Nexus)."""
    url = database_url(cfg)
    engine = engine_of(url)
    if install_driver:
        ensure_driver(engine)
    ensure_database(url)
    tables = tables_of(cfg)
    print(f"  {cfg.get('service_name')}: {engine} {url.split('@')[-1]}", flush=True)
    if tables:
        store = open_store(url)
        for table, indexes in tables.items():
            store.ensure(table, tuple(indexes))
        store.close()
    print(f"  {cfg.get('service_name')}: {len(tables)} table(s) {', '.join(tables)}")
    return list(tables)


if __name__ == "__main__":
    setup_service(Path(sys.argv[1] if len(sys.argv) > 1 else "."))
