# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""Browse the databases in a web page: the Nexus database plus every service's own database (read-only).

    scripts/run.sh dbview [start]     start it in the background and print how to open it
    scripts/run.sh dbview stop
    scripts/run.sh dbview status      running or not, its port, and the commands to reach it
    scripts/run.sh dbview list        which databases it shows

Uses Datasette (open source, installed into the tooling .venv on first start). Every SQLite file is opened read-only, so
browsing can never change data. It listens on 127.0.0.1 only and has no login of its own: reach it from your PC through
an SSH tunnel (the command is printed) - never open its port on the firewall.

.env:  DBVIEW=on           also start / stop it with `scripts/run.sh start|stop all` and show it in `status`
       DBVIEW_PORT=8890    first port to try (the next free one is used if taken, e.g. by another product)

Postgres / Mongo databases (when a service is switched to them) are listed with how to reach them; Datasette shows
SQLite only - use DBeaver / pgAdmin / Compass through the same kind of tunnel.
"""
from __future__ import annotations

import json
import os
import signal
import socket
import subprocess
import sys
import time
from pathlib import Path
from urllib.parse import urlparse

from log import say
from workspace import LOGS, ROOT, RUN, dotenv

NAME = "dbview"
PID = RUN / f"{NAME}.pid"
PORT_FILE = RUN / f"{NAME}.port"
NEXUS_DB = ROOT / "platform" / "nexus-server" / "bin" / "nexus_data.db"


def setting(key: str, default: str = "") -> str:
    return os.environ.get(key) or dotenv().get(key) or default


def enabled() -> bool:
    return setting("DBVIEW").lower() in ("1", "on", "true", "yes")


def product() -> str:
    try:
        import yaml
        return (yaml.safe_load((ROOT / "grepx.workspace.yaml").read_text(encoding="utf-8")) or {}).get("product") or ROOT.name
    except (OSError, ValueError):
        return ROOT.name


def databases() -> tuple[dict[str, Path], dict[str, str]]:
    """(name -> SQLite file that exists, name -> other database URL without password)."""
    files: dict[str, Path] = {}
    others: dict[str, str] = {}
    if NEXUS_DB.exists():
        files["nexus"] = NEXUS_DB
    try:
        from infra import services
        urls = services()
    except Exception as e:                       # a broken service config must not stop the viewer
        say("WARN", NAME, f"could not read service databases: {e}")
        urls = {}
    for name, url in urls.items():
        u = urlparse(url)
        if u.scheme.startswith("sqlite"):
            path = Path(url.split(":///", 1)[-1].split("?", 1)[0])   # sqlite:///rel/x.db or sqlite:////abs/x.db
            path = path if path.is_absolute() else ROOT / path
            if path.exists():
                files[name] = path
        else:
            others[name] = f"{u.scheme}://{u.hostname or ''}{':' + str(u.port) if u.port else ''}{u.path}"
    return files, others


def pid() -> int | None:
    try:
        p = int(PID.read_text())
        os.kill(p, 0)
        return p
    except (OSError, ValueError):
        PID.unlink(missing_ok=True)
        return None


def free(port: int) -> bool:
    with socket.socket() as s:
        s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            s.bind(("127.0.0.1", port))
            return True
        except OSError:
            return False


def pick_port() -> int:
    first = int(setting("DBVIEW_PORT", "8890"))
    for port in range(first, first + 50):
        if free(port):
            return port
    raise SystemExit(f"no free port between {first} and {first + 49}")


def server_host() -> str:
    """The server's public name, from SITE_URL (what people already use), else this machine's name."""
    host = urlparse(setting("SITE_URL")).hostname or ""
    return host if host not in ("", "localhost", "127.0.0.1") else socket.getfqdn()


def how_to_open(port: int) -> None:
    host = server_host()
    print(f"""
  Database viewer ({product()}) - read-only, listening on 127.0.0.1:{port} of this server
    on the server itself : curl http://127.0.0.1:{port}/
    from your PC         : ssh -N -L {port}:127.0.0.1:{port} <user>@{host}
                           then open http://localhost:{port}/ in your browser (keep the ssh window open)
    stop                 : scripts/run.sh dbview stop
    log                  : logs/{NAME}.log
""")


def ensure_datasette() -> bool:
    try:
        import datasette  # noqa: F401
        return True
    except ImportError:
        say("INFO", NAME, "installing Datasette into the tooling .venv (first start only)")
        code = subprocess.call([sys.executable, "-m", "pip", "install", "-q", "datasette>=0.64,<1"])
        if code:
            say("ERROR", NAME, "pip install datasette failed - check the network, then try again")
        return code == 0


def start() -> int:
    running = pid()
    if running:
        say("INFO", NAME, f"already running (pid {running})")
        how_to_open(int(PORT_FILE.read_text()) if PORT_FILE.exists() else 0)
        return 0
    files, others = databases()
    if not files:
        say("ERROR", NAME, "no SQLite databases found yet - run scripts/setup.sh / scripts/run.sh start first")
        return 1
    if not ensure_datasette():
        return 1
    RUN.mkdir(exist_ok=True)
    LOGS.mkdir(exist_ok=True)
    port = pick_port()
    meta = RUN / f"{NAME}.metadata.json"
    meta.write_text(json.dumps({"title": f"{product()} databases (read-only)",
                                "description": "Nexus is the shared database every service talks through; "
                                               "the others are each service's own tables."}))
    # Each file gets a readable name in the page (nexus, stock-service, ...) through a symlink folder.
    links = RUN / f"{NAME}-db"
    links.mkdir(exist_ok=True)
    for old in links.iterdir():
        old.unlink()
    paths = []
    for name, path in files.items():
        link = links / f"{name}.db"
        link.symlink_to(path)
        paths.append(str(link))
    command = [sys.executable, "-m", "datasette", "serve", *paths, "--host", "127.0.0.1", "--port", str(port),
               "--metadata", str(meta), "--setting", "sql_time_limit_ms", "3000",
               "--setting", "max_returned_rows", "2000", "--setting", "allow_download", "off"]
    log = open(LOGS / f"{NAME}.log", "a", encoding="utf-8")
    proc = subprocess.Popen(command, cwd=ROOT, stdout=log, stderr=subprocess.STDOUT, start_new_session=True)
    PID.write_text(str(proc.pid))
    PORT_FILE.write_text(str(port))
    for _ in range(40):
        if not free(port):
            break
        if proc.poll() is not None:
            say("ERROR", NAME, f"exited with code {proc.returncode} - see logs/{NAME}.log")
            return 1
        time.sleep(0.25)
    say("OK", NAME, f"started pid={proc.pid}, {len(files)} databases, port {port}")
    for name, url in others.items():
        say("INFO", NAME, f"{name} uses {url} - not shown here; open it with DBeaver/pgAdmin/Compass through a tunnel")
    how_to_open(port)
    return 0


def stop() -> int:
    running = pid()
    if not running:
        say("INFO", NAME, "not running")
        return 0
    os.kill(running, signal.SIGTERM)
    for _ in range(30):
        time.sleep(0.1)
        try:
            os.kill(running, 0)
        except OSError:
            break
    else:
        os.kill(running, signal.SIGKILL)
    PID.unlink(missing_ok=True)
    PORT_FILE.unlink(missing_ok=True)
    say("OK", NAME, f"stopped (pid {running})")
    return 0


def status(verbose: bool = True) -> int:
    running = pid()
    port = PORT_FILE.read_text().strip() if running and PORT_FILE.exists() else "-"
    if not verbose:
        state = "UP" if running else ("DOWN" if enabled() else "off")
        print(f"{NAME:26} {state:10} {running or '-':>7} {port:>5}  read-only database viewer"
              + (f" -> scripts/run.sh dbview status" if running else ""))
        return 0
    if running:
        say("OK", NAME, f"running (pid {running})")
        how_to_open(int(port))
    else:
        say("INFO", NAME, "not running - start it with: scripts/run.sh dbview start")
    return 0


def show_list() -> int:
    files, others = databases()
    for name, path in files.items():
        print(f"{name:28} sqlite    {path.relative_to(ROOT) if path.is_relative_to(ROOT) else path}")
    for name, url in others.items():
        print(f"{name:28} {url.split(':')[0]:9} {url}")
    return 0


def main(args: list[str]) -> int:
    cmd = args[0] if args else "start"
    actions = {"start": start, "stop": stop, "status": status, "list": show_list}
    if cmd not in actions:
        print(__doc__)
        return 1
    return actions[cmd]()


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
