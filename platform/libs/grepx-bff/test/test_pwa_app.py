# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""The phone app pieces: the manifest, and the Android app (built by scripts/run.sh apk) downloaded from /app.apk."""
import json

from fastapi import FastAPI
from fastapi.testclient import TestClient

from grepx_bff.pwa import mount_pwa


def test_manifest_and_android_app(tmp_path, monkeypatch):
    product = tmp_path / "product.json"
    product.write_text(json.dumps({"name": "GrepX FleetWise", "theme": {"primary": "#0f766e"}}))
    monkeypatch.setenv("GREPX_HOME", str(tmp_path))
    app = FastAPI()
    mount_pwa(app, lambda: product)
    web = TestClient(app)
    assert web.get("/manifest.webmanifest").json()["theme_color"] == "#0f766e"
    missing = web.get("/app.apk")
    assert missing.status_code == 404 and "scripts/run.sh apk" in missing.text
    (tmp_path / "build" / "mobile").mkdir(parents=True)
    (tmp_path / "build" / "mobile" / "fleetwise.apk").write_bytes(b"PK-apk")
    got = web.get("/app.apk")
    assert got.status_code == 200 and got.content == b"PK-apk" and got.headers["content-type"] == "application/vnd.android.package-archive"
    assert 'filename="FleetWise.apk"' in got.headers["content-disposition"]
