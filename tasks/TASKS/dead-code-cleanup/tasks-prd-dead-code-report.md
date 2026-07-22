# Dead Code and Hidden Surface Follow-Through — Tasks

## Relevant Files

- `tasks/TASKS/dead-code-cleanup/prd-dead-code-report.md` - Source audit, candidate clusters, surface classifications, and recommended cleanup order.
- `tasks/TASKS/dead-code-cleanup/prd-file-inventory.md` - Repository file inventory supporting provenance and ownership review.
- `tasks/TASKS/sko-charts/tasks-prd-sko-charts.md` - Owner of SKO-specific quarantine/burn-down decisions.
- `web/package.json` - Current route/build/script/test entrypoint evidence and `knip` tooling.
- `web/pages/` - Next.js route entrypoints that remain URL-reachable even without imports.
- `web/vercel.json`, `web/next.config.js`, `.github/` - External schedules, rewrites, and workflow consumers that import graphs may miss.
- `functions/`, `webhooks/`, `cms/` - Separate deployable/runtime roots that must be audited independently.

### Notes

- This list repairs the missing implementation pair for the completed audit; no deletion was authorized by the audit itself.
- Every candidate must be re-verified against current imports, routes, navigation, package scripts, cron/provider configuration, external deployment, dynamic imports, and documentation.
- A Next.js page/API file is a runtime entrypoint even with zero inbound imports.
- Mass deletion, route removal, or uncertain external-consumer cleanup requires the super-goal checkpoint.
- Work in small domain batches with verification between batches; preserve lineage and redirects when product URLs may have bookmarks.

## Tasks

- [ ] 1.0 Refresh the dead-code evidence baseline
  - [x] 1.1 Re-run source inventory/import graph and current `knip --production` using repository conventions; exclude generated/vendor/cache/test false positives explicitly.
  - [x] 1.2 Enumerate pages/API routes, navigation, dynamic links/imports, package scripts, cron schedules, Vercel rewrites, GitHub workflows, separate apps, and documented external callers.
  - [x] 1.3 Compare every 2026 audit candidate to current evidence and classify it as active, hidden supported, admin/operational, compatibility/redirect, quarantine, generated/temp, uncertain, or high-confidence dead.
  - [ ] 1.4 Add changed/new candidates and remove disproven claims with evidence; do not carry old `knip` flags forward automatically.

- [x] 2.0 Handle obvious temporary/generated debris separately
  - [x] 2.1 Classify root/temp/debug scripts, duplicated generated-output paths, logs, and test-result artifacts by current package/workflow/documentation usage.
  - [x] 2.2 Move durable findings into existing runbooks/tasks and delete only proven temporary files in small reviewable batches.
  - [x] 2.3 Add/adjust ignore rules for regenerated logs/results only after confirming they are not intentional committed fixtures.
  - [x] 2.4 Verify no package script, workflow, or operator command references removed artifacts.

- [ ] 3.0 Resolve empty/stub and development-only routes
  - [x] 3.1 Re-verify `FantasyPowerRankings`, `PowerRankings`, `/test`, logo/style/trends testing grounds, placeholders, and xGoals prototypes against current product links and use.
  - [x] 3.2 For each route choose keep/document, protect, redirect, move to tests/docs, or delete and record the replacement/consumer evidence.
  - [ ] 3.3 Obtain approval before removing a route family or externally bookmarkable surface with uncertain consumers.
  - [ ] 3.4 Verify routing, sitemap/navigation, build, and direct replacement links after each batch.

- [ ] 4.0 Resolve hidden legacy product surfaces through owning initiatives
  - [ ] 4.1 Reconcile buy-low/sell-high, legacy goalies/team stats/projections/FORGE/SKO/debug/twitter routes against current Variance, Underlying Stats, FORGE, Trends, Lines, and admin replacements.
  - [ ] 4.2 Prefer explicit redirects or quarantine notices when lineage/bookmarks remain useful; do not leave duplicate live product implementations ambiguous.
  - [ ] 4.3 Move active debug/operator behavior behind authenticated admin ownership or extract it into repeatable tests/runbooks.
  - [ ] 4.4 Synchronize deletion/quarantine tasks with the relevant source initiative before editing files.

- [ ] 5.0 Remove dead component/utility clusters only after route decisions
  - [x] 5.1 Re-verify legacy SKO/prediction, WiGO, goalie/team, old upsert, DRM wrapper, PPTOI, FORGE card, retired NHL API, formatter, and generic utility clusters.
  - [ ] 5.2 Confirm no active route, script, test fixture, dynamic import, separate app, cron, or external caller uses each cluster.
  - [ ] 5.3 Delete targeted proven-unused clusters with any required import/style/test cleanup and preserve documentation lineage.
  - [ ] 5.4 Verify type/build/unit/runtime paths owned by each domain after its batch.

- [ ] 6.0 Audit admin/operational and separate-project security/ownership
  - [ ] 6.1 Verify `/db`, admin CSV/alias tools, cron APIs, webhooks, `functions`, and CMS are authenticated, deployed, documented, and owned or explicitly retired.
  - [x] 6.2 Do not delete operational routes based on app import graphs; correlate with cron inventory, provider callbacks, external scheduler, and deployment configs.
  - [ ] 6.3 Add security/remediation tasks for reachable hidden tools lacking adequate authorization.

- [ ] 7.0 Final cleanup verification and synchronization
  - [ ] 7.1 Re-run import/knip/route inventories and explain remaining intentional flags/false positives.
  - [ ] 7.2 Run targeted tests, type/build checks, and direct route/navigation smoke verification proportional to removed batches.
  - [ ] 7.3 Confirm no unresolved import, missing Sass module, package-script failure, route dead end, cron gap, or deployment entrypoint removal.
  - [ ] 7.4 Update the audit PRD, file inventory, this list, owning initiative lists, and master ledger with final dispositions/evidence.

## NEW Tasks

- [ ] NEW 8.0 Append every newly discovered candidate, hidden consumer, security gap, uncertain external dependency, and cleanup optimization here before closure.

## Completion Reconciliation — July 2026

- A current `rg --files` inventory counts 3,401 tracked paths, including 2,050 web source/style files, 331 page entrypoints, and 256 API entrypoints. Temporary-cache `knip` 5.88.1 completed its production scan and reported 173 unused-file candidates; its nonzero exit is the expected findings result. The report explicitly excludes tests, operational scripts, framework/config entrypoints, separate apps, Sass alias failures, and other runtime/tool false positives instead of converting the raw total into deletion claims.
- The current entrypoint boundary includes 48 package scripts, 20 Vercel cron definitions, the separately verified 64-job pg_cron inventory, one GitHub workflow, and the `functions` (53 files), `webhooks` (4), and `cms` (22) roots. Navigation, dynamic/detail routes, rewrites/sitemap, provider callbacks, and documented external callers remain first-class consumer evidence.
- Exact tracking and ignore checks prove the 24 previously removed generated-state files remain untracked while their classes are narrowly ignored: Playwright results, all three Supabase CLI temp roots, Python bytecode, Codex build outputs, dependency caches, the local dev/SOS/Yahoo logs, and team-underlying audit JSON. Producers for the SOS log and team-underlying JSON remain intact; no package/workflow/operator consumer reads the removed outputs. The four duplicated nested SKO outputs remain intact and separately open behind retention/provenance decisions.
- All eight named stub/development routes still exist and have no product-navigation, rewrite, sitemap, workflow, cron, or runtime-link consumer. `FantasyPowerRankings`, `PowerRankings`, and `/test` remain high-confidence delete/move-to-test candidates; `testLogoMaker` and `xGoalsPage` remain unlinked prototype candidates; `cssTestingGrounds` is an actively documented style-review surface; `statsPlaceholder` remains a hidden legacy SoS/team-stats implementation pending redirect/deletion approval; and `trendsTestingGrounds` remains a read-only quarantined diagnostics surface after its mutation path was removed. No route was deleted because the externally bookmarkable-removal approval row remains open.
- Current `knip` reconfirms every named legacy component/utility family as an import-graph candidate, including SKO/prediction, WiGO, goalie/team utilities, old upserts, DRM wrapper, PPTOI, FORGE card, retired NHL API, duplicate formatter, and generic utilities. That closes re-verification only: external/manual callers, route decisions, targeted deletion, and post-delete tests remain open. Operational routes and separate apps are protected from import-graph deletion by the canonical 64-plus-20 scheduler/config/provider inventory.
- This bounded reconciliation closes 11/35 rows. Baseline parent 1.0 stays open for changed/new-candidate disposition; generated-debris parent 2.0 stays open for the retained nested SKO outputs; route, hidden-product, component-deletion, security, and final-verification parents remain open behind their explicit approval, consumer, and runtime gates.
