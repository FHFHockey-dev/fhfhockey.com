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

- [x] 1.0 Refresh the dead-code evidence baseline. The current production scan and bounded post-baseline delta review classify every changed/new candidate without promoting raw tool output to a deletion claim (verified 2026-07-25).
  - [x] 1.1 Re-run source inventory/import graph and current `knip --production` using repository conventions; exclude generated/vendor/cache/test false positives explicitly.
  - [x] 1.2 Enumerate pages/API routes, navigation, dynamic links/imports, package scripts, cron schedules, Vercel rewrites, GitHub workflows, separate apps, and documented external callers.
  - [x] 1.3 Compare every 2026 audit candidate to current evidence and classify it as active, hidden supported, admin/operational, compatibility/redirect, quarantine, generated/temp, uncertain, or high-confidence dead.
  - [x] 1.4 Add changed/new candidates and remove disproven claims with evidence; do not carry old `knip` flags forward automatically. Evidence: current `knip` 5.88.1 reports 174 raw unused-file candidates and 127 Sass-alias resolution failures. The post-baseline delta keeps the renamed SKO reader and prediction UI explicitly quarantined under B-SKO, treats test/script-owned Sustainability and operational modules as entrypoint false positives, and removes moved API helpers from dead-code consideration because current imports consume their new library paths. No new deletion claim or file mutation follows from the one-candidate raw-count increase (verified 2026-07-25).

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
  - [x] 6.3 Add security/remediation tasks for reachable hidden tools lacking adequate authorization. Evidence (2026-07-25): bounded route/separate-root review registered NEW 8.1–8.3 before remediation, separating the locally repaired standalone webhook and `/db` shell defects from their deployment/ownership gate.

- [ ] 7.0 Final cleanup verification and synchronization
  - [ ] 7.1 Re-run import/knip/route inventories and explain remaining intentional flags/false positives.
  - [ ] 7.2 Run targeted tests, type/build checks, and direct route/navigation smoke verification proportional to removed batches.
  - [ ] 7.3 Confirm no unresolved import, missing Sass module, package-script failure, route dead end, cron gap, or deployment entrypoint removal.
  - [ ] 7.4 Update the audit PRD, file inventory, this list, owning initiative lists, and master ledger with final dispositions/evidence.

## NEW Tasks

- [ ] NEW 8.0 Append every newly discovered candidate, hidden consumer, security gap, uncertain external dependency, and cleanup optimization here before closure.
- [x] NEW 8.1 **P0 — Fail the standalone line-combination webhook closed and stop disclosing dependency failures.** The Express service now rejects missing/blank configuration, malformed schemes, wrong tokens, and non-exact bearer values with fixed HTTP 401; exact bearer comparison is timing-safe. Mutation failures return fixed HTTP 500 text instead of raw exception messages. The Next.js counterpart also stops logging the Puppeteer endpoint and returning raw messages/stacks. Focused standalone auth tests pass 2/2, both JavaScript files parse, full web TypeScript and scoped ESLint pass, the new helper/test format cleanly, and diff integrity is clean; the two retained legacy route/app files preserve their pre-existing whole-file format (discovered and locally remediated 2026-07-25).
- [x] NEW 8.2 **P1 — Gate the `/db` operational shell itself, not only selected cards and downstream APIs.** The page now consumes the explicit auth-loading state, renders no operational UI to signed-out/non-admin users, and skips its public-table/local-resume reads unless the resolved user is an administrator. Downstream CSV, alias, cron, and mutation APIs retain their independent server authorization. Full TypeScript, scoped ESLint, and diff integrity pass while preserving the page's pre-existing whole-file format (discovered and locally remediated 2026-07-25).
- [ ] NEW 8.3 **P1 — Resolve and verify the deployed operational ownership boundary.** Identify the live owner/deployment or explicitly retire the standalone `webhooks` service; deploy the local NEW 8.1/8.2 repairs before claiming customer protection; then use value-free probes to prove `/db` denial and exact webhook safe boundaries without executing screenshot/upload/Discord work. Reconcile the CMS Studio's live access policy and the already-recorded functions deployment in the same ownership receipt. No deployment, webhook invocation, database/storage write, Discord call, or CMS/provider change is authorized by the local remediation (discovered 2026-07-25).

## Completion Reconciliation — July 2026

- A current `rg --files` inventory counts 3,401 tracked paths, including 2,050 web source/style files, 331 page entrypoints, and 256 API entrypoints. Temporary-cache `knip` 5.88.1 completed its production scan and reported 173 unused-file candidates; its nonzero exit is the expected findings result. The report explicitly excludes tests, operational scripts, framework/config entrypoints, separate apps, Sass alias failures, and other runtime/tool false positives instead of converting the raw total into deletion claims.
- The current entrypoint boundary includes 48 package scripts, 20 Vercel cron definitions, the separately verified 64-job pg_cron inventory, one GitHub workflow, and the `functions` (53 files), `webhooks` (4), and `cms` (22) roots. Navigation, dynamic/detail routes, rewrites/sitemap, provider callbacks, and documented external callers remain first-class consumer evidence.
- Exact tracking and ignore checks prove the 24 previously removed generated-state files remain untracked while their classes are narrowly ignored: Playwright results, all three Supabase CLI temp roots, Python bytecode, Codex build outputs, dependency caches, the local dev/SOS/Yahoo logs, and team-underlying audit JSON. Producers for the SOS log and team-underlying JSON remain intact; no package/workflow/operator consumer reads the removed outputs. The four duplicated nested SKO outputs remain intact and separately open behind retention/provenance decisions.
- All eight named stub/development routes still exist and have no product-navigation, rewrite, sitemap, workflow, cron, or runtime-link consumer. `FantasyPowerRankings`, `PowerRankings`, and `/test` remain high-confidence delete/move-to-test candidates; `testLogoMaker` and `xGoalsPage` remain unlinked prototype candidates; `cssTestingGrounds` is an actively documented style-review surface; `statsPlaceholder` remains a hidden legacy SoS/team-stats implementation pending redirect/deletion approval; and `trendsTestingGrounds` remains a read-only quarantined diagnostics surface after its mutation path was removed. No route was deleted because the externally bookmarkable-removal approval row remains open.
- Current `knip` reconfirms every named legacy component/utility family as an import-graph candidate, including SKO/prediction, WiGO, goalie/team utilities, old upserts, DRM wrapper, PPTOI, FORGE card, retired NHL API, duplicate formatter, and generic utilities. That closes re-verification only: external/manual callers, route decisions, targeted deletion, and post-delete tests remain open. Operational routes and separate apps are protected from import-graph deletion by the canonical 64-plus-20 scheduler/config/provider inventory.
- This bounded reconciliation closes 11/35 rows. Baseline parent 1.0 stays open for changed/new-candidate disposition; generated-debris parent 2.0 stays open for the retained nested SKO outputs; route, hidden-product, component-deletion, security, and final-verification parents remain open behind their explicit approval, consumer, and runtime gates.
- The 2026-07-25 delta reconciliation closes 1.4 and parent 1.0. A fresh `knip` 5.88.1 production scan reports 174 raw candidates and 127 unresolved Sass-alias imports; neither raw class is a deletion list. Candidate-affecting changes preserve the renamed SKO reader/prediction cluster as explicit quarantine, preserve tests/scripts/operational modules as entrypoints, and disprove deadness for API helpers moved into imported library paths. B-DEAD is 14/35 with 21 open. No route, component, utility, dependency, build, deployment, or external state changed.
- The 2026-07-25 operational-security cohort closes 6.3 plus local NEW 8.1/8.2 after repairing the standalone webhook bearer/error boundary, removing Puppeteer endpoint/raw-error disclosure from its Next.js counterpart, and gating `/db` plus its initial reads on resolved administrator state. NEW 8.3 preserves exact deployment, value-free runtime, standalone owner/retirement, functions receipt, and live CMS access-policy proof. B-DEAD is 17/38 with 21 open; no external system changed.
