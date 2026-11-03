# Working on this repository (read first)

This is the **GrepX platform**: Nexus hub + many small services + products assembled from them.
Product #1 is blood donation; more products (e.g. kitchen) reuse the same services, BFF core, web UI and mobile app.

Before writing code for any requirement, follow `docs/DEVELOPMENT-GUIDE.md` (decide: reuse / extend / new).
Architecture and patterns: `docs/ARCHITECTURE.md`. Every service, generated: `docs/SERVICE_CATALOG.md`.
Product behaviour reference (blood donation): `docs/SPECIFICATION.md`.

Repos: grepx-platform (platform/, scripts/, observability/, infra/, docs), grepx-services (common-services/),
grepx-nexus-cpp (the hub), grepx-blood-donation (the workspace: product-services/, apps/, config/). In the workspace the
other repos are symlinks made by `./workspace.sh` - edit and commit platform or generic-service code in its own repo.

Hard rules
- No service calls another service directly — only request rows through Nexus (`ctx.request`, `notify`, `RequestClient`).
- One service owns each state table; others only read it.
- Business rules live in `src/domain/` of the owning service, never in a BFF or UI.
- Generic capability → `common-services/`; product-only rule → `product-services/<product>/`; HTTP → `apps/`.
- Generic code never speaks a product's words (a test enforces it): product settings go in the deployment file named by
  `grepx.workspace.yaml`, product rules in `product-services/<product>/plugins/`, product words for clients in the BFF `vocabulary:`.
- Renaming stored data = a migration in `platform/tools/migrations/` (`scripts/run.sh migrate`), never a manual edit.
- Shared UI/API code lives once: `platform/libs/grepx-bff`, `apps/web/modules/core`, `apps/mobile/lib/core`.
- The blood-donation web site is the original site in `apps/blood-donation-bff/web`; its `repos/` read Nexus tables and send
  requests - never add SQL or business rules there (put rules in the owning service).
- Every new service: `scripts/run.sh new`, register in `config/services.ini` (path, project, ports), tests, `scripts/run.sh catalog`,
  `scripts/run.sh contracts` (other code then uses `gc.<service>.…`, never typed names).
- Platform libraries never import each other in a cycle; `scripts/run.sh deps` keeps requirements and pyproject dependencies in step (tests enforce both).
- Databases: each service has its own (engine set in config/common.yaml → config/projects/<p>.yaml → service config.yaml); use `grepx_store`, list owned tables in `owns:`.
- Each service declares `tables:` (created by setup.sh and again at start); no web framework in services (health is plain WSGI).
- Order: `scripts/infra.sh` → `scripts/setup.sh` → `scripts/run.sh start`. New product: `scripts/run.sh new-product NAME`.
- Run `scripts/run.sh test` before committing. Commits end with the attribution lines the session asks for.
