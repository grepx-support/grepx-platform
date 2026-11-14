# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""Sign in with Google, Microsoft or the company's own sign-in (OpenID Connect): which ones the operator switched on
(Integrations page) and where the browser goes for each; then the provider's ID token is checked by auth-service.
Only people who already have an account get in (a provider login never creates a person or grants a role)."""
from functools import lru_cache

import json
import urllib.request

import grepx_contracts as gc
from fastapi import APIRouter, Depends

from grepx_auth import is_sealed
from grepx_bff.errors import ApiError
from grepx_bff.routers.auth import session
from grepx_bff.security import gateway

router = APIRouter(prefix="/auth", tags=["auth"])


@lru_cache(maxsize=4)
def _authorize_endpoint(issuer: str) -> str:
    with urllib.request.urlopen(f"{issuer.rstrip('/')}/.well-known/openid-configuration", timeout=10) as answer:   # noqa: S310 - the operator's https issuer
        return json.loads(answer.read())["authorization_endpoint"]


def plain(gw) -> dict[str, str]:
    return {r["_key"]: str(r.get("value") or "") for r in gw.read.rows(gc.settings.APP_SETTINGS)
            if r.get("value") and not is_sealed(r.get("value"))}


def providers(s: dict[str, str]) -> list[dict]:
    out = []
    if s.get("GOOGLE_CLIENT_ID"):
        out.append({"id": "google", "label": "Google", "client_id": s["GOOGLE_CLIENT_ID"], "authorize": "https://accounts.google.com/o/oauth2/v2/auth"})
    if s.get("MICROSOFT_CLIENT_ID"):
        out.append({"id": "microsoft", "label": "Microsoft", "client_id": s["MICROSOFT_CLIENT_ID"],
                    "authorize": f"https://login.microsoftonline.com/{s.get('MICROSOFT_TENANT') or 'common'}/oauth2/v2.0/authorize"})
    if s.get("OIDC_CLIENT_ID") and s.get("OIDC_ISSUER"):
        try:
            out.append({"id": "company", "label": s.get("OIDC_LABEL") or "Company login", "client_id": s["OIDC_CLIENT_ID"],
                        "authorize": _authorize_endpoint(s["OIDC_ISSUER"])})
        except Exception:      # noqa: BLE001 - the provider is down or mistyped: its button is simply not shown
            pass
    return out


@router.get("/providers")
def list_providers(gw=Depends(gateway)):
    return {"providers": providers(plain(gw))}


@router.post("/external")
def external(body: dict, gw=Depends(gateway)):
    provider = str(body.get("provider") or "")
    gw.limit(f"external:{provider}", rate=30, per=60)
    verdict = gw.command(gc.auth.REQUESTS, gc.auth.SERVICE, {"action": "LOGIN_EXTERNAL", "provider": provider,
                                                           "id_token_enc": gw.box.seal(str(body.get("id_token") or "")),
                                                           "remember": bool(body.get("remember"))})
    if verdict.fields.get("registered") is False:
        raise ApiError("NO_ACCOUNT", 403, detail=f"{verdict.fields.get('email')} has no account here yet - ask your manager to add you.")
    return session(gw, verdict)
