# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""The documents: a customer invoice or credit note, and a supplier bill (kept as a record of what was entered)."""
from __future__ import annotations

from .layout import MoneyDocument


class InvoicePdf(MoneyDocument):
    def __init__(self, doc: dict, business: dict, customer: dict):
        super().__init__(doc, business)
        self.customer = customer
        self.title_word = "Credit note" if doc.get("kind") == "credit" else ("Tax invoice" if business.get("billing", {}).get("tax_number") else "Invoice")

    def counterparty(self):
        c = self.customer
        lines = [c.get("name", "") or self.doc.get("customer_name", ""), *(c.get("address") or "").splitlines(), c.get("email", ""),
                 f"Tax no. {c['tax_number']}" if c.get("tax_number") else ""]
        return "Bill to", [l for l in lines if l]

    def facts(self):
        d = self.doc
        out = [("Number", d.get("number") or "DRAFT"), ("Date", d.get("issued", "") or "-")]
        if d.get("kind") == "credit":
            return [*out, ("Corrects", d.get("corrects_number", ""))]
        return [*out, ("Due", d.get("due", "") or "-"), *([("Reference", d["reference"])] if d.get("reference") else [])]

    def extra_totals(self):
        d = self.doc
        rows = [("Total", d.get("total", 0))]
        if d.get("paid"):
            rows.append(("Paid", -d["paid"]))
        if d.get("credited"):
            rows.append(("Credited", -d["credited"]))
        return rows

    def due_label(self):
        return "Credit total" if self.doc.get("kind") == "credit" else "Amount due"

    def due_amount(self):
        return self.doc.get("total", 0) if self.doc.get("kind") == "credit" else super().due_amount()

    def note_blocks(self):
        how = self.business.get("billing", {}).get("payment_note", "")
        return [("Notes", self.doc.get("notes", "")), *([] if self.doc.get("kind") == "credit" else [("How to pay", how)])]


class BillPdf(MoneyDocument):
    title_word = "Supplier bill"

    def __init__(self, doc: dict, business: dict, supplier: dict):
        super().__init__(doc, business)
        self.supplier = supplier

    def counterparty(self):
        s = self.supplier
        return "From supplier", [l for l in (s.get("name") or self.doc.get("supplier_name", ""), s.get("email", ""), s.get("phone", "")) if l]

    def facts(self):
        d = self.doc
        return [("Their number", d.get("supplier_ref", "")), ("Date", d.get("bill_date", "")), ("Due", d.get("due", "")),
                *([("Order", d["po_number"])] if d.get("po_number") else []), ("Match", d.get("match", ""))]

    def due_label(self):
        return "Still to pay"

    def due_amount(self):
        return self.doc.get("total", 0) - self.doc.get("paid", 0)


def render(document: MoneyDocument) -> bytes:
    return document.build()
