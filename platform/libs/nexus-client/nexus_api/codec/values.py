# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""Encode/decode a single field value using Nexus's wire tag scheme
(i:/d:/b:/s:/n: only - the C++ nexus_server rejects any other tag; l:/u:/j: are still decoded for old rows).
"""
from __future__ import annotations


_UNSAFE = (";", "=", "\n", "\r")
JSON_MARK, TEXT_MARK = "~J~", "~U~"   # inside an s: value: escaped JSON / escaped text


def _needs_escape(text: str) -> bool:
    return any(ch in text for ch in _UNSAFE)


def _escape(text: str) -> str:
    from urllib.parse import quote
    return quote(text, safe=" !\"#$&'()*+,-./:<>?@[\\]^_`{|}~")


def encode_value(value) -> str:
    # Unwrap Enum (including str Enum) to its underlying value before type checks.
    # Without this, `str(RowStatus.CLAIMED)` is "RowStatus.CLAIMED" not "CLAIMED",
    # which breaks server transitions and field decoding.
    if hasattr(value, "value"):
        try:
            from enum import Enum

            if isinstance(value, Enum):
                value = value.value
        except Exception:
            pass
    # The C++ nexus_server only understands s/i/d/b/n (it answers "ERR could not parse request"
    # to l:[] and anything else). Lists and objects therefore travel as a marked s: string with
    # escaped JSON; decode_value turns them back into Python values.
    if isinstance(value, (dict, list, tuple)):
        import json
        from enum import Enum as _Enum
        def plain(v):
            if isinstance(v, _Enum):
                return v.value
            if isinstance(v, dict):
                return {str(getattr(k, "value", k)): plain(x) for k, x in v.items()}
            if isinstance(v, (list, tuple)):
                return [plain(x) for x in v]
            return v
        return "s:" + JSON_MARK + _escape(json.dumps(plain(value), separators=(",", ":"), ensure_ascii=False, default=str))
    if value is None:
        return "n:"
    if isinstance(value, bool):
        return "b:true" if value else "b:false"
    if isinstance(value, int):
        return f"i:{value}"
    if isinstance(value, float):
        return f"d:{value}"
    if isinstance(value, str):
        if _needs_escape(value) or value.startswith((JSON_MARK, TEXT_MARK)):
            return "s:" + TEXT_MARK + _escape(value)
        return f"s:{value}"
    raise TypeError(f"unsupported value type: {type(value)!r}")


def decode_value(text: str):
    tag, _, body = text.partition(":")
    if tag == "n":
        return None
    if tag == "i":
        return int(body)
    if tag == "d":
        return float(body)
    if tag == "b":
        # "true"/"false" is this module's own wire format (see
        # encode_value above); "1"/"0" is what nexus_server's C++
        # SqliteSnapshotStore writes to nexus_rows/outbox on disk (see
        # decode_storage_fields() in fields.py) — accepting both here
        # means one decode_value works for either source.
        return body in ("true", "1")
    if tag == "l":
        import json

        try:
            # JSON array – preserves element types (int vs string etc.)
            val = json.loads(body)
            # Ensure we always return a list (even if single value was encoded)
            if isinstance(val, list):
                return val
            # Defensive: if stored as non-list (legacy), wrap
            return val
        except Exception as exc:
            raise ValueError(f"invalid list encoding: {text!r}: {exc}") from exc
    if tag == "s":
        if body.startswith(JSON_MARK):
            import json
            from urllib.parse import unquote
            return json.loads(unquote(body[len(JSON_MARK):]))
        if body.startswith(TEXT_MARK):
            from urllib.parse import unquote
            return unquote(body[len(TEXT_MARK):])
        return body
    if tag == "u":
        from urllib.parse import unquote
        return unquote(body)
    if tag == "j":
        import json
        from urllib.parse import unquote
        return json.loads(unquote(body))
    raise ValueError(f"unrecognised value tag: {text!r}")
