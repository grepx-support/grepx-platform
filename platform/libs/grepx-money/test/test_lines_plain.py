# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""Quantities and discounts are kept as people write them: 10 and 100, never 1E+1 / 1E+2."""
from grepx_money import document_lines


def test_round_numbers_stay_plain():
    line = document_lines([{"description": "Tacos", "qty": "100", "unit_price": "8", "discount": "10"}], {})[0]
    assert (line["qty"], line["discount"]) == ("100", "10")
