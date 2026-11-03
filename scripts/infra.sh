#!/usr/bin/env bash
# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

# Install and start the infrastructure described in config/infra.yaml (run this first).
#   scripts/infra.sh            install toolchain + start the database engines the services are configured for
#   scripts/infra.sh plan       which service uses which database
#   scripts/infra.sh status     are the engines up?        scripts/infra.sh down    stop them
# Then: scripts/setup.sh  ->  scripts/run.sh start
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
LOG_COMPONENT=infra; . platform/tools/log.sh; . platform/tools/python.sh
CMD="${1:-up}"
log_info "infra $CMD (config/infra.yaml)"
want() { grep -E "^\s*$1:" config/infra.yaml | head -1 | sed -E 's/.*:\s*([a-z]+).*/\1/'; }
have() { command -v "$1" >/dev/null 2>&1; }
SUDO=""; [ "$(id -u)" -ne 0 ] && SUDO=sudo   # root (e.g. a VPS) needs no sudo
os() { case "$(uname -s)" in Darwin*) echo mac;; *) echo linux;; esac; }
install() {  # install <name> <apt package> <brew formula>
  if have "$1"; then return; fi
  log_info "installing $1"
  case "$(os)" in
    linux) $SUDO apt-get update -qq && $SUDO apt-get install -y -qq "$2" ;;
    mac) have brew || die "install Homebrew first: https://brew.sh"; brew install "$3" ;;
  esac
}

if [ "$CMD" = "up" ]; then
  PY=""; for c in python3 python py; do [ -z "$PY" ] && have "$c" && "$c" -c 'import sys; sys.exit(sys.version_info < (3, 10))' 2>/dev/null && PY="$c"; done
  [ -n "$PY" ] || { install python3 python3 python@3.12; PY=python3; }
  [ "$(want git)" = true ] && install git git git
  if [ "$(want flutter)" = true ] && ! have flutter; then
    git clone --depth 1 -b stable https://github.com/flutter/flutter.git "$HOME/flutter" && log_warn "add \$HOME/flutter/bin to PATH"
  fi
fi

find_python
make_venv .venv                     # installs python3-venv on Debian/Ubuntu and repairs a broken .venv
VPY="$(venv_python .venv)"
"$VPY" -m pip install -q --disable-pip-version-check pyyaml 2>&1 | log_each

if [ "$CMD" = "up" ]; then
  NEED_DOCKER="$(want docker)"
  if [ "$NEED_DOCKER" = auto ]; then
    NEED_DOCKER=false
    "$VPY" platform/tools/grepx_tools/infra.py plan | grep -qE '^\S+\s+(postgres|mongo)\s' && grep -qE '^\s*mode:\s*docker' config/infra.yaml && NEED_DOCKER=true
    grep -qE '^monitoring:\s*true' config/infra.yaml && NEED_DOCKER=true
  fi
  if [ "$NEED_DOCKER" = true ] && ! have docker; then
    case "$(os)" in
      linux) install docker docker.io docker Docker.DockerDesktop; $SUDO apt-get install -y -qq docker-compose-v2 || true; $SUDO usermod -aG docker "$USER" || true ;;
      *) die "Docker Desktop is needed: https://www.docker.com/products/docker-desktop/ - install it, start it, then re-run scripts/infra.sh" ;;
    esac
  fi
fi
exec "$VPY" platform/tools/grepx_tools/infra.py "$CMD"
