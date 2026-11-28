# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""The edge layer every product gets: headers, a CSP per page with its inline scripts by hash, the CSP report endpoint,
the failed sign-in limit per address, and the CORS origin list."""
from fastapi import FastAPI
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.testclient import TestClient

from grepx_bff.edge import EdgeOptions, FailureWindow, RateWindow, cors_origins, harden, sha256

PAGE = "<html><head><script>window.a=1</script><script src='/x.js'></script></head><body><b onclick=\"go()\">x</b>" + "pad" * 600 + "</body></html>"


def app_with(mode="report-only", **extra):
    app = FastAPI()
    app.add_middleware(GZipMiddleware, minimum_size=100)

    @app.get("/")
    def page():
        return HTMLResponse(PAGE)

    @app.get("/api/v1/thing")
    def thing():
        return {"ok": True}

    @app.post("/api/v1/auth/login")
    def login(body: dict):
        return JSONResponse({"ok": body.get("pw") == "right"}, status_code=200 if body.get("pw") == "right" else 401)

    harden(app, options=EdgeOptions(mode=mode, **extra))
    return TestClient(app)


def test_a_page_gets_its_own_policy_with_inline_scripts_by_hash():
    r = app_with(connect=("https://tiles.example",)).get("/")
    csp = r.headers["content-security-policy-report-only"]
    assert sha256("window.a=1") in csp and sha256("go()") in csp and "'unsafe-hashes'" in csp
    script = next(d for d in csp.split("; ") if d.startswith("script-src"))
    assert "'unsafe-inline'" not in script and "unsafe-eval" not in csp
    assert "connect-src 'self' https://tiles.example" in csp and "frame-ancestors 'none'" in csp
    assert r.headers["permissions-policy"].startswith("geolocation") and r.text == PAGE       # gzip undone for hashing, page intact


def test_enforce_and_off():
    assert "content-security-policy" in app_with("enforce").get("/").headers
    off = app_with("off").get("/").headers
    assert "content-security-policy" not in off and "content-security-policy-report-only" not in off
    assert "content-security-policy-report-only" not in app_with().get("/api/v1/thing").headers   # JSON answers carry none


def test_failed_sign_ins_are_limited_per_address_but_successes_are_not():
    c = app_with()
    for _ in range(25):
        assert c.post("/api/v1/auth/login", json={"pw": "right"}).status_code == 200
    codes = [c.post("/api/v1/auth/login", json={"pw": "wrong"}).status_code for _ in range(21)]
    assert codes[:20] == [401] * 20 and codes[20] == 429
    assert c.post("/api/v1/auth/login", json={"pw": "right"}).status_code == 429                  # the address waits it out


def test_public_posts_are_small():
    app = FastAPI()

    @app.post("/api/v1/public/demo")
    def demo(body: dict):
        return {"ok": True}

    harden(app, options=EdgeOptions())
    c = TestClient(app)
    assert c.post("/api/v1/public/demo", json={"name": "x"}).status_code == 200
    assert c.post("/api/v1/public/demo", content=b'{"m":"' + b"x" * 20000 + b'"}', headers={"content-type": "application/json"}).status_code == 413


def test_csp_reports_are_small_and_limited():
    c = app_with()
    ok = c.post("/api/v1/public/csp-report", json={"csp-report": {"violated-directive": "script-src", "blocked-uri": "inline"}})
    assert ok.status_code == 204
    assert c.post("/api/v1/public/csp-report", content=b"x" * 9000).status_code == 413
    assert c.post("/api/v1/public/csp-report", content=b"{not json").status_code == 400


def test_windows_age_out():
    now = [0.0]
    w = FailureWindow(2, 10, clock=lambda: now[0])
    w.fail("a"); w.fail("a")
    assert w.blocked("a") and not w.blocked("b")
    now[0] = 11
    assert not w.blocked("a")
    r = RateWindow(1, 10, clock=lambda: now[0])
    assert r.take("x") and not r.take("x")


def test_cors_origins_from_env():
    assert cors_origins({}) == ["*"]
    assert cors_origins({"CORS_ORIGINS": "https://a.grepx.sg/, https://b.grepx.sg"}) == ["https://a.grepx.sg", "https://b.grepx.sg"]


def test_options_read_config_and_env():
    class Cfg(dict):
        pass
    o = EdgeOptions.read(Cfg(edge={"connect": ["https://t"], "csp_mode": "enforce"}), env={"SITE_URL": "https://studio.grepx.sg"})
    assert o.connect == ("https://t",) and o.header == "Content-Security-Policy" and o.public
    assert not EdgeOptions.read(None, env={"SITE_URL": "http://localhost:8890"}).public
