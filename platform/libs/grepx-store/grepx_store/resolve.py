"""Resolve which database a service uses (service -> project -> platform defaults; env wins)."""
from __future__ import annotations

import os
from pathlib import Path
from typing import Any


def _get(cfg: Any, *path: str) -> Any:
    node = cfg
    for key in path:
        node = node.get(key) if isinstance(node, dict) else None
        if node is None:
            return None
    return node


def database_url(cfg: Any) -> str:
    """cfg = the merged config from grepx_config.load_config (common <- project <- service)."""
    name = str(cfg.get("service_name", "service"))
    env = os.environ.get("DATABASE_URL_" + name.upper().replace("-", "_")) or os.environ.get("GREPX_DATABASE_URL")
    url = env or _get(cfg, "database", "url") or "sqlite:///data/{service}.db"
    url = str(url).replace("{service}", name).replace("{service_db}", name.replace("-", "_"))
    if url.startswith("sqlite:///") and not url.startswith("sqlite:////") and url != "sqlite:///:memory:":
        url = "sqlite:///" + str(_root(cfg) / url[len("sqlite:///"):])  # relative paths are from the workspace
    return url


def _root(cfg: Any):
    from grepx_config import workspace_root
    return Path(cfg["workspace"]) if hasattr(cfg, "get") and cfg.get("workspace") else workspace_root()


def engine_of(url: str) -> str:
    scheme = url.split(":", 1)[0].lower()
    return {"postgres": "postgres", "postgresql": "postgres", "mongodb": "mongo", "mongodb+srv": "mongo"}.get(scheme, scheme)
