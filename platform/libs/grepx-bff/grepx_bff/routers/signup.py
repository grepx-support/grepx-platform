# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""Self-service sign-up of a new business (SaaS), for any business product that runs signup-service:

    POST /public/signup                  the owner's details -> an email link and a phone code are sent
    POST /public/signup/{id}/email       the link from the email          } when both are confirmed the business is set up
    POST /public/signup/{id}/phone       the 6-digit code from the phone  } (grepx_bff.onboarding) and the owner is signed in
    GET  /public/signup/check            is a short name free?
    GET  /public/address/{slug}          which business a short name (/b/<slug>) is - old names lead to the new one
    GET  /platform/signups               the platform operator's list (with messages that went to the log, no provider set)
    POST /platform/addresses             the operator gives a business ({business_id, slug}) its short name

A product includes signup.routers(section) - section: its deployment settings (staff_roles, owner_role, currency, timezone).
"""
from __future__ import annotations

from typing import Any, Callable

import grepx_contracts as gc
from fastapi import APIRouter, Depends, Request

from grepx_bff.errors import ApiError, register_copy
from grepx_bff.onboarding import email_in_use, open_business, settings
from grepx_bff.routers.auth import session
from grepx_bff.security import Principal, admin, gateway

SHOWN = ("signup_id", "product", "business_name", "slug", "owner_name", "stage", "email_ok", "phone_ok", "business_id", "reason",
         "created_at", "hold_until", "code_tries")
MIN_PASSWORD = 8

register_copy({
    "INVALID_BUSINESS_NAME": "Enter your business's name.", "INVALID_SLUG": "Use 3-30 small letters, digits or hyphens for the short name.",
    "RESERVED_SLUG": "That short name is kept for the platform - pick another.", "SLUG_TAKEN": "That short name is taken - pick another.",
    "INVALID_CURRENCY": "Pick a currency.", "ACCEPT_TERMS": "Please accept the terms to continue.",
    "EMAIL_IN_USE": "This email already has an account here.", "WRONG_LINK": "This link is not right - use the latest email we sent.",
    "WRONG_CODE": "That code is not right.", "CODE_EXPIRED": "That code has expired - send a new one.",
    "TOO_MANY_TRIES": "Too many wrong codes - send a new one.", "TOO_SOON": "Please wait a minute before asking again.",
    "SIGNUP_EXPIRED": "This sign-up has expired - please start again.", "UNKNOWN_SIGNUP": "We can't find this sign-up - please start again.",
    "ALREADY_DONE": "This sign-up is already finished - sign in.", "NOT_VERIFIED": "Confirm your email and phone first.",
    "UNKNOWN_ADDRESS": "There is no business at this address.", "RATE_LIMITED": "Too many tries - please wait a little and try again.",
})


def _ip(request: Request) -> str:
    return (request.headers.get("x-forwarded-for", "").split(",")[0].strip() or (request.client.host if request.client else "")) or "unknown"


def _ask(gw, action: str, ok_only: bool = True, **fields):
    return gw.command(gc.signup.REQUESTS, gc.signup.SERVICE, {"action": action, **fields}, ok_only=ok_only)


def _mask(row: dict) -> dict:
    email, phone = str(row.get("email") or ""), str(row.get("phone") or "")
    name, _, host = email.partition("@")
    return {**{k: row.get(k) for k in SHOWN}, "email": f"{name[:2]}{'*' * max(len(name) - 2, 1)}@{host}" if host else "",
            "phone": phone[:3] + "*" * max(len(phone) - 6, 0) + phone[-3:] if len(phone) > 6 else phone}


def operator(user: Principal = Depends(admin)) -> Principal:
    if user.tenant:
        raise ApiError("FORBIDDEN", 403)
    return user


def local_base(request: Request) -> str:
    """This app as it can reach itself (the port it listens on), for work it does through its own API afterwards."""
    server = request.scope.get("server") or ("127.0.0.1", 80)
    return f"http://127.0.0.1:{server[1]}"


def routers(section: str, after_open: Callable[[Any, dict, str], None] | None = None) -> list[APIRouter]:
    """after_open(gw, opened, base_url): the product's next step once a business has opened - opened carries
    business_id, owner_id, owner, name and start_with ("demo" / "empty"), e.g. fill a demo shop."""
    public, platform = APIRouter(prefix="/public", tags=["signup"]), APIRouter(prefix="/platform", tags=["signup"])

    def finish(gw, signup_id: str, base: str = "") -> dict | None:
        """Both confirmed: set the business up once (BEGIN_SETUP lets exactly one caller through) and sign the owner in."""
        begin = _ask(gw, "BEGIN_SETUP", ok_only=False, signup_id=signup_id)
        if not begin.ok:
            return None
        owner, signup = begin.fields["owner"], begin.fields["signup"]
        if email_in_use(gw, owner["email"]):
            _ask(gw, "FAIL", signup_id=signup_id, reason="EMAIL_IN_USE")
            raise ApiError("EMAIL_IN_USE", 409, f"{owner['email']} already has an account here - sign in, or sign up with another email.")
        own = settings(gw, section)
        try:
            made = open_business(gw, section=section, name=signup["business_name"], owner=owner, password_enc=begin.fields["password_enc"],
                                 currency=begin.fields.get("currency") or own.get("currency") or "INR",
                                 timezone=begin.fields.get("timezone") or own.get("timezone") or "UTC")
        except ApiError as exc:
            _ask(gw, "FAIL", signup_id=signup_id, reason=(exc.detail or {}).get("reason", "") if isinstance(exc.detail, dict) else "")
            raise
        _ask(gw, "ACTIVATE", signup_id=signup_id, business_id=made["business_id"])
        if after_open and base:
            after_open(gw, {**made, "owner": owner, "name": signup["business_name"], "start_with": signup.get("start_with") or "demo"}, base)
        verdict = gw.command(gc.auth.REQUESTS, gc.auth.SERVICE, {"action": "LOGIN", "email": owner["email"],
                                                                "password_enc": begin.fields["password_enc"], "remember": True})
        return {**made, "slug": signup["slug"], "start_with": signup.get("start_with") or "demo", "session": session(gw, verdict)}

    def answer(gw, verdict, base: str = "") -> dict:
        signup = verdict.fields["signup"]
        out = {"signup": signup}
        if signup.get("stage") == "verified":
            done = finish(gw, signup["signup_id"], base)
            if done:
                out.update(done=True, signup={**signup, "stage": "active", "business_id": done["business_id"]}, **done)
        return out

    @public.get("/signup/check")
    def check(slug: str = "", name: str = "", request: Request = None, gw=Depends(gateway)):
        gw.limit(f"signup-check:{_ip(request)}", rate=60, per=60)
        return {k: v for k, v in _ask(gw, "CHECK", slug=slug.strip().lower()[:40], business_name=name[:80]).fields.items()
                if k in ("slug", "available", "problem")}

    @public.post("/signup")
    def start(body: dict, request: Request, gw=Depends(gateway)):
        gw.limit(f"signup:{_ip(request)}", rate=5, per=3600)
        password = str(body.get("password") or "")
        if len(password) < MIN_PASSWORD:
            raise ApiError("WEAK_PASSWORD", 400)
        if not body.get("accept_terms"):
            raise ApiError("ACCEPT_TERMS", 400)
        if email_in_use(gw, str(body.get("email") or "")):
            raise ApiError("EMAIL_IN_USE", 409, "This email already has an account here - sign in instead.")
        fields = {k: str(body.get(k) or "") for k in ("business_name", "slug", "owner_name", "email", "phone", "currency", "timezone", "website", "start_with")}
        verdict = _ask(gw, "START", **fields, product=str(gw.cfg.get("product") or ""), password_enc=gw.box.seal(password), ip=_ip(request),
                       link=f"{str(request.base_url).rstrip('/')}/#/signup/email")
        return {"signup": verdict.fields["signup"]}

    @public.get("/signup/{signup_id}")
    def status(signup_id: str, gw=Depends(gateway)):
        row = gw.one(gc.signup.SIGNUPS, signup_id)
        if row is None:
            raise ApiError("UNKNOWN_SIGNUP", 404)
        return {"signup": _mask(row)}

    @public.post("/signup/{signup_id}/email")
    def confirm_email(signup_id: str, body: dict, request: Request, gw=Depends(gateway)):
        gw.limit(f"signup-email:{signup_id}", rate=10, per=60)
        return answer(gw, _ask(gw, "CONFIRM_EMAIL", signup_id=signup_id, token=str(body.get("token") or "")), local_base(request))

    @public.post("/signup/{signup_id}/phone")
    def confirm_phone(signup_id: str, body: dict, request: Request, gw=Depends(gateway)):
        gw.limit(f"signup-phone:{signup_id}", rate=10, per=60)
        verdict = _ask(gw, "CONFIRM_PHONE", signup_id=signup_id, code=str(body.get("code") or "").strip())
        if not verdict.fields.get("confirmed"):
            raise ApiError("WRONG_CODE", 400, f"That code is not right - {verdict.fields.get('tries_left', 0)} tries left.")
        return answer(gw, verdict, local_base(request))

    @public.post("/signup/{signup_id}/resend")
    def resend(signup_id: str, body: dict, gw=Depends(gateway)):
        what = "email" if body.get("what") == "email" else "phone"
        return {"signup": _ask(gw, "RESEND", signup_id=signup_id, what=what).fields["signup"]}

    @public.post("/signup/{signup_id}/finish")
    def retry_finish(signup_id: str, request: Request, gw=Depends(gateway)):
        """Both were confirmed but setting up did not finish (e.g. the page was closed): try again."""
        done = finish(gw, signup_id, local_base(request))
        if done is None:
            raise ApiError("NOT_VERIFIED", 409)
        return {"done": True, **done}

    @public.get("/address/{slug}")
    def address(slug: str, gw=Depends(gateway)):
        """The business behind /b/<slug> (following renamed names); only its public name, never who is in it."""
        from grepx_bff.routers.business_page import resolve
        slug, row, moved = resolve(gw, slug)
        business = gw.one(gc.business.BUSINESSES, row.get("business_id", "")) if row else None
        if business is None or business.get("closed"):
            raise ApiError("UNKNOWN_ADDRESS", 404)
        return {"slug": slug, "name": business.get("name", ""), "product": row.get("product", ""), "moved": moved}

    @platform.get("/signups")
    def signups(user: Principal = Depends(operator), gw=Depends(gateway)):
        """Every sign-up, newest first, with the messages that only went to the log (no email / SMS provider set up yet),
        so the operator can read the code to a tester."""
        logged: dict[str, list] = {}
        for note in gw.rows(gc.notification.NOTIFICATIONS):
            ref = str(note.get("ref") or "")
            if ref.startswith("signup-") and note.get("delivery") == "LOGGED":
                logged.setdefault(ref.split("-")[1], []).append({"channel": note.get("channel"), "to": note.get("recipient"),
                                                                 "text": note.get("body") or "", "at": note.get("sent_at") or ""})
        rows = [{**_mask(r), "email": r.get("email", ""), "phone": r.get("phone", ""), "logged": logged.get(r["_key"], [])}
                for r in gw.rows(gc.signup.SIGNUPS) if r.get("stage") != "replaced"]
        addresses = {a.get("business_id"): a["_key"] for a in gw.rows(gc.signup.ADDRESSES) if not a.get("moved_to")}
        return {"signups": sorted(rows, key=lambda r: r.get("created_at") or "", reverse=True), "addresses": addresses}

    @platform.post("/addresses")
    def set_address(body: dict, user: Principal = Depends(operator), gw=Depends(gateway)):
        business_id = str(body.get("business_id") or "")
        if gw.one(gc.business.BUSINESSES, business_id) is None:
            raise ApiError("UNKNOWN_BUSINESS", 404)
        return _ask(gw, "SET_ADDRESS", business_id=business_id, slug=str(body.get("slug") or ""),
                    product=str(gw.cfg.get("product") or "")).fields["address"]

    return [public, platform]
