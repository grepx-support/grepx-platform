"""Serve processed images (immutable, cached for a year)."""
import grepx_contracts as gc
from fastapi import APIRouter, Depends
from fastapi.responses import Response

from grepx_bff.errors import ApiError
from grepx_bff.security import gateway

router = APIRouter(tags=["media"])


@router.get("/media/{media_id}")
def media(media_id: str, gw=Depends(gateway)):
    info = gw.one(gc.media.MEDIA, media_id)
    data = gw.storage.get(info["key"]) if info else None
    if not data:
        raise ApiError("NOT_FOUND", 404)
    return Response(data, media_type=info.get("content_type", "image/webp"), headers={"Cache-Control": "public, max-age=31536000, immutable"})
