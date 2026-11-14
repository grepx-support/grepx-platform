# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""Files shared by link: a document the BFF made (a PDF) put in storage under an unguessable token that carries its
last day, so a channel that fetches files itself (WhatsApp through Twilio) can collect it. No table: the token is the
record. GET /files/{token}/{name} (routers/files.py) serves it until that day."""
from __future__ import annotations

import mimetypes
import re
import secrets
from datetime import date, timedelta
from typing import Optional

from grepx_config.deployment import site_url

TOKEN = re.compile(r"^(\d{8})([0-9a-f]{32})$")
NAME = re.compile(r"[^A-Za-z0-9._-]+")
DAYS = 14


def safe_name(name: str) -> str:
    return NAME.sub("-", name or "file").strip("-.")[:100] or "file"


def key_of(token: str, name: str) -> str:
    return f"shared/{token}/{safe_name(name)}"


def publish(storage, data: bytes, name: str, days: int = DAYS, today: Optional[date] = None) -> str:
    """Store data and return its public address (SITE_URL + /api/v1/files/...), valid for `days` days."""
    last = (today or date.today()) + timedelta(days=days)
    token = f"{last:%Y%m%d}{secrets.token_hex(16)}"
    storage.put(key_of(token, name), data, mime_of(name))
    return f"{site_url()}/api/v1/files/{token}/{safe_name(name)}"


def fetch(storage, token: str, name: str, today: Optional[date] = None) -> Optional[bytes]:
    """The file, or None when the token is malformed, past its last day, or unknown."""
    m = TOKEN.match(token or "")
    if not m or m.group(1) < f"{today or date.today():%Y%m%d}":
        return None
    return storage.get(key_of(token, name))


def mime_of(name: str) -> str:
    return mimetypes.guess_type(name)[0] or "application/octet-stream"
