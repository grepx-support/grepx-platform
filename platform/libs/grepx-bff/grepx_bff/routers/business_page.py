# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""Each business's own public page (site-service), the same in every business product:

    GET  /public/page/{slug}        what visitors of /b/<slug> see (ended promotions left out); old names lead to the new one
    GET  /setup/page                the owner's page to edit, with its address        } owner (manage_business), or GrepX
    PUT  /setup/page                publish it                                         } support opened with "edit"
    POST /setup/page/image          a logo or a promotion picture -> its id
    POST /setup/page/address        a business set up by the operator picks its short name (once)
"""
from __future__ import annotations

import uuid
from datetime import date

import grepx_contracts as gc
from fastapi import APIRouter, Depends

from grepx_bff.business import Business, allow
from grepx_bff.errors import ApiError, register_copy
from grepx_bff.security import gateway

register_copy({"INVALID_PAGE": "Give the page a name.", "INVALID_COLOR": "Pick a colour.", "INVALID_LINK": "A link is not a web address - check it.",
               "INVALID_DATE": "A date is not right.", "HAS_ADDRESS": "This business already has its address."})

owner = allow("manage_business")


def resolve(gw, slug: str) -> tuple[str, dict | None, bool]:
    """(final slug, its address row or None, moved) - following renamed names a few steps."""
    slug, seen = slug.strip().lower(), set()
    row = gw.one(gc.signup.ADDRESSES, slug)
    while row is not None and row.get("moved_to") and slug not in seen and len(seen) < 5:
        seen.add(slug)
        slug = row["moved_to"]
        row = gw.one(gc.signup.ADDRESSES, slug)
    return slug, row, bool(seen)


def address_of(gw, tenant: str) -> str:
    return next((a["_key"] for a in gw.rows(gc.signup.ADDRESSES, business_id=tenant) if not a.get("moved_to")), "")


def visible(page: dict, today: str | None = None) -> dict:
    """Promotions not started yet or ended are not shown; switched-off parts are emptied."""
    today, on = today or date.today().isoformat(), page.get("sections") or {}
    live = [p for p in page.get("promotions") or [] if (not p.get("starts") or p["starts"] <= today) and (not p.get("ends") or p["ends"] >= today)]
    out = {k: v for k, v in page.items() if k not in ("updated_by", "business_id")}
    return {**out, "promotions": live if on.get("offers", True) else [], "highlights": page.get("highlights") if on.get("highlights", True) else [],
            "brands": page.get("brands") if on.get("brands", True) else [], "videos": page.get("videos") if on.get("videos", True) else []}


def routers() -> list[APIRouter]:
    public, setup = APIRouter(prefix="/public", tags=["page"]), APIRouter(prefix="/setup/page", tags=["page"])

    @public.get("/page/{slug}")
    def page(slug: str, gw=Depends(gateway)):
        slug, row, moved = resolve(gw, slug)
        business = gw.one(gc.business.BUSINESSES, row.get("business_id", "")) if row else None
        if business is None or business.get("closed"):
            raise ApiError("UNKNOWN_ADDRESS", 404)
        stored = gw.one(gc.site.BUSINESS_PAGES, business["_key"])
        return {"slug": slug, "moved": moved, "name": business.get("name", ""), "product": row.get("product", ""),
                "page": visible(stored) if stored else None}

    @setup.get("")
    def mine(k: Business = Depends(owner)):
        stored = k.gw.one(gc.site.BUSINESS_PAGES, k.tenant)
        return {"page": {key: v for key, v in stored.items() if not key.startswith("_")} if stored else None,
                "slug": address_of(k.gw, k.tenant), "business_name": k.business.get("name", "")}

    @setup.put("")
    def publish(body: dict, k: Business = Depends(owner)):
        out = k.gw.command(gc.site.REQUESTS, gc.site.SERVICE, {"action": "SAVE", "business_id": k.tenant, "page": body,
                                                               "actor_id": k.user.user_id}).fields["page"]
        return {"page": out, "slug": address_of(k.gw, k.tenant)}

    @setup.post("/image")
    def image(body: dict, k: Business = Depends(owner)):
        """{image: data URL, kind: logo | picture}: kept by media-service (a logo keeps its clear background)."""
        from grepx_bff.routers.photo import decode_picture
        k.gw.limit(f"page-image:{k.tenant}", rate=30, per=600)
        staged = f"staged/{uuid.uuid4().hex}"
        k.gw.storage.put(staged, decode_picture(body.get("image", "")))
        kind = gc.media.MediaKind.LOGO if body.get("kind") == "logo" else gc.media.MediaKind.PICTURE
        out = k.gw.command(gc.media.REQUESTS, gc.media.SERVICE, {"action": gc.media.MediaAction.PROCESS.value, "staged_key": staged,
                                                                 "kind": kind.value, "owner_id": k.tenant}).fields
        return {"image_id": out.get("media_id") or ""}

    @setup.post("/address")
    def claim(body: dict, k: Business = Depends(owner)):
        if address_of(k.gw, k.tenant):
            raise ApiError("HAS_ADDRESS", 409)
        out = k.gw.command(gc.signup.REQUESTS, gc.signup.SERVICE, {"action": "SET_ADDRESS", "business_id": k.tenant,
                                                                   "slug": str(body.get("slug") or ""), "product": str(k.gw.cfg.get("product") or "")})
        return {"slug": out.fields["address"]["slug"]}

    return [public, setup]
