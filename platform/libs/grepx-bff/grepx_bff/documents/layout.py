# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""The page every money document shares: letterhead, the two parties, a table of lines, totals, payment note, footer.
Subclasses only say what the document is called and which party is which (template method)."""
from __future__ import annotations

from fpdf import FPDF

from .branding import draw_image

INK, MUTED, LINE, ACCENT = (17, 24, 39), (100, 116, 139), (226, 232, 240), (13, 148, 136)


def text(value) -> str:
    """fpdf2's built-in fonts are Latin-1: anything else becomes '?' instead of failing."""
    return str(value if value is not None else "").replace("–", "-").replace("—", "-").replace("·", "-")         .encode("latin-1", "replace").decode("latin-1")


def money(cents: int, currency: str = "") -> str:
    sign = "-" if cents < 0 else ""
    return f"{sign}{currency + ' ' if currency else ''}{abs(cents) / 100:,.2f}"


class MoneyDocument(FPDF):
    title_word = "Document"

    def __init__(self, doc: dict, business: dict):
        super().__init__(format="A4")
        self.doc, self.business, self.billing = doc, business, business.get("billing") or {}
        self.currency = doc.get("currency") or business.get("currency", "")
        self.set_auto_page_break(True, margin=22)
        self.set_margins(16, 16, 16)

    # --- what subclasses fill in ---
    def counterparty(self) -> tuple[str, list[str]]:
        raise NotImplementedError

    def facts(self) -> list[tuple[str, str]]:
        raise NotImplementedError

    # --- the page ---
    def build(self) -> bytes:
        self.add_page()
        self.letterhead()
        self.parties()
        self.lines_table()
        self.totals()
        self.notes()
        return bytes(self.output())

    def letterhead(self):
        b = self.billing
        self.set_fill_color(*ACCENT)
        self.rect(0, 0, 210, 6, "F")
        logo = draw_image(self, self.business.get("logo_bytes"), 16, 12, 14, 44)
        self.set_xy(16 + (logo + 4 if logo else 0), 14)
        self.set_font("Helvetica", "B", 18)
        self.set_text_color(*INK)
        self.cell(110 - (logo + 4 if logo else 0), 9, text(b.get("legal_name") or self.business.get("name", "")))
        self.set_font("Helvetica", "B", 22)
        self.set_text_color(*ACCENT)
        self.cell(0, 9, text(self.title_word.upper()), align="R", new_x="LMARGIN", new_y="NEXT")
        self.set_font("Helvetica", "", 9)
        self.set_text_color(*MUTED)
        if logo:
            self.set_y(max(self.get_y(), 27))
        details = [*filter(None, (b.get("address") or "").splitlines()),
                   f"{b.get('tax_label') or 'Tax'} no. {b['tax_number']}" if b.get("tax_number") else ""]
        for line in filter(None, details):
            self.cell(0, 4.6, text(line), new_x="LMARGIN", new_y="NEXT")
        self.ln(6)

    def parties(self):
        label, lines = self.counterparty()
        top = self.get_y()
        self.set_font("Helvetica", "B", 8)
        self.set_text_color(*MUTED)
        self.cell(100, 5, text(label.upper()), new_x="LMARGIN", new_y="NEXT")
        self.set_text_color(*INK)
        for n, line in enumerate(lines):
            self.set_font("Helvetica", "B" if n == 0 else "", 11 if n == 0 else 9.5)
            self.cell(100, 5.4, text(line), new_x="LMARGIN", new_y="NEXT")
        bottom = self.get_y()
        self.set_y(top)
        for key, value in self.facts():
            self.set_x(122)
            self.set_font("Helvetica", "", 9)
            self.set_text_color(*MUTED)
            self.cell(34, 5.4, text(key))
            self.set_font("Helvetica", "B", 9.5)
            self.set_text_color(*INK)
            self.cell(0, 5.4, text(value), align="R", new_x="LMARGIN", new_y="NEXT")
        self.set_y(max(bottom, self.get_y()) + 8)

    def lines_table(self):
        widths, heads = (88, 22, 18, 28, 22), ("Description", "Qty", "Unit", "Unit price", "Amount")
        self.set_font("Helvetica", "B", 8.5)
        self.set_fill_color(241, 245, 249)
        self.set_text_color(*MUTED)
        for w, h in zip(widths, heads):
            self.cell(w, 8, h.upper(), fill=True, align="L" if h in ("Description", "Unit") else "R")
        self.ln()
        self.set_text_color(*INK)
        for line in self.doc.get("lines") or []:
            self.set_font("Helvetica", "", 9.5)
            disc = f"  (-{line['discount']}%)" if line.get("discount") not in (None, "", "0") else ""
            row = (text(line["description"]) + disc, line["qty"], line.get("unit", ""), money(line["unit_price"]), money(line["amount"]))
            for w, value, align in zip(widths, row, "LRLRR"):
                self.cell(w, 8, text(value), align=align)
            self.ln()
            self.set_draw_color(*LINE)
            self.line(16, self.get_y(), 194, self.get_y())
        self.ln(4)

    def totals(self):
        d, label = self.doc, self.billing.get("tax_label") or "Tax"
        rows = [("Subtotal", d.get("subtotal", 0))]
        if d.get("discount"):
            rows.append((f"Discount ({d.get('discount_rate')}%)", -d["discount"]))
        rows.append((f"{label} ({d.get('tax_rate') or 0}%)", d.get("tax", 0)))
        rows += self.extra_totals()
        for n, (key, value) in enumerate(rows):
            self.set_x(120)
            self.set_font("Helvetica", "", 9.5)
            self.set_text_color(*MUTED)
            self.cell(44, 6.5, text(key))
            self.set_text_color(*INK)
            self.cell(0, 6.5, money(value), align="R", new_x="LMARGIN", new_y="NEXT")
        self.set_x(120)
        self.set_fill_color(*ACCENT)
        self.set_text_color(255, 255, 255)
        self.set_font("Helvetica", "B", 11)
        self.cell(44, 10, " " + text(self.due_label()), fill=True)
        self.cell(0, 10, money(self.due_amount(), self.currency) + " ", fill=True, align="R", new_x="LMARGIN", new_y="NEXT")
        self.set_text_color(*INK)
        self.ln(8)

    def extra_totals(self) -> list[tuple[str, int]]:
        return [("Total", self.doc.get("total", 0))]

    def due_label(self) -> str:
        return "Amount due"

    def due_amount(self) -> int:
        d = self.doc
        return d.get("total", 0) - d.get("paid", 0) - d.get("credited", 0)

    def notes(self):
        for heading, body in self.note_blocks():
            if not body:
                continue
            self.set_font("Helvetica", "B", 9)
            self.set_text_color(*MUTED)
            self.cell(0, 5, text(heading.upper()), new_x="LMARGIN", new_y="NEXT")
            self.set_font("Helvetica", "", 9.5)
            self.set_text_color(*INK)
            self.multi_cell(0, 5, text(body))
            self.ln(3)

    def note_blocks(self) -> list[tuple[str, str]]:
        return [("Notes", self.doc.get("notes", ""))]

    def footer(self):
        self.set_y(-14)
        self.set_font("Helvetica", "", 8)
        self.set_text_color(*MUTED)
        self.cell(0, 5, text(f"{self.billing.get('legal_name') or self.business.get('name', '')}  -  page {self.page_no()}"), align="C")
