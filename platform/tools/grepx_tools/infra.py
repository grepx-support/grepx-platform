# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""Infrastructure from configuration: which database engines the services use, and starting them.

    python platform/tools/grepx_tools/infra.py plan     # service -> engine table
    python platform/tools/grepx_tools/infra.py up       # start needed engines (+ monitoring), create per-service databases
    python platform/tools/grepx_tools/infra.py down | status
Called by scripts/infra.sh - you normally don't run it directly.
"""
from __future__ import annotations

import configparser
import os
import socket
import subprocess
import sys
import time
from pathlib import Path
from urllib.parse import urlparse

import yaml

from root import ROOT  # noqa: E402  (the workspace, see root.py)
sys.path[:0] = [str(p) for p in sorted((ROOT / "platform" / "libs").glob("*/"))]
from grepx_store import database_url, engine_of  # noqa: E402
from grepx_config import load_config  # noqa: E402

INFRA = yaml.safe_load((ROOT / "config" / "infra.yaml").read_text(encoding="utf-8"))
COMPOSE = ["docker", "compose", "-f", str(ROOT / "infra" / "docker-compose.yml")]


def services() -> dict[str, str]:
    """service name -> resolved database URL (only services with a config.yaml)."""
    ini = configparser.ConfigParser()
    ini.read(ROOT / "config" / "services.ini")
    out = {}
    for name in ini.sections():
        cfg_dir = ROOT / ini[name]["path"] / "config"
        if (cfg_dir / "config.yaml").exists():
            out[name] = database_url(load_config(cfg_dir))
    return out


def needed() -> dict[str, list[str]]:
    engines: dict[str, list[str]] = {}
    for name, url in services().items():
        engines.setdefault(engine_of(url), []).append(name)
    return engines


def plan() -> None:
    for name, url in services().items():
        print(f"{name:28} {engine_of(url):9} {url.split('@')[-1]}")
    print("\nengines:", ", ".join(f"{e} ({len(s)})" for e, s in needed().items()))


def compose_env() -> dict:
    db = INFRA.get("databases", {})
    pg, mg = db.get("postgres", {}), db.get("mongo", {})
    return {**os.environ, "POSTGRES_IMAGE": str(pg.get("image", "postgres:16")), "POSTGRES_PORT": str(pg.get("port", 5432)),
            "POSTGRES_USER": str(pg.get("user", "grepx")), "POSTGRES_PASSWORD": str(pg.get("password", "grepx")),
            "MONGO_IMAGE": str(mg.get("image", "mongo:7")), "MONGO_PORT": str(mg.get("port", 27017))}


def reachable(url: str) -> bool:
    u = urlparse(url)
    try:
        with socket.create_connection((u.hostname or "127.0.0.1", u.port or {"postgres": 5432, "mongo": 27017}[engine_of(url)]), timeout=2):
            return True
    except OSError:
        return False


def create_postgres_databases(urls: list[str]) -> None:
    user = str(INFRA["databases"]["postgres"].get("user", "grepx"))
    for url in urls:
        db = urlparse(url).path.lstrip("/")
        if not db:
            continue
        exists = subprocess.run([*COMPOSE, "exec", "-T", "postgres", "psql", "-U", user, "-tAc", f"SELECT 1 FROM pg_database WHERE datname='{db}'"],
                                capture_output=True, text=True, env=compose_env()).stdout.strip()
        if exists != "1":
            subprocess.run([*COMPOSE, "exec", "-T", "postgres", "createdb", "-U", user, db], check=True, env=compose_env())
            print(f"  created database {db}")


def up() -> None:
    engines, urls = needed(), services()
    external = [e for e in engines if e in ("postgres", "mongo")]
    if INFRA.get("databases", {}).get("mode", "docker") == "docker" and external:
        profiles = [a for e in external for a in ("--profile", e)]
        subprocess.run([*COMPOSE, *profiles, "up", "-d"], check=True, env=compose_env())
        if "postgres" in external:
            for _ in range(60):
                if subprocess.run([*COMPOSE, "exec", "-T", "postgres", "pg_isready"], capture_output=True, env=compose_env()).returncode == 0:
                    break
                time.sleep(1)
            create_postgres_databases([u for u in urls.values() if engine_of(u) == "postgres"])
    for engine in external:
        bad = [n for n in engines[engine] if not reachable(urls[n])]
        print(f"{engine:9} {'ready' if not bad else 'NOT reachable for ' + ', '.join(bad)}")
    if "sqlite" in engines:
        (ROOT / "data").mkdir(exist_ok=True)
        print(f"sqlite    files in data/ for {len(engines['sqlite'])} service(s)")
    if INFRA.get("monitoring"):
        from monitor import observability
        observability([])
        print("monitoring up: Grafana http://<this server>:3000")


def status() -> None:
    urls = services()
    for engine, names in needed().items():
        if engine in ("postgres", "mongo"):
            print(f"{engine:9} {'UP' if all(reachable(urls[n]) for n in names) else 'DOWN'}  used by {', '.join(names)}")
        else:
            print(f"{engine:9} local     used by {len(names)} service(s)")


def down() -> None:
    subprocess.run([*COMPOSE, "--profile", "postgres", "--profile", "mongo", "down"], env=compose_env())


if __name__ == "__main__":
    {"plan": plan, "up": up, "status": status, "down": down}.get((sys.argv[1:] or ["up"])[0], plan)()
