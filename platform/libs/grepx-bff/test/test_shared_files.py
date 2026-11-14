# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""Files shared by link: served until their last day, never with a made-up or altered token."""
from datetime import date

from grepx_storage import LocalStorage

from grepx_bff.shared_files import fetch, publish


def test_link_works_until_its_last_day(tmp_path, monkeypatch):
    monkeypatch.setenv("SITE_URL", "https://kitchen.example")
    store = LocalStorage(tmp_path)
    url = publish(store, b"%PDF-1", "Payslip Nov 2026.pdf", days=3, today=date(2026, 11, 1))
    assert url.startswith("https://kitchen.example/api/v1/files/20261104") and url.endswith("/Payslip-Nov-2026.pdf")
    token, name = url.split("/")[-2:]
    assert fetch(store, token, name, today=date(2026, 11, 4)) == b"%PDF-1"
    assert fetch(store, token, name, today=date(2026, 11, 5)) is None                  # expired
    assert fetch(store, "20991231" + "0" * 32, name, today=date(2026, 11, 1)) is None   # unknown
    assert fetch(store, "../etc", name) is None
