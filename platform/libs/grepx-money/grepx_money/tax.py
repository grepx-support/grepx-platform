# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""Tax on document lines, as one of two shapes (strategy) - the caller picks the shape and its names; nothing here knows
a country:
  Single        one tax at each line's rate ("GST 9 %")
  RegionalSplit within one region the rate is split into two equal halves (e.g. central + state); across regions it is
                one integrated tax at the full rate
Lines carry amount (cents, after discount), rate (percent) and an optional code (a goods classification); the result has
each line's tax, the components (name, rate, taxable, tax) and a summary per code. Cents rounded half-up per component
and line."""
from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal

from .amounts import percent_of


def _rate(v) -> Decimal:
    return Decimal(str(v or 0))


def _fmt(d: Decimal) -> str:
    return format(d.normalize(), "f") if d else "0"


@dataclass(frozen=True)
class Single:
    name: str = "Tax"

    def parts(self, rate: Decimal, same_region: bool) -> list[tuple[str, Decimal]]:
        return [(self.name, rate)]


@dataclass(frozen=True)
class RegionalSplit:
    first: str
    second: str
    whole: str

    def parts(self, rate: Decimal, same_region: bool) -> list[tuple[str, Decimal]]:
        return [(self.first, rate / 2), (self.second, rate / 2)] if same_region else [(self.whole, rate)]


def compute(lines: list[dict], shape, same_region: bool = True) -> dict:
    """{lines: [line + tax, tax_parts], components: [{name, rate, taxable, tax}], by_code: [{code, taxable, tax}], tax, taxable}."""
    comps: dict[tuple[str, str], dict] = {}
    codes: dict[str, dict] = {}
    out = []
    for line in lines:
        amount, rate = int(line.get("amount") or 0), _rate(line.get("rate"))
        parts = [(n, r, percent_of(amount, r)) for n, r in shape.parts(rate, same_region)] if rate else []
        tax = sum(t for _, _, t in parts)
        for n, r, t in parts:
            c = comps.setdefault((n, _fmt(r)), {"name": n, "rate": _fmt(r), "taxable": 0, "tax": 0})
            c["taxable"] += amount
            c["tax"] += t
        code = str(line.get("code") or "")
        s = codes.setdefault(code, {"code": code, "rate": _fmt(rate), "taxable": 0, "tax": 0})
        s["taxable"] += amount
        s["tax"] += tax
        out.append({**line, "tax": tax, "tax_parts": [{"name": n, "rate": _fmt(r), "tax": t} for n, r, t in parts]})
    return {"lines": out, "components": list(comps.values()), "by_code": list(codes.values()),
            "tax": sum(l["tax"] for l in out), "taxable": sum(int(l.get("amount") or 0) for l in out)}
