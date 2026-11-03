# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""Deployment values (from .env), read in one place. Neutral defaults: nothing product-specific lives in code.

    SITE_URL   public address used in links (emails, calendars, certificates)
    ORG_NAME   the organisation name shown in messages
    TIMEZONE   local time zone for dates and schedules (IANA name)

Page paths that messages link to are declared per product under `links:` in config/projects/<product>.yaml.
"""
from __future__ import annotations

import os
from zoneinfo import ZoneInfo


def site_url() -> str:
    return (os.environ.get("SITE_URL") or "http://localhost").rstrip("/")


def org_name() -> str:
    return os.environ.get("ORG_NAME", "")


def timezone() -> ZoneInfo:
    return ZoneInfo(os.environ.get("TIMEZONE") or "UTC")


def link(cfg, page: str, **ids) -> str:
    """Absolute URL of a product page declared in config `links:` (e.g. drive: /drive/{id}); unknown page → site root."""
    path = str(((cfg.get("links") if hasattr(cfg, "get") else None) or {}).get(page, "/"))
    return site_url() + path.format(**ids)
