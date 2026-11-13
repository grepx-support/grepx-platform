# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""Turning user input into cents and back, and percentages of an amount."""
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation

HUNDRED = Decimal(100)


def _decimal(value) -> Decimal:
    try:
        d = Decimal(str(value).strip().replace(",", "")) if value not in (None, "") else Decimal(0)
    except (InvalidOperation, ValueError):
        raise ValueError("INVALID_AMOUNT")
    if not d.is_finite():
        raise ValueError("INVALID_AMOUNT")
    return d


def cents(value) -> int:
    """'12.345' -> 1235, 7 -> 700. Accepts str / int / float / Decimal; rejects text that is not a number."""
    return int((_decimal(value) * HUNDRED).quantize(Decimal(1), rounding=ROUND_HALF_UP))


def from_cents(amount: int) -> float:
    """For display and JSON only - never compute with the result."""
    return float(Decimal(int(amount)) / HUNDRED)


def percent_of(amount: int, rate) -> int:
    """rate % of an amount in cents, rounded half-up to a cent."""
    return int((Decimal(int(amount)) * _decimal(rate) / HUNDRED).quantize(Decimal(1), rounding=ROUND_HALF_UP))
