<!--
  Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
  This file is part of the GrepX platform and is proprietary and confidential.
  Unauthorised copying, use, modification or distribution is strictly prohibited.
-->

# grepx-platform

The GrepX platform kit: everything a product workspace runs on, but nothing about any one product.

| Folder | What |
|---|---|
| `platform/libs/` | the libraries: config, Nexus client, service kit, BFF kit, auth, storage, store, testkit, contracts (generated at setup) |
| `platform/tools/` | `grepx_tools` (behind `scripts/run.sh`), service script templates, data migrations, platform gate tests |
| `platform/nexus-server/` | how the Nexus hub is set up and run; the binary itself comes from **grepx-nexus-cpp** |
| `scripts/` | `infra.sh` → `setup.sh` → `run.sh` - the only entry points |
| `observability/`, `infra/` | Prometheus + Loki + Grafana; local database engines |
| `docs/` | `ARCHITECTURE.md`, `DEVELOPMENT-GUIDE.md` |

This repo is not run on its own. A product repo (e.g. **grepx-blood-donation**) is the workspace: its `./workspace.sh`
links `platform/`, `scripts/`, `observability/` and `infra/` from here, and `common-services/` from **grepx-services**.

```bash
git clone …/grepx-platform  git clone …/grepx-services  git clone …/grepx-nexus-cpp  git clone …/grepx-blood-donation
cd grepx-blood-donation && ./workspace.sh && scripts/setup.sh && scripts/run.sh start
```

Rules: no product words in this repo (`platform/tools/test/test_product_agnostic.py`), no library import cycles
(`test_deps.py`), versions of every library equal the `platform.version` a workspace pins (`scripts/run.sh workspace`).
