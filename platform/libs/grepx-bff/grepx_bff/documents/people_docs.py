# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""Documents every business product prints for its people and funds: the payslip and the investor statement, as
specs for ReportPdf (title, facts, sections, signatures)."""
from __future__ import annotations


def num(v, places: int = 2) -> str:
    if v in (None, ""):
        return "-"
    v = float(v)
    return f"{v:,.{places}f}".rstrip("0").rstrip(".") if places else f"{v:,.0f}"


def cash(cents, cur: str = "") -> str:
    return "-" if cents is None else f"{cur} {cents / 100:,.2f}".strip()


def payslip(s: dict, business: dict, cur: str) -> dict:
    lines = lambda xs: [[l["label"], cash(round(l["amount"] * 100), cur)] for l in xs]  # noqa: E731
    return {"title": "Payslip", "subtitle": f"{s['month']} - {s['name']}",
            "facts": [("Employee", s["name"]), ("Position", s.get("position", "")), ("Month", s["month"]), ("Hours worked", num(s.get("worked_hours"), 1)),
                      ("Gross", cash(round(s["gross"] * 100), cur)), ("Deductions", cash(round(sum(l["amount"] for l in s["deductions"]) * 100), cur)),
                      ("Net pay", cash(round(s["net"] * 100), cur)), ("Unpaid days", num(s.get("unpaid_days"), 1))],
            "sections": [{"heading": "Earnings", "columns": [("", 5, "L"), ("Amount", 2, "R")], "rows": lines(s["earnings"]), "total": ["Gross", cash(round(s["gross"] * 100), cur)]},
                         {"heading": "Deductions", "columns": [("", 5, "L"), ("Amount", 2, "R")], "rows": lines(s["deductions"]), "empty": "None"},
                         {"heading": "Paid by the employer on top", "columns": [("", 5, "L"), ("Amount", 2, "R")], "rows": lines(s["employer"]), "empty": "None"},
                         {"heading": "Net pay", "text": f"{cash(round(s['net'] * 100), cur)} - paid to the employee's account."}]}


KIND_WORDS = {"commit": "Promised", "receive": "Paid in", "return": "Paid back to you", "interest": "Interest"}


def investor_statement(st: dict) -> dict:
    """One party's statement: per fund promised, paid in, paid back, still promised and their share; then every movement
    of theirs in the period, with the original amount when it was paid in another currency."""
    def amt(cents: int, cur: str) -> str:
        return f"{cur} {cents / 100:,.2f}".strip()
    summary = [[f["name"], amt(f["committed"], f["currency"]), amt(f["received"], f["currency"]), amt(f["returned"], f["currency"]),
                amt(f["pending"], f["currency"]), f"{f['share_pct']}%"] for f in st["funds"]]
    lines = [[l["date"], f["name"], KIND_WORDS.get(l["kind"], l["kind"]), amt(l["amount"], f["currency"]),
              (f"{amt(l['original']['amount'], l['original']['currency'])} at {l['original']['rate']}" if l.get("original") else "") + (f" {l['ref']}" if l.get("ref") else "")]
             for f in st["funds"] for l in f["lines"]]
    period = f"{st['first']} to {st['last']}" if st["first"] > "0000-01-01" else f"to {st['last']}"
    return {"title": "Investor statement", "subtitle": f"{st['name']} - {period}",
            "facts": [("For", st["name"]), ("Period", period), ("Funds", str(len(st["funds"])))],
            "sections": [{"heading": "Your position", "columns": [("Fund", 4, "L"), ("Promised", 2.2, "R"), ("Paid in", 2.2, "R"), ("Paid back", 2.2, "R"),
                                                                    ("Still promised", 2.2, "R"), ("Share", 1.2, "R")], "rows": summary},
                         {"heading": "Movements", "columns": [("Date", 2, "L"), ("Fund", 3, "L"), ("What", 2.5, "L"), ("Amount", 2.5, "R"), ("Note", 4, "L")],
                          "rows": lines or [["", "", "No movements in this period", "", ""]]},
                         {"heading": "", "text": "Share is your part of the money paid into each fund. Amounts paid in another currency are shown at the rate they were converted."}]}
