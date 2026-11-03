# Shared logging for every GrepX shell script (sourced, not run). One format everywhere:
#   2026-10-31 15:33:01 INFO  [component] message
# Lines also go to logs/scripts.log at the repo root. Python tools use the same format (grepx_tools/log.py).
GREPX_ROOT="${GREPX_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
export GREPX_HOME="${GREPX_HOME:-$GREPX_ROOT}"   # the workspace (logical path: platform/ may be a linked repo)
GREPX_LOG_FILE="${GREPX_LOG_FILE:-$GREPX_ROOT/logs/scripts.log}"
mkdir -p "$(dirname "$GREPX_LOG_FILE")" 2>/dev/null || true
_log() {
  local level="$1"; shift
  local line; line="$(date '+%Y-%m-%d %H:%M:%S') $(printf '%-5s' "$level") [${LOG_COMPONENT:-grepx}] $*"
  if [ "$level" = ERROR ] || [ "$level" = WARN ]; then echo "$line" >&2; else echo "$line"; fi
  echo "$line" >> "$GREPX_LOG_FILE" 2>/dev/null || true
}
log_info()  { _log INFO "$@"; }
log_ok()    { _log OK "$@"; }
log_warn()  { _log WARN "$@"; }
log_error() { _log ERROR "$@"; }
die()       { _log ERROR "$@"; exit 1; }
log_each()  {   # pipe a command's output through it: each line logged, errors as ERROR
  while IFS= read -r l; do
    [ -n "$l" ] || continue
    case "$l" in *Traceback*|*Error*|*error:*|*ERROR*) _log ERROR "$(echo "$l" | sed 's/^ *//')" ;; *) _log INFO "$(echo "$l" | sed 's/^ *//')" ;; esac
  done
}
