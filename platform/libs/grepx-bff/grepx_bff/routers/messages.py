# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""Broadcasts, delivery log, automatic-message settings."""
import grepx_contracts as gc
from fastapi import APIRouter, Depends

from grepx_bff.security import Principal, admin, gateway, require
from grepx_bff.views import clean

router = APIRouter(prefix="/admin/messages", tags=["messages"])


@router.post("/broadcast")
def broadcast(body: dict, user: Principal = Depends(require("notify")), gw=Depends(gateway)):
    return gw.command(gc.campaign.REQUESTS, gc.campaign.SERVICE, {"action": "BROADCAST", "actor_id": user.user_id, **body}).fields


@router.get("/log")
def log(limit: int = 200, user: Principal = Depends(require("view_log")), gw=Depends(gateway)):
    rows = sorted(gw.read.rows(gc.notification.NOTIFICATIONS), key=lambda n: n.get("occurred_at", ""), reverse=True)[:limit]
    return [{**{k: n.get(k) for k in ("template", "channel", "recipient", "delivery", "error", "subject", "occurred_at")}, "status": n.get("status")} for n in rows]


@router.get("/automatic")
def automatic(user: Principal = Depends(admin), gw=Depends(gateway)):
    settings = {s["_key"]: clean(s) for s in gw.rows(gc.template.MESSAGE_SETTINGS)}
    return [{**clean(t), "settings": settings.get(t["_key"])} for t in gw.rows(gc.template.MESSAGE_TEMPLATES)]


@router.put("/automatic/{key}")
def save_automatic(key: str, body: dict, user: Principal = Depends(admin), gw=Depends(gateway)):
    action = "RESET" if body.get("reset") else "SAVE"
    return gw.command(gc.template.REQUESTS, gc.template.SERVICE, {"action": action, "template_key": key, **body}).fields
