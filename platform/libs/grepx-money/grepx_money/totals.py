# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""Totals of a document (invoice, bill, credit note): lines -> subtotal, discount, tax, total - all in cents."""
from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal

from .amounts import _decimal, cents, percent_of


@dataclass(frozen=True)
class Line:
    qty: Decimal
    unit_price: int          # cents
    discount: Decimal = Decimal(0)   # % off this line


@dataclass(frozen=True)
class Totals:
    subtotal: int
    discount: int
    taxable: int
    tax: int
    total: int

    def as_dict(self) -> dict:
        return {"subtotal": self.subtotal, "discount": self.discount, "taxable": self.taxable, "tax": self.tax, "total": self.total}


def line_total(line: Line) -> int:
    """qty x price, less the line's discount, rounded half-up to a cent."""
    gross = (line.qty * Decimal(line.unit_price)).quantize(Decimal(1), rounding=ROUND_HALF_UP)
    return int(gross) - percent_of(int(gross), line.discount)


def make_line(qty, unit_price, discount=0) -> Line:
    q = _decimal(qty)
    if q <= 0:
        raise ValueError("INVALID_QUANTITY")
    d = _decimal(discount)
    if not 0 <= d <= 100:
        raise ValueError("INVALID_DISCOUNT")
    price = cents(unit_price)
    if price < 0:
        raise ValueError("INVALID_PRICE")
    return Line(q, price, d)


def totals(lines: list[Line], tax_rate=0, discount_rate=0) -> Totals:
    """Lines are rounded one by one; the document discount and the tax are each rounded once on the whole."""
    rate = _decimal(tax_rate)
    if not 0 <= rate <= 100:
        raise ValueError("INVALID_TAX_RATE")
    subtotal = sum(line_total(line) for line in lines)
    discount = percent_of(subtotal, discount_rate)
    taxable = subtotal - discount
    tax = percent_of(taxable, rate)
    return Totals(subtotal, discount, taxable, tax, taxable + tax)
