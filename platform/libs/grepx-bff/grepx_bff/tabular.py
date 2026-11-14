# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""Tables in and out of files: read a CSV or Excel upload into rows keyed by its column headings, and write rows as CSV
or Excel. Headings are matched loosely ("Unit cost", "unit_cost", "UNIT COST" are the same column). No product words:
what the columns mean is the caller's business."""
from __future__ import annotations

import csv
import io
import re
from dataclasses import dataclass

MAX_ROWS = 5000
MAX_BYTES = 5 * 1024 * 1024


class TableError(ValueError):
    pass


def norm(heading) -> str:
    return re.sub(r"[^a-z0-9]+", " ", str(heading or "").lower()).strip()


@dataclass(frozen=True)
class Table:
    headings: list[str]
    rows: list[dict]          # {normalised heading: cell text}, with "_row" = the row number in the file


def read(data: bytes, filename: str) -> Table:
    """CSV (comma, semicolon or tab; UTF-8 with or without BOM, else Latin-1) or .xlsx (first sheet)."""
    if len(data) > MAX_BYTES:
        raise TableError("FILE_TOO_LARGE")
    grid = _xlsx(data) if filename.lower().endswith((".xlsx", ".xlsm")) else _csv(data)
    grid = [[_text(c) for c in row] for row in grid]
    while grid and not any(grid[0]):
        grid.pop(0)
    if not grid:
        raise TableError("EMPTY_FILE")
    heads = [norm(h) for h in grid[0]]
    rows = [{"_row": n + 2, **{h: row[i] if i < len(row) else "" for i, h in enumerate(heads) if h}} for n, row in enumerate(grid[1:]) if any(row)]
    if len(rows) > MAX_ROWS:
        raise TableError("TOO_MANY_ROWS")
    return Table([h for h in grid[0] if norm(h)], rows)


def _text(cell) -> str:
    if cell is None:
        return ""
    if isinstance(cell, float) and cell.is_integer():
        return str(int(cell))
    if hasattr(cell, "isoformat"):
        return cell.isoformat()[:10]
    return str(cell).strip()


def _csv(data: bytes) -> list[list]:
    try:
        text = data.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = data.decode("latin-1")
    try:
        dialect = csv.Sniffer().sniff(text[:4096], delimiters=",;\t")
    except csv.Error:
        dialect = csv.excel
    return list(csv.reader(io.StringIO(text), dialect))


def _xlsx(data: bytes) -> list[list]:
    from openpyxl import load_workbook
    try:
        book = load_workbook(io.BytesIO(data), read_only=True, data_only=True)
    except Exception as exc:
        raise TableError("NOT_A_SPREADSHEET") from exc
    return [list(r) for r in book.worksheets[0].iter_rows(values_only=True)]


def shown(v):
    """What a cell shows: nothing for None, 28000 rather than 28000.0."""
    if v is None:
        return ""
    return int(v) if isinstance(v, float) and v.is_integer() else v


def write_csv(headings: list[str], rows: list[list]) -> bytes:
    out = io.StringIO()
    w = csv.writer(out)
    w.writerow(headings)
    w.writerows([[shown(v) for v in r] for r in rows])
    return ("﻿" + out.getvalue()).encode("utf-8")          # the BOM makes Excel open it as UTF-8


def write_xlsx(headings: list[str], rows: list[list], sheet: str = "Data", notes: list[str] | None = None) -> bytes:
    """One sheet with bold, frozen headings and sensible widths; notes (how to fill it in) on a second sheet."""
    from openpyxl import Workbook
    from openpyxl.styles import Font, PatternFill
    book = Workbook()
    ws = book.active
    ws.title = sheet[:31]
    ws.append(headings)
    for r in rows:
        ws.append([shown(v) for v in r])
    for cell in ws[1]:
        cell.font, cell.fill = Font(bold=True, color="FFFFFF"), PatternFill("solid", fgColor="0F766E")
    ws.freeze_panes = "A2"
    for i, h in enumerate(headings, start=1):
        width = max([len(str(h))] + [len(str(r[i - 1])) for r in rows[:200] if i - 1 < len(r)])
        ws.column_dimensions[ws.cell(1, i).column_letter].width = min(48, max(10, width + 2))
    if notes:
        help_ = book.create_sheet("How to fill it in")
        for line in notes:
            help_.append([line])
        help_.column_dimensions["A"].width = 110
    out = io.BytesIO()
    book.save(out)
    return out.getvalue()
