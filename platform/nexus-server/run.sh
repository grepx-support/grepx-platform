#!/usr/bin/env bash
# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

# Manage THIS service on its own:  ./run.sh start | stop | restart | status | logs | test
# Same as scripts/run.sh <command> <service-name> from the repo root, which manages all services.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="${GREPX_HOME:-$HERE}"; while [ ! -f "$ROOT/scripts/run.sh" ]; do [ "$ROOT" = / ] && { echo "no GrepX workspace above $HERE - set GREPX_HOME" >&2; exit 1; }; ROOT="$(dirname "$ROOT")"; done
NAME="$(sed -n 's/^service_name: *//p' "$HERE/config/config.yaml" 2>/dev/null || true)"; NAME="${NAME:-$(basename "$HERE")}"
CMD="${1:-status}"
[ "$CMD" = "test" ] && exec "$ROOT/scripts/run.sh" test "$HERE/test"
exec "$ROOT/scripts/run.sh" "$CMD" "$NAME"
