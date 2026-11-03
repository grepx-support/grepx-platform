# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""In-process counters reported by the heartbeat (handled / accepted / rejected / errors / last_error)."""
import threading

_lock = threading.Lock()
_counts = {"handled": 0, "accepted": 0, "rejected": 0, "errors": 0, "last_error": "", "last_error_at": ""}


def count(name: str, error: str = "") -> None:
    from .wire import now_iso
    with _lock:
        _counts[name] = _counts.get(name, 0) + 1
        if error:
            _counts["last_error"], _counts["last_error_at"] = error[:200], now_iso()


def snapshot() -> dict:
    with _lock:
        return dict(_counts)
