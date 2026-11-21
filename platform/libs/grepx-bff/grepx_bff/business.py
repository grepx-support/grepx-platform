# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""The signed-in business user, shared by every business product (kitchen, electronics, ...): who, which business,
what they may do - and commands that always carry the business.

Every request carries tenant_id = the user's business (from the login token, never from the client) and every read
filters by it, so one business never sees another's rows. A product extends Business with its own helpers and points
its routers at its own user dependency; the shared routers (team, roster, leave, payroll, my work, funds) use this one.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable, Optional, Type, TypeVar

import grepx_contracts as gc
from fastapi import APIRouter, Depends

from .errors import ApiError
from .security import Principal, current_user, gateway

B = TypeVar("B", bound="Business")


@dataclass
class Business:
    user: Principal
    gw: Any
    business: dict
    name: str

    @property
    def tenant(self) -> str:
        return self.user.tenant

    def can(self, perm: str) -> bool:
        return perm in self.user.perms or "*" in self.user.perms

    def feature(self, module: str) -> bool:
        return bool((self.business.get("modules") or {}).get(module, True))

    def cmd(self, table: str, service: str, fields: dict, key: Optional[str] = None) -> dict:
        return self.gw.command(table, service, {**fields, "tenant_id": self.tenant, "actor_id": self.user.user_id,
                                                "actor_name": self.name}, key=key).fields

    def cmds(self, *calls: tuple[str, str, dict]) -> list[dict]:
        """Independent commands at once - k.cmds((table, service, fields), ...) -> their answers in order: a dashboard
        waits for the slowest answer, not for each in turn."""
        mine = {"tenant_id": self.tenant, "actor_id": self.user.user_id, "actor_name": self.name}
        return [v.fields for v in self.gw.commands([(t, s, {**f, **mine}) for t, s, f in calls])]

    def rows(self, table: str, criteria: str = "", **eq) -> list[dict]:
        return self.gw.rows(table, criteria, tenant_id=self.tenant, **eq)

    def one(self, table: str, key: str) -> Optional[dict]:
        row = self.gw.one(table, key)
        return row if row and row.get("tenant_id") == self.tenant else None

    def location(self, key: str) -> dict:
        row = self.one(gc.business.LOCATIONS, key)
        if row is None:
            raise ApiError("UNKNOWN_LOCATION", 404)
        return row

    def places(self) -> dict[str, dict]:
        return {r["_key"]: r for r in self.rows(gc.business.LOCATIONS)}


def signed_in(kind: Type[B]) -> Callable[..., B]:
    """The FastAPI dependency that builds kind (Business or a product's subclass) for the signed-in user."""
    def dependency(user: Principal = Depends(current_user), gw=Depends(gateway)) -> B:
        if not user.tenant:
            raise ApiError("MISSING_TENANT", 403)
        business = gw.one(gc.business.BUSINESSES, user.tenant)
        if business is None:
            raise ApiError("UNKNOWN_BUSINESS", 403)
        if business.get("closed") and not user.support:          # closed by the platform operator; support can still look
            raise ApiError("BUSINESS_CLOSED", 403)
        person = gw.one(gc.people.PEOPLE, user.user_id) or {}
        return kind(user, gw, business, person.get("name") or user.name or "")
    return dependency


business_user = signed_in(Business)


class Access:
    """The access checks of one user dependency (the shared business_user, or a product's own): routes depend on
    allow(...), a router whose feature is switched off in Setup -> Features refuses every call (gated)."""

    def __init__(self, user_dependency: Callable):
        self.user = user_dependency

    def allow(self, *perms: str, module: str = ""):
        """The user holds one of perms (none given: any business user) and the module is switched on."""
        def check(k=Depends(self.user)):
            if module and not k.feature(module):
                raise ApiError("MODULE_OFF", 403)
            if perms and not any(k.can(p) for p in perms):
                raise ApiError("FORBIDDEN", 403)
            return k
        return check

    def feature_on(self, module: str):
        def check(k=Depends(self.user)) -> None:
            if not k.feature(module):
                raise ApiError("MODULE_OFF", 403)
        return check

    def gated(self, router: APIRouter, module: str) -> APIRouter:
        """The router's routes again, each first checking that its feature is on."""
        outer = APIRouter(dependencies=[Depends(self.feature_on(module))])
        outer.include_router(router)
        return outer

    def gate_all(self, routers: list[APIRouter], features: list[tuple[APIRouter, str]]) -> list[APIRouter]:
        """Routers in order, those listed in features wrapped by gated()."""
        gate = {id(r): f for r, f in features}
        return [self.gated(r, gate[id(r)]) if id(r) in gate else r for r in routers]


ACCESS = Access(business_user)
allow, feature_on = ACCESS.allow, ACCESS.feature_on


def listed(rows, *then: str) -> list[dict]:
    """Rows in the order the owner dragged them into (`sort`), unsorted ones after, then by the given fields."""
    return sorted(rows, key=lambda r: (r.get("sort") is None, r.get("sort") or 0, *(str(r.get(f, "")) for f in then)))
