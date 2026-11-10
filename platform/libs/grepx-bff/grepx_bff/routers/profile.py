# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""GET /me — who is signed in (works for every product: name comes from the product's people table)."""
from fastapi import APIRouter, Depends

from grepx_bff.security import Principal, current_user, gateway
from grepx_bff.views import clean

router = APIRouter(tags=["me"])


@router.get("/me")
def me(user: Principal = Depends(current_user), gw=Depends(gateway)):
    person = clean(gw.one(gw.people, user.user_id)) or {}
    return {**person, "id": user.user_id, "role": user.role, "perms": user.perms, "is_staff": user.is_staff, "tenant": user.tenant,
            "support": user.support, "read_only": user.read_only}
