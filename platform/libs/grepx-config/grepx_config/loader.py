# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""A service's configuration: config/common.yaml <- the product's deployment file (grepx.workspace.yaml `deployment:`)
<- config/projects/<project>.yaml <- the service's config/config.yaml.

Plain YAML; values are reachable as attributes (cfg.service_name) or with cfg.get("key", default).
Conventions fill what follows from the service name (criteria, bot user), so a config.yaml only states what differs.
NEXUS_HOST / NEXUS_PORT override the Nexus address.
"""
from __future__ import annotations

import os
from pathlib import Path
from typing import Any, Optional

from .workspace import MARKER, common, merge, read_yaml, workspace_root


class Config(dict):
    """dict with attribute access; nested dicts become Config too."""

    def __getattr__(self, name: str) -> Any:
        try:
            return self[name]
        except KeyError as exc:
            raise AttributeError(name) from exc

    @classmethod
    def wrap(cls, value: Any) -> Any:
        if isinstance(value, dict):
            return cls({k: cls.wrap(v) for k, v in value.items()})
        return value


def nexus_address(configured: Optional[dict] = None) -> tuple[str, int]:
    """Where the Nexus hub is: NEXUS_HOST / NEXUS_PORT, else common.yaml `nexus:`, else 127.0.0.1:7878."""
    nexus = configured if configured is not None else (common().get("nexus") or {})
    return os.environ.get("NEXUS_HOST") or nexus.get("host") or "127.0.0.1", int(os.environ.get("NEXUS_PORT") or nexus.get("port") or 7878)


def conventions(cfg: dict) -> dict:
    """Values every service would otherwise repeat, derived from service_name."""
    name = cfg.get("service_name")
    if not name:
        return cfg
    cfg.setdefault("recovery_criteria", f"to_service = '{name}' OR from_service = '{name}'")
    cfg.setdefault("live_criteria", f"to_service = '{name}' AND status = 'NEW'")
    cfg.setdefault("bot_username", name.removesuffix("-service") + "-bot")
    return cfg


def load_config(service_config_dir: Path, config_name: str = "config") -> Config:
    folder = Path(service_config_dir)
    root = workspace_root(folder)
    service = read_yaml(folder / f"{config_name}.yaml")
    project = read_yaml(root / "config" / "projects" / f"{service.get('project', 'platform')}.yaml")
    merged = conventions(merge(merge(common(folder), project), service))
    merged["nexus"] = dict(zip(("host", "port"), nexus_address(merged.get("nexus") or {})))
    merged.setdefault("logging", {}).setdefault("log_dir", "logs")
    merged["workspace"] = str(root)
    return Config.wrap(merged)


def resolve_log_dir(log_dir: Optional[str] = None, start: Optional[Path] = None) -> Path:
    root = workspace_root(start)
    if log_dir is None:
        log_dir = (read_yaml(root / MARKER).get("logging") or {}).get("log_dir", "logs")
    return root / log_dir
