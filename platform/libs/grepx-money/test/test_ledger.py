# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""Double entry: every entry balances; credit notes reverse; the trial balance nets to zero."""
import pytest

from grepx_money.ledger import Accounts, paid, purchase, received, sale, supplier_credit, trial_balance


def test_entries_balance_and_trial_balance_nets_to_zero():
    acc = Accounts.of({"bank": "DBS Current", "nonsense": "x"})
    rows = [*sale({"date": "2026-11-01", "ref": "INV-1", "total": 11500, "tax": 900, "charges": 600}, acc),
            *sale({"date": "2026-11-02", "ref": "CN-1", "total": 1090, "tax": 90}, acc, credit_note=True),
            *purchase({"date": "2026-11-03", "ref": "HM-1", "total": 5450, "tax": 450, "landed": 1000}, acc),
            *supplier_credit({"date": "2026-11-04", "ref": "HM-1 return", "total": 1090, "tax": 90}, acc),
            *received({"date": "2026-11-05", "ref": "INV-1", "amount": 5000}, acc), *paid({"date": "2026-11-06", "ref": "HM-1", "amount": 2000}, acc)]
    tb = {a["account"]: a["balance"] for a in trial_balance(rows)}
    assert sum(tb.values()) == 0
    assert tb["Sales"] == -(10000 - 1000) and tb["DBS Current"] == 3000 and tb["Freight and Duty"] == 1000
    assert tb["Accounts Payable"] == -(5450 - 1090 - 2000)


def test_unbalanced_is_refused():
    from grepx_money.ledger import _entry
    with pytest.raises(ValueError):
        _entry("d", "r", "", [("a", 1, 0), ("b", 0, 2)])
