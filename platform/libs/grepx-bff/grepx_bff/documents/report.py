# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""The page every working document shares (closing report, payslip, purchase order, pick list, count sheet, food
safety log): the business letterhead with its logo mark, a title, key facts, then sections - tables (with a total
row, red rows for problems) or paragraphs - and signature lines; page numbers and when it was printed in the footer.
A document is described as data (a spec, see specs.py) and drawn here, so each new document is only its spec."""
from __future__ import annotations

from datetime import datetime

from fpdf import FPDF

from .branding import draw_image
from .layout import ACCENT, INK, LINE, MUTED, text

BAD = (190, 18, 60)
WIDTH = 178


class ReportPdf(FPDF):
    def __init__(self, spec: dict, business: dict):
        super().__init__(format="A4", orientation=spec.get("orientation", "P"))
        self.spec, self.business = spec, business
        self.width = 265 if spec.get("orientation") == "L" else WIDTH
        self.set_auto_page_break(True, margin=18)
        self.set_margins(16, 16, 16)
        self.alias_nb_pages()

    def build(self) -> bytes:
        self.add_page()
        self.letterhead()
        self.facts(self.spec.get("facts") or [])
        for section in self.spec.get("sections") or []:
            self.section(section)
        self.signatures(self.spec.get("signatures") or [])
        return bytes(self.output())

    def letterhead(self):
        name = (self.business.get("billing") or {}).get("legal_name") or self.business.get("name", "")
        self.set_fill_color(*ACCENT)
        self.rect(0, 0, 300, 5, "F")
        left = 16 + (draw_image(self, self.business.get("logo_bytes"), 16, 12, 11, 34) or self.initials(name)) + 3
        self.set_text_color(*INK)
        self.set_xy(left, 12)
        self.set_font("Helvetica", "B", 13)
        self.cell(0, 5.5, text(name), new_x="LMARGIN", new_y="NEXT")
        self.set_x(left)
        self.set_font("Helvetica", "", 8.5)
        self.set_text_color(*MUTED)
        self.cell(0, 5, text(self.spec.get("subtitle", "")), new_x="LMARGIN", new_y="NEXT")
        self.set_xy(16, 12)
        self.set_font("Helvetica", "B", 17)
        self.set_text_color(*ACCENT)
        self.cell(self.width, 11, text(self.spec["title"].upper()), align="R", new_x="LMARGIN", new_y="NEXT")
        self.ln(6)

    def initials(self, name: str) -> float:
        self.set_xy(16, 12)
        self.set_fill_color(*ACCENT)
        self.set_text_color(255, 255, 255)
        self.set_font("Helvetica", "B", 13)
        self.cell(11, 11, text("".join(w[0] for w in name.split()[:2]).upper() or "B"), fill=True, align="C")
        return 11

    def facts(self, facts: list):
        if not facts:
            return
        per_row, w = 4, self.width / 4
        for start in range(0, len(facts), per_row):
            y = self.get_y()
            for n, (key, value) in enumerate(facts[start:start + per_row]):
                self.set_xy(16 + n * w, y)
                self.set_font("Helvetica", "", 7.5)
                self.set_text_color(*MUTED)
                self.cell(w - 2, 4, text(key).upper())
                self.set_xy(16 + n * w, y + 4)
                self.set_font("Helvetica", "B", 10.5)
                self.set_text_color(*INK)
                self.cell(w - 2, 6, text(value))
            self.set_y(y + 12)
        self.ln(2)

    def heading(self, title: str):
        self.set_font("Helvetica", "B", 10.5)
        self.set_text_color(*ACCENT)
        self.cell(0, 7, text(title), new_x="LMARGIN", new_y="NEXT")

    def section(self, s: dict):
        if self.get_y() > self.h - 50:
            self.add_page()
        self.heading(s["heading"])
        if "text" in s:
            self.set_font("Helvetica", "", 9.5)
            self.set_text_color(*INK)
            self.multi_cell(0, 5, text(s["text"] or "-"), new_x="LMARGIN", new_y="NEXT")
            self.ln(3)
            return
        self.table(s)

    def table(self, s: dict):
        cols = s["columns"]                                         # [(label, share of the width, "L" / "R" / "C")]
        total = sum(c[1] for c in cols)
        widths = [self.width * c[1] / total for c in cols]
        self.set_font("Helvetica", "B", 7.5)
        self.set_fill_color(241, 245, 249)
        self.set_text_color(*MUTED)
        for w, (label, _, align) in zip(widths, cols):
            self.cell(w, 7, text(label).upper(), fill=True, align=align)
        self.ln()
        rows = s.get("rows") or []
        if not rows:
            self.set_font("Helvetica", "I", 9)
            self.cell(0, 7, text(s.get("empty", "Nothing to show")), new_x="LMARGIN", new_y="NEXT")
        for row in rows + ([s["total"]] if s.get("total") else []):
            cells, flag = (row["cells"], row.get("flag")) if isinstance(row, dict) else (row, None)
            is_total = row is s.get("total")
            self.set_font("Helvetica", "B" if is_total else "", 9)
            self.set_text_color(*(BAD if flag == "bad" else INK))
            if self.get_y() > self.h - 24:
                self.add_page()
            for w, value, (_, _, align) in zip(widths, cells, cols):
                self.cell(w, 6.6, text(value)[:int(w * 0.55)], align=align)
            self.ln()
            self.set_draw_color(*LINE)
            self.line(16, self.get_y(), 16 + self.width, self.get_y())
        self.ln(4)

    def signatures(self, lines: list):
        """Signature lines: a label each ("Checked by"), or {"label", "image": bytes} to print a signature drawn on a phone."""
        if not lines:
            return
        if self.get_y() > self.h - 50:
            self.add_page()
        self.ln(10)
        w = self.width / len(lines)
        y = self.get_y() + (12 if any(isinstance(l, dict) and l.get("image") for l in lines) else 0)
        for n, line in enumerate(lines):
            label, image = (line.get("label", ""), line.get("image")) if isinstance(line, dict) else (line, None)
            draw_image(self, image, 16 + n * w, y - 12, 20, w - 14)
            self.set_draw_color(*MUTED)
            self.line(16 + n * w, y + 10, 16 + n * w + w - 10, y + 10)
            self.set_xy(16 + n * w, y + 11)
            self.set_font("Helvetica", "", 8)
            self.set_text_color(*MUTED)
            self.cell(w - 10, 5, text(label))

    def footer(self):
        self.set_y(-12)
        self.set_font("Helvetica", "", 7.5)
        self.set_text_color(*MUTED)
        self.cell(0, 5, text(f"{self.spec['title']} - printed {datetime.now().strftime('%Y-%m-%d %H:%M')}"))
        self.cell(0, 5, f"page {self.page_no()} of {{nb}}", align="R")
