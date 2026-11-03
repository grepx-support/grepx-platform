# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""One open store per service (cached), from its resolved database URL."""
from __future__ import annotations

import threading
from typing import Any

from .resolve import database_url
from .stores import DocumentStore, open_store

_stores: dict[str, DocumentStore] = {}
_lock = threading.Lock()


def store_for(cfg: Any) -> DocumentStore:
    url = database_url(cfg)
    with _lock:
        if url not in _stores:
            _stores[url] = open_store(url)
        return _stores[url]
