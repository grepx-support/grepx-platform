# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""Same log format as platform/tools/log.sh:  2026-10-31 15:33:01 INFO  [component] message"""
from __future__ import annotations

import sys
import time
from pathlib import Path

from root import ROOT  # noqa: E402  (the workspace, see root.py)
LOG_FILE = ROOT / "logs" / "scripts.log"


def say(level: str, component: str, message: str, to_file: bool = True) -> None:
    line = f"{time.strftime('%Y-%m-%d %H:%M:%S')} {level:<5} [{component}] {message}"
    stream = sys.stderr if level in ("ERROR", "WARN") else sys.stdout
    print(line, file=stream, flush=True)
    if to_file:
        LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write(line + "\n")
