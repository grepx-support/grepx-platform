"""Standard library `logging` setup: console + file, nanosecond timestamps
(matches the C++ side's ConsoleLogger format so logs read side by side).
"""
from __future__ import annotations

import logging
import sys
import time
from pathlib import Path
from typing import Optional, Union



class NanosecondFormatter(logging.Formatter):
    default_time_format = "%Y-%m-%d %H:%M:%S"

    def formatTime(self, record: logging.LogRecord, datefmt: str | None = None) -> str:
        ns = time.time_ns()
        secs, nanos = divmod(ns, 1_000_000_000)
        formatted = time.strftime(self.default_time_format, time.localtime(secs))
        return f"{formatted}.{nanos:09d}"


def _default_log_file(log_dir: Optional[Path] = None) -> Path:
    script_name = Path(sys.argv[0]).stem or "nexus"
    base_dir = log_dir if log_dir is not None else Path.cwd() / "logs"   # callers normally pass the workspace log dir
    return base_dir / f"{script_name}.log"


def configure_logging(level: int = logging.INFO,
                      log_file: Optional[Union[str, Path]] = None,
                      log_dir: Optional[Union[str, Path]] = None) -> Path:
    """Call once at the top of each entrypoint. Idempotent - only the
    first call attaches handlers. log_file wins if given; otherwise
    log_dir/<script>.log; otherwise ./logs/.
    """
    resolved_log_dir = Path(log_dir) if log_dir is not None else None
    root = logging.getLogger()
    if root.handlers:
        return _default_log_file(resolved_log_dir) if log_file is None else Path(log_file)

    import os
    from .json_format import JsonFormatter
    formatter = JsonFormatter() if os.environ.get("LOG_FORMAT") == "json" else NanosecondFormatter("%(asctime)s [%(levelname)s] %(name)s: %(message)s")

    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(formatter)
    root.addHandler(console_handler)

    resolved_log_file = Path(log_file) if log_file is not None else _default_log_file(resolved_log_dir)
    if os.environ.get("LOG_TO_FILE", "1") == "0":   # run.sh captures stdout into logs/<service>.log
        root.setLevel(level)
        return resolved_log_file
    resolved_log_file.parent.mkdir(parents=True, exist_ok=True)
    file_handler = logging.FileHandler(resolved_log_file, encoding="utf-8")
    file_handler.setFormatter(formatter)
    root.addHandler(file_handler)

    root.setLevel(level)
    return resolved_log_file
