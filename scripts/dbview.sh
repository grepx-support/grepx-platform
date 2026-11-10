#!/usr/bin/env bash
# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

# Read-only web viewer of every database (Nexus + each service). Run from the product folder on the server.
#   scripts/dbview.sh            start (if not running) and print the address, user and password
#   scripts/dbview.sh status     is it running, address, user, password
#   scripts/dbview.sh stop
#   scripts/dbview.sh list       which databases it shows
# Settings in .env: DBVIEW=on (start/stop with the services), DBVIEW_PORT, DBVIEW_HOST, DBVIEW_USER, DBVIEW_PASSWORD.
set -euo pipefail
exec "$(cd "$(dirname "$0")" && pwd)/run.sh" dbview "${@:-start}"
