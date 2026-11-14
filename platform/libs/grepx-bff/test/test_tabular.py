# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""Tables in and out of files: CSV in any common shape and Excel read the same; what is written reads back."""
import pytest

from grepx_bff.tabular import TableError, read, write_csv, write_xlsx


def test_csv_and_excel_read_the_same():
    heads, rows = ["Name", "Unit cost", "Kind"], [["Basmati rice", 92.5, "ingredient"], ["Naan", 4, "finished"]]
    for data, name in ((write_csv(heads, rows), "items.csv"), (write_xlsx(heads, rows, notes=["Fill one row per item."]), "items.xlsx")):
        t = read(data, name)
        assert t.headings == heads and t.rows[0] == {"_row": 2, "name": "Basmati rice", "unit cost": "92.5", "kind": "ingredient"}
        assert t.rows[1]["unit cost"] == "4"
    semi = read("\n\nNAME;UNIT_COST\nTomato;30\n;\n".encode("latin-1"), "x.csv")
    assert semi.rows == [{"_row": 2, "name": "Tomato", "unit cost": "30"}]
    for bad, why in ((b"", "EMPTY_FILE"), (b"x" * (6 * 1024 * 1024), "FILE_TOO_LARGE"), (b"not a zip", "NOT_A_SPREADSHEET")):
        with pytest.raises(TableError, match=why):
            read(bad, "a.xlsx" if why == "NOT_A_SPREADSHEET" else "a.csv")
