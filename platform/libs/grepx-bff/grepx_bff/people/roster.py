# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""Roster: shifts per place per week (roster-service) - add, move, remove, copy last week, publish; clock in / out
on a shared terminal with a PIN; each person's own shifts."""
from datetime import datetime
from zoneinfo import ZoneInfo

import grepx_contracts as gc
from fastapi import APIRouter, Depends

from ..business import Business, allow, business_user

router = APIRouter(prefix="/roster", tags=["roster"])
manager = allow("manage_people", "manage_business")
SHIFT = ("shift_id", "site_id", "employee_id", "date", "start", "end", "break_min", "role", "note")


def ask(k: Business, action: str, **fields) -> dict:
    return k.cmd(gc.roster.REQUESTS, gc.roster.SERVICE, {"action": action, **fields})


def local_now(k: Business) -> str:
    return datetime.now(ZoneInfo(k.business.get("timezone") or "UTC")).isoformat(timespec="minutes")[:16]


@router.get("")
def week(week: str, site_id: str = "", k: Business = Depends(manager)):
    return ask(k, "WEEK", week=week, site_id=site_id)["week"]


@router.post("/shifts")
def save_shift(body: dict, k: Business = Depends(manager)):
    return ask(k, "SAVE_SHIFT", **{f: body.get(f) for f in SHIFT if body.get(f) is not None})["shift"]


@router.delete("/shifts/{shift_id}")
def remove_shift(shift_id: str, k: Business = Depends(manager)):
    return ask(k, "REMOVE_SHIFT", shift_id=shift_id)


@router.post("/copy")
def copy_week(body: dict, k: Business = Depends(manager)):
    return ask(k, "COPY_WEEK", site_id=body.get("site_id"), from_week=body.get("from_week"), to_week=body.get("to_week"))


@router.post("/publish")
def publish(body: dict, k: Business = Depends(manager)):
    return ask(k, "PUBLISH_WEEK", site_id=body.get("site_id"), week=body.get("week"))


@router.post("/clock")
def clock(body: dict, k: Business = Depends(business_user)):
    """Any signed-in device of the business (a shared terminal): the person's PIN proves who is clocking."""
    k.gw.limit(f"clock:{k.tenant}:{body.get('employee_id')}", rate=6, per=60)
    return ask(k, "CLOCK", employee_id=body.get("employee_id"), pin=str(body.get("pin") or ""), site_id=body.get("site_id"), at=local_now(k))


@router.get("/people")
def people(site_id: str = "", k: Business = Depends(business_user)):
    """Names for the clock screen (no pay, no documents)."""
    team = k.cmd(gc.employee.REQUESTS, gc.employee.SERVICE, {"action": "TEAM", "site_id": site_id})["team"]
    return {"people": [{"employee_id": p["employee_id"], "name": p["name"], "position": p.get("position", "")} for p in team if p.get("active", True)]}
