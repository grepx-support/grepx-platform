# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""Integrations view: which channels are live, and secrets never leave the server."""
from grepx_bff.routers.integrations import view


def test_live_channels_and_hidden_secrets():
    rows = {"SMTP_HOST": {"value": "smtp.zoho.com"}, "SMTP_FROM": {"value": "a@b.sg"}, "SMTP_PASS": {"value": "sealed:v1:abc"},
            "WHATSAPP_TOKEN": {"value": "sealed:v1:xyz"}, "TWILIO_SID": {"value": "AC1"}}
    got = {c["channel"]: c for c in view(rows)}
    assert got["email"]["live"] and not got["sms"]["live"] and not got["whatsapp"]["live"]
    pw = next(f for f in got["email"]["fields"] if f["name"] == "SMTP_PASS")
    assert pw == {**pw, "set": True, "value": "", "secret": True}
    assert next(f for f in got["email"]["fields"] if f["name"] == "SMTP_HOST")["value"] == "smtp.zoho.com"
    rows["WHATSAPP_PHONE_ID"] = {"value": "123"}
    assert {c["channel"]: c for c in view(rows)}["whatsapp"]["live"]
