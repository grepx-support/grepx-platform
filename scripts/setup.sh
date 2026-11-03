#!/usr/bin/env bash
# Set up services from here (inside a service folder, its own setup.sh does the same for just that one).
#   scripts/setup.sh                       install all  (tooling .venv + every service's .venv, database, tables)
#   scripts/setup.sh install [all|name]    install / update all or one service   (scripts/setup.sh event-service works too)
#   scripts/setup.sh reset   [all|name]    delete the .venv(s) and set up from scratch - data is kept
#   scripts/setup.sh db      [all|name]    only (re)create databases and tables
#   scripts/setup.sh list                  services you can name
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
LOG_COMPONENT=setup; . platform/tools/log.sh; . platform/tools/python.sh
case "${1:-install}" in
  install|reset|db|list) MODE="${1:-install}"; TARGET="${2:-all}" ;;
  *) MODE=install; TARGET="$1" ;;
esac
find_python
if [ "$MODE" = reset ] && [ "$TARGET" = all ] && [ -d .venv ]; then log_warn "reset: removing tooling .venv"; rm -rf .venv; fi
if [ "$MODE" != db ] && [ "$MODE" != list ]; then
  log_info "step 1/2 tooling environment (.venv at the repo root, used by scripts/run.sh)"
  make_venv .venv
fi
VPY="$(venv_python .venv)"
[ -x "$VPY" ] || die "tooling not set up - run scripts/setup.sh first"
if [ "$MODE" != db ] && [ "$MODE" != list ]; then
  log_info "installing platform libraries (first time can take a minute)"
  rm -f .venv/.ready
  pip_install "$VPY" requirements.txt
  "$VPY" -c "import yaml, nexus_api, grepx_store" 2>&1 | log_each || die "tooling .venv is incomplete - run scripts/setup.sh reset"
  touch .venv/.ready
  log_ok "tooling ready"
  [ -f .env ] || { cp .env.example .env; log_warn "created .env from .env.example - set JWT_SECRET, SITE_URL, SMTP_*, TWILIO_*"; }
  log_info "generated code: service contracts + catalogue (from the services in config/services.ini)"
  "$VPY" platform/tools/grepx_tools/manage.py contracts || die "could not generate grepx_contracts"
  "$VPY" platform/tools/grepx_tools/manage.py catalog >/dev/null || log_warn "catalogue not refreshed"
  log_info "step 2/2 services ($MODE $TARGET)"
fi
exec "$VPY" platform/tools/grepx_tools/manage.py setup "$MODE" "$TARGET"
