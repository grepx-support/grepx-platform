"""SecretBox — symmetric encryption for secrets that cross the Nexus bus (passwords) or are stored (admin-saved keys).

Rows are kept in the outbox forever, so plaintext secrets must never be written there.
Keys are separate from the session-signing key:
    SECRET_BOX_KEY      seals and opens (AUTH_TRANSPORT_KEY is the older name for the same key)
    JWT_SECRET          only OPENS values sealed before SECRET_BOX_KEY existed, so old data keeps working;
                        once everything is re-saved it can stop being used for this.
"""
from __future__ import annotations

import base64
import hashlib
import os
from typing import Iterable

from cryptography.fernet import Fernet, InvalidToken, MultiFernet

DEV_ONLY = "dev-only-secret-change-me"


def _fernet(secret: str) -> Fernet:
    return Fernet(base64.urlsafe_b64encode(hashlib.sha256(secret.encode()).digest()))


class SecretBox:
    def __init__(self, secret: str, older: Iterable[str] = ()):
        keys = list(dict.fromkeys([secret, *[k for k in older if k]]))
        self._fernet = MultiFernet([_fernet(k) for k in keys])   # seals with the first, opens with any

    @classmethod
    def from_env(cls) -> "SecretBox":
        current = os.environ.get("SECRET_BOX_KEY") or os.environ.get("AUTH_TRANSPORT_KEY")
        legacy = os.environ.get("JWT_SECRET") or DEV_ONLY
        return cls(current or legacy, older=[legacy] if current else [])

    def seal(self, value: str) -> str:
        return self._fernet.encrypt(value.encode()).decode()

    def open(self, token: str) -> str:
        try:
            return self._fernet.decrypt((token or "").encode()).decode()
        except (InvalidToken, ValueError):
            return ""
