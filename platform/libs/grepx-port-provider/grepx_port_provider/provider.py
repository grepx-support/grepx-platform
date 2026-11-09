# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""Port registry: each service owns a port range, declared once in config/services.ini (`ports = 9100-9104`).
get_free_port() hands a service the first free port of its own range, so ports are stable and never collide."""
from __future__ import annotations

import configparser
import logging
import os
import socket
from functools import lru_cache
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)


def registry_file() -> Path:
    """GREPX_SERVICES_INI, else config/services.ini of the workspace (grepx_config.workspace_root)."""
    from grepx_config import workspace_root
    return Path(os.environ.get("GREPX_SERVICES_INI") or workspace_root() / "config" / "services.ini")


@lru_cache(maxsize=1)
def port_ranges() -> dict[str, tuple[int, int]]:
    ini = configparser.ConfigParser()
    ini.read(registry_file())
    out = {}
    for name in ini.sections():
        if ini[name].get("ports"):
            first, _, last = ini[name]["ports"].partition("-")
            out[name] = (int(first), int(last or first))
    owners: dict[tuple[int, int], list[str]] = {}
    for name, r in out.items():
        owners.setdefault(r, []).append(name)
    clashes = {r: names for r, names in owners.items() if len(names) > 1}
    if clashes:
        raise RuntimeError(f"Duplicate port ranges in {registry_file()}: {clashes}")
    return out


def is_port_free(port: int) -> bool:
    """True when a server could listen on the port now. SO_REUSEADDR as the servers themselves use it: connections of a
    process that just stopped linger in TIME_WAIT for a minute and must not push a restarted service onto the next port
    (a public site moving from 8851 to 8852 looks down). A port someone is listening on still counts as taken."""
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            s.bind(("0.0.0.0", port))
            return True
    except OSError:
        return False


def get_port_range(service: str) -> Optional[tuple[int, int]]:
    return port_ranges().get(service)


def get_free_port(service: str) -> Optional[int]:
    span = get_port_range(service)
    if span is None:
        logger.error("no ports for %s - add `ports = first-last` to its section in %s", service, registry_file())
        return None
    for port in range(span[0], span[1] + 1):
        if is_port_free(port):
            return port
    logger.error("no free port for %s in %s-%s", service, *span)
    return None


def list_services() -> list[dict]:
    return [{"service": name, "start": a, "end": b} for name, (a, b) in port_ranges().items()]
