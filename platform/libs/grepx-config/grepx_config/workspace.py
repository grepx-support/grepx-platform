"""Where a GrepX workspace's shared configuration lives - found from the caller's side, never from this library's own path.

A workspace = a folder holding config/common.yaml (and config/projects/<project>.yaml), and usually grepx.workspace.yaml,
which names the product it runs and that product's deployment file (how it plugs into the generic services).
The workspace folder is, in order:
  1. GREPX_HOME, when set (an installed library, a container, a CI job)
  2. the nearest folder above `start` (a service's own config folder) that holds config/common.yaml
  3. the nearest such folder above the current directory
"""
from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path
from typing import Optional

import yaml

MARKER = Path("config") / "common.yaml"
WORKSPACE_FILE = "grepx.workspace.yaml"


def _above(start: Path) -> Optional[Path]:
    for folder in [start, *start.parents]:
        if (folder / MARKER).exists():
            return folder
    return None


def workspace_root(start: Optional[Path] = None) -> Path:
    if os.environ.get("GREPX_HOME"):
        return Path(os.environ["GREPX_HOME"]).resolve()
    if start is not None:
        found = _above(Path(start).resolve())
        if found:
            return found
    return _cwd_root()


@lru_cache(maxsize=1)
def _cwd_root() -> Path:
    cwd = Path.cwd().resolve()
    return _above(cwd) or cwd


def read_yaml(path: Path) -> dict:
    return (yaml.safe_load(path.read_text(encoding="utf-8")) or {}) if path.exists() else {}


def merge(base: dict, over: dict) -> dict:
    out = dict(base)
    for key, value in over.items():
        out[key] = merge(out[key], value) if isinstance(value, dict) and isinstance(out.get(key), dict) else value
    return out


def workspace_file(start: Optional[Path] = None) -> dict:
    """grepx.workspace.yaml: the product this workspace runs, its deployment file, pinned versions."""
    return read_yaml(workspace_root(start) / WORKSPACE_FILE)


def product_settings(start: Optional[Path] = None) -> dict:
    """The product's deployment settings (roles, phone, links, person, messages, plugins …): GREPX_DEPLOYMENT, else the
    `deployment:` file named in grepx.workspace.yaml; paths are relative to the workspace."""
    root = workspace_root(start)
    path = os.environ.get("GREPX_DEPLOYMENT") or workspace_file(start).get("deployment")
    return read_yaml(root / path) if path else {}


def common(start: Optional[Path] = None) -> dict:
    """Deployment-wide settings: platform defaults (config/common.yaml) overlaid with the product's deployment file."""
    return merge(read_yaml(workspace_root(start) / MARKER), product_settings(start))
