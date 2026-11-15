# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""Tax shapes: one tax, or split in halves within a region and whole across regions; cents add up."""
from grepx_money.tax import RegionalSplit, Single, compute

SPLIT = RegionalSplit("Central", "State", "Integrated")


def test_single_tax():
    r = compute([{"amount": 10000, "rate": "9", "code": "8471"}, {"amount": 333, "rate": "9"}], Single("GST"))
    assert r["tax"] == 900 + 30 and r["components"] == [{"name": "GST", "rate": "9", "taxable": 10333, "tax": 930}]


def test_split_within_and_across_regions():
    lines = [{"amount": 50000, "rate": "18", "code": "8517"}, {"amount": 1000, "rate": "0"}]
    inside = compute(lines, SPLIT, same_region=True)
    assert [(c["name"], c["rate"], c["tax"]) for c in inside["components"]] == [("Central", "9", 4500), ("State", "9", 4500)]
    across = compute(lines, SPLIT, same_region=False)
    assert across["components"] == [{"name": "Integrated", "rate": "18", "taxable": 50000, "tax": 9000}]
    assert across["by_code"][0] == {"code": "8517", "rate": "18", "taxable": 50000, "tax": 9000} and across["lines"][1]["tax"] == 0
