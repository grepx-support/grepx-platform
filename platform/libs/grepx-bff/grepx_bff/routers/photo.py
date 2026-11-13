# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""POST/DELETE /me/photo — the signed-in person's profile picture (every product).

The browser sends the picture already cropped (a data URL). The BFF only stages the bytes; media-service turns them into a
square WebP avatar and people-service links it to the person. No image handling here, and nothing written to a table
directly."""
import base64
import binascii
import uuid

import grepx_contracts as gc
from fastapi import APIRouter, Depends

from grepx_bff.errors import ApiError
from grepx_bff.security import Principal, current_user, gateway

router = APIRouter(tags=["me"])

MAX_BYTES = 6 * 1024 * 1024
ALLOWED = ("image/jpeg", "image/png", "image/webp")


def decode_picture(data_url: str) -> bytes:
    """`data:image/jpeg;base64,...` -> bytes; anything else (or too big) is refused."""
    head, _, body = (data_url or "").partition(",")
    if not head.startswith("data:") or ";base64" not in head or head[5:].split(";")[0] not in ALLOWED:
        raise ApiError("NOT_AN_IMAGE", 400)
    if len(body) > MAX_BYTES * 4 // 3 + 4:
        raise ApiError("TOO_LARGE", 413)
    try:
        return base64.b64decode(body, validate=True)
    except (binascii.Error, ValueError):
        raise ApiError("NOT_AN_IMAGE", 400)


def link_photo(gw, person_id: str, photo_id: str) -> None:
    gw.command(gc.people.REQUESTS, gc.people.SERVICE, {"action": gc.people.PersonAction.SET_PHOTO.value,
                                                       "person_id": person_id, "photo_id": photo_id})


@router.post("/me/photo")
def set_photo(body: dict, user: Principal = Depends(current_user), gw=Depends(gateway)):
    gw.limit(f"photo:{user.user_id}", rate=10, per=600)
    picture = decode_picture(body.get("image", ""))
    staged = f"staged/{uuid.uuid4().hex}"
    gw.storage.put(staged, picture)
    verdict = gw.command(gc.media.REQUESTS, gc.media.SERVICE, {"action": gc.media.MediaAction.PROCESS.value, "staged_key": staged,
                                                               "kind": gc.media.MediaKind.AVATAR.value, "owner_id": user.user_id})
    photo_id = verdict.fields.get("media_id") or verdict.key
    link_photo(gw, user.user_id, photo_id)
    return {"photo_id": photo_id}


@router.delete("/me/photo")
def remove_photo(user: Principal = Depends(current_user), gw=Depends(gateway)):
    link_photo(gw, user.user_id, "")
    return {"photo_id": ""}
