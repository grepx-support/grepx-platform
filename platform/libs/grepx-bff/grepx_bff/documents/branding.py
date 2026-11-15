# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""The business as its documents show it: its row plus the logo picture (media-service, set on Setup -> Business).
Documents read `logo_bytes`; a business without a logo prints its initials instead."""
from __future__ import annotations

import io
from typing import Optional

import grepx_contracts as gc


def logo_of(gw, business: dict) -> Optional[bytes]:
    logo_id = (business.get("billing") or {}).get("logo_id")
    info = gw.one(gc.media.MEDIA, logo_id) if logo_id else None
    if not info or info.get("owner_id") not in ("", None, business.get("_key"), business.get("business_id")):
        return None
    return gw.storage.get(info["key"])


def brand(k) -> dict:
    """k: the signed-in business user (grepx_bff.business.Business or a product subclass)."""
    return {**k.business, "logo_bytes": logo_of(k.gw, k.business)}


def draw_image(pdf, data: Optional[bytes], x: float, y: float, height: float, max_width: float = 40) -> float:
    """Draw the logo with its height fixed (width capped); return the width used, 0 when there is none or it is broken."""
    if not data:
        return 0
    try:
        from PIL import Image
        w, h = Image.open(io.BytesIO(data)).size
        width = min(max_width, height * w / h)
        pdf.image(io.BytesIO(data), x=x, y=y, w=width, h=width * h / w)
        return width
    except Exception:          # a damaged picture never stops the document
        return 0
