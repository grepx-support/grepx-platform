# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""harden(app, gw): the headers, the per-page CSP and its report endpoint, and the failed sign-in limit, on a finished app."""
from __future__ import annotations

import json
import logging

from fastapi import Request
from fastapi.responses import JSONResponse, Response

from grepx_bff.errors import ApiError

from .csp import REPORT_PATH, Policy, page_text
from .limits import FailureWindow, RateWindow
from .options import EdgeOptions

AUTH_PATHS = {"/api/v1/auth/login", "/api/v1/auth/login/code", "/api/v1/auth/forgot", "/api/v1/auth/reset"}
AUTH_FAILURES, AUTH_WINDOW = 20, 600                 # failed attempts per address in 10 minutes
FAILED = (400, 401, 403, 409, 422)
PERMISSIONS = "geolocation=(self), camera=(), microphone=(), payment=(), usb=()"
REPORTS, REPORT_WINDOW, REPORT_BYTES = 30, 60, 8192
PUBLIC, PUBLIC_BYTES = "/api/v1/public/", 16 * 1024      # no sign-in: a demo form or a screen formula is small (SEC-09)
log = logging.getLogger("grepx.edge")


def _who(request: Request) -> str:
    return request.client.host if request.client else "unknown"     # uvicorn resolves forwarded headers from FORWARDED_ALLOW_IPS only


def _small(request: Request, limit: int) -> bool:
    """A body that says its size and is within the limit (one without a size - chunked - is refused here too)."""
    size = request.headers.get("content-length", "")
    return size.isdigit() and int(size) <= limit


def _refuse(status: int, reason: str, retry: int = 0) -> JSONResponse:
    return JSONResponse({"detail": ApiError(reason, status).detail}, status_code=status, headers={"Retry-After": str(retry)} if retry else None)


def _mount_reports(app, reports: RateWindow) -> None:
    @app.post(REPORT_PATH, include_in_schema=False)
    async def csp_report(request: Request):
        """Browsers post CSP violations here; kept small, rate limited per address, logged (never stored)."""
        if not reports.take(_who(request)):
            return Response(status_code=204)
        body = await request.body()
        if len(body) > REPORT_BYTES:
            return Response(status_code=413)
        try:
            report = (json.loads(body or b"{}") or {}).get("csp-report") or {}
        except ValueError:
            return Response(status_code=400)
        log.warning("csp %s blocked=%s page=%s", str(report.get("violated-directive", ""))[:80],
                    str(report.get("blocked-uri", ""))[:200], str(report.get("document-uri", ""))[:200])
        return Response(status_code=204)


def harden(app, gw=None, options: EdgeOptions | None = None) -> None:
    o = options or EdgeOptions.read(getattr(gw, "cfg", None))
    policy, failures = Policy(o), FailureWindow(AUTH_FAILURES, AUTH_WINDOW)
    if o.public and not __import__("os").environ.get("FORWARDED_ALLOW_IPS", "").strip("* "):
        log.warning("public SITE_URL without FORWARDED_ALLOW_IPS (the proxy's address, never '*'): per-address limits may be shared or spoofed")
    _mount_reports(app, RateWindow(REPORTS, REPORT_WINDOW))

    @app.middleware("http")
    async def edge(request, call_next):
        who = _who(request)
        counted = request.method == "POST" and request.url.path in AUTH_PATHS
        if counted and failures.blocked(who):
            return _refuse(429, "RATE_LIMITED", AUTH_WINDOW)
        if request.method in ("POST", "PUT", "PATCH") and request.url.path.startswith(PUBLIC) and request.url.path != REPORT_PATH \
           and not _small(request, PUBLIC_BYTES):
            return _refuse(413, "TOO_LARGE")
        response = await call_next(request)
        if counted and response.status_code in FAILED:
            failures.fail(who)
        response.headers.setdefault("Permissions-Policy", PERMISSIONS)
        if request.url.scheme == "https":
            response.headers.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
        own = {k.lower() for k in response.headers} & {"content-security-policy", "content-security-policy-report-only"}
        if o.header and not own and response.headers.get("content-type", "").startswith("text/html"):
            body = b"".join([chunk async for chunk in response.body_iterator])            # a page is small
            headers = {k: v for k, v in response.headers.items() if k.lower() != "content-length"}
            headers[o.header] = policy.for_page(page_text(body, response.headers.get("content-encoding", "")))
            return Response(content=body, status_code=response.status_code, headers=headers)
        return response
