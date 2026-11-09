# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""Observe the running platform: status table from heartbeats, merged logs, Prometheus targets."""
from __future__ import annotations

import os
import subprocess

from log import say
from nexus import nexus_log, nexus_port, nexus_up
from processes import pid_of
from workspace import LOGS, ROOT, registry


def local_time(iso: str) -> str:
    """Heartbeats are stamped in UTC; show them in this machine's time like the log lines."""
    from datetime import datetime
    try:
        return datetime.fromisoformat(iso).astimezone().strftime("%H:%M:%S")
    except ValueError:
        return ""


def health() -> dict:
    """Heartbeats from Nexus (_health table); {} when Nexus itself is down."""
    try:
        from nexus_api import HEALTH_TABLE, NexusClient
        client = NexusClient("run-status")
        rows = {r.key: r.fields for r in client.select(HEALTH_TABLE, "")}
        client.close()
        return rows
    except Exception:
        return {}


def last_error(name: str) -> str:
    path = LOGS / f"{name}.log"
    if not path.exists():
        return ""
    for line in reversed(path.read_text(encoding="utf-8", errors="replace").splitlines()[-400:]):
        if '"level": "ERROR"' in line or "Traceback" in line or "Error" in line[:200]:
            return line[:110]
    return ""


def status(only: str = "") -> int:
    from nexus_api import is_stale
    beats, problems = health(), 0
    say("INFO", "status", "services (heartbeats via Nexus)", to_file=False)
    print(f"{'SERVICE':26} {'STATE':10} {'PID':>7} {'PORT':>5}  {'HANDLED':>7} {'REJECT':>6} {'ERRORS':>6}  LAST SEEN")
    for name, s in registry().items():
        if only and only != "all" and name != only:
            continue
        pid, beat = pid_of(name), beats.get(name)
        if name == "nexus-server":
            state = "UP" if nexus_up() else ("STARTING" if pid else "DOWN")
            beat = {"port": nexus_port(), "last_seen": ""}
        elif not s["enabled"]:
            state = "disabled"
        elif not pid and not beat:
            state = "DOWN"
        elif beat and not is_stale(beat.get("last_seen", "")):
            state = "UP"
        elif pid:
            state = "STARTING" if not beat else "STALE"
        else:
            state = "DOWN"
        b = beat or {}
        print(f"{name:26} {state:10} {pid or '-':>7} {b.get('port') or '-':>5}  {b.get('handled', '-'):>7} {b.get('rejected', '-'):>6} "
              f"{b.get('errors', '-'):>6}  {local_time(b.get('last_seen', ''))}")
        if state in ("DOWN", "STALE") or b.get("errors"):
            problems += 1
            hint = b.get("last_error") or last_error(name)
            if hint:
                print(f"{'':26}   -> {hint}")
    say("WARN", "status", f"{problems} service(s) need attention - see scripts/run.sh logs <name>") if problems else say("OK", "status", "all services up")
    return 1 if problems else 0


def targets_file() -> int:
    """Prometheus file_sd targets from heartbeats -> observability/prometheus/targets.json (re-run after start)."""
    import json
    host = os.environ.get("METRICS_HOST", "127.0.0.1")   # Prometheus runs on the host network
    targets = [{"targets": [f"{host}:{b['port']}"], "labels": {"service": name, "project": b.get("project", "platform")}}
               for name, b in health().items() if b.get("port")]
    out = ROOT / "observability" / "prometheus" / "targets.json"
    out.write_text(json.dumps(targets, indent=2), encoding="utf-8")
    say("OK", "targets", f"{len(targets)} scrape targets -> {out.relative_to(ROOT)}")
    return 0


def logs(args: list[str]) -> None:
    """logs            last 40 lines of every service, merged by time
       logs NAME       follow one service
       logs errors     only WARNING/ERROR lines from every service
       logs TRACE_ID   every line of one request across all services"""
    import json
    if args and args[0] == "nexus-server":
        path = nexus_log(pid_of("nexus-server"))
        if not path.exists():
            say("WARN", "logs", f"no Nexus log at {path}")
            return
        say("INFO", "logs", f"following {path}")
        os.execvp("tail", ["tail", "-n", "100", "-f", str(path)])
    if args and (LOGS / f"{args[0]}.log").exists():
        os.execvp("tail", ["tail", "-n", "100", "-f", str(LOGS / f"{args[0]}.log")])
        return
    entries = []
    for path in LOGS.glob("*.log"):
        for line in path.read_text(encoding="utf-8", errors="replace").splitlines()[-2000:]:
            try:
                e = json.loads(line)
            except ValueError:
                e = {"ts": "", "level": "TEXT", "service": path.stem, "msg": line}
            if args and args[0] == "errors" and e.get("level") not in ("WARNING", "ERROR", "CRITICAL"):
                continue
            if args and args[0] != "errors" and args[0] not in (e.get("trace_id"), ) and args[0] not in line:
                continue
            entries.append(e)
    entries.sort(key=lambda e: e.get("ts", ""))
    for e in entries[-40 if not args else -500:]:
        ts = e.get("ts", "").replace("T", " ")[:19]
        print(f"{ts} {e.get('level', ''):<5} [{e.get('service', '')}] {('(' + e['trace_id'][:12] + ') ') if e.get('trace_id') else ''}{e.get('msg', '')[:200]}")


def observability(args: list[str]) -> int:
    """scripts/run.sh monitor: Prometheus + Loki/Promtail + Grafana (docker compose; GRAFANA_PASSWORD etc. from .env). `monitor down` stops them.
    Old Elasticsearch/Logstash containers from earlier versions are removed (--remove-orphans)."""
    env_file = ["--env-file", str(ROOT / ".env")] if (ROOT / ".env").exists() else []
    command = args or ["up", "-d", "--remove-orphans"]
    if command[0] == "up":
        targets_file()          # Prometheus scrapes what is running now, not a stale list
    # observability/ may be a link into grepx-platform: give Promtail the workspace logs folder as an absolute path
    env = {**os.environ, "GREPX_LOGS": str(ROOT / "logs")}
    return subprocess.call(["docker", "compose", *env_file, "-f", str(ROOT / "observability" / "docker-compose.yml"), *command], env=env)
