# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""Exact money for invoices, bills and payments.

Amounts are kept as whole cents (int) - never floats - and rounded half-up once per line and once for tax, the way an
invoice is checked by hand. Rates (tax, discount) are percentages given by the caller: nothing here knows a country."""
from .amounts import cents, from_cents, percent_of
from .lines import document_lines, priced
from .totals import Line, Totals, line_total, make_line, totals

__all__ = ["Line", "Totals", "cents", "document_lines", "from_cents", "line_total", "make_line", "percent_of", "priced", "totals"]
