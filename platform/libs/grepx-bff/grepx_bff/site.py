# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""The public page of a deployment - the company behind it, not the software: its name, tagline, a headline, colour,
logo, highlights, brands, contact (phone, WhatsApp, email, address, hours) and whether the sign-in button shows. The
platform operator edits it; it is kept as one setting (settings-service). Pure."""
from __future__ import annotations

import json
import re

SETTING = "SITE_PAGE"
TEXT = {"company": 80, "tagline": 140, "headline": 160, "intro": 600, "phone": 30, "whatsapp": 30, "email": 120, "address": 300,
        "hours": 120, "logo_id": 64, "cta_label": 40, "footer": 200}
MAX_HIGHLIGHTS, MAX_BRANDS = 8, 24


def _text(v, limit: int) -> str:
    return " ".join(str(v or "").split())[:limit] if limit < 300 else str(v or "").strip()[:limit]


def clean_site(raw: dict) -> dict:
    """The page from what the operator typed. Refuses INVALID_SITE (no company name, a bad colour)."""
    out = {k: _text(raw.get(k), n) for k, n in TEXT.items()}
    if not out["company"]:
        raise ValueError("INVALID_SITE")
    color = str(raw.get("color") or "#4f46e5")
    if not re.fullmatch(r"#[0-9a-fA-F]{6}", color):
        raise ValueError("INVALID_SITE")
    highlights = [{"icon": _text(h.get("icon"), 20) or "check", "title": _text(h.get("title"), 60), "text": _text(h.get("text"), 200)}
                  for h in raw.get("highlights") or [] if str(h.get("title") or "").strip()][:MAX_HIGHLIGHTS]
    brands = [_text(b, 30) for b in raw.get("brands") or [] if str(b).strip()][:MAX_BRANDS]
    return {**out, "color": color, "highlights": highlights, "brands": brands, "show_sign_in": bool(raw.get("show_sign_in", True))}


def read_site(value: str) -> dict:
    """The stored page, or {} when there is none yet (the screen then shows the product's own default)."""
    try:
        data = json.loads(value) if value else {}
    except ValueError:
        return {}
    return data if isinstance(data, dict) else {}
