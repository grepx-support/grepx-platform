#!/usr/bin/env bash
# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

# Manage this service on its own (./run.sh start|stop|restart|status|logs|test); the steps live in platform/tools/service_run.sh.
HERE="$(cd "$(dirname "$0")" && pwd)"; ROOT="${GREPX_HOME:-$HERE}"; while [ ! -f "$ROOT/platform/tools/service_run.sh" ]; do [ "$ROOT" = / ] && { echo "no GrepX workspace above $HERE - set GREPX_HOME" >&2; exit 1; }; ROOT="$(dirname "$ROOT")"; done
exec bash "$ROOT/platform/tools/service_run.sh" "$HERE" "$@"
