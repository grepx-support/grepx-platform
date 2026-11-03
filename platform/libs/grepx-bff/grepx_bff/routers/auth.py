"""Common auth routes for every product: login, forgot / reset password, change password.
(Sign-up is product-specific — each product creates its own profile first; see the product's routers/signup.py.)"""
import grepx_contracts as gc
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from grepx_bff.security import Principal, current_user, gateway

router = APIRouter(prefix="/auth", tags=["auth"])


class Login(BaseModel):
    email: str
    password: str
    remember: bool = False


def session(gw, verdict) -> dict:
    return {"token": gw.box.open(verdict.fields["token_enc"]), "user_id": verdict.fields["user_id"], "role": verdict.fields["role"],
            "expires_hours": verdict.fields["expires_hours"]}


@router.post("/login")
def login(body: Login, gw=Depends(gateway)):
    gw.limit(f"login:{body.email.lower()}", rate=10, per=60)
    return session(gw, gw.command(gc.auth.REQUESTS, gc.auth.SERVICE, {"action": "LOGIN", "email": body.email,
                                                                    "password_enc": gw.box.seal(body.password), "remember": body.remember}))


@router.post("/forgot")
def forgot(body: dict, gw=Depends(gateway)):
    gw.limit(f"forgot:{str(body.get('email', '')).lower()}", rate=1, per=60)
    gw.command(gc.auth.REQUESTS, gc.auth.SERVICE, {"action": "RESET_REQUEST", "email": body.get("email", ""), "link_base": f"{gw.site}/reset"})
    return {"message": "If that email is registered, a reset link is on its way."}


@router.post("/reset")
def reset(body: dict, gw=Depends(gateway)):
    gw.command(gc.auth.REQUESTS, gc.auth.SERVICE, {"action": "RESET_CONFIRM", "token_enc": gw.box.seal(body.get("token", "")),
                                                 "password_enc": gw.box.seal(body.get("password", ""))})
    return {"ok": True}


@router.post("/password")
def change_password(body: dict, user: Principal = Depends(current_user), gw=Depends(gateway)):
    gw.command(gc.auth.REQUESTS, gc.auth.SERVICE, {"action": "CHANGE_PASSWORD", "user_id": user.user_id,
                                                 "current_enc": gw.box.seal(body.get("current", "")), "password_enc": gw.box.seal(body.get("password", ""))})
    return {"ok": True}
