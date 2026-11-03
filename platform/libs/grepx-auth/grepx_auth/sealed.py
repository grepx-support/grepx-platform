# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""Sealed setting values: "enc:" + SecretBox text, so secrets saved on the admin pages stay unreadable in Nexus rows.

    seal_value("s3cret") -> "enc:..."     open_value("enc:...") -> "s3cret"     open_value("plain") -> "plain"
    open_settings(rows)  -> {key: opened value} for settings-service's app_settings rows
"""
from __future__ import annotations

from typing import Iterable, Optional

from .secret_box import SecretBox

PREFIX = "enc:"


def is_sealed(value) -> bool:
    return str(value or "").startswith(PREFIX)


def seal_value(value: str, box: Optional[SecretBox] = None) -> str:
    return PREFIX + (box or SecretBox.from_env()).seal(value) if value else ""


def open_value(value, box: Optional[SecretBox] = None) -> str:
    text = str(value or "")
    return (box or SecretBox.from_env()).open(text[len(PREFIX):]) if is_sealed(text) else text


def open_settings(rows: Iterable[dict], key: str = "_key") -> dict[str, str]:
    box = SecretBox.from_env()
    return {r[key]: open_value(r.get("value"), box) for r in rows}
