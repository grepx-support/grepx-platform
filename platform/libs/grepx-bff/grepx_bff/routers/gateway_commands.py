# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""Generic API gateway: any catalogued service's action over HTTP, for admins and integrations.

POST /api/v1/gateway/{service}/{action} with a JSON body → the request row → the verdict.
Routes come from catalog/services.json (scripts/run.sh catalog), so a new service is reachable
without writing BFF code. Product screens should still use the purpose-built routes above,
which add per-feature permission checks.
"""
import json

from fastapi import APIRouter, Depends, Header

from grepx_bff.errors import ApiError
from grepx_bff.security import Principal, admin, gateway

router = APIRouter(prefix="/gateway", tags=["gateway"])
def routes() -> dict:
    from grepx_config import workspace_root
    catalog = workspace_root() / "catalog" / "services.json"
    services = json.loads(catalog.read_text(encoding="utf-8")) if catalog.exists() else []
    return {s["name"]: s for s in services}


@router.get("")
def list_routes(user: Principal = Depends(admin)):
    return [{"service": n, "table": s["request_table"], "actions": s["actions"], "summary": s["summary"]} for n, s in routes().items()]


@router.post("/{service}/{action}")
def command(service: str, action: str, body: dict, idempotency_key: str = Header(default=""), user: Principal = Depends(admin), gw=Depends(gateway)):
    route = routes().get(service)
    if route is None or action not in route["actions"]:
        raise ApiError("UNKNOWN_ROUTE", 404)
    v = gw.command(route["request_table"], service, {**body, "action": action, "actor_id": user.user_id}, key=idempotency_key or None, ok_only=False)
    return {"ok": v.ok, "reason": v.reason if not v.ok else "", "key": v.key,
            "fields": {k: x for k, x in v.fields.items() if not k.endswith("_enc")}}
