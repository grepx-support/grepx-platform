"""The Nexus hub as seen from the tools: address, liveness, binary and log file."""
from __future__ import annotations

import os
from pathlib import Path

from workspace import LOGS


def nexus_port() -> int:
    from grepx_config import nexus_address
    return nexus_address()[1]


def nexus_up(timeout: float = 1.0) -> bool:
    """Nexus is UP when its port accepts connections — whether or not run.sh started it."""
    import socket
    try:
        from grepx_config import nexus_address
        with socket.create_connection((nexus_address()[0], nexus_port()), timeout=timeout):
            return True
    except OSError:
        return False


def nexus_binary(path: Path) -> Path:
    """The C++ nexus_server, copied manually into platform/nexus-server/bin/."""
    return path / "bin" / "nexus_server"


def nexus_log(pid: int | None = None) -> Path:
    """logs/nexus-server.log when run.sh started it; otherwise the C++ default next to the running binary."""
    ours = LOGS / "nexus-server.log"
    if ours.exists() or not pid:
        return ours
    try:
        return Path(os.readlink(f"/proc/{pid}/exe")).parent / "logs" / "nexus_server.log"
    except OSError:
        return ours
