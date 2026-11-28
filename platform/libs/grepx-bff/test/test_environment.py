# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""The server's environment (GREPX_ENV) travels in product.json, so the shell can show it on every page."""
from grepx_bff.app import with_environment


def test_environment_is_added_only_when_the_server_names_one(monkeypatch):
    monkeypatch.delenv("GREPX_ENV", raising=False)
    assert with_environment({"name": "X"}) == {"name": "X"}
    monkeypatch.setenv("GREPX_ENV", " production ")
    assert with_environment({"name": "X"}) == {"name": "X", "environment": "production"}
