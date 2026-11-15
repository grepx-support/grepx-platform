# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""The deployment's public page: anyone reads it (GET /public/site); the platform operator changes it (PUT /platform/site)."""
import json

import grepx_contracts as gc
from fastapi import APIRouter, Depends

from grepx_bff.errors import ApiError
from grepx_bff.security import Principal, admin, gateway
from grepx_bff.site import SETTING, clean_site, read_site

router = APIRouter(tags=["site"])


def stored(gw) -> dict:
    row = gw.one(gc.settings.APP_SETTINGS, SETTING) or {}
    return read_site(str(row.get("value") or ""))


@router.get("/public/site")
def site(gw=Depends(gateway)):
    return {"site": stored(gw)}


@router.put("/platform/site")
def save(body: dict, user: Principal = Depends(admin), gw=Depends(gateway)):
    if user.tenant:
        raise ApiError("FORBIDDEN", 403)
    try:
        page = clean_site(body)
    except ValueError as exc:
        raise ApiError(str(exc), 400)
    gw.command(gc.settings.REQUESTS, gc.settings.SERVICE, {"action": "SET", "name": SETTING, "value": json.dumps(page), "actor_id": user.user_id})
    return {"site": page}


@router.post("/platform/site/logo")
def logo(body: dict, user: Principal = Depends(admin), gw=Depends(gateway)):
    """The page's logo ({image: data URL}): media-service keeps it as a PNG with its clear background; returns its id
    (saved with the page when the operator publishes)."""
    import uuid

    from grepx_bff.routers.photo import decode_picture
    if user.tenant:
        raise ApiError("FORBIDDEN", 403)
    gw.limit("site-logo", rate=20, per=600)
    staged = f"staged/{uuid.uuid4().hex}"
    gw.storage.put(staged, decode_picture(body.get("image", "")))
    out = gw.command(gc.media.REQUESTS, gc.media.SERVICE, {"action": gc.media.MediaAction.PROCESS.value, "staged_key": staged,
                                                           "kind": gc.media.MediaKind.LOGO.value, "owner_id": "platform"}).fields
    return {"logo_id": out.get("media_id") or ""}
