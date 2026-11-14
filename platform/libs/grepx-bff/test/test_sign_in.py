# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

from grepx_bff.routers import sign_in
from grepx_bff.routers.auth import session
from grepx_bff.routers.integrations import view


def test_only_switched_on_providers_get_a_button(monkeypatch):
    monkeypatch.setattr(sign_in, "_authorize_endpoint", lambda issuer: f"{issuer}/authorize")
    assert sign_in.providers({}) == []
    got = sign_in.providers({"GOOGLE_CLIENT_ID": "g", "MICROSOFT_CLIENT_ID": "m", "MICROSOFT_TENANT": "t1",
                             "OIDC_CLIENT_ID": "c", "OIDC_ISSUER": "https://okta.x", "OIDC_LABEL": "Okta"})
    assert [(p["id"], p["label"]) for p in got] == [("google", "Google"), ("microsoft", "Microsoft"), ("company", "Okta")]
    assert got[1]["authorize"] == "https://login.microsoftonline.com/t1/oauth2/v2.0/authorize" and got[2]["authorize"] == "https://okta.x/authorize"
    assert [p["id"] for p in sign_in.providers({"OIDC_CLIENT_ID": "c"})] == []


def test_login_answer_asks_for_the_code_when_two_step_is_on():
    verdict = type("V", (), {"fields": {"two_step": True, "challenge_enc": "sealed"}})()
    assert session(None, verdict) == {"two_step": True, "challenge": "sealed"}


def test_sign_in_providers_are_on_the_integrations_page():
    rows = {"GOOGLE_CLIENT_ID": {"value": "g"}}
    google = next(c for c in view(rows) if c["channel"] == "google")
    assert google["live"] and google["sign_in"] and not next(c for c in view(rows) if c["channel"] == "microsoft")["live"]
