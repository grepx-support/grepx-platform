<!--
  Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
  This file is part of the GrepX platform and is proprietary and confidential.
  Unauthorised copying, use, modification or distribution is strictly prohibited.
-->
# GrepX AI engine

Free, private AI for every GrepX project, on the project's own server.

| Part | What it is | Where |
| --- | --- | --- |
| Ollama | runs the language models | `127.0.0.1:11434` (this server only) |
| Base model | `qwen2.5:3b` (about 2 GB, CPU) - `GREPX_AI_BASE` to change | Ollama |
| Project models | `grepx-kitchen`, `grepx-electronics`, `grepx-blood-donation` - the base model + the project's own context (`product-services/<p>/catalog/ai_context.md`) | Ollama |
| Open WebUI | a ChatGPT-style screen for the team, with the project models | port `3000` |
| ai-service | each project's AI: jobs, chats, limits; uses this engine unless `GREPX_AI_KEY` (Anthropic) is set | each project |

Install / update: `./install.sh ai` (orchestrator) or `bash platform/ai-engine/deploy.sh`.
A project registers its own model when it deploys (`register.sh`); editing its `ai_context.md` and deploying again updates it.
Open WebUI: open `http://<server>:3000`, create the first account (the admin), then set `WEBUI_SIGNUP=false` in `platform/ai-engine/.env` and deploy again.
