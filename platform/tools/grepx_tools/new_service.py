"""Scaffold a new service in the standard layout.

    scripts/run.sh new common notification-service --table notifications --actions SEND
    scripts/run.sh new product/blood-donation event-service --table drives --actions CREATE,UPDATE

common  -> common-services/<name>   (reusable by every product)
product/<p> -> product-services/<p>/<name>  (rules only this product has)
requirements.txt is written from its imports (scripts/run.sh deps). Then: register it in config/services.ini
(path, project, ports), write domain/, routes/, tests,
and run scripts/setup.sh <name> && scripts/run.sh start <name>.
"""
from __future__ import annotations

import argparse
from pathlib import Path

from root import ROOT  # noqa: E402  (the workspace, see root.py)


def camel(name: str) -> str:
    return "".join(p.capitalize() for p in name.rsplit("/", 1)[-1].replace("-service", "").split("-"))


def write(path: Path, text: str) -> None:
    if path.exists():
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text.lstrip("\n"), encoding="utf-8")


def scaffold(layer: str, name: str, table: str, actions: list[str]) -> Path:
    base = ROOT / ("common-services" if layer == "common" else "product-services/" + layer.split("/", 1)[1]) / name
    prefix = camel(name)
    svc = name.rsplit("/", 1)[-1]
    write(base / "config/config.yaml", f"""
service_name: {svc}
snapshot_table: {table}
project: {"platform" if layer == "common" else layer.split("/", 1)[1]}
description: ""   # one line for the service catalogue
owns: []          # state tables this service is the system of record for
tables: {{}}       # created in its own database (table: [indexed fields])
# criteria and bot user follow from service_name (grepx_config.conventions); add subscriptions: / on_start: when needed
""")
    write(base / "src/main.py", f'''
"""{svc} - wiring comes from config/config.yaml; see grepx_service.serve."""
from grepx_service.serve import serve

if __name__ == "__main__":
    serve(__file__)
''')
    enum_lines = "\n".join(f'    {a} = "{a}"' for a in actions)
    write(base / f"src/dto/{prefix.lower()}_action.py", f'''
"""Actions {svc} accepts."""
from enum import Enum


class {prefix}Action(str, Enum):
{enum_lines}
''')
    write(base / "src/dto/__init__.py", f'''
"""Single import door for {svc} vocabulary."""
from .{prefix.lower()}_action import {prefix}Action

__all__ = ["{prefix}Action"]
''')
    routes = "\n".join(f"from . import {a.lower()}" for a in actions)
    mapping = "\n".join(f"    {prefix}Action.{a}: {a.lower()}.handle," for a in actions)
    write(base / "src/routes/__init__.py", f'''
"""Action routing for {svc}: one module per action."""
from grepx_service import ActionDispatcher

from dto import {prefix}Action
{routes}

TABLE = "{table}"
ROUTES = {{
{mapping}
}}
handle = ActionDispatcher(ROUTES, {prefix}Action, TABLE)
''')
    for a in actions:
        write(base / f"src/routes/{a.lower()}.py", f'''
"""{a}."""
from grepx_service import RequestContext


def handle(ctx: RequestContext) -> None:
    ctx.accept()
''')
    write(base / "test/conftest.py", '''
"""Put this service's src/ first on sys.path (each service is tested in its own process)."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
''')
    for script, template in (("setup.sh", "service_setup.sh"), ("run.sh", "service_run.sh")):
        target = base / script
        if not target.exists():
            target.write_text((ROOT / "platform" / "tools" / "templates" / template).read_text(encoding="utf-8"), encoding="utf-8")
            target.chmod(0o755)
    import subprocess
    import sys
    subprocess.call([sys.executable, str(Path(__file__).with_name("deps.py"))])   # requirements.txt from its imports
    return base


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("layer", help="common | product/<product-name>")
    ap.add_argument("name")
    ap.add_argument("--table", required=True)
    ap.add_argument("--actions", required=True)
    a = ap.parse_args()
    print(scaffold(a.layer, a.name, a.table, [x.strip().upper() for x in a.actions.split(",")]))
