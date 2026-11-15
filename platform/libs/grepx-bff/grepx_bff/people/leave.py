# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""Leave (leave-service): requests, approval, balances per person and type, who is away; leave types of the business."""
import grepx_contracts as gc
from fastapi import APIRouter, Depends

from ..business import Business, allow

router = APIRouter(prefix="/leave", tags=["leave"])
manager = allow("manage_people", "manage_business")


def ask(k: Business, action: str, **fields) -> dict:
    return k.cmd(gc.leave.REQUESTS, gc.leave.SERVICE, {"action": action, "actor_name": k.name, **fields})


@router.get("")
def overview(first: str, last: str, site_id: str = "", year: int = 0, k: Business = Depends(manager)):
    away = ask(k, "CALENDAR", first=first, last=last, site_id=site_id)["leaves"]
    balances = ask(k, "BALANCES", site_id=site_id, **({"year": year} if year else {}))
    pending = [l for l in k.rows(gc.leave.LEAVES, state="pending")]
    return {"leaves": away, "pending": sorted(({**{f: v for f, v in l.items() if not f.startswith("_")}, "leave_id": l["_key"]} for l in pending),
                                              key=lambda l: l["first"]), **balances}


@router.post("")
def request(body: dict, k: Business = Depends(manager)):
    return ask(k, "REQUEST", **{f: body.get(f) for f in ("employee_id", "type_id", "first", "last", "half_day", "note")})["leave"]


@router.post("/{leave_id}/decide")
def decide(leave_id: str, body: dict, k: Business = Depends(manager)):
    return ask(k, "DECIDE", leave_id=leave_id, approve=bool(body.get("approve")), note=body.get("note"))["leave"]


@router.post("/{leave_id}/cancel")
def cancel(leave_id: str, k: Business = Depends(manager)):
    return ask(k, "CANCEL", leave_id=leave_id)


@router.post("/types")
def save_type(body: dict, k: Business = Depends(manager)):
    return ask(k, "SAVE_TYPE", **{f: body.get(f) for f in ("type_id", "name", "days_per_year", "paid", "carry_over", "unlimited", "active")})["type"]
