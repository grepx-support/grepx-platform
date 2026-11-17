#!/usr/bin/env bash
# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.
#
# Install or update the GrepX AI engine on this server - one command, safe to run again:
#   1 docker      Docker Engine + compose plugin (installed when missing)
#   2 engine      Ollama + Open WebUI (compose.yaml, project grepx-ai); WEBUI_SECRET_KEY kept in .env here
#   3 model       the free base model (GREPX_AI_BASE, default qwen2.5:3b - about 2 GB, runs on CPU)
#   4 projects    each project found on this server gets its own model from its catalog/ai_context.md
#                 (grepx-kitchen, grepx-electronics, grepx-blood-donation ...)
# Open WebUI: http://<server>:${WEBUI_PORT:-3000} - the first account made there is the admin.
# Every project's ai-service uses the engine on 127.0.0.1:11434 by itself (unless a paid GREPX_AI_KEY is set).
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
cd "$HERE"
say() { printf '%s %-5s [ai-engine] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$1" "$2"; }
die() { say ERROR "$1"; exit 1; }
step() { say INFO "── $1"; }
SUDO=""; [ "$(id -u)" -ne 0 ] && SUDO=sudo
URL="${GREPX_OLLAMA_URL:-http://127.0.0.1:11434}"; BASE="${GREPX_AI_BASE:-qwen2.5:3b}"

step "1/4 docker"
if ! command -v docker >/dev/null 2>&1; then
  say INFO "installing Docker Engine"
  curl -fsSL https://get.docker.com | $SUDO sh >/dev/null || die "could not install Docker"
fi
docker compose version >/dev/null 2>&1 || $SUDO apt-get install -y -qq docker-compose-plugin >/dev/null 2>&1 || die "docker compose plugin missing"
mem_gb=$(awk '/MemTotal/ {printf "%d", $2/1024/1024}' /proc/meminfo 2>/dev/null || echo 0)
[ "${mem_gb:-0}" -ge 6 ] || say WARN "this server has ${mem_gb} GB RAM - a 3B model needs about 3 GB free; try GREPX_AI_BASE=qwen2.5:1.5b"

step "2/4 engine (Ollama + Open WebUI)"
[ -f .env ] || touch .env
grep -q '^WEBUI_SECRET_KEY=' .env || echo "WEBUI_SECRET_KEY=$(head -c 32 /dev/urandom | base64 | tr -d '/+=' | head -c 40)" >> .env
$SUDO docker compose -p grepx-ai --env-file .env -f compose.yaml pull -q
$SUDO docker compose -p grepx-ai --env-file .env -f compose.yaml up -d
for _ in $(seq 1 60); do curl -fsS -m 2 "$URL/api/tags" >/dev/null 2>&1 && break; sleep 2; done
curl -fsS -m 2 "$URL/api/tags" >/dev/null 2>&1 || die "Ollama did not start - docker logs grepx-ollama"
say OK "engine up: Ollama on $URL (this server only), Open WebUI on port ${WEBUI_PORT:-3000}"

step "3/4 base model $BASE"
curl -fsS -m 3600 -X POST "$URL/api/pull" -H 'content-type: application/json' -d "{\"model\": \"$BASE\", \"stream\": false}" >/dev/null \
  && say OK "$BASE ready" || die "could not download $BASE"

step "4/4 a model per project"
found=0
for root in "$HERE/../../.." "$HERE/../../../.." ${GREPX_ROOT:-}; do        # the project next to this platform, and every project on the server
  for ctx in "$root"/grepx-*/product-services/*/catalog/ai_context.md "$root"/*/grepx-*/product-services/*/catalog/ai_context.md; do
    [ -f "$ctx" ] || continue
    product="$(basename "$(dirname "$(dirname "$ctx")")")"
    bash "$HERE/register.sh" "grepx-$product" "$ctx" && found=$((found + 1))
  done
done
[ "$found" -gt 0 ] || say WARN "no project found next to this platform - each project registers its own model when it deploys"
say OK "AI engine ready - Open WebUI: http://$(hostname -I 2>/dev/null | awk '{print $1}'):${WEBUI_PORT:-3000} (the first account there is the admin)"
