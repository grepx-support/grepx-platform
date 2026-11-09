# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""create_app — one FastAPI app per product: common routers + the product's own, one trace id per request."""
from __future__ import annotations

from pathlib import Path
from typing import Iterable, Optional

from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, PlainTextResponse
from fastapi.staticfiles import StaticFiles
from grepx_service import new_key

from .gateway import CURRENT_TRACE, Gateway
from .routers import COMMON_ROUTERS


def create_app(gw: Gateway, product_routers: Iterable[APIRouter], title: str, web_dir: Optional[Path] = None,
               product: str = "", product_dir: Optional[Path] = None) -> FastAPI:
    """web_dir: the shared web shell (grepx-platform web/); product_dir: the product's modules/ and product.json."""
    app = FastAPI(title=title, version="1.0")
    app.state.gateway = gw
    app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"], expose_headers=["X-Trace-Id"])

    @app.middleware("http")
    async def trace_and_headers(request, call_next):
        trace_id = "".join(c for c in request.headers.get("x-trace-id", "") if c.isalnum() or c in "-_")[:64] or new_key()
        token = CURRENT_TRACE.set(trace_id)
        try:
            response = await call_next(request)
        finally:
            CURRENT_TRACE.reset(token)
        response.headers["X-Trace-Id"] = trace_id
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

        @app.get("/product.json", include_in_schema=False)
        def product_config():
            return FileResponse(product_dir / "product.json" if product_dir is not None else web_dir / "products" / f"{product}.json")

        @app.get("/{path:path}", include_in_schema=False)
        def spa(path: str):
            return FileResponse(web_dir / "index.html")
    return app
