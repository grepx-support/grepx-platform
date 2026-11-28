# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""The shared attachments router: who may see, open, attach and delete is the product's rule, never any member (SEC-02,
OS-01); another business's file is absent; only images and PDFs open in the page (SEC-04)."""
import base64

import grepx_contracts as gc
from fastapi import Depends, FastAPI, Header
from fastapi.testclient import TestClient

from grepx_bff.attachments import attachments_router
from grepx_bff.errors import ApiError

FILE = gc.media.MediaKind.FILE.value
ROLES = {"owner": ["manage_business"], "engineer": ["manage_seas", "seas"], "analyst": ["seas"], "viewer": ["markets"]}


class Store(dict):
    def put(self, key, data): self[key] = data
    def get(self, key, default=None): return super().get(key, default)


class Gw:
    def __init__(self):
        self.storage, self.media = Store(), {}
        self.add("m1", "t1", "sea:1", "report.pdf", "application/pdf")
        self.add("m2", "t1", "sea:1", "page.html", "text/html")
        self.add("m3", "t2", "sea:9", "theirs.pdf", "application/pdf")
        self.add("m4", "t1", "private:1", "secret.pdf", "application/pdf")

    def add(self, key, owner, ref, name, kind):
        self.media[key] = {"_key": key, "owner_id": owner, "ref": ref, "name": name, "content_type": kind, "kind": FILE, "key": f"k/{key}", "at": key}
        self.storage.put(f"k/{key}", b"%PDF-1" if kind == "application/pdf" else b"<script>x</script>")

    def one(self, table, key): return self.media.get(key)
    def rows(self, table, owner_id, ref=None): return [r for r in self.media.values() if r["owner_id"] == owner_id and (ref is None or r["ref"] == ref)]
    def limit(self, *a, **k): pass


class K:
    def __init__(self, gw, role, tenant):
        self.gw, self.tenant, self.perms, self.name, self.sent = gw, tenant, ROLES[role], role, []

    def can(self, p): return p in self.perms

    def cmd(self, table, service, fields):
        self.sent.append(fields)
        return {"media_id": "new", "name": fields.get("name", ""), "ref": fields.get("ref", "")}


def client(can_see=None):
    gw = Gw()

    def user(x_role: str = Header("owner"), x_tenant: str = Header("t1")):
        return K(gw, x_role, x_tenant)

    def allow(*perms):
        def check(k=Depends(user)):
            if perms and not any(k.can(p) for p in perms):
                raise ApiError("FORBIDDEN", 403)
            return k
        return check

    app = FastAPI()

    @app.exception_handler(ApiError)
    async def as_json(request, exc):
        from fastapi.responses import JSONResponse
        return JSONResponse({"detail": exc.detail}, status_code=exc.status_code)

    app.include_router(attachments_router(allow, see=("seas", "manage_seas", "manage_business"), change=("manage_seas", "manage_business"), can_see=can_see), prefix="/api/v1")
    return TestClient(app), gw


def as_(role, tenant="t1"):
    return {"x-role": role, "x-tenant": tenant}


def test_who_may_do_what():
    c, _ = client()
    data = {"ref": "sea:1", "name": "a.pdf", "data": "data:application/pdf;base64," + base64.b64encode(b"%PDF-1").decode()}
    expect = {"owner": (200, 200, 200, 200), "engineer": (200, 200, 200, 200), "analyst": (200, 200, 403, 403), "viewer": (403, 403, 403, 403)}
    for role, (lst, get, post, delete) in expect.items():
        assert c.get("/api/v1/attachments", headers=as_(role)).status_code == lst, role
        assert c.get("/api/v1/attachments/m1/file", headers=as_(role)).status_code == get, role
        assert c.post("/api/v1/attachments", headers=as_(role), json=data).status_code == post, role
        assert c.delete("/api/v1/attachments/m1", headers=as_(role)).status_code == delete, role


def test_another_business_file_is_absent():
    c, _ = client()
    names = [f["name"] for f in c.get("/api/v1/attachments", headers=as_("owner")).json()["files"]]
    assert "theirs.pdf" not in names
    assert c.get("/api/v1/attachments/m3/file", headers=as_("owner")).status_code == 404
    assert c.delete("/api/v1/attachments/m3", headers=as_("owner")).status_code == 404


def test_only_images_and_pdfs_open_in_the_page():
    c, _ = client()
    pdf, page = c.get("/api/v1/attachments/m1/file", headers=as_("owner")), c.get("/api/v1/attachments/m2/file", headers=as_("owner"))
    assert pdf.headers["content-disposition"].startswith("inline") and page.headers["content-disposition"].startswith("attachment")
    for r in (pdf, page):
        assert r.headers["x-content-type-options"] == "nosniff" and r.headers["content-security-policy"].startswith("sandbox")


def test_a_per_record_rule_hides_files_everywhere():
    c, _ = client(can_see=lambda k, row: not row["ref"].startswith("private:") or k.can("manage_business"))
    assert "secret.pdf" not in [f["name"] for f in c.get("/api/v1/attachments", headers=as_("engineer")).json()["files"]]
    assert c.get("/api/v1/attachments/m4/file", headers=as_("engineer")).status_code == 404
    data = {"ref": "private:1", "name": "x.pdf", "data": "data:application/pdf;base64,JVBERi0x"}
    assert c.post("/api/v1/attachments", headers=as_("engineer"), json=data).status_code == 403
    assert c.get("/api/v1/attachments/m4/file", headers=as_("owner")).status_code == 200
