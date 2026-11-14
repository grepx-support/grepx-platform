# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""Double entry for an accounting system: sales, purchases, credits and payments as balanced journal lines (debits =
credits for every entry). Accounts are names the caller can change (Accounts). Pure; money in cents."""
from __future__ import annotations

from dataclasses import asdict, dataclass


@dataclass(frozen=True)
class Accounts:
    receivable: str = "Accounts Receivable"
    payable: str = "Accounts Payable"
    sales: str = "Sales"
    purchases: str = "Purchases"
    tax_out: str = "GST / VAT Collected"
    tax_in: str = "GST / VAT Paid"
    bank: str = "Bank"
    charges: str = "Delivery and Other Income"
    landed: str = "Freight and Duty"

    @classmethod
    def of(cls, raw: dict | None) -> "Accounts":
        names = {k: " ".join(str(v).split())[:60] for k, v in (raw or {}).items() if k in cls.__dataclass_fields__ and str(v).strip()}
        return cls(**names)

    def as_dict(self) -> dict:
        return asdict(self)


def _entry(date: str, ref: str, text: str, lines: list[tuple[str, int, int]]) -> list[dict]:
    rows = [{"date": date, "ref": ref, "description": text, "account": a, "debit": d, "credit": c} for a, d, c in lines if d or c]
    if sum(r["debit"] for r in rows) != sum(r["credit"] for r in rows):
        raise ValueError("UNBALANCED")
    return rows


def sale(doc: dict, acc: Accounts, credit_note: bool = False) -> list[dict]:
    """An issued sales document: receivable = sales (+ charges) + tax; a credit note the other way round."""
    total, tax, charges = int(doc.get("total") or 0), int(doc.get("tax") or 0), int(doc.get("charges") or 0)
    goods = total - tax - charges
    lines = [(acc.receivable, total, 0), (acc.sales, 0, goods), (acc.charges, 0, charges), (acc.tax_out, 0, tax)]
    if credit_note:
        lines = [(a, c, d) for a, d, c in lines]
    return _entry(doc["date"], doc["ref"], doc.get("text", ""), lines)


def purchase(doc: dict, acc: Accounts) -> list[dict]:
    """An approved supplier bill: purchases (+ freight / duty charged on it) + tax = payable."""
    total, tax, landed = int(doc.get("total") or 0), int(doc.get("tax") or 0), int(doc.get("landed") or 0)
    return _entry(doc["date"], doc["ref"], doc.get("text", ""),
                  [(acc.purchases, total - tax - landed, 0), (acc.landed, landed, 0), (acc.tax_in, tax, 0), (acc.payable, 0, total)])


def supplier_credit(doc: dict, acc: Accounts) -> list[dict]:
    """Goods sent back: the supplier owes less (payable down; purchases and tax paid back out)."""
    total, tax = int(doc.get("total") or 0), int(doc.get("tax") or 0)
    return _entry(doc["date"], doc["ref"], doc.get("text", ""), [(acc.payable, total, 0), (acc.purchases, 0, total - tax), (acc.tax_in, 0, tax)])


def received(doc: dict, acc: Accounts) -> list[dict]:
    """A customer paid: bank up, receivable down."""
    amount = int(doc["amount"])
    return _entry(doc["date"], doc["ref"], doc.get("text", ""), [(acc.bank, amount, 0), (acc.receivable, 0, amount)])


def paid(doc: dict, acc: Accounts) -> list[dict]:
    """A supplier was paid: payable down, bank down."""
    amount = int(doc["amount"])
    return _entry(doc["date"], doc["ref"], doc.get("text", ""), [(acc.payable, amount, 0), (acc.bank, 0, amount)])


def trial_balance(rows: list[dict]) -> list[dict]:
    """Per account: debits, credits and the balance (debit positive)."""
    out: dict[str, dict] = {}
    for r in rows:
        a = out.setdefault(r["account"], {"account": r["account"], "debit": 0, "credit": 0})
        a["debit"] += r["debit"]
        a["credit"] += r["credit"]
    return [{**a, "balance": a["debit"] - a["credit"]} for a in sorted(out.values(), key=lambda a: a["account"])]
