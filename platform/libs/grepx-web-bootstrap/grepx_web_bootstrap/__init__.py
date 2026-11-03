# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""Framework-agnostic web server bootstrap, plus automatic port allocation.

    from grepx_web_bootstrap import run_server, create_health_app
    run_server(app, service="catalog")
"""
from .health import create_health_app, prometheus_text
from .server import run_server

__all__ = ["run_server", "create_health_app", "prometheus_text"]
