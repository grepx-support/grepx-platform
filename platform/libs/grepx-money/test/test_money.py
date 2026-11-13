# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""Money in cents: input parsing, half-up rounding, document totals."""
import pytest

from grepx_money import cents, from_cents, make_line, percent_of, totals


def test_cents_parses_like_a_person_would_type():
    assert [cents("12.345"), cents(7), cents("1,250.5"), cents(""), cents(0.1 + 0.2)] == [1235, 700, 125050, 0, 30]
    assert from_cents(1235) == 12.35
    for bad in ("abc", "nan", "inf"):
        with pytest.raises(ValueError):
            cents(bad)


def test_percent_rounds_half_up_to_the_cent():
    assert percent_of(1000, 9) == 90 and percent_of(1005, 9) == 90 and percent_of(1006, 9) == 91   # 90.45 -> 90, 90.54 -> 91


def test_document_totals_round_each_line_then_tax_once():
    lines = [make_line(3, "1.333"), make_line("2.5", "4.20", discount=10)]      # 3 x 133 = 399; 2.5 x 420 = 1050 - 105 = 945
    t = totals(lines, tax_rate=9, discount_rate=5)
    assert t.as_dict() == {"subtotal": 1344, "discount": 67, "taxable": 1277, "tax": 115, "total": 1392}


@pytest.mark.parametrize("args,reason", [((0, 5), "INVALID_QUANTITY"), ((1, -2), "INVALID_PRICE"), ((1, 5, 101), "INVALID_DISCOUNT")])
def test_bad_lines_are_refused(args, reason):
    with pytest.raises(ValueError, match=reason):
        make_line(*args)


def test_document_lines_and_priced():
    from grepx_money import document_lines, priced
    lines = document_lines([{"item_id": "taco", "qty": "3", "unit_price": "4.50"}, {"description": "", "qty": ""}], {"taco": {"name": "Tacos", "unit": "box"}})
    assert [(l["description"], l["unit"], l["amount"]) for l in lines] == [("Tacos", "box", 1350)]
    assert priced({"lines": lines, "tax_rate": "9"})["total"] == 1472
    for raw, reason in (([{"item_id": "x", "qty": 1, "unit_price": 1}], "UNKNOWN_ITEM"), ([], "NO_LINES")):
        with pytest.raises(ValueError, match=reason):
            document_lines(raw, {})
