"""Decides a service's log filename: "<name>_<run-timestamp>.log".
Timestamp comes from SERVICE_RUN_TS (set by scripts/run.sh per restart)
or is generated fresh if unset.
"""
from __future__ import annotations

import os
import time
from pathlib import Path


def run_timestamp() -> str:
    return os.environ.get("SERVICE_RUN_TS") or time.strftime("%Y%m%d_%H%M")


def timestamped_log_path(log_dir, name: str) -> str:
    filename = f"{name}_{run_timestamp()}.log"
    return str(Path(log_dir) / filename) if log_dir else filename
