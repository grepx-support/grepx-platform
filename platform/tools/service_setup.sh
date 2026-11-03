#!/usr/bin/env bash
# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

# platform/tools/service_setup.sh <service-folder> [install|reset|db] - shared by every service's own setup.sh.
# Sets up ONE service: a private .venv with only its requirements, then its database and tables.
#   ./setup.sh          install (or update) - safe to run again
#   ./setup.sh reset    delete this service's .venv and set it up from scratch (its data is kept)
#   ./setup.sh db       only (re)create its database and tables
# From the repo root, scripts/setup.sh does the same for all services or one by name.
set -euo pipefail
cd "$1"; shift
ROOT="${GREPX_HOME:-$PWD}"; while [ ! -f "$ROOT/platform/tools/log.sh" ]; do [ "$ROOT" = / ] && { echo "no GrepX workspace above $PWD - set GREPX_HOME" >&2; exit 1; }; ROOT="$(dirname "$ROOT")"; done
LOG_COMPONENT="$(basename "$PWD")"; . "$ROOT/platform/tools/log.sh"; . "$ROOT/platform/tools/python.sh"
find_python
MODE="${1:-install}"
case "$MODE" in install|reset|db) ;; *) die "unknown option '$MODE' - use: install | reset | db" ;; esac
VPY="$(venv_python .venv)"
if [ "$MODE" = db ]; then
  [ -x "$VPY" ] || die "not set up yet - run ./setup.sh first"
  log_info "database + tables"; "$VPY" -m grepx_store "$PWD" 2>&1 | log_each; log_ok "database ready"; exit 0
fi
if [ "$MODE" = reset ] && [ -d .venv ]; then log_warn "reset: removing .venv"; rm -rf .venv; fi
log_info "1/3 virtualenv (.venv)"; make_venv .venv
VPY="$(venv_python .venv)"
log_info "2/3 installing $(grep -cvE '^\s*(#|$)' requirements.txt) requirements (first time can take a minute)"
rm -f .venv/.ready
pip_install "$VPY" requirements.txt
if [ -f config/config.yaml ]; then
  log_info "3/3 database + tables"
  "$VPY" -m grepx_store "$PWD" 2>&1 | log_each
else
  log_info "3/3 no database needed"
fi
touch .venv/.ready                                                     # run.sh only uses a finished venv
log_ok "ready"
