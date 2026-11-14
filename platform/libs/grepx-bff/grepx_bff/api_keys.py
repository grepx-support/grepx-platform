# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""API keys: another system calls the API as an organisation with "X-Api-Key: gx_<id>_<secret>" (or as a bearer
token). Only a hash of the secret is stored (access-service api_keys); a read key may only read. Each key is rate
limited."""
from __future__ import annotations

import hashlib
import hmac
import re
import secrets
from typing import Optional

import grepx_contracts as gc

from grepx_bff.errors import ApiError

PREFIX = "gx_"
SHAPE = re.compile(r"^gx_([a-z0-9]{12})_([A-Za-z0-9_-]{32,64})$")


def digest(secret: str) -> str:
    return hashlib.sha256(secret.encode()).hexdigest()


def make() -> tuple[str, str, str]:
    """A new key: (the full key to show once, its id, the hash to store)."""
    key_id = "".join(secrets.choice("abcdefghijklmnopqrstuvwxyz0123456789") for _ in range(12))
    secret = secrets.token_urlsafe(32)
    return f"{PREFIX}{key_id}_{secret}", key_id, digest(secret)


def looks_like_key(value: str) -> bool:
    return bool(value) and value.startswith(PREFIX)


def check(gw, value: str) -> dict:
    """The active key row for this key; refuses INVALID_API_KEY (unknown, wrong secret, revoked) or RATE_LIMITED."""
    m = SHAPE.fullmatch(value.strip())
    row: Optional[dict] = gw.one(gc.access.API_KEYS, m.group(1)) if m else None
    if not m or not row or not row.get("active") or not hmac.compare_digest(row.get("secret_hash", ""), digest(m.group(2))):
        raise ApiError("INVALID_API_KEY", 401)
    gw.limit(f"apikey:{row['_key']}", rate=600, per=60)
    return row
