# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""GET /me — who is signed in (works for every product: name comes from the product's people table). A product adds to
it without changing this file (Open/Closed): `ME_EXTRAS.append(fn)`, fn(user, gw) -> dict - e.g. which features its
organisation has switched on ({"features": {name: bool}}), which the web shell uses to hide what is off."""
from fastapi import APIRouter, Depends

from grepx_bff.security import Principal, current_user, gateway
from grepx_bff.views import clean

router = APIRouter(tags=["me"])
ME_EXTRAS: list = []


@router.get("/me")
def me(user: Principal = Depends(current_user), gw=Depends(gateway)):
    person = clean(gw.one(gw.people, user.user_id)) or {}
    out = {**person, "id": user.user_id, "role": user.role, "perms": user.perms, "is_staff": user.is_staff, "tenant": user.tenant,
           "support": user.support, "read_only": user.read_only}
    for extra in ME_EXTRAS:
        out.update(extra(user, gw) or {})
    return out
