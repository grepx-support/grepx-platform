"""PBKDF2-SHA256 password hashes: pbkdf2_sha256$<iterations>$<salt>$<hash>."""
from __future__ import annotations

import base64
import hashlib
import hmac
import os

ITERATIONS = 260_000


def hash_password(password: str, iterations: int = ITERATIONS) -> str:
    salt = base64.b64encode(os.urandom(12)).decode()
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), iterations)
    return f"pbkdf2_sha256${iterations}${salt}${base64.b64encode(digest).decode()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        _algo, iterations, salt, expected = stored.split("$", 3)
    except ValueError:
        return False
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), int(iterations))
    return hmac.compare_digest(base64.b64encode(digest).decode(), expected)
