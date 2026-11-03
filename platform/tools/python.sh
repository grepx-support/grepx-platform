# Shared Python helpers for setup scripts (sourced after log.sh).
#   find_python        -> sets PY to a Python 3.10+ (python3, python, py)
#   make_venv DIR      -> creates DIR as a working virtualenv; on Debian/Ubuntu installs python3.X-venv if needed
#   venv_python DIR    -> prints DIR's python path
#   pip_install PY REQ -> install a requirements file reliably (build tools first, no build isolation, one retry)
find_python() {
  PY="${PYTHON:-}"
  for c in python3 python py; do
    [ -z "$PY" ] && command -v "$c" >/dev/null 2>&1 && "$c" -c 'import sys; sys.exit(sys.version_info < (3, 10))' 2>/dev/null && PY="$c"
  done
  [ -n "$PY" ] || die "Python 3.10+ not found - run scripts/infra.sh, or set PYTHON=/path/to/python3"
}

venv_python() { echo "$1/bin/python"; }

_venv_ok() { [ -d "$1" ] && "$(venv_python "$1")" -m pip --version >/dev/null 2>&1; }

_try_venv() { rm -rf "$1"; "$PY" -m venv "$1" >/dev/null 2>&1 && _venv_ok "$1"; }

make_venv() {
  local dir="$1"
  _venv_ok "$dir" && return 0
  [ -d "$dir" ] && log_warn "removing broken virtualenv $dir"
  log_info "creating virtualenv $dir"
  _try_venv "$dir" && return 0
  # Debian/Ubuntu ship Python without ensurepip's wheels: install the matching -venv package and retry
  local ver pkg SUDO=""
  ver="$("$PY" -c 'import sys; print(f"{sys.version_info[0]}.{sys.version_info[1]}")')"; pkg="python${ver}-venv"
  if command -v apt-get >/dev/null 2>&1; then
    [ "$(id -u)" -ne 0 ] && SUDO=sudo
    log_warn "Python's venv support is missing - installing $pkg (apt)"
    $SUDO apt-get update -qq >/dev/null 2>&1 || true
    $SUDO apt-get install -y -qq "$pkg" >/dev/null 2>&1 || $SUDO apt-get install -y -qq python3-venv >/dev/null 2>&1 || log_warn "apt could not install $pkg"
    _try_venv "$dir" && { log_ok "virtualenv created"; return 0; }
  fi
  # last resort: venv without pip, then bootstrap pip from pypa
  log_warn "falling back to venv --without-pip + get-pip.py"
  rm -rf "$dir"
  if "$PY" -m venv --without-pip "$dir" >/dev/null 2>&1 && command -v curl >/dev/null 2>&1 \
     && curl -fsSL https://bootstrap.pypa.io/get-pip.py | "$(venv_python "$dir")" - -q >/dev/null 2>&1 && _venv_ok "$dir"; then
    log_ok "virtualenv created (pip bootstrapped)"; return 0
  fi
  rm -rf "$dir"
  die "could not create a virtualenv - install Python venv support (Debian/Ubuntu: apt install $pkg) and re-run"
}

pip_install() {   # pip_install <venv-python> <requirements file>
  # Third-party packages come from pip; the repo's own libraries (-e lines) are linked with a .pth file
  # instead of being built by pip (no build backend subprocess that can fail or be killed).
  local vpy="$1" req="$2" tmp site
  rm -f "$("$vpy" -c 'import sysconfig; print(sysconfig.get_paths()["purelib"])')/grepx-libs.pth"
  tmp="$(mktemp -d)"
  "$vpy" "$GREPX_ROOT/platform/tools/grepx_tools/reqs.py" "$req" "$tmp" 2>&1 | log_each
  # one package per pip run: low peak memory, and a failure names the package
  local pkg n=0 total
  total="$(grep -c . "$tmp/third_party.txt" || true)"
  while IFS= read -r pkg; do
    [ -n "$pkg" ] || continue
    n=$((n + 1)); log_info "    pip [$n/$total] $pkg"
    if ! "$vpy" -m pip install -q --no-cache-dir --disable-pip-version-check "$pkg" </dev/null 2>&1 | log_each; then
      log_warn "    pip failed for $pkg - retrying once"
      "$vpy" -m pip install --no-cache-dir --disable-pip-version-check "$pkg" </dev/null 2>&1 | log_each \
        || { rm -rf "$tmp"; die "pip could not install $pkg - see the errors above"; }
    fi
  done < "$tmp/third_party.txt"
  site="$("$vpy" -c 'import sysconfig; print(sysconfig.get_paths()["purelib"])')"
  cp "$tmp/grepx-libs.pth" "$site/grepx-libs.pth"     # after pip, so pip never sees (or "fixes") our libraries
  rm -rf "$tmp"
}
