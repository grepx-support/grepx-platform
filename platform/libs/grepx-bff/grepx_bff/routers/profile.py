"""GET /me — who is signed in (works for every product: name comes from the product's people table)."""
from fastapi import APIRouter, Depends

from grepx_bff.security import Principal, current_user, gateway
from grepx_bff.views import clean

router = APIRouter(tags=["me"])


@router.get("/me")
def me(user: Principal = Depends(current_user), gw=Depends(gateway)):
    person = clean(gw.one(gw.people, user.user_id)) or {}
    return {**person, "id": user.user_id, "role": user.role, "perms": user.perms}
