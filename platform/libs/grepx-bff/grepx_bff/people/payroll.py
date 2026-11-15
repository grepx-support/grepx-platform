# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""Payroll (payroll-service): the country and its rates in one place, the month's run, bonuses / advances, locking the
month, each payslip as a PDF and sent to the person (email / WhatsApp / SMS). Pay is the owner's business: managers of places do not see it.

What else happens when a month is locked belongs to the product (kitchen puts each outlet's labour cost into Costs):
it passes an after_finalise hook to build()."""
from typing import Callable, Optional

import grepx_contracts as gc
from fastapi import APIRouter, Depends

from ..business import Business, allow
from ..documents import PdfFile, ReportPdf, brand, people_docs
from ..errors import ApiError

owner = allow("manage_business")
Finalised = Callable[[Business, str, dict], None]          # (user, month, FINALISE verdict) -> None


def ask(k: Business, action: str, **fields) -> dict:
    return k.cmd(gc.payroll.REQUESTS, gc.payroll.SERVICE, {"action": action, **fields})


def month_of(k: Business, month: str) -> dict:
    return ask(k, "MONTH", month=month)


def payslip_file(month: str, employee_id: str, k: Business) -> PdfFile:
    slip = next((s for s in month_of(k, month)["payslips"] if s["employee_id"] == employee_id), None)
    if slip is None:
        raise ApiError("NOT_FOUND", 404)
    spec = people_docs.payslip(slip, k.business, k.business.get("currency", ""))
    return PdfFile(ReportPdf(spec, brand(k)).build(), f"payslip-{month}-{slip['name'].replace(' ', '-')}")


def send_one(k: Business, month: str, employee_id: str, channels: list[str]) -> dict:
    """One payslip out by email / WhatsApp / SMS with its PDF; payroll-service decides whether it may go and records it."""
    try:
        file = payslip_file(month, employee_id, k)
        slip = ask(k, "SEND_PAYSLIP", month=month, employee_id=employee_id, channels=channels, org=k.business.get("name", ""),
                   attachments=[file.attachment(k.gw.storage)])["payslip"]
        return {"employee_id": employee_id, "ok": True, "channels": slip["sent"][-1]["channels"]}
    except ApiError as exc:
        return {"employee_id": employee_id, "ok": False, "reason": exc.detail["reason"], "message": exc.detail["message"]}


def build(after_finalise: Optional[Finalised] = None) -> APIRouter:
    router = APIRouter(prefix="/payroll", tags=["payroll"])

    @router.get("/settings")
    def settings(k: Business = Depends(owner)):
        return ask(k, "SETTINGS")

    @router.put("/settings")
    def set_settings(body: dict, k: Business = Depends(owner)):
        return ask(k, "SET_SETTINGS", country=body.get("country", ""), rates=body.get("rates") or {})["settings"]

    @router.get("")
    def month(month: str, k: Business = Depends(owner)):
        return month_of(k, month)

    @router.post("/run")
    def run(body: dict, k: Business = Depends(owner)):
        return ask(k, "RUN", month=body.get("month"))["run"]

    @router.post("/adjust")
    def adjust(body: dict, k: Business = Depends(owner)):
        return ask(k, "ADJUST", **{f: body.get(f) for f in ("month", "employee_id", "kind", "amount", "note")})["adjustment"]

    @router.delete("/adjust/{adjustment_id}")
    def remove(adjustment_id: str, k: Business = Depends(owner)):
        return ask(k, "REMOVE_ADJUSTMENT", adjustment_id=adjustment_id)

    @router.post("/finalise")
    def finalise(body: dict, k: Business = Depends(owner)):
        m = body.get("month")
        done = ask(k, "FINALISE", month=m)
        if after_finalise:
            after_finalise(k, m, done)
        return done

    @router.get("/payslip")
    def payslip(month: str, employee_id: str, k: Business = Depends(owner)):
        return payslip_file(month, employee_id, k).response()

    @router.post("/payslips/send")
    def send_payslips(body: dict, k: Business = Depends(owner)):
        """Send a locked month's payslips: to the people listed (employee_ids), or to everyone on that month's run."""
        month = str(body.get("month") or "")
        names = {s["employee_id"]: s.get("name", "") for s in k.rows(gc.payroll.PAYSLIPS, month=month)}
        ids = body.get("employee_ids") or list(names)
        if not ids:
            raise ApiError("NO_RUN", 409)
        results = [{**send_one(k, month, eid, body.get("channels") or ["email"]), "name": names.get(eid, "")} for eid in dict.fromkeys(ids)]
        return {"sent": sum(r["ok"] for r in results), "results": results}

    return router
