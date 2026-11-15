# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""What a fund's money was used for, from the product's own books (strategy).

A fund's use can be named like one of the business's places; the product then says what that place really spent and
earned, so fund-service can show spent against given, burn, forecast and suggestions. Amounts in minor units."""
from __future__ import annotations

from datetime import date, timedelta
from typing import Protocol

from ..business import Business


class FundCosts(Protocol):
    def spending(self, k: Business, purposes: set[str]) -> dict[str, list[dict]]:
        """{use: [{month, category, amount}]} - each use that is a place: its costs per month and category."""

    def actuals(self, k: Business, uses: list[str]) -> dict[str, list[float]]:
        """{use: [monthly profit]} for the last months that had sales - compared with the fund's plan."""


class NoCosts:
    """A product that does not keep costs per place: funds still work, without spent-against-given per place."""

    def spending(self, k: Business, purposes: set[str]) -> dict[str, list[dict]]:
        return {}

    def actuals(self, k: Business, uses: list[str]) -> dict[str, list[float]]:
        return {}


def last_months(n: int = 3) -> list[str]:
    """The n whole months before this one, newest first."""
    first = date.today().replace(day=1)
    out = []
    for _ in range(n):
        first = (first - timedelta(days=1)).replace(day=1)
        out.append(first.isoformat()[:7])
    return out


def months_back(n: int) -> list[str]:
    """The last n months including this one, oldest first."""
    return list(reversed(last_months(n - 1))) + [date.today().isoformat()[:7]]
