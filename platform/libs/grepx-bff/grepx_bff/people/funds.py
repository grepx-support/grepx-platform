# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""Funds (fund-service), for the owner: every fund and the business's totals, one fund in full, funds, parties and
movements, investor statements (PDF, or sent by email / WhatsApp). How a use's real spending is found is the
product's FundCosts (kitchen: the Costs page per outlet); without one the rest still works."""
import grepx_contracts as gc
from fastapi import APIRouter, Depends

from ..business import Business, allow
from ..documents import PdfFile, ReportPdf, brand, people_docs
from .fund_costs import FundCosts, NoCosts

owner = allow("manage_business")
FUND = ("fund_id", "name", "kind", "currency", "target", "rate_pct", "rate_to_base", "purpose", "opened", "closed", "order")
ENTRY = ("kind", "amount", "currency", "rate", "date", "due", "party_id", "purpose", "ref", "note")


def ask(k: Business, action: str, **fields) -> dict:
    return k.cmd(gc.fund.REQUESTS, gc.fund.SERVICE, {"action": action, **fields})


def purposes(k: Business, fund_id: str = "") -> set[str]:
    entries = k.rows(gc.fund.FUND_ENTRIES, **({"fund_id": fund_id} if fund_id else {}))
    return {e.get("purpose") for e in entries if e.get("kind") == "allocate" and e.get("purpose")}


def place_names(k: Business) -> list[str]:
    return sorted(r.get("name", "") for r in k.rows(gc.business.LOCATIONS))


def planned_uses(k: Business, fund_id: str) -> list[str]:
    plan = (k.one(gc.fund.FUNDS, fund_id) or {}).get("plan") or {}
    return [u["purpose"] for u in plan.get("uses") or [] if u.get("purpose")]


def statement_file(party_id: str, first: str, last: str, k: Business) -> PdfFile:
    st = ask(k, "STATEMENT", party_id=party_id, first=first, last=last)["statement"]
    return PdfFile(ReportPdf(people_docs.investor_statement(st), brand(k)).build(), f"statement-{st['name'].replace(' ', '-')}-{st['last']}")


def build(costs: FundCosts = NoCosts()) -> APIRouter:
    router = APIRouter(prefix="/funds", tags=["funds"])

    @router.get("")
    def overview(as_of: str = "", k: Business = Depends(owner)):
        base = k.business.get("currency", "")
        return {**ask(k, "OVERVIEW", base=base, as_of=as_of, spending=costs.spending(k, purposes(k))), "currency": base, "places": place_names(k)}

    @router.get("/{fund_id}")
    def one(fund_id: str, k: Business = Depends(owner)):
        return {**ask(k, "FUND", fund_id=fund_id, actuals=costs.actuals(k, planned_uses(k, fund_id)), spending=costs.spending(k, purposes(k, fund_id))),
                "people": [{"party_id": p["_key"], "name": p.get("name", "")} for p in k.rows(gc.fund.FUND_PARTIES)], "places": place_names(k)}

    @router.put("/{fund_id}/plan")
    def plan(fund_id: str, body: dict, k: Business = Depends(owner)):
        return ask(k, "SET_PLAN", fund_id=fund_id, plan=body)["plan"]

    @router.post("")
    def save_fund(body: dict, k: Business = Depends(owner)):
        fields = {f: body.get(f) for f in FUND if body.get(f) not in (None, "")}
        return ask(k, "SAVE_FUND", **{"currency": k.business.get("currency", ""), **fields})["fund"]

    @router.post("/parties")
    def save_party(body: dict, k: Business = Depends(owner)):
        return ask(k, "SAVE_PARTY", **{f: body.get(f) for f in ("party_id", "name", "kind", "email", "phone", "note")})["party"]

    @router.post("/{fund_id}/entries")
    def record(fund_id: str, body: dict, k: Business = Depends(owner)):
        return ask(k, "RECORD", fund_id=fund_id, **{f: body.get(f) for f in ENTRY})["entry"]

    @router.post("/entries/{entry_id}/reverse")
    def reverse(entry_id: str, body: dict, k: Business = Depends(owner)):
        return ask(k, "REVERSE", entry_id=entry_id, reason=body.get("reason"))

    @router.post("/order")
    def reorder(body: dict, k: Business = Depends(owner)):
        """Funds in the order they were dragged to."""
        for n, fund_id in enumerate(body.get("fund_ids") or []):
            ask(k, "SAVE_FUND", fund_id=fund_id, order=n + 1)
        return {"ok": True}

    @router.get("/parties/{party_id}/statement")
    def statement(party_id: str, first: str = "", last: str = "", k: Business = Depends(owner)):
        return statement_file(party_id, first, last, k).response()

    @router.post("/parties/{party_id}/statement/send")
    def send_statement(party_id: str, body: dict, k: Business = Depends(owner)):
        first, last = body.get("first", ""), body.get("last", "")
        file = statement_file(party_id, first, last, k)
        return ask(k, "SEND_STATEMENT", party_id=party_id, first=first, last=last, channels=body.get("channels") or ["email"],
                   org=k.business.get("name", ""), attachments=[file.attachment(k.gw.storage)])["party"]

    return router
