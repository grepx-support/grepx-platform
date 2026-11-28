# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""The Content-Security-Policy of one HTML page: its own inline scripts and handlers by hash, taken from the page as served
(the BFF writes the import map and the product settings into it per build), so script-src never needs 'unsafe-inline'."""
from __future__ import annotations

import base64
import gzip
import hashlib
import re

from .options import EdgeOptions

REPORT_PATH = "/api/v1/public/csp-report"
SCRIPTS = re.compile(r"<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>", re.S | re.I)
HANDLERS = re.compile(r"\son[a-z]+=\"([^\"]*)\"", re.I)


def sha256(text: str) -> str:
    return "'sha256-" + base64.b64encode(hashlib.sha256(text.replace("\r\n", "\n").encode()).digest()).decode() + "'"


def inline_hashes(page: str) -> tuple[list[str], list[str]]:
    return [sha256(m) for m in SCRIPTS.findall(page) if m.strip()], [sha256(m) for m in HANDLERS.findall(page)]


def page_text(body: bytes, encoding: str) -> str:
    """The page as the browser parses it (GZip runs before this layer sees the answer)."""
    return (gzip.decompress(body) if encoding.lower() == "gzip" else body).decode("utf-8", "replace")


class Policy:
    """One product's policy; `for_page(html)` adds that page's inline hashes."""

    def __init__(self, options: EdgeOptions):
        self.o = options

    def for_page(self, page: str) -> str:
        scripts, handlers = inline_hashes(page)
        join = lambda *parts: " ".join(p for part in parts for p in ([part] if isinstance(part, str) else part))   # noqa: E731
        return "; ".join([
            "default-src 'self'",
            "script-src " + join("'self'", scripts, ["'unsafe-hashes'", *handlers] if handlers else []),
            "style-src " + join("'self'", "'unsafe-inline'", "https://fonts.googleapis.com", self.o.style),   # inline goes with the vanilla kit
            "img-src " + join("'self'", "data:", "blob:", self.o.img),
            "font-src " + join("'self'", "data:", "https://fonts.gstatic.com", self.o.font),
            "connect-src " + join("'self'", self.o.connect),
            "worker-src 'self' blob:",
            "object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'",
            f"report-uri {REPORT_PATH}",
        ])
