# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""The public page: the company name is needed, colours are checked, lists are capped, a broken stored value reads as none."""
import pytest

from grepx_bff.site import clean_site, read_site


def test_site_page():
    page = clean_site({"company": "  Galaxy   Mobiles ", "color": "#ff6600", "highlights": [{"title": "Genuine phones", "text": "Brand warranty"}, {"title": ""}],
                       "brands": ["Samsung", " ", "Apple"]})
    assert page["company"] == "Galaxy Mobiles" and page["highlights"] == [{"icon": "check", "title": "Genuine phones", "text": "Brand warranty"}]
    assert page["brands"] == ["Samsung", "Apple"] and page["show_sign_in"] is True
    for bad in ({"company": ""}, {"company": "X", "color": "red"}):
        with pytest.raises(ValueError):
            clean_site(bad)
    assert read_site("not json") == {} and read_site("") == {}
