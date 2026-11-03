# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""/health and /metrics for a service — framework-free by default.

create_health_app(name) returns a plain WSGI app (standard library only), so a service needs no
web framework at all. Pass framework="fastapi" or "flask" (or set `web.framework` in config) to get
that framework's app instead — e.g. when the service also exposes its own HTTP routes.
"""
import json
import os
from typing import Any, Callable, Optional


def prometheus_text(service: str, metrics: Optional[Callable[[], dict]] = None) -> str:
    """The service's counters (from the `metrics` callable it was given) in Prometheus text format, labelled by service and project."""
    counts = metrics() if metrics else {}
    labels = f'service="{service}",project="{os.environ.get("GREPX_PROJECT", "platform")}"'
    lines = ["# TYPE grepx_up gauge", f"grepx_up{{{labels}}} 1"]
    for name in ("handled", "accepted", "rejected", "errors"):
        lines += [f"# TYPE grepx_requests_{name}_total counter", f"grepx_requests_{name}_total{{{labels}}} {int(counts.get(name, 0))}"]
    return "\n".join(lines) + "\n"


def _wsgi(service: str, metrics=None):
    def app(environ, start_response):
        path = environ.get("PATH_INFO", "/")
        if path == "/health":
            body, ctype, status = json.dumps({"ok": True, "service": service}).encode(), "application/json", "200 OK"
        elif path == "/metrics":
            body, ctype, status = prometheus_text(service, metrics).encode(), "text/plain; version=0.0.4", "200 OK"
        else:
            body, ctype, status = b"not found", "text/plain", "404 Not Found"
        start_response(status, [("Content-Type", ctype), ("Content-Length", str(len(body)))])
        return [body]
    return app


def _fastapi(service: str, metrics=None):
    from fastapi import FastAPI
    from fastapi.responses import PlainTextResponse
    app = FastAPI(title=service)
    app.get("/health")(lambda: {"ok": True, "service": service})
    app.get("/metrics", response_class=PlainTextResponse)(lambda: prometheus_text(service, metrics))
    return app


def _flask(service: str, metrics=None):
    from flask import Flask, Response, jsonify
    app = Flask(service)
    app.get("/health")(lambda: jsonify(ok=True, service=service))
    app.get("/metrics")(lambda: Response(prometheus_text(service, metrics), mimetype="text/plain"))
    return app


FRAMEWORKS = {"wsgi": _wsgi, "stdlib": _wsgi, "fastapi": _fastapi, "flask": _flask}


def create_health_app(service_name: str, framework: str | None = None, metrics: Optional[Callable[[], dict]] = None) -> Any:
    """metrics: a callable returning {handled, accepted, rejected, errors} (the service kit passes its own)."""
    return FRAMEWORKS[(framework or os.environ.get("GREPX_WEB_FRAMEWORK") or "wsgi").lower()](service_name, metrics)
