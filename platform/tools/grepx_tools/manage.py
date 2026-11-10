# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""One control script for the whole platform (Linux / macOS).

    scripts/setup.sh [install|reset|db|list] [all|name]   # runs each service's own setup.sh
    scripts/run.sh start [all|name]      # nexus-server first, then services, then the BFF
    scripts/run.sh stop  [all|name]
    scripts/run.sh status
    scripts/run.sh seed                  # load each product's catalogue (config/projects/<p>.yaml catalog:) into the common services
    scripts/run.sh admin EMAIL PASSWORD NAME PHONE
    scripts/run.sh test [path]           # every service's tests, each in its own process
    scripts/run.sh catalog | find WORD   # service registry
    scripts/run.sh new common|product/<p> NAME --table T --actions A,B   # scaffold a service
    scripts/run.sh deps                  # rewrite requirements.txt from imports; fail on a library import cycle
    scripts/run.sh contracts [--check]   # regenerate grepx_contracts from each service's config + dto
    scripts/run.sh lint-contracts        # list service/table names typed outside grepx_contracts
    scripts/run.sh db [all|name]                    # (re)create each service's database + tables (setup.sh does this too)
    scripts/run.sh migrate [NAME [--dry-run]]  # Nexus data migrations (platform/tools/migrations/), services stopped
    scripts/run.sh nexus-accounts       # one Nexus login per service + table ownership (NEXUS_SERVICE_SECRET)
    scripts/run.sh headers [--dry-run|--remove]  # GrepX proprietary header in every source file of every repo
    scripts/run.sh workspace [pin]       # check grepx.workspace.yaml (versions, folders, Nexus checksum)
    scripts/run.sh new-product NAME      # a new product: deployment file, catalogue, plugins folder, project config
    scripts/run.sh trace TRACE_ID        # follow one request through every service
    scripts/run.sh monitor [down]        # Prometheus + Loki + Grafana (docker) -> http://<server>:3000
    scripts/run.sh targets               # refresh Prometheus targets from heartbeats
    scripts/run.sh demo [ARGS]           # optional demo data: runs the product's demo/seed.py (see its --help)
    scripts/run.sh dbview [start|stop|status|list]  # read-only web viewer of Nexus + every service database (Datasette)
Logs: logs/<name>.log   PIDs: run/<name>.pid
"""
from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from installer import setup_all  # noqa: E402
from monitor import logs, observability, status, targets_file  # noqa: E402
from processes import start, stop  # noqa: E402
from testrun import run_tests  # noqa: E402
from workspace import ROOT, dotenv, env, python_for, registry, targets  # noqa: E402

HERE = Path(__file__).resolve().parent


def tool(script: str, *args: str) -> int:
    """Run a sibling tool script with the platform environment."""
    return subprocess.call([sys.executable, str(HERE / script), *args], env=env())


def setup(args: list[str]) -> int:
    modes = ("install", "reset", "db", "list")
    mode, rest = (args[0], args[1:]) if args and args[0] in modes else ("install", args)
    if mode == "list":
        for name, svc in registry().items():
            print(f"{name:28} {svc['path'].relative_to(ROOT)}{'' if svc['enabled'] else '  (disabled)'}")
        return 0
    return setup_all(rest[0] if rest else "all", mode)


def db(args: list[str]) -> int:
    for name in targets(args[0] if args else "all"):
        path = registry()[name]["path"]
        if (path / "config" / "config.yaml").exists():
            subprocess.check_call([python_for(path), "-m", "grepx_store", str(path)], cwd=ROOT, env=env(name))
    return 0


def demo(args: list[str]) -> int:
    """A product's optional demo data (demo/seed.py in the workspace), run with the platform environment."""
    seed = ROOT / "demo" / "seed.py"
    if not seed.exists():
        print("this product has no demo data (demo/seed.py)")
        return 1
    return subprocess.call([sys.executable, str(seed), *args], cwd=ROOT, env=env())


def with_dbview(action: str, target: str) -> int | None:
    """start/stop all also starts/stops the database viewer when .env has DBVIEW=on."""
    import dbview
    if target != "all" or not dbview.enabled():
        return None
    return dbview.start() if action == "start" else dbview.stop()


def start_all(target: str) -> None:
    start(target)
    with_dbview("start", target)


def stop_all(target: str) -> None:
    with_dbview("stop", target)
    stop(target)


def restart(target: str) -> None:
    stop_all(target)
    start_all(target)


def status_all(only: str) -> int:
    code = status(only)
    if not only or only == "all":
        import dbview
        dbview.status(verbose=False)
    return code


COMMANDS = {
    "setup": setup,
    "start": lambda a: start_all(a[0] if a else "all"),
    "stop": lambda a: stop_all(a[0] if a else "all"),
    "restart": lambda a: restart(a[0] if a else "all"),
    "status": lambda a: status_all(a[0] if a else ""),
    "dbview": lambda a: __import__("dbview").main(a),
    "demo": demo,
    "targets": lambda a: targets_file(),
    "logs": logs,
    "test": lambda a: run_tests(a[0] if a else ""),
    "db": db,
    "monitor": observability,
    "seed": lambda a: tool("seed.py", *a),
    "admin": lambda a: tool("create_admin.py", *a),
    "backup": lambda a: tool("backup.py", *a),
    "restore": lambda a: tool("backup.py", "restore", *a),
    "migrate": lambda a: tool("migrate.py", *a),
    "nexus-accounts": lambda a: tool("nexus_accounts.py", *a),
    "workspace": lambda a: tool("pins.py", *a),
    "headers": lambda a: tool("headers.py", *a),
    "new-product": lambda a: tool("new_product.py", *a),
    "nexus-check": lambda a: tool("nexus_check.py", *a),
    "trace": lambda a: tool("trace.py", *a),
    "new": lambda a: tool("new_service.py", *a),
    "deps": lambda a: tool("deps.py", *a),
    "contracts": lambda a: tool("contracts.py", *a),
    "lint-contracts": lambda a: tool("lint_contracts.py", *a),
    "catalog": lambda a: tool("catalog.py", "build", *a),
    "find": lambda a: tool("catalog.py", "find", *a),
    "show": lambda a: tool("catalog.py", "show", *a),
}


def main() -> None:
    for key, value in dotenv().items():          # .env applies to this tool too (environment wins)
        os.environ.setdefault(key, value)
    cmd, *args = sys.argv[1:] or ["status"]
    if cmd not in COMMANDS:
        print(__doc__)
        return
    code = COMMANDS[cmd](args)
    sys.exit(code if isinstance(code, int) else 0)


if __name__ == "__main__":
    main()
