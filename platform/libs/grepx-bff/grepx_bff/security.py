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


def optional_user(authorization: Optional[str] = Header(default=None), gw=Depends(gateway)) -> Optional[Principal]:
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    try:
        claims = gw.tokens.verify(authorization[7:].strip())
    except InvalidToken:
        raise ApiError("INVALID_SESSION", 401)
    access = gw.one(gc.access.USER_ACCESS, claims["sub"]) or {}
    roles = Roles.of(gw.cfg)
    return Principal(claims["sub"], access.get("role") or claims.get("role") or roles.member, list(access.get("effective") or []), roles)


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
