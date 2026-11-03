<!--
  Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
  This file is part of the GrepX platform and is proprietary and confidential.
  Unauthorised copying, use, modification or distribution is strictly prohibited.
-->

# Development guide — how to turn a requirement into services

Written for whoever (human or AI) picks up the next requirement. Follow the steps in order.

## 1. Understand the requirement
* Write or update the product spec (like `docs/SPECIFICATION.md`): screens, rules, messages, jobs, roles.
* List the **capabilities** it needs as short verbs + nouns: "send reminder", "book slot", "upload photo", "approve stock count".

## 2. Search before you build
```bash
scripts/run.sh find reminder        # searches catalog/services.json (names, actions, descriptions, tables)
scripts/run.sh find photo
cat docs/SERVICE_CATALOG.md   # everything at a glance
```
For each capability decide:

| Situation | Do this |
|---|---|
| A service already does it | **Reuse** — send its request rows (from a BFF route or `ctx.request(...)`) |
| A common service *almost* does it and the gap is product-agnostic | **Extend** it: new action file + dto value + tests. Never put product words in a common service (a test enforces it) |
| A common service does it but needs a product rule (eligibility, audiences, extra profile fields, report figures) | **Plugin**: a module in `product-services/<p>/plugins/` named under `plugins:` in the deployment file |
| It only makes sense for this product | **New product service** in `product-services/<product>/` |
| Any other product could use it | **New common service** in `common-services/` |
| It's only presentation (layout, copy, colours, which screens) | **No service** — product config/UI module |
| It needs data the product already has in another service | Read that service's state table; never copy its rules |

Configuration, not code, makes a common service product-specific: templates (template-service SEED), checklists
(checklist-service SEED_TEMPLATE), permissions and roles (access-service REGISTER_PERMISSION, SAVE_ROLE), schedules
(scheduler REGISTER) — all kept as YAML in `product-services/<product>/catalog/` and loaded by `scripts/run.sh seed`
(`grepx_service.catalog.seed_catalog`; the folder is declared as `catalog:` in `config/projects/<product>.yaml`).

### Where each kind of value lives (change it once, there)
| Value | Central place | Read with |
|---|---|---|
| Public site address, organisation name, time zone | `.env` `SITE_URL`, `ORG_NAME`, `TIMEZONE` | `grepx_config.deployment` (`site_url()`, `org_name()`, `timezone()`); `grepx_service.local_today()` |
| Which product this deployment runs, pinned versions | `grepx.workspace.yaml` | `grepx_config.workspace_file()`, `scripts/run.sh workspace` |
| Page links in messages (`/drive/{id}`, `/dashboard` …) | deployment file `links:` | `grepx_config.deployment.link(cfg, "event", id=…)` |
| Role ladder (member / staff / admin names) | deployment file `roles:` | `grepx_common.Roles.of(cfg)` (auth, access, BFF, web) |
| Home-country phone rules | deployment file `phone:` | `grepx_common.Phone` (services and web) |
| The person record (generic services read contacts there; `run.sh admin` creates one) | deployment file `person:` | `grepx_service.plugins.person_table(cfg)`, `create_admin.py` |
| Template a generic service sends for a message role | deployment file `messages:` | `grepx_service.plugins.template_for(cfg, role)` |
| Product rules for generic services | deployment file `plugins:` → `product-services/<p>/plugins/` | `grepx_service.plugins.plugin(cfg, role)` |
| Product words in the BFF (drive ↔ event, donor ↔ person …) | `config/projects/<p>.yaml` `vocabulary:` | `grepx_bff.vocabulary` (inside the Gateway) |
| Renaming stored data | `platform/tools/migrations/NNN-*.yaml` | `scripts/run.sh migrate NAME` (services stopped, backup first) |
| Ports, which services run | `config/services.ini` | `grepx_port_provider`, `manage.py` |
| Databases | `config/common.yaml` → deployment file → project → service `database:` | `grepx_store` |
| Product error wording | `apps/<p>-bff/src/product_copy.py` → `register_copy()` | `grepx_bff.errors` |
| Fields never sent to clients (secrets) | product BFF `register_hidden(...)` | `grepx_bff.views.clean` |
| Admin-saved secrets ("enc:" values) | settings-service `app_settings` | `grepx_auth.open_settings / seal_value` |
| Request envelope on rows | — | `grepx_service.state_of(row)` (never strip fields by hand) |
| Another service's name, request table, owned tables, actions | its contract, generated | `import grepx_contracts as gc` → `gc.booking.REQUESTS`, `gc.booking.SERVICE`, `gc.booking.BOOKINGS` (never typed strings; `run.sh lint-contracts`) |
| Which platform libraries a service needs | its imports | `scripts/run.sh deps` writes requirements.txt and each library's pyproject dependencies |
| Session signing vs stored secrets | `.env` `JWT_SECRET`, `SECRET_BOX_KEY` | `grepx_auth.TokenService`, `grepx_auth.SecretBox` (separate keys) |
| Where health/metrics listen | `GREPX_BIND` (default 127.0.0.1); a public app sets `web.bind` | `grepx_web_bootstrap.run_server` |

## 3. Design the flow as rows
Draw the sequence: which request row, which service claims it, which state rows it writes, who reacts.
Choose: request/response (BFF waits for the verdict), saga (`SagaRunner`, with compensations), or choreography
(services react to ACCEPTED state rows). Give every repeated side effect a deterministic key (idempotency).

## 4. Build a service
```bash
scripts/run.sh new common <name> --table <x>_requests --actions A,B
scripts/run.sh new product/<product> <name> --table <x>_requests --actions A,B
```
Then, in this order: `dto/` (fields, reason codes, table names) → `domain/` (pure rules + unit tests) → one
`routes/<action>.py` per action → `jobs/` for reactions (declare them under `subscriptions:` in config.yaml; main.py
stays the one-line `serve(__file__)`) → tests with `ServiceHarness` → `config.yaml` description (feeds the catalogue)
→ `config/services.ini` (`path`, `project`, `ports`) → `owns:` + optional `database:` in its config (else the project/platform default) → `scripts/infra.sh` if a new engine is needed → `scripts/setup.sh <name>` → `scripts/run.sh start <name>`.

## 5. Expose it
* **Product BFF** (`apps/<product>-bff`): only product routes; auth, tasks, messages, staff/roles, media, traces,
  system health and the generic gateway come from `platform/libs/grepx-bff` (`create_app`).
* **Web UI** (`apps/web`): one shell for all products. Product = `apps/web/products/<product>.json`
  (name, logo, colours, module list). Shared screens in `modules/core/`, product screens in `modules/<product>/`.
  A different colour or extra screen never copies a shared module.
* **Mobile** (`apps/mobile`, Flutter iOS + Android): one app; `lib/core/` shared, `lib/products/<product>/`
  adds tabs; build with `--dart-define=PRODUCT=<product>`.

## 6. Verify
* `scripts/run.sh test` (each suite in its own process) — add an end-to-end case in the product BFF test.
* `scripts/run.sh start all && scripts/run.sh status` — everything UP; `scripts/run.sh logs errors`; `scripts/run.sh trace <id>`.
* `scripts/run.sh catalog` so the next requirement can find what you built.

## Adding a second product (example: kitchen)
1. `scripts/run.sh new-product kitchen` — deployment file (person → people-service, roles, links, message templates per
   role, checklist, referral points), starter catalogue, plugins folder, `config/projects/kitchen.yaml`.
   `platform/tools/test/test_second_product.py` proves such a product runs on the generic services unchanged.
2. `product-services/kitchen/…` only for kitchen rules (items, stock movements …); everything else is a generic service
   plus, where needed, a plugin.
3. `apps/kitchen-bff` = `create_app(gw, kitchen_routers, "Kitchen API", web_dir=apps/web, product="kitchen")`, own port;
   `vocabulary:` in its project config if it wants its own words for events, bookings or people.
4. `apps/web/products/kitchen.json` (already present: teal theme, core modules) + `apps/web/modules/kitchen/*.js`.
5. `apps/mobile/lib/products/kitchen/` (already present) + its tabs.
6. `config/services.ini` entries with `project = kitchen`; point `grepx.workspace.yaml` at kitchen; `scripts/run.sh workspace`.

## Debugging checklist
| Symptom | Look at |
|---|---|
| Request "timed out" (`*_TIMEOUT`) | `scripts/run.sh status` — owning service DOWN? `scripts/run.sh trace <id>` shows "stuck … waiting for <service>" |
| Rejected with a reason | trace shows the service + reason code; rule is in that service's `domain/` |
| Crash | `dead_letters` (System page / `scripts/run.sh trace`), `scripts/run.sh logs errors`, Grafana "Crashes" panel |
| Nothing happens after an action | a reaction isn't subscribed: check that service's `main.py` subscriptions |
