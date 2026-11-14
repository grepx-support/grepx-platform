# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""Who is calling: bearer token → Principal (role from the token, permissions from access-service's projection)."""
from __future__ import annotations
import grepx_contracts as gc

from dataclasses import dataclass, field
from typing import Optional

from fastapi import Depends, Header, Request
from grepx_auth import InvalidToken
from grepx_common import Roles

from grepx_bff.errors import ApiError


@dataclass
class Principal:
    user_id: str
    role: str
    perms: list[str] = field(default_factory=list)
    roles: Roles = field(default_factory=Roles)
    tenant: str = ""            # the organisation the login belongs to (auth-service puts it in the token); "" = the platform
    support: bool = False       # a platform admin working inside `tenant` with a support token (see support.py)
    read_only: bool = False     # ... that may look but not change anything
    name: str = ""              # shown as who did it when there is no person (an API key's name)

    @property
    def is_staff(self) -> bool:
        return self.roles.is_staff(self.role)

    @property
    def is_admin(self) -> bool:
        return self.role == self.roles.admin

    def can(self, perm: str) -> bool:
        return self.is_admin or "*" in self.perms or perm in self.perms


def gateway(request: Request):
    return request.app.state.gateway


READS = ("GET", "HEAD", "OPTIONS")


def key_principal(request: Request, gw, value: str) -> Principal:
    """An API key acts for its organisation as staff with every permission it is given; a read key cannot change anything."""
    from grepx_bff import api_keys
    row = api_keys.check(gw, value)
    roles = Roles.of(gw.cfg)
    user = Principal(f"api:{row['_key']}", roles.staff[0], ["*"], roles, str(row.get("tenant_id") or ""), read_only=row.get("scope") != "write",
                     name=f"API: {row.get('name', '')}")
    if user.read_only and request.method not in READS:
        raise ApiError("READ_ONLY_KEY", 403)
    return user


def optional_user(request: Request, authorization: Optional[str] = Header(default=None), x_api_key: Optional[str] = Header(default=None),
                  gw=Depends(gateway)) -> Optional[Principal]:
    if x_api_key:
        return key_principal(request, gw, x_api_key)
    if authorization and authorization.lower().startswith("bearer gx_"):
        return key_principal(request, gw, authorization[7:].strip())
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    try:
        claims = gw.tokens.verify(authorization[7:].strip())
    except InvalidToken:
        raise ApiError("INVALID_SESSION", 401)
    access = gw.one(gc.access.USER_ACCESS, claims["sub"]) or {}
    roles = Roles.of(gw.cfg)
    user = Principal(claims["sub"], access.get("role") or claims.get("role") or roles.member, list(access.get("effective") or []), roles,
                     str(claims.get("tenant") or ""))
    if claims.get("act_tenant"):
        user = support_principal(user, claims)
        if user.read_only and request.method not in READS:
            raise ApiError("READ_ONLY_SUPPORT", 403)
    return user


def support_principal(user: Principal, claims: dict) -> Principal:
    """A support token: a platform admin (no organisation of their own) sees one organisation with every permission."""
    if not user.is_admin or user.tenant:
        raise ApiError("INVALID_SESSION", 401)              # only the platform's own admins can hold one
    return Principal(user.user_id, user.role, ["*"], user.roles, str(claims["act_tenant"]), support=True,
                     read_only=claims.get("support") != "edit")


def current_user(user: Optional[Principal] = Depends(optional_user)) -> Principal:
    if user is None:
        raise ApiError("LOGIN_REQUIRED", 401)
    return user


def require(perm: str = ""):
    def check(user: Principal = Depends(current_user)) -> Principal:
        if not user.is_staff or (perm and not user.can(perm)):
            raise ApiError("FORBIDDEN", 403)
        return user
    return check


def admin(user: Principal = Depends(current_user)) -> Principal:
    if not user.is_admin:
        raise ApiError("FORBIDDEN", 403)
    return user
