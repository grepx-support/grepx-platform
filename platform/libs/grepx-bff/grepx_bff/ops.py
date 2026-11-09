# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""/ops/ - the live operations screen, reached through the product's own address.

The screen is its own service (ops-monitor-service, listening on 127.0.0.1 only). This is a plain pass-through like a
reverse proxy: same path, same query, the caller's Authorization header and nothing else; the monitor checks the
session and role itself. Where it listens is read from its heartbeat (`_health`), so no port is configured twice.
Settings (deployment / project file): `ops: {service: …, path: /ops}`; `ops: {path: ""}` turns the route off.
"""
from __future__ import annotations

import time
import urllib.error
import urllib.request
from typing import Any, Optional

from fastapi import Request
from fastapi.responses import RedirectResponse, Response

DEFAULTS = {"service": "ops-monitor-service", "path": "/ops"}
PASS_HEADERS = ("content-type", "cache-control", "x-content-type-options", "referrer-policy")


class Locator:
    """Where the monitor listens, from its heartbeat row; remembered for a few seconds."""

    def __init__(self, gw: Any, service: str, ttl: float = 15.0):
        self.gw, self.service, self.ttl = gw, service, ttl
        self.port: Optional[int] = None
        self.checked = 0.0

    def __call__(self) -> Optional[int]:
        if self.port and time.monotonic() - self.checked < self.ttl:
            return self.port
        from nexus_api import HEALTH_TABLE, is_stale
        rows = [r for r in self.gw.read.rows(HEALTH_TABLE) if r.get("service") == self.service]
        live = [r for r in rows if not is_stale(str(r.get("last_seen") or "")) and int(r.get("port") or 0)]
        self.port, self.checked = (int(live[0]["port"]) if live else None), time.monotonic()
        return self.port


def mount_ops(app: Any, gw: Any) -> None:
    settings = {**DEFAULTS, **(gw.cfg.get("ops") or {})}
    path = str(settings["path"] or "").rstrip("/")
    if not path:
        return
    locate = Locator(gw, settings["service"])

    @app.get(path, include_in_schema=False)
    def ops_root():
        return RedirectResponse(path + "/")

    @app.api_route(path + "/{rest:path}", methods=["GET", "HEAD"], include_in_schema=False)
    def ops(rest: str, request: Request):
        try:
            port = locate()
        except Exception:
            port = None
        if not port:
            return Response("The operations screen is not running (scripts/run.sh start ops-monitor-service).", 503,
                            media_type="text/plain")
        url = f"http://127.0.0.1:{port}/{rest}" + (f"?{request.url.query}" if request.url.query else "")
        headers = {"Authorization": request.headers["authorization"]} if request.headers.get("authorization") else {}
        try:
            upstream = urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=40)  # noqa: S310 - local only
        except urllib.error.HTTPError as exc:
            upstream = exc
        except OSError:
            locate.port = None
            return Response("The operations screen did not answer.", 502, media_type="text/plain")
        with upstream:
            body, status = upstream.read(), getattr(upstream, "status", None) or upstream.code
            kept = {k: v for k, v in upstream.headers.items() if k.lower() in PASS_HEADERS}
        return Response(body, status, headers=kept)
