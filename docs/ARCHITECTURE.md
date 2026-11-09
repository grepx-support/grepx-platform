<!--
  Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
  This file is part of the GrepX platform and is proprietary and confidential.
  Unauthorised copying, use, modification or distribution is strictly prohibited.
-->

# GrepX Platform — Architecture (blood donation is product #1)

> This repository is the **GrepX core platform** with its first product (LifeFlow Blood Camp) built on it.
> It is self-sufficient: the Nexus hub, the service kit, the common services, the product services, the BFF
> (for web **and** the future mobile app), the tooling and the tests all live here.
>
> Companion documents: `docs/SPECIFICATION.md` (every feature of the product), `docs/SERVICE_CATALOG.md`
> (generated list of every service — **search it before building anything**), `docs/DEVELOPMENT-GUIDE.md`
> (reuse / extend / new — the procedure for every new requirement), `CLAUDE.md` (rules for AI assistants).

---

## 1. The idea: thousands of small services, products assembled from them

```mermaid
flowchart LR
    NEED["New product idea"] --> LIST["List capabilities it needs"]
    LIST --> FIND{"scripts/run.sh find &lt;word&gt;<br/>exists in catalogue?"}
    FIND -- yes, fits --> REUSE["Reuse: send its request rows"]
    FIND -- almost --> EXTEND["Extend the common service<br/>(only product-agnostic behaviour)"]
    FIND -- no --> WHERE{"Would any other product use it?"}
    WHERE -- yes --> COMMON["scripts/run.sh new common &lt;name&gt;"]
    WHERE -- no --> PRODUCT["scripts/run.sh new product/&lt;p&gt; &lt;name&gt;"]
    REUSE & EXTEND & COMMON & PRODUCT --> CATALOG["catalogue rebuilt → next product finds it"]
    CATALOG --> BFF["Product BFF + UI (web/mobile) compose the services"]
```

Every service is: one folder, one request table, its own config, its own `dto/` vocabulary, one file per action,
a pure `domain/` with the rules, and its own tests. Nothing calls anything directly — **every interaction is a row in
Nexus**. That is what lets the count grow to 15,000+ without the services knowing about each other.

---

## 2. Repository layout

Four repositories; a product repo is the workspace you run, and `./workspace.sh` there links the others in:

| Repo | Brings into the workspace |
|---|---|
| grepx-platform | `platform/` (libs, tools, nexus-server scripts), `scripts/`, `observability/`, `infra/`, these docs |
| grepx-services | `common-services/` |
| grepx-nexus-cpp | the `nexus_server` binary (copied into `platform/nexus-server/bin/`) |
| grepx-blood-donation (the workspace) | `product-services/blood-donation/`, `apps/`, `config/`, `grepx.workspace.yaml`, `workspace.sh` |

Tools find the workspace through `GREPX_HOME` (exported by the scripts), never through their own path, so linked repos
behave exactly like folders. The assembled workspace looks like this:

```text
platform/
  nexus-server/            the C++ nexus_server: bin/ (binary + nexus_data.db, copied manually), setup.sh, run.sh, prepare_db.py
  libs/
    grepx-config/          grepx_config: load_config, workspace_root (GREPX_HOME or the folder holding config/common.yaml),
                           nexus_address, deployment values (site_url, org_name, timezone, link) - no other GrepX dependency
    grepx-contracts/       GENERATED (scripts/run.sh contracts): per service SERVICE, REQUESTS, owned tables, action/field/reason enums
    nexus-client/          nexus_api: NexusClient, NexusApplication, RecoveringSubscriber, codec - talks to Nexus, nothing else
    nexus-logging/         log setup
    nexus-testkit/         in-memory stand-in for the hub, used only by unit tests (MemoryClient)
    grepx-service/         THE service kit: serve(), runner, dispatcher, context, emitter, reader, reactor, saga, resilience,
                           request client, notify(), projection (owned tables -> the service database), catalogue seeding
    grepx-testkit/         ServiceHarness (one service) and start_stack (every service) on the in-memory hub
    grepx-common/          value objects configured per deployment: Phone, Roles
    grepx-auth/            JWT token strategy, password hashing, SecretBox (secrets on the bus are encrypted)
    grepx-storage/         blob storage strategy (local | S3)
    grepx-audit/           write_audit() → audit-log-service
    grepx-web-bootstrap/   /health app + run_server on a port from grepx-port-provider
    grepx-port-provider/   each service's port window, read from config/services.ini
    grepx-bff/             shared BFF core: gateway, vocabulary (product words <-> generic services), auth/tasks/messages/staff/media routes
common-services/           reusable by every product: identity, notification, template, scheduler, task, checklist, audit, media,
                           settings, people, event, slot, booking, campaign, recognition, referral, event-report, questionnaire
product-services/
  blood-donation/          rules only this product has (donor, donation)
    deployment.yaml        how the product plugs into the generic services: roles, phone, links, person, messages, plugins
    plugins/               product rules loaded by generic services (eligibility questionnaire, audiences, event-report figures)
    catalog/               product data fed to common services: messages.yaml, playbook.yaml, access.yaml, schedules.yaml (run.sh seed)
apps/
  blood-donation-bff/      product API /api/v1 (only blood routes; the rest comes from grepx-bff) + serves the web UI
  web/                     ONE web UI for all products: products/<p>.json (brand, colours, modules), modules/core + modules/<p>
  mobile/                  ONE Flutter app (iOS + Android): lib/core + lib/products/<p>, --dart-define=PRODUCT=<p>
observability/             docker compose: Promtail → Loki (logs), Prometheus (metrics), Grafana (dashboards per project)
catalog/services.json      generated service registry (scripts/run.sh catalog)
grepx.workspace.yaml       what this deployment runs: the product, its deployment file, pinned platform / services / Nexus versions
config/common.yaml         platform defaults: nexus host/port, log dir, database URL (the product's deployment file is laid over it)
scripts/                   run.sh + setup.sh — the only scripts; they set up and manage every service (each service folder has its own run.sh + setup.sh)
platform/tools/            grepx_tools: manage.py (command table) + workspace / processes / monitor / installer / testrun modules, seed.py,
                           create_admin.py, catalog.py, new_service.py, new_product.py, migrate.py, pins.py; migrations/ (Nexus data, as YAML)
config/services.ini        registry of runnable services (path, enabled, project)
```

---

## 3. Runtime picture

```mermaid
flowchart TB
    subgraph Clients
        WEB["Web app"]
        MOB["Mobile app (Flutter, later)"]
        EXT["Integrations / admin tools"]
    end
    BFF["blood-donation-bff :8851<br/>/api/v1 feature routes<br/>/api/v1/gateway/{service}/{action}"]
    NX(("nexus-server :7878<br/>rows · versions · CAS claims<br/>outbox · subscriptions"))
    subgraph Common["common-services"]
        AUTH[auth] --- ACC[access] --- NOT[notification] --- TPL[template]
        SCH[scheduler] --- TSK[task] --- CHK[checklist] --- AUD[audit-log] --- MED[media]
    end
    subgraph Blood["product-services/blood-donation"]
        DON[donor] --- DRV[drive] --- SLT[slot] --- REG[registration] --- DNT[donation]
        ELG[eligibility] --- REF[referral] --- RWD[rewards] --- RPT[report] --- OUT[outreach]
    end
    RELAY["outbox relay → webhooks / Kafka / analytics"]
    WEB & MOB & EXT -->|HTTPS + JWT| BFF
    BFF <-->|SUBMIT request rows / SELECT projections| NX
    NX <--> Common
    NX <--> Blood
    NX --> RELAY
    NOT -->|circuit breaker + retry| SMTP["SMTP / Twilio"]
```

---

## 4. Nexus in one page

| Concept | Meaning |
|---|---|
| Logical table | e.g. `event_requests`, `events`; one physical store, `table_name` separates them |
| Row | key + fields + version; **latest snapshot per key**; every change also appended to the **outbox** in the same transaction |
| Envelope | `status, transaction_id, from_service, to_service, application, username, occurred_at` stamped by the kit |
| `SUBMIT` | the business write; server validates the transition; moving to `CLAIMED` only works from an open status ⇒ **exactly one worker wins** |
| `SUBSCRIBE` | push of every insert/update matching a criteria (`status = 'NEW' AND to_service = 'x'`) |
| Recovery | every service: subscribe (buffer) → replay `recovery_criteria` → drain → live (`RecoveringSubscriber`) — nothing is lost across restarts |
| Wire codec | `k=type:value;…` with only `s:` `i:` `d:` `b:` `n:` (all the C++ server accepts). Lists/objects go as `s:~J~<escaped JSON>`, text with `; =` or newlines as `s:~U~<escaped>`; old `l:`/`u:`/`j:` rows still decode |
| Criteria | safe SQL WHERE subset (`= != < > IN LIKE IS NULL AND OR NOT`) |


### 4a. The Nexus server

The hub is the C++ `nexus_server` from grepx-core-platform. There is no Python server.

| | |
|---|---|
| Binary | copy it into `platform/nexus-server/bin/nexus_server` (not in git) |
| Database | `platform/nexus-server/bin/nexus_data.db`, prepared by `platform/nexus-server/setup.sh` (`prepare_db.py`: same schema + user as grepx-core-platform nexus-db) |
| Manage | `scripts/run.sh start|stop|status nexus-server` or `platform/nexus-server/run.sh start|stop|status`; status is UP when port `NEXUS_PORT` (7878) answers |
| Unit tests | `nexus_testkit.MemoryClient` (platform/libs/nexus-testkit) - in-memory, same row model; never used at runtime |

Features this repo added on top of the original protocol - check the C++ build supports them before relying on them:
the `TRACE` command and the outbox `trace_id` column
(tracing); `_`-prefixed tables skipping the outbox (heartbeats); free-form row statuses (DELETED, VOIDED, CANCELLED, SKIPPED...)
that the C++ state machine may reject.

---

## 5. Service anatomy (every service looks the same)

```text
<service>/
  config/config.yaml      service_name · snapshot_table (its *request* table) · project · owns · tables · description
                          (+ subscriptions: / on_start: when needed; criteria and bot user follow from service_name)
  src/main.py             one line: serve(__file__)
  setup.sh / run.sh       3-line wrappers around platform/tools/service_setup.sh / service_run.sh
  requirements.txt        library lines written by scripts/run.sh deps from what the code imports
  src/dto/                (str, Enum) vocabulary — <x>_action.py, <x>_field.py, reason_code.py, table names
  src/routes/__init__.py  ROUTES = {Action.X: x.handle}; handle = ActionDispatcher(ROUTES, Action, TABLE)
  src/routes/<action>.py  one file per action: def handle(ctx) → ctx.accept({...}) | ctx.reject(Reason.X)
  src/routes/common.py    projection load/save helpers for this service
  src/domain/             pure rules (no Nexus import) — the part most tests hit
  src/jobs/               reactions to other tables (drive completed, ticks, …) — idempotent
  test/                   pytest on an in-memory Nexus (ServiceHarness); conftest puts src/ on sys.path
  requirements.txt        -e ../../platform/libs/... (depth comment on line 1)
```

### Request lifecycle inside a service

```mermaid
sequenceDiagram
    participant C as caller (BFF / other service)
    participant N as Nexus
    participant D as ActionDispatcher
    participant H as routes/<action>.py
    C->>N: SUBMIT x_requests key {action, ..., status NEW, to_service}
    N-->>D: EVENT (live_criteria)
    D->>N: SUBMIT CLAIMED (CAS — one winner)
    D->>H: handle(ctx)  (domain rules, reads via ctx.read)
    H->>N: write projection rows (drives / slots / …)
    H->>N: follow-up requests to other services (saga steps, notify)
    H->>N: SUBMIT ACCEPTED {result} | REJECTED {reason}
    Note over D: exception → dead_letters row + REJECTED INTERNAL_ERROR
    C->>N: wait for terminal status (RequestClient)
```

**Commands vs state (CQRS-lite):** callers write to `<x>_requests`; the owning service writes the state tables
(`drives`, `slots`, `registrations`, `donor_stats` …) that everyone may read. Only the owner writes its state tables.

---

## 6. Patterns — where each one lives

| Pattern | Implementation | Used by |
|---|---|---|
| **Hub / message bus (event-driven)** | Nexus rows + subscriptions | everything |
| **Competing consumers** | CAS claim (`NEW → CLAIMED`) — run N replicas of any service safely | all request services |
| **Transactional outbox** | snapshot + outbox written in one SQLite transaction (`store.py`); `outbox_relay.py` publishes at-least-once to a `Publisher` (log, webhook; add Kafka by subclassing) | platform |
| **Event sourcing / audit history** | outbox keeps every transition; `grepx_audit.write_audit` → audit-log-service | platform, audit |
| **CQRS** | request tables vs projection tables; read models assembled in the BFF (`views.py`) | all |
| **Saga (orchestration)** | `grepx_service.saga.SagaRunner` — steps with compensations, saga log in `sagas` table | sign-up (donor → credentials), create-admin |
| **Saga (choreography)** | services react to each other's state rows | drive completed → registrations closed + certificates + vouchers; donated → donation + stats → referral points |
| **Idempotency / deduplication** | deterministic keys (notifications, checklist tasks, certificates, ticks); `Idempotency-Key` header on the gateway | notify(), checklist, rewards, scheduler |
| **API gateway** | `apps/blood-donation-bff`: auth, rate limits, security headers, error mapping, generic `/gateway/{service}/{action}` routed from the catalogue | edge |
| **Backend for frontend** | feature routes shaped for screens; web and mobile share them | edge |
| **Circuit breaker** | `CircuitBreaker` (closed → open → half-open) | notification channels, BFF → Nexus |
| **Retry with backoff + jitter** | `Retry` | notification channels |
| **Bulkhead** | `Bulkhead` / `Resilient` (bulkhead → breaker → retry) | notification channels |
| **Rate limiter** | token bucket `RateLimiter` | login, forgot-password, kiosk search |
| **Dead-letter queue** | `dead_letters` table written by the dispatcher on crashes | all request services |
| **Strategy / plug-in** | channels (email/SMS/WhatsApp/log), storage (local/S3), token (JWT), outbox publishers, schedule kinds | common services |
| **Template method** | `ActionDispatcher` (claim → route → verdict), `TwilioChannel` | kit, notification |
| **Repository** | `CredentialRepository` (auth-service private DB) | auth |
| **Database per service** | Nexus tables owned per service; secrets in a private store (auth credentials never touch the bus) | auth, all |
| **Service registry / discovery** | `catalog/services.json` + `scripts/run.sh find`; `config/services.ini` (path, project, ports) | tooling, gateway |
| **Health check** | `/health` on every service (`create_health_app`) | all |
| **Externalised configuration** | `config/common.yaml` + per-service yaml + env (`NEXUS_HOST`, `JWT_SECRET`, `SMTP_*`, `TWILIO_*`, `SITE_URL`) | all |
| **Scheduler / timer** | scheduler-service emits `ticks` rows with deterministic keys (fire once per slot) | reminders |
| **Distributed tracing / correlation id** | `trace_id` + `parent` + `hop` stamped on every row; outbox indexed by trace; `TRACE` command; `X-Trace-Id` header in/out | everything |
| **Heartbeat / health monitoring** | every service writes `_health` every 15 s (pid, port, counters, last error); `scripts/run.sh status`, System page | everything |
| **Centralised structured logging** | JSON lines with service, project, level, trace_id → Promtail → Loki → Grafana | everything |
| **Metrics** | `/metrics` (Prometheus) on every service: up, handled, accepted, rejected, errors | everything |
| **Secrets in transit** | `SecretBox` seals passwords/tokens inside rows (the outbox is permanent) | auth, BFF |

---

## 7. Common services (reusable)

| Service | Requests table | Owns | Notes |
|---|---|---|---|
| auth-service | `auth_requests` | private credential DB | REGISTER, LOGIN, CHANGE_PASSWORD, SET_PASSWORD, RESET_REQUEST, RESET_CONFIRM; JWT with role + tenant; remember-me donors only |
| access-service | `access_requests` | `user_access`, `staff_roles`, reads `permission_catalog` | roles donor/volunteer/admin, volunteer roles, personal perms, effective perms; never self-demote / last admin |
| template-service | `templates` | `message_templates`, `message_settings` | products SEED built-ins; admins SAVE wording (only declared `{placeholders}`) / RESET |
| notification-service | `notifications` | delivery result on the row | SENT / LOGGED (channel not configured) / FAILED / SKIPPED (disabled); channel strategy + circuit breaker |
| scheduler-service | `schedule_requests` | `schedules`, `ticks` | EVERY_MINUTES / DAILY_AT → one `ticks` row per slot to the target service |
| task-service | `task_requests` | `tasks` | CREATE, UPDATE, CHANGE_STATUS, CLAIM, DELETE; history; assignment notice; due-soon reminders (24 h horizon, 12 h cooldown) |
| checklist-service | `checklist_requests` | `checklist_templates` | SEED_TEMPLATE, APPLY (idempotent by title, dated from a base date), REMOVE (all / open only) |
| audit-log-service | `audit_log` | — | records `write_audit` entries |
| media-service | `media_requests` | `media` | PROCESS staged upload → WebP (picture ≤1920, avatar 512²), DELETE |
| settings-service | `settings_requests` | `app_settings` | SET / DELETE admin-editable settings (integrations, auto-message policies, widget access); secrets arrive sealed (`enc:` + platform SecretBox) and only services can open them |
| people-service | `people_requests` | `people` | generic person record (contact, photo, invite code, calendar token); product fields through the `profile` plugin |
| event-service | `event_requests` | `events` (open/completed, pictures, voucher offer) | CREATE (+ slot plan, checklist `events.checklist_template`), CLONE, COMPLETE / REOPEN |
| slot-service | `slot_requests` | `slots` | time slots with capacity per event; reads `bookings` for booked counts |
| booking-service | `booking_requests` | `bookings` | INTEREST, BOOK, MOVE, CANCEL, CHECK_IN, MARK (attended / no_show / not_eligible); `events` completed → no-shows; ticks `event-reminders` |
| campaign-service | `campaign_requests` | `campaigns`, `social_posts` | ANNOUNCE / INVITE / BROADCAST to audiences (member + staff roles built in, more through the `audience` plugin), social posting |
| recognition-service | `recognition_requests` | `certificates`, `vouchers` | `events` completed → a certificate per attendee + vouchers |
| referral-service | `referral_events` | `referral_scores` | people with a referrer, the deployment's conversion table (`referral.conversion`) |
| event-report-service | `event_report_requests` | `event_reports` | attendance funnel, show / fill rate, slots, messages, tasks; product figures from the `event_report` plugin |
| questionnaire-service | `questionnaire_requests` | — | CHECK / CHAT / CRITERIA, all from the `questionnaire` plugin |
| ops-monitor-service | — (watches only) | `geo_cache` (its own DB) | the live operations screen at `<site>/ops/`: subscribes read-only to every request table (from `grepx_contracts`) and `dead_letters`, keeps a bounded window of envelope-only events (no names, phones or emails), traces, service health, headline numbers and a map of places - all set by the deployment file's `monitor:` section. Admins only (session token + role). See §10b |

Product words never appear in these services: they read the person table, message templates per role, links, checklist and
referral points from the product's deployment file, and product rules from its plugins (`grepx_service.plugins`).

## 8. Blood-donation product services

| Service / folder | Requests table | State it owns | Reacts to |
|---|---|---|---|
| donor-service | `donor_requests` | `donor_segments`, `import_rows` | — (staff tools: saved donor groups, the Excel import queue) |
| plugins/blood_profile | — | — | people-service: blood group, sex, weight, date of birth on the person record (`people`) |
| donation-service | `donation_requests` | `donations`, `donor_stats` | `bookings` attended ↔ donation; ticks `eligible-again` |
| plugins/blood_eligibility | — | — | questionnaire-service: HSA criteria, LifeBot chat |
| plugins/blood_audience | — | — | campaign-service: `eligible`, `group:<blood group>` audiences and invite filters |
| plugins/blood_event_stats | — | — | event-report-service: units, first-timers, blood groups |

The product's own words (drive, registration, donor, donated) live only here, in its catalogue and in its apps: the BFF
translates them to and from the generic services' words (`vocabulary:` in `config/projects/blood-donation.yaml`, applied
by `grepx_bff.vocabulary` inside the Gateway), so the web site, JSON API and mobile app kept their URLs and fields.

### Example choreography: completing a drive

```mermaid
sequenceDiagram
    participant B as BFF
    participant DR as event-service
    participant RG as booking-service
    participant DN as donation-service
    participant RW as recognition-service
    participant NT as notification-service
    B->>DR: event_requests COMPLETE (+ voucher offer)
    DR->>DR: today ≥ event_date? → events.state = completed
    par reactions
        DR-->>RG: events row → open bookings become no_show
        DR-->>RW: events row → certificate per attendee, vouchers (shared or unique codes)
    end
    RW->>NT: notifications (certificate link + voucher)
    Note over DN: earlier, MARK attended → donation row → donor_stats → thank-you
```

---

## 9. The BFF (web + mobile)

**The web site** is the original LifeFlow site (`apps/blood-donation-bff/web`: Flask routes, Jinja templates, CSS, JS),
mounted by the BFF at `/` (a2wsgi). Its `repos/` package keeps the original repository interface but reads the services'
state tables through Nexus and sends every change as a request to the owning service (`repos/_nexus.py` is the only door).
Rules stay in the services: booking capacity (booking-service), donations (donation-service reacts to "attended"),
completion → certificates/vouchers (event-, booking-, recognition-service), auto-message policy (template-service),
delivery + log (notification-service, `staff_message` passes the site's own wording), social posting (campaign-service).
Both the site and the JSON API go through the Gateway, whose vocabulary turns events / bookings / people / attended into the
product's drives / registrations / donors / donated (rows, filters, commands, verdicts and reason codes).
What the site still computes itself is presentation: grids, filters, charts, posters, certificates, Excel files.

**The JSON API** (`/api/v1`) serves the mobile app and integrations:

* `/api/v1/auth/*` sign-up (saga), login, forgot/reset, change password
* `/api/v1/drives`, `/drives/{id}`, interest, kiosk find/check-in/register, `/stats`, `/certificates/{code}`, `/join/{code}`, `/calendar/{token}.ics`
* `/api/v1/me/*` dashboard (card + QR, stats, badges, bookings, history, certificates, vouchers, invite + leaderboard, tasks), profile, photo, calendar reset, book/cancel
* `/api/v1/eligibility/check|chat`
* staff: `/admin/drives…` (create with slot plan + checklist, edit, clone, pictures, complete/reopen, rewards, slots/capacity, announce/invite, board), `/admin/registrations/{id}/mark|move`, `/admin/checkin/{drive}` (search, QR, walk-in), `/admin/donors…` (grid, add, edit, donations, import), `/tasks…`, `/admin/messages…` (broadcast, log, automatic messages), `/admin/reports…`, `/admin/access…`
* `/api/v1/gateway/{service}/{action}` — any catalogued action (admin), so new services are reachable without BFF code
* OpenAPI docs at `/docs`. The BFF holds **no business rules**: it authenticates, composes reads and maps reason codes to copy (`errors.py`).

---

## 9a. Databases — each service has its own

```mermaid
flowchart LR
    COMMON["config/common.yaml<br/>database.url (platform default)"] --> PROJECT["config/projects/&lt;project&gt;.yaml<br/>database.url (whole product)"] --> SERVICE["service config.yaml<br/>database.url (one service)"] --> ENV["env DATABASE_URL_&lt;SERVICE&gt;<br/>(deployment override)"]
    ENV --> STORE["grepx_store.store_for(cfg)"]
    STORE --> SQ["SQLite file data/&lt;service&gt;.db"]
    STORE --> PG["PostgreSQL database &lt;service_db&gt;"]
    STORE --> MG["MongoDB database"]
```

* **Every service owns a private database** with its own tables (collections). Nobody else connects to it.
* **Schema before the service comes up:** `tables:` in `config.yaml` (table → indexed fields) is created by the service's
  `setup.sh` (`python -m grepx_store`, which also creates the PostgreSQL database and installs the driver) **and**
  again, create-if-missing, at every start — the runner calls `ensure_schema(cfg)` before
  connecting to Nexus, so a service never subscribes without its tables. `scripts/run.sh db [name]` re-runs it on demand.
* `owns: [drives]` in a service's `config.yaml` lists the tables it publishes. **One write path:** the Emitter writes
  state only to Nexus; the service also subscribes to its own owned tables (`grepx_service.projection`) and copies each
  ACCEPTED row into its private database (a deleted row is removed). A crash between the two is healed by recovery on the
  next start, so the database never holds anything Nexus does not.
* Services with private data that must never touch the bus (auth-service credentials) use the store directly
  (`CredentialRepository` over `grepx_store`).
* The engine is configuration, never code: same five calls (`put`, `get`, `find`, `delete`) on SQLite, PostgreSQL
  (jsonb + GIN index), MongoDB, or memory (tests). `{service}` / `{service_db}` in a URL become the service's name.
* Examples: whole blood product on PostgreSQL → `config/projects/blood-donation.yaml`:
  `database: { url: "postgresql://grepx:grepx@127.0.0.1:5432/{service_db}" }`; only auth on MongoDB → in its
  `config.yaml`: `database: { url: "mongodb://127.0.0.1:27017/grepx_auth" }`. `scripts/infra.sh plan` shows the result.

## 9a-2. No web-framework dependency

Services don't need Flask or FastAPI: their only HTTP surface is `/health` + `/metrics`, served by a plain WSGI app on the
standard library (`grepx_web_bootstrap.create_health_app`). `GREPX_WEB_FRAMEWORK=fastapi|flask` (or passing `framework=`)
switches to that framework when a service wants its own HTTP routes; `run_server` picks the adapter (FastAPI → uvicorn,
Flask → werkzeug, anything WSGI → wsgiref). Business logic never imports a web framework. The blood-donation BFF uses
FastAPI by choice (`grepx_bff`); another product's BFF may use any framework — the `Gateway` (commands, reads, trace ids,
circuit breaker) is plain Python.

## 9b. Infrastructure — three scripts, in order

| Script | Does |
|---|---|
| `scripts/infra.sh` | installs the toolchain from `config/infra.yaml` (Python, git, Docker when needed, Flutter if asked), reads every service's resolved database, starts only the engines in use (PostgreSQL / MongoDB containers from `infra/docker-compose.yml`, one database per service), and the monitoring stack if `monitoring: true`. `plan`, `status`, `down` too |
| `scripts/setup.sh` | tooling venv + each service's own venv (+ its database driver) |
| `scripts/run.sh` | start / stop / restart / status / logs / trace / test … for all services or one |

Inside a service folder, its own `setup.sh` / `run.sh` do the same for that service only.

## 10. Running it

```bash
scripts/infra.sh              # first: toolchain + database engines + (optional) monitoring
scripts/setup.sh                    # tooling .venv + every service's own .venv (each service also has its own setup.sh)
scripts/setup.sh event-service      # just one service
# edit .env (created from .env.example): JWT_SECRET, SITE_URL, SMTP_*, TWILIO_*
scripts/run.sh start                # nexus-server, then every service, then the BFF   (start|stop|restart [all|name])
scripts/run.sh seed [project]       # each product's catalog: (templates, playbook, permissions, roles, schedules)
scripts/run.sh admin admin@example.sg 'Pass-1234' 'Ada Admin' '9123 4567'
open http://localhost:8851    # web UI;  /docs = API
scripts/run.sh status               # UP / DOWN / STALE per service with counters and the last error
scripts/run.sh logs [name|errors|TRACE_ID]   scripts/run.sh trace TRACE_ID   scripts/run.sh test   scripts/run.sh find WORD
scripts/run.sh monitor              # Prometheus + Loki + Grafana (docker) → http://<server>:3000
scripts/run.sh targets              # refresh Prometheus targets from heartbeats after (re)starting services
scripts/run.sh backup               # every service DB + Nexus DB + pictures -> BACKUP_DIR (git push with BACKUP_GIT_REMOTE)
scripts/run.sh restore DIR          # put a backup back (services stopped)
```

Email/SMS/WhatsApp go to the log until `SMTP_*` / `TWILIO_*` are set. Media goes to `data/uploads` (or S3 with `MEDIA_STORAGE=s3`).

## 10a-1. Several products on one machine

Each product is its own workspace (the orchestrator puts each in its own folder with its own clones) with its own Nexus
hub and database. To share a server they only need different ports:

| | Where | blood-donation | kitchen |
|---|---|---|---|
| Nexus hub | `config/common.yaml` `nexus.port` (passed to the C++ server as `NEXUS_PORT`) | 7878 | 7880 |
| services, BFF | `config/services.ini` `ports =` | 88xx-91xx, 8851 | 93xx-94xx, 8861 |

A restarted service gets its first port back even while the old process's connections linger (the port check uses
SO_REUSEADDR like the servers do), so a site does not move to the next port after a restart.

**Shared web shell.** `web/` in grepx-platform (`index.html`, `app.js`, `ui.css`, `modules/core/`) is linked into each
workspace; a product keeps only `apps/web/product.json` and `apps/web/modules/*.js` and passes both to
`grepx_bff.create_app(web_dir=ROOT/"web", product_dir=ROOT/"apps/web")`. `/me` (grepx-bff) returns `is_staff` and `tenant`.

**Organisations.** auth-service puts the login's `tenant` in the token; `Principal.tenant` carries it in every BFF. A
multi-business product (kitchen) sends it as `tenant_id` on every command and filters every read by it.

**Tests per workspace.** `scripts/run.sh test` runs every suite except the prefixes in `grepx.workspace.yaml`
`tests.skip` (kitchen skips `common-services`, whose suites are written against blood donation's deployment file).
Contracts are generated for every shipped generic service, so any workspace can import any contract.

## 10b. The live operations screen (ops-monitor-service)

`<site>/ops/` - a full-screen dark map with the product's places, live pulses as requests touch them, a heat layer,
"the wire" (every request and verdict as it happens), headline numbers, why requests were refused, service health,
a System view (services as a graph, requests flowing between them) and a trace drawer for any line.

```mermaid
flowchart LR
    SVC["every service's request table + dead_letters"] -->|SUBSCRIBE, read-only| MON["ops-monitor-service<br/>127.0.0.1:8970"]
    ST["state tables (places, counts, kpis) + _health"] -->|SELECT every 5-30 s| MON
    MON -->|"/api/* (admin token checked here)"| BFF["product BFF /ops/* (plain pass-through)"]
    BFF --> BROWSER["browser: MapLibre map + wire + System view"]
```

* Generic: the service never knows what a place is. The deployment file's `monitor:` says which table is drawn
  (`places:` table, label, address, date, capacity, `where`, per-place `counts`), which headline numbers (`kpis:`),
  the map centre and geocoder (`onemap` for Singapore, `nominatim` anywhere, `known:` to pin an address), the words.
  A second product gets its own screen by writing its own `monitor:` section - no code.
* Safe to put on a wall: events keep only the envelope (table, status, action, reason, services, trace, hop, time) and
  the configured reference field (e.g. `event_id`); the service also silences row-level client logging.
* Honest numbers: request -> answer time is measured on the monitor's own clock between seeing NEW and the verdict;
  p95 is shown only with 20+ samples; "dropped" counts events that fell out of the window.
* A new service is watched automatically (its contract appears in `grepx_contracts`).
* The map tiles (CARTO dark) and the map library (MapLibre GL) load in the viewer's browser from the internet;
  without them the wire, numbers and System view still work.

## 10a-0. Script log format (every .sh and the Python tools)

`2026-10-31 15:33:01 INFO  [component] message` — levels INFO / OK / WARN / ERROR, component = script or service name.
All shell scripts source `platform/tools/log.sh` (Python tools use `grepx_tools/log.py`); every line is also appended to
`logs/scripts.log`. Per-service setup output is kept in `logs/setup/<service>.log`. Running services write JSON lines with
the same fields (ts, level, service, plus project and trace_id) for Promtail/Loki; `scripts/run.sh logs` prints them in this format.

## 10a. Seeing what happens — tracing, logs, health

```mermaid
flowchart LR
    UI["web / mobile<br/>X-Trace-Id"] --> BFF --> R1["row trace_id=T hop 0"] --> S1["event-service"] --> R2["rows trace_id=T hop 1"] --> S2["slot / checklist"] --> R3["task rows hop 2"]
    S1 & S2 -->|JSON logs with trace_id| LOGS["logs/*.log"] --> PT["Promtail"] --> LK["Loki"] --> GF["Grafana"]
    S1 & S2 -->|/metrics| PR["Prometheus"] --> GF
    S1 & S2 -->|heartbeat 15 s| HB["_health table"] --> ST["scripts/run.sh status · System page"]
```

* Every HTTP response carries `X-Trace-Id`; error messages show it. Paste it into **System → trace**, `scripts/run.sh trace <id>`
  or the Grafana logs panel: you see every service the request touched, in order, which step was REJECTED and why,
  which crashed (dead letter) and which is **stuck** waiting for a service that isn't running.
* Grafana dashboard "GrepX services": services up/down, requests, rejections, crashes per service, logs filtered by
  project, service, level and trace id. Each project (blood-donation, kitchen …) is a filter value — one stack for all.
* More hosts: run Promtail on each (pointing at the same Loki) and add each host's targets to Prometheus.

## 11. Testing

* Every service: unit tests of `domain/` + request tests on an in-memory Nexus (`ServiceHarness`), incl. cross-service ones via `load_service`.
* `apps/blood-donation-bff/test/test_end_to_end.py` starts **all** services in one process (`grepx_testkit.stack.start_stack`) and walks the donor and staff journeys through the HTTP API.
* `scripts/run.sh test` runs each suite in its own process (services share package names `dto`, `routes`, … by design).
* Gates in `platform/tools/test/`: no library import cycle, no typed service/table name outside `grepx_contracts`, no product
  word in platform or generic-service code, a product made by `new-product` runs on the generic services alone
  (`test_second_product.py`), and migration 001 rewrites old data correctly and idempotently.

## 12. Adding a product — checklist

1. Write its feature spec (like `docs/SPECIFICATION.md`).
2. `scripts/run.sh new-product <p>`: deployment file (roles, phone, links, person → people-service, message templates per
   role, checklist, referral points, plugins), starter catalogue, plugins folder, `config/projects/<p>.yaml`.
3. For each capability run `scripts/run.sh find <word>`; reuse what exists. Product rules for a generic service go in
   `product-services/<p>/plugins/` (interfaces in its README), never into the generic service.
4. Scaffold product-only services (`scripts/run.sh new product/<p> …`), write `domain/` first, then routes, then tests.
5. Register in `config/services.ini` (path, project, ports); declare reactions under `subscriptions:` in its config.yaml.
6. Build the product BFF in `apps/<p>-bff` on `grepx-bff` (its own words go in `vocabulary:`), then the UI module.
7. Point `grepx.workspace.yaml` at the product (`product:`, `deployment:`), `scripts/run.sh workspace`, `scripts/run.sh catalog`.

## 13. Status and next steps

* Done: platform, 9 common + 10 product services, shared BFF core + blood BFF, shared web UI (public, donor, staff, core
  admin), Flutter app (blood tabs + kitchen skeleton), tracing, heartbeats, JSON logs, Prometheus metrics, Loki/Grafana
  stack, seeds, e2e + per-service tests, live run over TCP.
* Done since: the original web site on the services (all pages), settings-service, social publishing in campaign-service (then outreach-service),
  integration settings used by notification-service, report numbers as in the original, platform backup / restore.
* Done since: phases 1-5 of the extraction plan - acyclic libraries, generated contracts, Nexus as the single write path,
  separate secret keys, localhost-only health ports, generic services (people, event, slot, booking, campaign,
  recognition, referral, event-report, questionnaire) with product plugins and the BFF vocabulary, data migration 001,
  the workspace file and `new-product`.
* Done since: the four repositories (grepx-platform, grepx-services, grepx-nexus-cpp, the product as the workspace,
  `./workspace.sh`); blood donation's person record on people-service with the `blood_profile` plugin (migration 002).
* Next: port the Flask site's pages into `apps/web` product modules; per-service Nexus
  accounts (needs the C++ server); TRACE support and `sqlite3_busy_timeout` in nexus_server.
