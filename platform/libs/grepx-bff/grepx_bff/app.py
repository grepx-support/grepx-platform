# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""create_app — one FastAPI app per product: common routers + the product's own, one trace id per request."""
from __future__ import annotations

import json
import logging
import os
import posixpath
import re
import time
from pathlib import Path
from typing import Callable, Iterable, Optional

from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import HTMLResponse
from fastapi.responses import FileResponse, PlainTextResponse
from fastapi.staticfiles import StaticFiles
from grepx_service import new_key
from starlette.concurrency import run_in_threadpool

from .edge import cors_origins, harden
from .gateway import CURRENT_TRACE, Gateway
from .routers import COMMON_ROUTERS


def create_app(gw: Gateway, product_routers: Iterable[APIRouter], title: str, web_dir: Optional[Path] = None,
               product: str = "", product_dir: Optional[Path] = None) -> FastAPI:
    """web_dir: the shared web shell (grepx-platform web/); product_dir: the product's modules/ and product.json."""
    app = FastAPI(title=title, version="1.0")
    app.state.gateway = gw
    app.add_middleware(CORSMiddleware, allow_origins=cors_origins(), allow_methods=["*"], allow_headers=["*"], expose_headers=["X-Trace-Id"])
    app.add_middleware(GZipMiddleware, minimum_size=1024, compresslevel=6)     # modules, styles and big lists: about a quarter of the bytes

    product_json = (lambda: product_dir / "product.json") if product_dir is not None else (lambda: web_dir / "products" / f"{product}.json")
    mounts = {**({f"/assets/modules/{product}/": product_dir / "modules"} if product_dir is not None else {}), "/assets/": web_dir}
    build = WebBuild([d for d in (web_dir, product_dir) if d is not None], mounts if web_dir is not None else {}, product_json)

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

    harden(app, gw)                                    # every product: security headers, per-page CSP, failed sign-in limit (edge/)

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
log = logging.getLogger("grepx.web")


class WebBuild:
    """The web app is ~200 small ES modules. Asking for each on every load (304s) is slow over a long link, and caching
    them plainly risks mixing old and new modules after an update. So the page names a build - a hash of every web
    file's size and time - and an import map sends every /assets/ import to /assets/v/<build>/, cached for good; the
    next update is a new build, new URLs. Checked at most every few seconds, so an edited file shows on the next load.

    A first visit is the slow one: the browser found the modules a layer at a time (app.js -> product.json -> every
    page module -> what each imports...), one round trip per layer. So the page also lists every module it will need
    (modulepreload - fetched all at once from the start) and carries product.json inside it (one round trip less)."""

    def __init__(self, roots: list[Path], mounts: Optional[dict] = None, product_json: Optional[Callable[[], Path]] = None):
        self.roots, self._tag, self._at = roots, "", 0.0
        self.mounts, self.product_json = mounts or {}, product_json
        self._head: tuple[str, str] = ("", "")

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
        importmap += self.head(v)
        html = path.read_text(encoding="utf-8")
        html = html.replace('<link rel="stylesheet" href="/assets/ui.css">', f'<link rel="stylesheet" href="{v}ui.css">')
        return html.replace('<script type="module" src="/assets/app.js"></script>', f'{importmap}\n  <script type="module" src="{v}app.js"></script>')

    def head(self, v: str) -> str:
        """product.json inline and a modulepreload for every module the app imports at start - worked out once a build."""
        if self._head[0] == v or not self.mounts or self.product_json is None:
            return self._head[1] if self._head[0] == v else ""
        try:
            product = json.loads(self.product_json().read_text(encoding="utf-8"))
            starts = ["/assets/app.js", *(f"/assets/modules/{m}.js" for m in product.get("modules") or [])]
            links = "".join(f'<link rel="modulepreload" href="{v}{url[len("/assets/"):]}">' for url in module_graph(starts, self.mounts))
            inline = "<script>window.GREPX_PRODUCT = %s;</script>" % json.dumps(product).replace("</", "<\\/")
            self._head = (v, f"\n  {inline}\n  {links}")
        except Exception as exc:                          # a page that still works the slow way beats no page
            log.warning("web: no preload list (%s)", exc)
            self._head = (v, "")
        return self._head[1]


IMPORTS = re.compile(r"""(?:^|[;\s])(?:import|export)\s*(?:[\w*{}\s,$]*?\sfrom\s*)?["']([^"']+\.js)["']""", re.M)


def module_graph(starts: list[str], mounts: dict) -> list[str]:
    """Every module reachable by static imports from `starts` (URLs under /assets/), in the order found. Dynamic
    import() is left to load when it is needed."""
    def file_of(url: str) -> Optional[Path]:
        for prefix, root in mounts.items():
            if url.startswith(prefix):
                return Path(root) / url[len(prefix):]
        return None
    seen: list[str] = []
    todo = list(starts)
    while todo:
        url = todo.pop(0)
        if url in seen:
            continue
        f = file_of(url)
        if f is None or not f.is_file():
            continue
        seen.append(url)
        for spec in IMPORTS.findall(f.read_text(encoding="utf-8")):
            if spec.startswith("/assets/v/") or "://" in spec:
                continue
            nxt = posixpath.normpath(posixpath.join(posixpath.dirname(url), spec)) if spec.startswith(".") else spec
            if nxt.startswith("/assets/") and nxt not in seen:
                todo.append(nxt)
    return seen
