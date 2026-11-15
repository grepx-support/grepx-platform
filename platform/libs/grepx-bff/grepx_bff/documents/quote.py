# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""A catering quotation, and once the customer says yes the same document as an order confirmation."""
from __future__ import annotations

from .layout import MoneyDocument, money


class QuotePdf(MoneyDocument):
    def __init__(self, doc: dict, business: dict, customer: dict):
        super().__init__(doc, business)
        self.customer = customer
        self.ordered = doc.get("state") in ("ordered", "invoiced")
        self.title_word = "Order confirmation" if self.ordered else "Quotation"

    def counterparty(self):
        c = self.customer
        lines = [c.get("name", "") or self.doc.get("customer_name", ""), *(c.get("address") or "").splitlines(), c.get("email", ""), c.get("phone", "")]
        return "Prepared for", [l for l in lines if l]

    def facts(self):
        d = self.doc
        when = " ".join(filter(None, [d.get("event_date", ""), d.get("event_time", "")]))
        out = [("Order", d.get("order_number", ""))] if self.ordered else [("Quotation", d.get("number") or "DRAFT"), ("Valid until", d.get("valid_until") or "-")]
        return [*out, ("Date", d.get("ordered_on") or d.get("quoted_on") or "-"), ("Event", when or "-"),
                *([("Guests", str(d["guests"]))] if d.get("guests") else []), *([("Venue", d["venue"][:28])] if d.get("venue") else [])]

    def due_label(self):
        return "Order total" if self.ordered else "Quoted total"

    def due_amount(self):
        return self.doc.get("total", 0)

    def note_blocks(self):
        d, how = self.doc, self.business.get("billing", {}).get("payment_note", "")
        guests = f"That is {money(round(d['total'] / d['guests']), self.currency)} per guest for {d['guests']} guests." if d.get("guests") else ""
        terms = (f"Confirmed by {d.get('accepted_by', '')} on {d.get('ordered_on', '')}. We will invoice it as agreed." if self.ordered else
                 f"This quotation is valid until {d.get('valid_until') or 'it is sent'}. Prices may change after that date. "
                 "To confirm, reply to us or sign below.")
        return [("For", d.get("event_name", "")), ("Notes", d.get("notes", "")), ("Price", guests), ("Terms", terms), ("How to pay", how)]
