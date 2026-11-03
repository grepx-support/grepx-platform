"""Users & roles (admin): role, staff role (bundle of permissions), personal permissions, password help."""
import grepx_contracts as gc
from fastapi import APIRouter, Depends
from grepx_common import Roles

from grepx_bff.security import Principal, admin, gateway
from grepx_bff.views import clean

router = APIRouter(prefix="/admin/access", tags=["access"])


@router.get("/staff")
def staff(user: Principal = Depends(admin), gw=Depends(gateway)):
    people = []
    roles = Roles.of(gw.cfg)
    for a in gw.rows(gc.access.USER_ACCESS):
        if roles.is_staff(a.get("role", "")):
            people.append({**(clean(gw.one(gw.people, a["_key"]), ("name", "email", "phone", "photo_id")) or {"id": a["_key"]}), **clean(a)})
    return {"staff": people, "roles": [clean(r) for r in gw.rows(gc.access.STAFF_ROLES)], "permissions": [clean(p) for p in gw.rows(gc.access.PERMISSION_CATALOG)]}


@router.post("/users/{user_id}/{op}")
def user_op(user_id: str, op: str, body: dict, user: Principal = Depends(admin), gw=Depends(gateway)):
    """op: role {role} | staff-role {staff_role_id} | permission {perm, enabled} | set-password {password?} | send-reset"""
    if op in ("role", "staff-role", "permission"):
        action = {"role": "SET_ROLE", "staff-role": "SET_STAFF_ROLE", "permission": "SET_PERMISSION"}[op]
        return gw.command(gc.access.REQUESTS, gc.access.SERVICE, {"action": action, "user_id": user_id, "actor_id": user.user_id, **body}).fields
    person = gw.one(gw.people, user_id) or {}
    if op == "set-password":
        v = gw.command(gc.auth.REQUESTS, gc.auth.SERVICE, {"action": "SET_PASSWORD", "user_id": user_id, "email": person.get("email", ""),
                                                         "password_enc": gw.box.seal(body.get("password", "")) if body.get("password") else ""})
        return {"temporary_password": gw.box.open(v.fields["temp_password_enc"])}
    gw.command(gc.auth.REQUESTS, gc.auth.SERVICE, {"action": "RESET_REQUEST", "email": person.get("email", ""), "link_base": f"{gw.site}/reset"})
    return {"ok": True}


@router.post("/roles")
def save_role(body: dict, user: Principal = Depends(admin), gw=Depends(gateway)):
    action = "DELETE_ROLE" if body.get("delete") else "SAVE_ROLE"
    return gw.command(gc.access.REQUESTS, gc.access.SERVICE, {"action": action, **body}).fields


@router.get("/traces/{trace_id}")
def trace(trace_id: str, user: Principal = Depends(admin), gw=Depends(gateway)):
    """Follow one request across every service: timeline, failures (with reason) and stuck steps."""
    return gw.trace(trace_id)


@router.get("/system")
def system(user: Principal = Depends(admin), gw=Depends(gateway)):
    """Which services are up (heartbeats), their counters, and recent dead letters."""
    from nexus_api import HEALTH_TABLE, is_stale
    services = [{**{k: v for k, v in r.items() if not k.startswith("_")}, "up": not is_stale(r.get("last_seen", ""))}
                for r in gw.read.rows(HEALTH_TABLE)]
    dead = sorted(gw.read.rows("dead_letters"), key=lambda d: d.get("occurred_at", ""), reverse=True)[:20]
    return {"services": sorted(services, key=lambda s: s.get("service", "")), "down": [s["service"] for s in services if not s["up"]],
            "dead_letters": [{k: d.get(k) for k in ("service", "table", "row_key", "error", "trace_id")} for d in dead]}
