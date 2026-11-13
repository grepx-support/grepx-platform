# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""Delivery channels for the platform operator: email (SMTP), SMS (Twilio), WhatsApp (Meta Cloud API or Twilio).
Settings are stored by settings-service (secrets sealed here with the platform key, never sent back to a browser) and
used by notification-service; "test" signs in to the provider, "send-test" sends one real message."""
import grepx_contracts as gc
from fastapi import APIRouter, Depends

from grepx_auth import is_sealed
from grepx_bff.errors import ApiError
from grepx_bff.security import Principal, admin, gateway

router = APIRouter(prefix="/admin/integrations", tags=["integrations"])

# channel -> (label, [(setting, label, secret, hint)], what makes it live)
CHANNELS = {
    "email": ("Email (SMTP)", [("SMTP_HOST", "Server", False, "smtp.gmail.com, smtp.zoho.com, smtp.sendgrid.net"), ("SMTP_PORT", "Port", False, "587 (STARTTLS) or 465 (SSL)"),
                               ("SMTP_USER", "User name", False, ""), ("SMTP_PASS", "Password / app password", True, ""), ("SMTP_FROM", "Send as", False, "orders@yourbusiness.com")],
              [["SMTP_HOST", "SMTP_FROM"]]),
    "sms": ("SMS (Twilio)", [("TWILIO_SID", "Account SID", False, "AC..."), ("TWILIO_TOKEN", "Auth token", True, ""), ("TWILIO_SMS_FROM", "From number", False, "+1...")],
            [["TWILIO_SID", "TWILIO_TOKEN", "TWILIO_SMS_FROM"]]),
    "whatsapp": ("WhatsApp", [("WHATSAPP_PROVIDER", "Provider", False, "meta or twilio (empty: whichever is set up)"),
                              ("WHATSAPP_TOKEN", "Meta access token", True, "WhatsApp Cloud API, permanent token"), ("WHATSAPP_PHONE_ID", "Meta phone number ID", False, ""),
                              ("TWILIO_WHATSAPP_FROM", "Twilio WhatsApp number", False, "uses the SMS Twilio account")],
                 [["WHATSAPP_TOKEN", "WHATSAPP_PHONE_ID"], ["TWILIO_SID", "TWILIO_TOKEN", "TWILIO_WHATSAPP_FROM"]]),
}
NAMES = {name for _, fields, _ in CHANNELS.values() for name, *_ in fields}


def saved(gw) -> dict[str, dict]:
    return {r["_key"]: r for r in gw.read.rows(gc.settings.APP_SETTINGS)}


def view(rows: dict[str, dict]) -> list[dict]:
    has = lambda n: bool((rows.get(n) or {}).get("value"))
    out = []
    for key, (label, fields, live) in CHANNELS.items():
        out.append({"channel": key, "label": label, "live": any(all(has(n) for n in group) for group in live),
                    "fields": [{"name": n, "label": l, "secret": s, "hint": hint, "set": has(n),
                                "value": "" if s or is_sealed((rows.get(n) or {}).get("value", "")) else (rows.get(n) or {}).get("value", "")} for n, l, s, hint in fields]})
    return out


@router.get("")
def channels(user: Principal = Depends(admin), gw=Depends(gateway)):
    return view(saved(gw))


@router.put("")
def save(body: dict, user: Principal = Depends(admin), gw=Depends(gateway)):
    """{values: {SETTING: value}} - a secret left empty keeps what is saved; other fields are saved as typed."""
    secrets = {n for _, fields, _ in CHANNELS.values() for n, _, s, _ in fields if s}
    for name, value in (body.get("values") or {}).items():
        if name not in NAMES:
            raise ApiError("UNKNOWN_SETTING", 400)
        value = str(value or "").strip()
        if name in secrets and not value:
            continue
        gw.command(gc.settings.REQUESTS, gc.settings.SERVICE, {"action": "SET", "name": name, "secret": name in secrets, "actor_id": user.user_id,
                                                               "value": gw.box.seal(value) if name in secrets else value})
    return view(saved(gw))


@router.post("/{channel}/test")
def test(channel: str, user: Principal = Depends(admin), gw=Depends(gateway)):
    if channel not in CHANNELS:
        raise ApiError("UNKNOWN_CHANNEL", 404)
    """Sign in to the provider: {ok, message} - a failure carries the provider's own words (wrong password, unknown host)."""
    try:
        out = gw.command(gc.notification.REQUESTS, gc.notification.SERVICE, {"action": "TEST_CHANNEL", "channel": channel}).fields
        return {"ok": True, "message": out.get("message", "Connected")}
    except ApiError as e:
        reason = e.detail.get("reason") if isinstance(e.detail, dict) else ""
        said = e.detail.get("detail") if isinstance(e.detail, dict) else ""
        return {"ok": False, "message": "Not set up yet - save its settings first." if reason == "NOT_CONFIGURED" else said or reason or "The provider did not answer."}


@router.post("/{channel}/send-test")
def send_test(channel: str, body: dict, user: Principal = Depends(admin), gw=Depends(gateway)):
    if channel not in CHANNELS:
        raise ApiError("UNKNOWN_CHANNEL", 404)
    return gw.command(gc.notification.REQUESTS, gc.notification.SERVICE, {"action": "TEST_SEND", "channel": channel,
                                                                         "recipient": str(body.get("recipient") or "")}).fields
