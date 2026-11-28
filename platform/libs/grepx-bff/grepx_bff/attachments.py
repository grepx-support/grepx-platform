# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""Attachments on any record, for every product: ref names the record ("bill:123"), the browser sends a data URL,
media-service checks the type and keeps the file. Each product says who may do what (one copy, no drift):

    router = attachments_router(allow, see=("seas", "manage_business"), change=("manage_seas", "manage_business"))
    can_see(k, row) -> bool              optional: per record (a driver sees only his own jobs' files)

Who may see the library, open a file, attach one or delete one is decided here, never by any signed-in member (SEC-02,
OS-01). Only images and PDFs open in the page; anything else downloads, with nosniff and a sandbox (SEC-04)."""
from __future__ import annotations

import base64
import binascii
import re
import uuid
from typing import Callable, Optional

import grepx_contracts as gc
from fastapi import APIRouter, Depends
from fastapi.responses import Response

from .errors import ApiError

REF = re.compile(r"^[a-z_]{2,20}:[A-Za-z0-9_.-]{1,64}$")
MAX_BYTES = 10 * 1024 * 1024
PREVIEW = {"image/png", "image/jpeg", "image/gif", "image/webp", "application/pdf"}
SANDBOX = {"X-Content-Type-Options": "nosniff", "Content-Security-Policy": "sandbox; default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'"}


def check_ref(ref: str) -> str:
    if not REF.fullmatch(ref or ""):
        raise ApiError("INVALID_REF", 400)
    return ref


def decode(data_url: str) -> bytes:
    head, _, body = (data_url or "").partition(",")
    if not head.startswith("data:") or ";base64" not in head:
        raise ApiError("MISSING_FILE", 400)
    if len(body) > MAX_BYTES * 4 // 3 + 4:
        raise ApiError("TOO_LARGE", 413)
    try:
        return base64.b64decode(body, validate=True)
    except (binascii.Error, ValueError):
        raise ApiError("MISSING_FILE", 400)


def shown(row: dict, base: str) -> dict:
    return {"id": row["_key"], "name": row.get("name", ""), "ref": row.get("ref", ""), "type": row.get("content_type", ""), "size": row.get("size", 0),
            "note": row.get("note", ""), "by": row.get("by", ""), "at": row.get("at", ""), "url": f"/api/v1{base}/{row['_key']}/file"}


def served(row: dict, data: bytes) -> Response:
    """Images and PDFs open in place; anything else is a download. Either way the type is the one media-service found."""
    kind = row.get("content_type", "application/octet-stream")
    name = re.sub(r'["\r\n\\]', "", row.get("name", "file"))[:200] or "file"
    how = "inline" if kind in PREVIEW else "attachment"
    return Response(data, media_type=kind, headers={"Content-Disposition": f'{how}; filename="{name}"', "Cache-Control": "private, max-age=600", **SANDBOX})


def attachments_router(allow: Callable, see: tuple, change: tuple, can_see: Optional[Callable] = None, prefix: str = "/attachments") -> APIRouter:
    router = APIRouter(prefix=prefix, tags=["attachments"])
    seeing, changing = allow(*see), allow(*change)
    visible = can_see or (lambda k, row: True)

    def mine(k, media_id: str) -> dict:
        row = k.gw.one(gc.media.MEDIA, media_id)
        if not row or row.get("owner_id") != k.tenant or row.get("kind") != gc.media.MediaKind.FILE.value or not visible(k, row):
            raise ApiError("NOT_FOUND", 404)                    # another business's, or not this person's to see: absent
        return row

    @router.get("")
    def listing(ref: str = "", k=Depends(seeing)):
        """The files on one record (ref), or every file of the business this person may see, newest first."""
        rows = k.gw.rows(gc.media.MEDIA, owner_id=k.tenant, **({"ref": check_ref(ref)} if ref else {}))
        files = [shown(r, prefix) for r in rows if r.get("kind") == gc.media.MediaKind.FILE.value and visible(k, r)]
        return {"files": sorted(files, key=lambda f: f["at"], reverse=True)}

    @router.post("")
    def attach(body: dict, k=Depends(changing)):
        ref = check_ref(body.get("ref", ""))
        if not visible(k, {"ref": ref}):
            raise ApiError("FORBIDDEN", 403)
        k.gw.limit(f"attach:{k.tenant}", rate=60, per=600)
        staged = f"staged/{uuid.uuid4().hex}"
        k.gw.storage.put(staged, decode(body.get("data", "")))
        out = k.cmd(gc.media.REQUESTS, gc.media.SERVICE, {"action": gc.media.MediaAction.ATTACH.value, "staged_key": staged, "owner_id": k.tenant,
                                                          "ref": ref, "name": body.get("name", "file"), "note": body.get("note", ""), "by": k.name})
        return shown({**out, "_key": out["media_id"]}, prefix)

    @router.get("/{media_id}/file")
    def file(media_id: str, k=Depends(seeing)):
        row = mine(k, media_id)
        data = k.gw.storage.get(row["key"])
        if data is None:
            raise ApiError("NOT_FOUND", 404)
        return served(row, data)

    @router.delete("/{media_id}")
    def remove(media_id: str, k=Depends(changing)):
        mine(k, media_id)
        k.cmd(gc.media.REQUESTS, gc.media.SERVICE, {"action": gc.media.MediaAction.DELETE.value, "media_id": media_id})
        return {"removed": media_id}

    return router
