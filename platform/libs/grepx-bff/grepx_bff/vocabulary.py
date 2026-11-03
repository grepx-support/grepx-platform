"""Vocabulary — the anti-corruption layer between generic services and a product's words.

Generic services speak "event / booking / person / attended"; a product may speak "drive / registration /
donor / donated". The product declares the mapping once in its project config:

    vocabulary:
      contracts: [event, booking, slot]          # contract modules whose tables/requests speak the generic words
      fields: {event_id: drive_id, person_id: donor_id}     # generic -> product
      values: {state: {attended: donated}}                  # per field, generic -> product
      reasons: {UNKNOWN_EVENT: UNKNOWN_DRIVE}               # verdict reasons, generic -> product
      nested: {stats: {attended: donated}}                  # keys inside a dict field, generic -> product

Rows read from those tables come back in product words; commands sent to those services go out in generic
words, and their verdicts come back in product words. Tables and services not listed pass through untouched.
"""
from __future__ import annotations

import importlib
import re
from typing import Any, Iterable, Optional


class Vocabulary:
    def __init__(self, tables: Iterable[str] = (), fields: Optional[dict] = None, values: Optional[dict] = None,
                 reasons: Optional[dict] = None, nested: Optional[dict] = None):
        self.tables = set(tables)
        self.out_fields = dict(fields or {})                        # generic -> product
        self.in_fields = {p: g for g, p in self.out_fields.items()}  # product -> generic
        self.out_values = {f: dict(m) for f, m in (values or {}).items()}
        self.in_values = {f: {p: g for g, p in m.items()} for f, m in self.out_values.items()}
        self.out_reasons = dict(reasons or {})
        self.in_reasons = {p: g for g, p in self.out_reasons.items()}
        self.nested = {f: dict(m) for f, m in (nested or {}).items()}
        words = sorted(self.in_fields, key=len, reverse=True)
        self._criteria = re.compile(r"\b(" + "|".join(map(re.escape, words)) + r")\b") if words else None

    @classmethod
    def from_config(cls, cfg: Any) -> "Vocabulary":
        spec = (cfg.get("vocabulary") if cfg is not None else None) or {}
        tables: set[str] = set()
        for name in spec.get("contracts") or ():
            module = importlib.import_module(f"grepx_contracts.{name}")
            tables |= {v for k, v in vars(module).items() if k.isupper() and k != "SERVICE" and isinstance(v, str)}
        return cls(tables, spec.get("fields"), spec.get("values"), spec.get("reasons"), spec.get("nested"))

    def speaks(self, table: str) -> bool:
        return table in self.tables

    # ---- generic -> product (rows and verdicts coming back) ----
    def row_out(self, row: Optional[dict]) -> Optional[dict]:
        if row is None:
            return None
        return {self.out_fields.get(k, k): self._nest(k, self._value(self.out_values, k, v)) for k, v in row.items()}

    def reason_out(self, reason: str) -> str:
        return self.out_reasons.get(reason, reason)

    def fields_out(self, fields: dict) -> dict:
        out = self.row_out(fields) or {}
        if "reason" in out:
            out["reason"] = self.reason_out(str(out["reason"]))
        return out

    # ---- product -> generic (filters and commands going in) ----
    def fields_in(self, fields: dict) -> dict:
        return {self.in_fields.get(k, k): self._value(self.in_values, self.in_fields.get(k, k), v) for k, v in fields.items()}

    def criteria_in(self, criteria: str) -> str:
        if not criteria or self._criteria is None:
            return criteria
        parts = re.split(r"('[^']*')", criteria)          # rename field words only outside quoted values
        text = "".join(p if i % 2 else self._criteria.sub(lambda m: self.in_fields[m.group(1)], p) for i, p in enumerate(parts))
        for field, mapping in self.in_values.items():
            for product, generic in mapping.items():
                text = re.sub(rf"(\b{re.escape(field)}\s*(?:=|!=|<>)\s*)'{re.escape(product)}'", rf"\1'{generic}'", text)
        return text

    def _nest(self, field: str, value: Any) -> Any:
        mapping = self.nested.get(field)
        if not mapping or not isinstance(value, dict):
            return value
        return {mapping.get(k, k): v for k, v in value.items()}

    def _value(self, maps: dict, field: str, value: Any) -> Any:
        mapping = maps.get(field)
        if not mapping:
            return value
        if isinstance(value, (list, tuple, set)):
            return type(value)(mapping.get(v, v) if isinstance(v, str) else v for v in value)
        return mapping.get(value, value) if isinstance(value, str) else value


class TranslatingReader:
    """A Reader that speaks the product's words for the tables the vocabulary covers."""

    def __init__(self, reader, vocabulary: Vocabulary):
        self.inner, self.vocab = reader, vocabulary
        self.client = reader.client

    def __getattr__(self, name):
        return getattr(self.inner, name)

    def rows(self, table: str, criteria: str = "", **equals: Any) -> list[dict]:
        return self._read(self.inner.rows, table, criteria, equals)

    def accepted(self, table: str, criteria: str = "", **equals: Any) -> list[dict]:
        return self._read(self.inner.accepted, table, criteria, equals)

    def one(self, table: str, key: str) -> Optional[dict]:
        row = self.inner.one(table, key)
        return self.vocab.row_out(row) if self.vocab.speaks(table) else row

    def accepted_one(self, table: str, key: str) -> Optional[dict]:
        row = self.inner.accepted_one(table, key)
        return self.vocab.row_out(row) if self.vocab.speaks(table) else row

    def _read(self, fn, table: str, criteria: str, equals: dict) -> list[dict]:
        if not self.vocab.speaks(table):
            return fn(table, criteria, **equals)
        rows = fn(table, self.vocab.criteria_in(criteria), **self.vocab.fields_in(equals))
        return [self.vocab.row_out(r) for r in rows]
