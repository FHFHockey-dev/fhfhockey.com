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
  - [ ] 1.1 Re-run source inventory/import graph and current `knip --production` using repository conventions; exclude generated/vendor/cache/test false positives explicitly.
  - [ ] 1.2 Enumerate pages/API routes, navigation, dynamic links/imports, package scripts, cron schedules, Vercel rewrites, GitHub workflows, separate apps, and documented external callers.
  - [ ] 1.3 Compare every 2026 audit candidate to current evidence and classify it as active, hidden supported, admin/operational, compatibility/redirect, quarantine, generated/temp, uncertain, or high-confidence dead.
  - [ ] 1.4 Add changed/new candidates and remove disproven claims with evidence; do not carry old `knip` flags forward automatically.

- [ ] 2.0 Handle obvious temporary/generated debris separately
  - [ ] 2.1 Classify root/temp/debug scripts, duplicated generated-output paths, logs, and test-result artifacts by current package/workflow/documentation usage.
  - [ ] 2.2 Move durable findings into existing runbooks/tasks and delete only proven temporary files in small reviewable batches.
  - [ ] 2.3 Add/adjust ignore rules for regenerated logs/results only after confirming they are not intentional committed fixtures.
  - [ ] 2.4 Verify no package script, workflow, or operator command references removed artifacts.

- [ ] 3.0 Resolve empty/stub and development-only routes
  - [ ] 3.1 Re-verify `FantasyPowerRankings`, `PowerRankings`, `/test`, logo/style/trends testing grounds, placeholders, and xGoals prototypes against current product links and use.
  - [ ] 3.2 For each route choose keep/document, protect, redirect, move to tests/docs, or delete and record the replacement/consumer evidence.
  - [ ] 3.3 Obtain approval before removing a route family or externally bookmarkable surface with uncertain consumers.
  - [ ] 3.4 Verify routing, sitemap/navigation, build, and direct replacement links after each batch.

- [ ] 4.0 Resolve hidden legacy product surfaces through owning initiatives
  - [ ] 4.1 Reconcile buy-low/sell-high, legacy goalies/team stats/projections/FORGE/SKO/debug/twitter routes against current Variance, Underlying Stats, FORGE, Trends, Lines, and admin replacements.
  - [ ] 4.2 Prefer explicit redirects or quarantine notices when lineage/bookmarks remain useful; do not leave duplicate live product implementations ambiguous.
  - [ ] 4.3 Move active debug/operator behavior behind authenticated admin ownership or extract it into repeatable tests/runbooks.
  - [ ] 4.4 Synchronize deletion/quarantine tasks with the relevant source initiative before editing files.

- [ ] 5.0 Remove dead component/utility clusters only after route decisions
  - [ ] 5.1 Re-verify legacy SKO/prediction, WiGO, goalie/team, old upsert, DRM wrapper, PPTOI, FORGE card, retired NHL API, formatter, and generic utility clusters.
  - [ ] 5.2 Confirm no active route, script, test fixture, dynamic import, separate app, cron, or external caller uses each cluster.
  - [ ] 5.3 Delete targeted proven-unused clusters with any required import/style/test cleanup and preserve documentation lineage.
  - [ ] 5.4 Verify type/build/unit/runtime paths owned by each domain after its batch.

- [ ] 6.0 Audit admin/operational and separate-project security/ownership
  - [ ] 6.1 Verify `/db`, admin CSV/alias tools, cron APIs, webhooks, `functions`, and CMS are authenticated, deployed, documented, and owned or explicitly retired.
  - [ ] 6.2 Do not delete operational routes based on app import graphs; correlate with cron inventory, provider callbacks, external scheduler, and deployment configs.
  - [ ] 6.3 Add security/remediation tasks for reachable hidden tools lacking adequate authorization.

- [ ] 7.0 Final cleanup verification and synchronization
  - [ ] 7.1 Re-run import/knip/route inventories and explain remaining intentional flags/false positives.
  - [ ] 7.2 Run targeted tests, type/build checks, and direct route/navigation smoke verification proportional to removed batches.
  - [ ] 7.3 Confirm no unresolved import, missing Sass module, package-script failure, route dead end, cron gap, or deployment entrypoint removal.
  - [ ] 7.4 Update the audit PRD, file inventory, this list, owning initiative lists, and master ledger with final dispositions/evidence.

## NEW Tasks

- [ ] NEW 8.0 Append every newly discovered candidate, hidden consumer, security gap, uncertain external dependency, and cleanup optimization here before closure.
