#!/usr/bin/env bash
# Manage ALL services from here (inside a service folder, its own run.sh manages just that one).
#   scripts/run.sh start   [all|name]      scripts/run.sh stop [all|name]      scripts/run.sh restart [all|name]
#   scripts/run.sh status  [name]          UP / DOWN / STALE, counters, last error (heartbeats via Nexus)
#   scripts/run.sh logs    [name|errors|TRACE_ID]
#   scripts/run.sh trace   TRACE_ID        one request across every service
#   scripts/run.sh monitor [down]          Prometheus + Loki + Grafana -> http://<server>:3000 (logs, metrics, trace ids)
#   scripts/run.sh targets                 refresh Prometheus scrape targets after starting services
#   scripts/run.sh seed | admin EMAIL PASS NAME PHONE | test [path] | find WORD | catalog | new ...
#   scripts/run.sh nexus-check            which value formats the running Nexus server accepts
#   scripts/run.sh backup | restore DIR   every service database + Nexus + pictures (git push with BACKUP_GIT_REMOTE)
#   scripts/run.sh migrate [NAME]         Nexus data migrations (platform/tools/migrations/) - stop the services first
#   scripts/run.sh workspace [pin]        check grepx.workspace.yaml | scripts/run.sh new-product NAME   start a product
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
LOG_COMPONENT=run; . platform/tools/log.sh
VPY=.venv/bin/python
[ -x "$VPY" ] || die "no tooling .venv - run scripts/setup.sh first"
[ -f .venv/.ready ] || die "tooling .venv is incomplete (setup did not finish) - run scripts/setup.sh reset"
exec "$VPY" platform/tools/grepx_tools/manage.py "${@:-status}"
