#!/usr/bin/env bash
# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.
#
# Register (or update) one project's own model on the AI engine: the base model + the project's context as its system
# prompt. Run by each project's deploy (and by the engine's deploy for every project it finds); does nothing - and says
# so - when the engine is not running on this server.
#   platform/ai-engine/register.sh grepx-electronics product-services/electronics/catalog/ai_context.md
set -uo pipefail
NAME="${1:?model name, e.g. grepx-kitchen}"; CONTEXT="${2:?path of the ai_context.md of the project}"
URL="${GREPX_OLLAMA_URL:-http://127.0.0.1:11434}"; BASE="${GREPX_AI_BASE:-qwen2.5:3b}"
say() { printf '%s %-5s [ai-model] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$1" "$2"; }
[ -f "$CONTEXT" ] || { say WARN "$NAME: no context file at $CONTEXT"; exit 0; }
curl -fsS -m 3 "$URL/api/tags" >/dev/null 2>&1 || { say INFO "$NAME: the AI engine is not running here (install it: ./install.sh ai) - skipped"; exit 0; }
body="$(python3 "$(dirname "$0")/model_body.py" "$NAME" "$BASE" "$CONTEXT")"
if out="$(curl -fsS -m 600 -X POST "$URL/api/create" -H 'content-type: application/json' -d "$body" 2>&1)"; then
  say OK "$NAME ready on the AI engine (from $BASE, with its own context)"
else
  say WARN "$NAME not registered: $out"
fi
