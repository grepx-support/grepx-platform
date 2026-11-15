# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""My work - what a staff member sees on their phone: their published shifts, clocking in and out with their PIN, the
hours they worked, their payslips (finalised months only) with the PDF, their leave balance and asking for leave. Only
their own records: the person is the employee linked to the login (by user, else by email)."""
from datetime import date, timedelta

import grepx_contracts as gc
from fastapi import APIRouter, Depends

from ..business import Business, allow
from ..errors import ApiError
from .payroll import payslip_file
from .roster import local_now

router = APIRouter(prefix="/my", tags=["my work"])
anyone = allow()


def me(k: Business) -> dict:
    rows = k.rows(gc.employee.EMPLOYEES)
    mine = next((e for e in rows if e.get("user_id") == k.user.user_id), None)
    if mine is None:
        email = ((k.gw.one(gc.people.PEOPLE, k.user.user_id) or {}).get("email") or "").strip().lower()
        mine = next((e for e in rows if email and (e.get("email") or "").lower() == email), None)
    if mine is None or not mine.get("active", True):
        raise ApiError("NOT_ON_THE_TEAM", 404)
    return mine


def hours(row: dict) -> float:
    return round(float(row.get("worked_min") or 0) / 60, 2)


@router.get("")
def overview(k: Business = Depends(anyone)):
    e = me(k)
    eid, today = e["_key"], date.today()
    places = {p["_key"]: p.get("name", "") for p in k.rows(gc.business.LOCATIONS)}
    soon = (today + timedelta(days=21)).isoformat()
    shifts = sorted(({"shift_id": s["_key"], "date": s["date"], "start": s["start"], "end": s["end"], "role": s.get("role", ""), "note": s.get("note", ""),
                      "site": places.get(s.get("site_id"), "")} for s in k.rows(gc.roster.SHIFTS, employee_id=eid)
                     if s.get("published") and today.isoformat() <= s.get("date", "") <= soon), key=lambda s: (s["date"], s["start"]))
    since = (today - timedelta(days=14)).isoformat()
    worked = sorted(({"date": a.get("date"), "in": str(a.get("clock_in", ""))[11:16], "out": str(a.get("clock_out", ""))[11:16], "hours": hours(a),
                      "site": places.get(a.get("site_id"), "")} for a in k.rows(gc.roster.ATTENDANCE, employee_id=eid) if a.get("date", "") >= since),
                    key=lambda a: a["date"], reverse=True)
    final = {r.get("month") for r in k.rows(gc.payroll.PAY_RUNS) if r.get("final")}
    slips = sorted(({"month": s["month"], "net": s.get("net"), "gross": s.get("gross")} for s in k.rows(gc.payroll.PAYSLIPS, employee_id=eid) if s.get("month") in final),
                   key=lambda s: s["month"], reverse=True)
    leave = k.cmd(gc.leave.REQUESTS, gc.leave.SERVICE, {"action": "BALANCES", "employee_id": eid})
    mine = sorted(({"leave_id": l["_key"], **{f: l.get(f) for f in ("type_name", "first", "last", "days", "state", "note")}} for l in k.rows(gc.leave.LEAVES, employee_id=eid)),
                  key=lambda l: l["first"] or "", reverse=True)
    open_clock = any(not a.get("clock_out") for a in k.rows(gc.roster.ATTENDANCE, employee_id=eid))
    return {"employee": {"employee_id": eid, "name": e.get("name", ""), "position": e.get("position", ""), "sites": [places.get(s, "") for s in e.get("sites") or []]},
            "shifts": shifts, "worked": worked, "hours_14d": round(sum(a["hours"] for a in worked), 2), "clocked_in": open_clock,
            "payslips": slips, "currency": k.business.get("currency", ""), "leave_types": leave.get("types", []),
            "balances": (leave.get("people") or [{}])[0].get("types", []), "leaves": mine}


@router.post("/clock")
def clock(body: dict, k: Business = Depends(anyone)):
    eid = me(k)["_key"]
    k.gw.limit(f"clock:{k.tenant}:{eid}", rate=6, per=60)
    return k.cmd(gc.roster.REQUESTS, gc.roster.SERVICE, {"action": "CLOCK", "employee_id": eid, "pin": str(body.get("pin") or ""),
                                                         "site_id": body.get("site_id", ""), "at": local_now(k)})


@router.post("/leave")
def ask_leave(body: dict, k: Business = Depends(anyone)):
    eid = me(k)["_key"]
    return k.cmd(gc.leave.REQUESTS, gc.leave.SERVICE, {"action": "REQUEST", "actor_name": k.name, "employee_id": eid,
                                                       **{f: body.get(f) for f in ("type_id", "first", "last", "half_day", "note")}})["leave"]


@router.get("/payslips/{month}/pdf")
def payslip(month: str, k: Business = Depends(anyone)):
    eid = me(k)["_key"]
    if not any(r.get("month") == month and r.get("final") for r in k.rows(gc.payroll.PAY_RUNS)):
        raise ApiError("NOT_FOUND", 404)
    return payslip_file(month, eid, k).response()
