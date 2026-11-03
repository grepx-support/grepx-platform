# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""Encode/decode a row's whole field set: "k1=type:v1;k2=type:v2;..."."""
from __future__ import annotations

from .values import decode_value, encode_value


def encode_fields(fields: dict) -> str:
    def _k(key):
        # Unwrap Enum keys (e.g. RowField, EventField) to their underlying string value
        if hasattr(key, "value"):
            try:
                from enum import Enum

                if isinstance(key, Enum):
                    return key.value
            except Exception:
                pass
        return str(key)

    return ";".join(f"{_k(k)}={encode_value(v)}" for k, v in fields.items())


def _maybe_legacy_list(key: str, value):
    """Narrowly scoped backward-compat for legacy s: comma-separated reminder_offsets_hours.

    Old encoding used s:1,2,3 (string). New encoding uses l:[1,2,3] (JSON). For
    reminder_offsets_hours only, decode legacy comma string to list of ints.
    Other fields (e.g. normal scalar strings containing commas) remain strings.
    """
    if key == "reminder_offsets_hours" and isinstance(value, str) and "," in value:
        # Trim and split, ignore empty parts
        parts = [p.strip() for p in value.split(",") if p.strip() != ""]
        if not parts:
            return []
        # Only convert if all parts look like integers (including negative)
        if all(p.lstrip("-").isdigit() for p in parts):
            try:
                return [int(p) for p in parts]
            except Exception:
                return value
        # For non-int comma strings (e.g. "hello, world"), keep as string per requirement
        return value
    return value


def decode_fields(text: str) -> dict:
    if not text:
        return {}
    result = {}
    for pair in text.split(";"):
        key, _, value = pair.partition("=")
        decoded = decode_value(value)
        decoded = _maybe_legacy_list(key, decoded)
        result[key] = decoded
    return result


def decode_storage_fields(text: str) -> dict:
    """Decodes the format nexus_server's C++ SqliteSnapshotStore actually
    writes to nexus_rows.fields / outbox.fields on disk — NOT the same
    wire format as decode_fields() above (which is what NexusClient sends/
    receives over the TCP connection). The on-disk format uses ASCII
    control characters as delimiters — '\\x1e' (record separator) between
    a key and its type:value, '\\x1f' (unit separator) between pairs —
    instead of '='/';', specifically so a field value that happens to
    contain a literal '=' or ';' can never be misparsed as a delimiter.
    See libs/persistence/include/nexus/persistence/sqlite_snapshot_store.hpp's
    detail::encode_fields/decode_fields for the canonical C++ version this
    mirrors; if one side changes delimiters, the other must too.
    """
    if not text:
        return {}
    result = {}
    for pair in text.split("\x1f"):
        key, sep, value = pair.partition("\x1e")
        if not sep:
            continue
        decoded = decode_value(value)
        decoded = _maybe_legacy_list(key, decoded)
        result[key] = decoded
    return result
