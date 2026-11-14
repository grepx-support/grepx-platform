# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""GET /files/{token}/{name} - a file shared by link (grepx_bff.shared_files), no sign-in: the token is the key."""
from fastapi import APIRouter, Depends
from fastapi.responses import Response

from grepx_bff.errors import ApiError
from grepx_bff.security import gateway
from grepx_bff.shared_files import fetch, mime_of, safe_name

router = APIRouter(tags=["files"])


@router.get("/files/{token}/{name}")
def shared_file(token: str, name: str, gw=Depends(gateway)):
    data = fetch(gw.storage, token, name)
    if data is None:
        raise ApiError("NOT_FOUND", 404)
    return Response(data, media_type=mime_of(name), headers={"Content-Disposition": f'inline; filename="{safe_name(name)}"',
                                                             "Cache-Control": "private, max-age=3600", "X-Robots-Tag": "noindex"})
