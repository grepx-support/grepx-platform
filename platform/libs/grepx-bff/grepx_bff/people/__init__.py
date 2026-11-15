# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""People and money features every business product shares, each behind its Setup -> Features switch:
Team, Roster (and clock in / out), Leave, Payroll (payslip PDFs), My work (the staff member's own phone screen), Funds.

    routers = people.routers(after_finalise=..., fund_costs=...)   # [(router, feature)]; my work has no feature
"""
from typing import Optional

import grepx_contracts as gc
from fastapi import APIRouter

from . import funds, leave, my, payroll, roster, team
from .fund_costs import FundCosts, NoCosts, last_months, months_back
from .payroll import Finalised



def routers(after_finalise: Optional[Finalised] = None, fund_costs: FundCosts = NoCosts()) -> list[tuple[APIRouter, str]]:
    """Each shared router with the feature that switches it ("" = always on)."""
    m = gc.business.Module                    # each product's business-service has these switches
    return [(team.router, m.TEAM.value), (roster.router, m.ROSTER.value), (leave.router, m.LEAVE.value),
            (payroll.build(after_finalise), m.PAYROLL.value), (funds.build(fund_costs), m.FUNDS.value), (my.router, "")]


__all__ = ["FundCosts", "NoCosts", "last_months", "months_back", "routers"]
