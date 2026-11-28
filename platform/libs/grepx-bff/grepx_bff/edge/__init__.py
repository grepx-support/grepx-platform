# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""The edge layer every GrepX product's BFF gets from create_app (moved here from FleetWise's edge.py, SEC-11 / A-1 / A-4 / A-5):

    headers   Permissions-Policy, HSTS over HTTPS (nosniff, frame and referrer headers are set in app.py)
    csp       a Content-Security-Policy per HTML page, inline scripts allowed by their hash; Report-Only until CSP_MODE=enforce
    limits    failed sign-ins per address; CSP reports per address
    cors      the origins allowed to call the API (CORS_ORIGINS; "*" only where the API uses bearer tokens, never cookies)

A product adds hosts its pages load from in config.yaml: edge: {connect: [...], img: [...], font: [...], style: [...]}."""
from .csp import Policy, inline_hashes, sha256
from .limits import FailureWindow, RateWindow
from .middleware import harden
from .options import EdgeOptions, cors_origins

__all__ = ["EdgeOptions", "FailureWindow", "Policy", "RateWindow", "cors_origins", "harden", "inline_hashes", "sha256"]
