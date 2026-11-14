# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""notify() — queue a message through the common notification-service (one row per channel).

Keys are deterministic (ref + template + channel) so a replayed decision never
sends twice. The notification-service decides whether the template is enabled,
which channels are allowed, and renders the wording. Files go along as attachments=[{name, mime, data_b64, url}]
(url: a public link for channels that fetch the file themselves, e.g. WhatsApp through Twilio).
"""
from __future__ import annotations
import grepx_contracts as gc

import hashlib
from typing import Iterable, Optional

NOTIFICATIONS_TABLE = gc.notification.NOTIFICATIONS
NOTIFICATION_SERVICE = gc.notification.SERVICE
DEFAULT_CHANNELS = ("email", "whatsapp")


def notify(emitter, template: str, *, email: str = "", phone: str = "", values: Optional[dict] = None,
           channels: Optional[Iterable[str]] = None, ref: str = "", tenant_id: str = "", user_id: str = "",
           auto: bool = True, attachments: Optional[list[dict]] = None) -> list[str]:
    keys = []
    for channel in channels or DEFAULT_CHANNELS:
        recipient = email if channel == "email" else phone
        if not recipient:
            continue
        key = hashlib.sha1(f"{ref}|{template}|{channel}|{recipient}".encode()).hexdigest()
        emitter.request(NOTIFICATIONS_TABLE, key, {
            "action": "SEND", "template": template, "channel": channel, "recipient": recipient,
            "values": values or {}, "ref": ref, "tenant_id": tenant_id, "user_id": user_id, "auto": auto,
            **({"attachments": attachments} if attachments else {})},
            NOTIFICATION_SERVICE)
        keys.append(key)
    return keys
