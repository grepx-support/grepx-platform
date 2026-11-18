# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""The web app as a phone app: "Add to Home screen" / "Install app" gives every product an app icon that opens full
screen with every feature (the same pages as the web). The manifest and icon come from the product's product.json
(name, logo, colour); the service worker keeps this build's files for fast starts and shows a page when offline.
It never stores business data: /api/ always goes to the server."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Callable

from fastapi import FastAPI
from fastapi.responses import JSONResponse, Response

SW = """// GrepX app shell - caches this build's files (/assets/v/<build>/, they never change) and the page; never /api/.
const SHELL = "grepx-shell-v1";
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin || url.pathname.startsWith("/api/")) return;
  if (url.pathname.startsWith("/assets/v/")) {
    e.respondWith(caches.open(SHELL).then(async (c) => (await c.match(e.request)) || fetch(e.request).then((r) => { if (r.ok) c.put(e.request, r.clone()); return r; })));
  } else if (e.request.mode === "navigate") {
    e.respondWith(fetch(e.request).then((r) => { caches.open(SHELL).then((c) => c.put("/", r.clone())); return r; })
      .catch(async () => (await caches.match("/")) || new Response("<h1>You are offline</h1><p>Connect to the internet and try again.</p>",
        { headers: { "Content-Type": "text/html" } })));
  }
});
"""


def _icon(logo: str, colour: str) -> str:
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">'
            f'<stop offset="0" stop-color="{colour}"/><stop offset="1" stop-color="#7c3aed"/></linearGradient></defs>'
            f'<rect width="512" height="512" rx="112" fill="url(#g)"/><text x="256" y="300" font-size="250" text-anchor="middle" '
            f'dominant-baseline="middle" font-family="Apple Color Emoji,Segoe UI Emoji,Noto Color Emoji,sans-serif">{logo}</text></svg>')


def mount_pwa(app: FastAPI, product_json: Callable[[], Path]) -> None:
    def product() -> dict:
        try:
            return json.loads(product_json().read_text(encoding="utf-8"))
        except (OSError, ValueError):
            return {}

    @app.get("/manifest.webmanifest", include_in_schema=False)
    def manifest():
        p = product()
        colour = ((p.get("theme") or {}).get("primary")) or "#4f46e5"
        name = p.get("name") or "GrepX"
        tabs = [t for t in p.get("mobile_tabs") or [] if t.get("href", "").startswith("#/") and t.get("href") != "#/"][:4]
        return JSONResponse({"name": name, "short_name": p.get("short_name") or name.replace("GrepX ", "")[:12], "description": p.get("tagline", ""),
                             "start_url": "/#/", "scope": "/", "id": "/", "display": "standalone", "orientation": "portrait-primary",
                             "background_color": "#f8fafc", "theme_color": colour,
                             "icons": [{"src": "/app-icon.svg", "sizes": "any", "type": "image/svg+xml", "purpose": "any"},
                                       {"src": "/app-icon.svg", "sizes": "any", "type": "image/svg+xml", "purpose": "maskable"}],
                             "shortcuts": [{"name": t["label"], "url": "/" + t["href"]} for t in tabs]},
                            media_type="application/manifest+json")

    @app.get("/app-icon.svg", include_in_schema=False)
    def icon():
        p = product()
        return Response(_icon(p.get("logo") or "✦", ((p.get("theme") or {}).get("primary")) or "#4f46e5"), media_type="image/svg+xml",
                        headers={"Cache-Control": "public, max-age=86400"})

    @app.get("/sw.js", include_in_schema=False)
    def service_worker():
        return Response(SW, media_type="text/javascript", headers={"Cache-Control": "no-cache", "Service-Worker-Allowed": "/"})
