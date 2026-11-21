# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""create_app — one FastAPI app per product: common routers + the product's own, one trace id per request."""
from __future__ import annotations

import logging
import os
import time
from pathlib import Path
from typing import Iterable, Optional

from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import HTMLResponse
from fastapi.responses import FileResponse, PlainTextResponse
from fastapi.staticfiles import StaticFiles
from grepx_service import new_key
from starlette.concurrency import run_in_threadpool

from .gateway import CURRENT_TRACE, Gateway
from .routers import COMMON_ROUTERS


def create_app(gw: Gateway, product_routers: Iterable[APIRouter], title: str, web_dir: Optional[Path] = None,
               product: str = "", product_dir: Optional[Path] = None) -> FastAPI:
    """web_dir: the shared web shell (grepx-platform web/); product_dir: the product's modules/ and product.json."""
    app = FastAPI(title=title, version="1.0")
    app.state.gateway = gw
    app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"], expose_headers=["X-Trace-Id"])
    app.add_middleware(GZipMiddleware, minimum_size=1024, compresslevel=6)     # modules, styles and big lists: about a quarter of the bytes

    build = WebBuild([d for d in (web_dir, product_dir) if d is not None])

    @app.middleware("http")
    async def trace_and_headers(request, call_next):
        started = time.perf_counter()
        versioned = request.scope["path"].startswith(VERSIONED)
        if versioned:                                  # /assets/v/<build>/x -> /assets/x (the build is only for the browser's cache)
            tag, _, rest = request.scope["path"][len(VERSIONED):].partition("/")
            request.scope["path"] = "/assets/" + rest
            if tag == await run_in_threadpool(build.tag):  # it reads the web folder: never on the event loop
                request.scope["grepx.immutable"] = True
        trace_id = "".join(c for c in request.headers.get("x-trace-id", "") if c.isalnum() or c in "-_")[:64] or new_key()
        token = CURRENT_TRACE.set(trace_id)
        try:
            response = await call_next(request)
        finally:
            CURRENT_TRACE.reset(token)
        response.headers["X-Trace-Id"] = trace_id
        took = (time.perf_counter() - started) * 1000
        response.headers["Server-Timing"] = f"app;dur={took:.0f}"                 # the browser's Network tab shows it
        if took > SLOW_MS and request.scope["path"].startswith("/api/"):
            slow_log.warning("slow %s %s %.0f ms trace=%s", request.method, request.scope["path"], took, trace_id)
        if request.scope.get("grepx.immutable"):
            response.headers["Cache-Control"] = "public, max-age=31536000, immutable"      # this build's file never changes
        elif "cache-control" not in response.headers:
            # The web app is many small modules: the browser must ask each time (an unchanged file is a cheap 304), so
            # after an update it never mixes a new module with an old cached one - that leaves the app stuck on Loading.
            response.headers["Cache-Control"] = "no-cache"
        response.headers.update({"X-Content-Type-Options": "nosniff", "X-Frame-Options": "SAMEORIGIN", "Referrer-Policy": "strict-origin-when-cross-origin"})
        return response

    @app.get("/health", include_in_schema=False)
    def health():
        return {"ok": True, "service": gw.cfg.service_name}

    @app.get("/metrics", include_in_schema=False)
    def metrics():
        from grepx_web_bootstrap import prometheus_text
        return PlainTextResponse(prometheus_text(gw.cfg.service_name))

    for router in [*COMMON_ROUTERS, *product_routers]:
        app.include_router(router, prefix="/api/v1")

    from .ops import mount_ops
    mount_ops(app, gw)

    if web_dir is not None and web_dir.exists():          # the shared web UI, branded for this product
        if product_dir is not None:                        # the product's own screens: modules/ + product.json, in its repo
            app.mount(f"/assets/modules/{product}", StaticFiles(directory=product_dir / "modules"), name="product-web")
        app.mount("/assets", StaticFiles(directory=web_dir), name="web")

        from .pwa import mount_pwa                         # installable as a phone app: manifest, icon, service worker
        mount_pwa(app, lambda: product_dir / "product.json" if product_dir is not None else web_dir / "products" / f"{product}.json")

        @app.get("/product.json", include_in_schema=False)
        def product_config():
            return FileResponse(product_dir / "product.json" if product_dir is not None else web_dir / "products" / f"{product}.json")

        @app.get("/{path:path}", include_in_schema=False)
        def spa(path: str):
            return HTMLResponse(build.index(web_dir / "index.html"), headers={"Cache-Control": "no-cache"})
    return app


VERSIONED = "/assets/v/"
SLOW_MS = float(os.environ.get("GREPX_SLOW_MS", "1000"))        # API calls slower than this are logged (grepx.slow)
slow_log = logging.getLogger("grepx.slow")


class WebBuild:
    """The web app is ~200 small ES modules. Asking for each on every load (304s) is slow over a long link, and caching
    them plainly risks mixing old and new modules after an update. So the page names a build - a hash of every web
    file's size and time - and an import map sends every /assets/ import to /assets/v/<build>/, cached for good; the
    next update is a new build, new URLs. Checked at most every few seconds, so an edited file shows on the next load."""

    def __init__(self, roots: list[Path]):
        self.roots, self._tag, self._at = roots, "", 0.0

    def tag(self) -> str:
        import hashlib
        import time
        if time.monotonic() - self._at > 3:
            h = hashlib.sha1()
            for root in self.roots:
                for f in sorted(root.rglob("*")):
                    if f.suffix in (".js", ".css", ".json", ".html", ".svg", ".png", ".woff2") and f.is_file():
                        st = f.stat()
                        h.update(f"{f.relative_to(root)}|{st.st_size}|{st.st_mtime_ns}".encode())
            self._tag, self._at = h.hexdigest()[:12], time.monotonic()
        return self._tag

    def index(self, path: Path) -> str:
        v = f"{VERSIONED}{self.tag()}/"
        importmap = ('<script type="importmap">{"imports": {"/assets/v/": "/assets/v/", "/assets/": "%s"}}</script>' % v)
        html = path.read_text(encoding="utf-8")
        html = html.replace('<link rel="stylesheet" href="/assets/ui.css">', f'<link rel="stylesheet" href="{v}ui.css">')
        return html.replace('<script type="module" src="/assets/app.js"></script>', f'{importmap}\n  <script type="module" src="{v}app.js"></script>')
