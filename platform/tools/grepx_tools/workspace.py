"""Where things are: repo paths, .env, the service registry (config/services.ini) and project configs."""
from __future__ import annotations

import configparser
import os
import sys
from pathlib import Path

import yaml

from log import say

from root import ROOT  # noqa: E402  (the workspace, see root.py)
LIBS = sorted((ROOT / "platform" / "libs").glob("*/"))
RUN, LOGS = ROOT / "run", ROOT / "logs"


def dotenv() -> dict:
    """KEY=VALUE lines from the repo's .env (never executed as shell; quotes stripped)."""
    path, out = ROOT / ".env", {}
    if path.exists():
        for line in path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, value = line.split("=", 1)
                out[key.strip()] = value.strip().strip('"').strip("'")
    return out


def env(name: str = "") -> dict:
    e = {**dotenv(), **os.environ}
    e.update({"GREPX_HOME": str(ROOT), "GREPX_SERVICE": name, "LOG_FORMAT": e.get("LOG_FORMAT", "json"), "LOG_TO_FILE": "0", "PYTHONUNBUFFERED": "1"})
    e["PYTHONPATH"] = os.pathsep.join([str(p) for p in LIBS] + [e.get("PYTHONPATH", "")])
    e.setdefault("AUTH_DB_PATH", str(ROOT / "data" / "auth-service.db"))
    if name and name != "nexus-server" and e.get("NEXUS_SERVICE_SECRET"):   # its own Nexus login (nexus_accounts.py)
        from nexus_accounts import service_password
        e.update({"NEXUS_USERNAME": name, "NEXUS_PASSWORD": service_password(e["NEXUS_SERVICE_SECRET"], name)})
    return e


def registry() -> dict[str, dict]:
    ini = configparser.ConfigParser()
    ini.read(ROOT / "config" / "services.ini")
    return {name: {"path": ROOT / ini[name]["path"], "enabled": ini[name].getboolean("enabled", True),
                   "project": ini[name].get("project", "platform")} for name in ini.sections()}


def python_for(path: Path) -> str:
    """The service's own .venv once its setup.sh finished (.venv/.ready); otherwise the tooling Python."""
    candidate = path / ".venv" / "bin" / "python"
    if candidate.exists() and (path / ".venv" / ".ready").exists():
        return str(candidate)
    return sys.executable


def targets(arg: str) -> list[str]:
    reg = registry()
    names = [n for n, s in reg.items() if s["enabled"]] if arg == "all" else [arg]
    unknown = [n for n in names if n not in reg]
    if unknown:
        say("ERROR", "grepx", f"unknown service '{unknown[0]}' - see: scripts/setup.sh list")
        sys.exit(1)
    return names


def projects() -> dict[str, dict]:
    """config/projects/<name>.yaml for every project (a product declares catalog: and its BFF vocabulary:)."""
    return {p.stem: yaml.safe_load(p.read_text(encoding="utf-8")) or {} for p in sorted((ROOT / "config" / "projects").glob("*.yaml"))}
