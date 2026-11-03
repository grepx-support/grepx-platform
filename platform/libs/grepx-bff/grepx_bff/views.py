# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""Generic read-model helpers for any product BFF."""
from __future__ import annotations

from typing import Optional

from grepx_service import state_of

_hidden: set = set()


def register_hidden(*fields: str) -> None:
    """Fields a product never sends to clients (secrets such as calendar tokens)."""
    _hidden.update(fields)


def clean(row: Optional[dict], keep: tuple = ()) -> Optional[dict]:
    if row is None:
        return None
    out = {k: v for k, v in state_of(row).items() if k not in _hidden}
    out["id"] = row.get("_key")
    return {k: out[k] for k in keep + ("id",) if k in out} if keep else out


def media_url(gw, ref: str) -> str:
    return ref if not ref or ref.startswith("http") else f"/api/v1/media/{ref}"
