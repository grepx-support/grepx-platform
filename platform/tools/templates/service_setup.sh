#!/usr/bin/env bash
# Set up this service on its own (./setup.sh [install|reset|db]); the steps live once in platform/tools/service_setup.sh.
HERE="$(cd "$(dirname "$0")" && pwd)"; ROOT="${GREPX_HOME:-$HERE}"; while [ ! -f "$ROOT/platform/tools/service_setup.sh" ]; do [ "$ROOT" = / ] && { echo "no GrepX workspace above $HERE - set GREPX_HOME" >&2; exit 1; }; ROOT="$(dirname "$ROOT")"; done
exec bash "$ROOT/platform/tools/service_setup.sh" "$HERE" "$@"
