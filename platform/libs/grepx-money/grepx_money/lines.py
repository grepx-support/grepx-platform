# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""Document lines as typed on a form -> checked lines with their amount in cents (invoices, bills, credit notes)."""
from decimal import Decimal

from .totals import Line, make_line, totals


def document_lines(raw_lines: list, items: dict[str, dict]) -> list[dict]:
    """[{item_id?, description?, qty, unit_price, discount?}]: an item (from `items`, by id) gives the description and unit;
    fully empty rows are skipped. Refuses: UNKNOWN_ITEM, INVALID_QUANTITY / PRICE / DISCOUNT, NO_LINES."""
    out = []
    for raw in raw_lines or []:
        item = items.get(raw.get("item_id") or "")
        if raw.get("item_id") and item is None:
            raise ValueError("UNKNOWN_ITEM")
        description = str(raw.get("description") or (item or {}).get("name") or "").strip()[:200]
        if not description and not raw.get("qty"):
            continue
        line = make_line(raw.get("qty"), raw.get("unit_price"), raw.get("discount") or 0)
        out.append({"item_id": raw.get("item_id") or "", "description": description or "Item",
                    "unit": (item or {}).get("unit") or str(raw.get("unit") or ""), "qty": str(line.qty.normalize()),
                    "unit_price": line.unit_price, "discount": str(line.discount.normalize()), "amount": totals([line]).subtotal})
    if not out:
        raise ValueError("NO_LINES")
    return out


def priced(doc: dict) -> dict:
    """The document with subtotal / discount / taxable / tax / total worked out again from its lines and rates."""
    lines = [Line(Decimal(l["qty"]), int(l["unit_price"]), Decimal(l.get("discount") or 0)) for l in doc["lines"]]
    return {**doc, **totals(lines, doc.get("tax_rate") or 0, doc.get("discount_rate") or 0).as_dict()}
