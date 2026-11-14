# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""Two-step login for the signed-in person (Profile): status, switch on (key + QR link, then a first code), switch off."""
import json

import grepx_contracts as gc
from fastapi import APIRouter, Depends

from grepx_bff.security import Principal, current_user, gateway

router = APIRouter(prefix="/me/two-step", tags=["auth"])


def ask(gw, user: Principal, action: str, **fields):
    return gw.command(gc.auth.REQUESTS, gc.auth.SERVICE, {"action": action, "user_id": user.user_id, **fields}).fields


@router.get("")
def status(user: Principal = Depends(current_user), gw=Depends(gateway)):
    out = ask(gw, user, "TWO_STEP_STATUS")
    return {"on": out["on"], "recovery_left": out["recovery_left"], "linked": out.get("linked") or []}


@router.post("/start")
def start(body: dict | None = None, user: Principal = Depends(current_user), gw=Depends(gateway)):
    """body.issuer: the name the authenticator app shows (the product's name)."""
    out = ask(gw, user, "TWO_STEP_START", issuer=str((body or {}).get("issuer") or "GrepX")[:40])
    return {"key": gw.box.open(out["secret_enc"]), "link": gw.box.open(out["app_link_enc"])}


@router.post("/enable")
def enable(body: dict, user: Principal = Depends(current_user), gw=Depends(gateway)):
    out = ask(gw, user, "TWO_STEP_ENABLE", code=str(body.get("code") or ""))
    return {"on": True, "recovery_codes": json.loads(gw.box.open(out["recovery_enc"]))}


@router.post("/disable")
def disable(body: dict, user: Principal = Depends(current_user), gw=Depends(gateway)):
    ask(gw, user, "TWO_STEP_DISABLE", password_enc=gw.box.seal(str(body.get("password") or "")), code=str(body.get("code") or ""))
    return {"on": False}
