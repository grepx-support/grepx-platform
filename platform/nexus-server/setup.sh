#!/usr/bin/env bash
# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

# Set up the Nexus hub (the C++ nexus_server binary - copy it yourself into platform/nexus-server/bin/).
# Prepares bin/nexus_data.db: the server's schema + the Nexus user from NEXUS_USERNAME / NEXUS_PASSWORD (.env).
#   ./setup.sh | ./setup.sh reset   (reset deletes bin/nexus_data.db first)
set -euo pipefail
cd "$(dirname "$0")"
ROOT="${GREPX_HOME:-$PWD}"; while [ ! -f "$ROOT/platform/tools/log.sh" ]; do [ "$ROOT" = / ] && { echo "no GrepX workspace above $PWD - set GREPX_HOME" >&2; exit 1; }; ROOT="$(dirname "$ROOT")"; done
LOG_COMPONENT=nexus-server; . "$ROOT/platform/tools/log.sh"; . "$ROOT/platform/tools/python.sh"
find_python
MODE="${1:-install}"
DB=bin/nexus_data.db
[ "$MODE" = reset ] && [ -f "$DB" ] && { log_warn "reset: removing $DB"; rm -f "$DB"; }
log_info "1/2 C++ binary"
if [ -f bin/nexus_server ]; then
  chmod 755 bin/nexus_server
  log_ok "    found bin/nexus_server"
else
  log_warn "    bin/nexus_server missing - copy the C++ binary into platform/nexus-server/bin/ (run.sh start needs it)"
fi
log_info "2/2 database $DB"
"$PY" prepare_db.py "$DB" "${NEXUS_USERNAME:-demo}" "${NEXUS_PASSWORD:-demo}" 2>&1 | log_each
[ -f "$ROOT/.venv/bin/python" ] && "$ROOT/.venv/bin/python" "$ROOT/platform/tools/grepx_tools/nexus_accounts.py" 2>&1 | log_each
log_ok "nexus-server ready"
