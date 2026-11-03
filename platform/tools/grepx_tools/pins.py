# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""The workspace file (grepx.workspace.yaml): what this deployment runs and the versions it is pinned to.

    scripts/run.sh workspace          check: library versions = platform.version, every registered service lives in a
                                      listed folder, the deployment file exists, the Nexus binary matches its checksum
    scripts/run.sh workspace pin      record the Nexus binary's sha256 in grepx.workspace.yaml
"""
from __future__ import annotations

import hashlib
import re
import sys
from pathlib import Path

import yaml

from log import say
from workspace import ROOT, registry

FILE = ROOT / "grepx.workspace.yaml"


def load() -> dict:
    if not FILE.exists():
        raise SystemExit(f"no {FILE.name} at {ROOT}")
    return yaml.safe_load(FILE.read_text(encoding="utf-8")) or {}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as f:
        for block in iter(lambda: f.read(1 << 20), b""):
            digest.update(block)
    return digest.hexdigest()


def problems(ws: dict, root: Path = ROOT) -> list[str]:
    found = []
    deployment = ws.get("deployment")
    if not deployment or not (root / deployment).exists():
        found.append(f"deployment file missing: {deployment!r}")
    platform = ws.get("platform") or {}
    for pyproject in sorted((root / platform.get("libs", "platform/libs")).glob("*/pyproject.toml")):
        version = re.search(r'^version\s*=\s*"([^"]+)"', pyproject.read_text(encoding="utf-8"), re.MULTILINE)
        if not version or version.group(1) != str(platform.get("version")):
            found.append(f"{pyproject.parent.name} is {version.group(1) if version else '?'}, workspace pins {platform.get('version')}")
    homes = [(ws.get("services") or {}).get("path", "common-services"), (ws.get("product_repo") or {}).get("services", ""),
             *((ws.get("product_repo") or {}).get("apps") or [])]
    for name, svc in registry().items():
        rel = svc["path"].relative_to(root).as_posix() if svc["path"].is_relative_to(root) else str(svc["path"])
        if svc["enabled"] and not any(h and (rel == h or rel.startswith(h.rstrip("/") + "/")) for h in homes) \
                and not rel.startswith("platform/"):
            found.append(f"{name} ({rel}) is in no folder the workspace file lists")
    nexus = ws.get("nexus") or {}
    binary = root / nexus.get("binary", "platform/nexus-server/bin/nexus_server")
    if nexus.get("sha256") and binary.exists() and sha256(binary) != nexus["sha256"]:
        found.append(f"{binary.relative_to(root)} does not match the pinned sha256")
    return found


def pin() -> int:
    ws_text = FILE.read_text(encoding="utf-8")
    binary = ROOT / (load().get("nexus") or {}).get("binary", "platform/nexus-server/bin/nexus_server")
    if not binary.exists():
        say("ERROR", "workspace", f"no Nexus binary at {binary}")
        return 1
    digest = sha256(binary)
    FILE.write_text(re.sub(r'(\n  sha256: )"[^"]*"', rf'\1"{digest}"', ws_text), encoding="utf-8")
    say("OK", "workspace", f"pinned {binary.name} sha256 {digest[:12]}…")
    return 0


def main(argv: list[str]) -> int:
    if argv[:1] == ["pin"]:
        return pin()
    ws = load()
    found = problems(ws)
    for p in found:
        say("ERROR", "workspace", p)
    if not (ws.get("nexus") or {}).get("sha256"):
        say("WARN", "workspace", "Nexus binary not pinned - run: scripts/run.sh workspace pin")
    if not found:
        say("OK", "workspace", f"{ws.get('product')} on platform {ws.get('platform', {}).get('version')}, "
                               f"services {ws.get('services', {}).get('version')}: consistent")
    return 1 if found else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
