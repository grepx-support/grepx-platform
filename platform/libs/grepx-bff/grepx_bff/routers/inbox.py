# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""The bell: every person's in-app messages (the "app" channel of notification-service), how many are new since they
last looked, and their phones / browsers for Web Push (allow notifications -> subscribe with the platform's key)."""
import grepx_contracts as gc
from fastapi import APIRouter, Depends

from grepx_bff.security import Principal, current_user, gateway

router = APIRouter(prefix="/me", tags=["inbox"])


ANSWERS = ("public_key", "device", "forgotten", "seen_until")


def _ask(gw, user: Principal, action: str, **fields) -> dict:
    out = gw.command(gc.notification.NOTIFICATIONS, gc.notification.SERVICE, {"action": action, "user_id": user.user_id,
                                                                               "tenant_id": user.tenant, **fields}).fields
    return {k: out[k] for k in ANSWERS if k in out}


@router.get("/inbox")
def inbox(limit: int = 30, user: Principal = Depends(current_user), gw=Depends(gateway)):
    """{items: [{key, subject, body, link, at, new}], unread} - newest first."""
    seen = (gw.read.one(gc.notification.INBOX_SEEN, user.user_id) or {}).get("seen_until", "")
    rows = [n for n in gw.read.rows(gc.notification.NOTIFICATIONS, channel="app")
            if n.get("recipient") == user.user_id and n.get("delivery") in ("SENT", "LOGGED")]
    rows.sort(key=lambda n: n.get("sent_at") or n.get("occurred_at", ""), reverse=True)
    items = [{"key": n.get("_key", ""), "subject": n.get("subject", ""), "body": n.get("body", ""), "template": n.get("template", ""),
              "link": (n.get("values") or {}).get("link", ""), "at": n.get("sent_at") or n.get("occurred_at", ""),
              "new": (n.get("sent_at") or "") > seen} for n in rows[:limit]]
    return {"items": items, "unread": sum(1 for n in rows if (n.get("sent_at") or "") > seen)}


@router.post("/inbox/seen")
def seen(user: Principal = Depends(current_user), gw=Depends(gateway)):
    return _ask(gw, user, "MARK_SEEN")


@router.get("/push/key")
def push_key(user: Principal = Depends(current_user), gw=Depends(gateway)):
    return _ask(gw, user, "PUSH_KEY")


@router.post("/push/subscribe")
def subscribe(body: dict, user: Principal = Depends(current_user), gw=Depends(gateway)):
    return _ask(gw, user, "REGISTER_DEVICE", subscription=body.get("subscription") or {}, label=str(body.get("label") or "")[:80])


@router.post("/push/unsubscribe")
def unsubscribe(body: dict, user: Principal = Depends(current_user), gw=Depends(gateway)):
    return _ask(gw, user, "FORGET_DEVICE", endpoint=str(body.get("endpoint") or ""))
