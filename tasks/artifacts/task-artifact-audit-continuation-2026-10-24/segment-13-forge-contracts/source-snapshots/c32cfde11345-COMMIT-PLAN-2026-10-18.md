# Commit plan for the post-sprint tree (S-10, refreshed 2026-10-18)

> **SNAPSHOT.** Taken 2026-10-18T19:18:33Z on `octoberBranch` HEAD `0de97e77d`: **350 dirty paths**, with no lane editing (the sprint is checkpointed).
>
> Every path's lane, overlap note and working-file blob is in `commit-plan-snapshot-2026-10-18.tsv`. Before each commit, compare the blobs (and the lanes' sha256 prefixes in their `CHECKPOINT-DIARY-2026-10-18.md`) with the current files. Stage explicit paths only.
>
> This is read-only analysis: no git mutation and no network. TJ commits together with Chef. It replaces the 18:48Z version of this plan.

**Sources:**
- the six `CHECKPOINT-DIARY-2026-10-18.md` files: draft-lane (S-13/S-19), forge-serving-release-review (S-01/Q-01/Q-05), forge-v2-integration (S-05), game-grid-lane (S-14), independent-audit (S-09/Q-03), security-audit-fixes (S-02/Q-02)
- `tasks/sprint-2026-10-18/SPRINT-REGISTER.md` (lanes S-01–S-20, results log)
- `data-correctness-fixes-2026-10-18/DIARY.md` (S-03), `xg-gate-lane-2026-10-18/S-18-report.md`, `s20-typecheck-rankings-2026-10-18/notes.md`

## Full Vitest result

Chef's post-sprint run, from `SPRINT-REGISTER.md` Results log "~19:30Z" (raw JSON `vitest-post-sprint.json` in Chef's scratchpad):

| Files | Tests | Passed | Failed | Skipped | Exit |
|---|---|---|---|---|---|
| 979 | 10,494 | **10,444** | **0** | 50 | 0 |

It ran on the same tree as this snapshot: 261 `git status` entries, which expand to 350 paths with untracked directories listed. Before the sprint there were 9 failures in 2 files (the Oct 17 audit run).

So no commit in this plan is blocked by a unit failure. This proves the **combined** tree only. A commit that is landed alone, out of the order below, can still break: for example, D1 without H2, or C05 without its route set. Re-run each commit's focused test as it lands. The 12 baseline failures belong to the curated production candidate (`forge-serving-release-review-2026-10-17/test-evidence.json`), not to this branch.

Full `tsc`: S-20, S-02, Q-03 and S-13 each report exit 0 after S-20's declaration and caller fix, with an 8–12 GB heap. Chef has not re-run it.

## Risk tiers

| Tier | Meaning |
|---|---|
| **T0: commit first** | Fixes for production P1 defects; first in line for the next `master` slice |
| **T1** | Reviewed source with focused tests passing; commit in the order below |
| **T2** | Docs and evidence only, with no runtime effect; commit any time after the source they describe |
| **T3: hold** | Do not commit yet. The blocker is named in each row |

## 0. Already in `0de97e77d`, so not part of this plan

- Security A + B + role binding. They cannot be split without a rewrite. For a `master` slice, use S-08's `1-/2-/3-*.patch`, in order.
- IFTTT R21 + R22 (same commit). They must ship together in one `master` SHA.
- **The shift-charts P1 fix** (P-H, the Pettersson name collision): `shift-charts.ts`, `relationshipPlayerPosition.ts`, and their tests. Not on `master` yet, so it belongs with C01 in the first release slice.
- The first pass of the sustainability fix (P-G), which C01 hardens.

## 1. Commits

Every command runs from `web/` as `npx vitest run …` (equivalently `npm test -- --run …`).

### T0: commit first

| # | Lane | Commit | Files | Focused test | Notes |
|---|---|---|---|---|---|
| C01 | S-07 | Skip a sustainability batch only when every player is current | `lib/sustainability/incremental.ts`, `incremental.test.ts`, `tasks/TASKS/three-pillars-analytics/sustainability/tasks-prd-sustainability-barometer.md` | `lib/sustainability/incremental.test.ts` (13 tests) | **P1 P-G:** offsets 250/500 were skipping. Release it together with the committed shift-charts P1 fix. Its 4th cron and finalize-RPC proposals need TJ and are not in this commit |

### T1: reviewed source, in order

| # | Lane | Commit | Files | Focused test | Order / notes |
|---|---|---|---|---|---|
| C02 | S-20 | Declare `persistCapturedGameNormalization` and type its ingest caller | `types/nhlRawGamecenter.d.ts`, `pages/api/v1/db/ingest-projection-inputs.ts`, `tasks/artifacts/s20-typecheck-rankings-2026-10-18/*` | `__tests__/pages/api/v1/db/ingest-projection-inputs.test.ts` (28) | **First in T1:** it clears the TS2305 error at HEAD. The rest of the tree needs it for a clean `tsc` |
| C03 | S-20 | Rankings reader metadata pushdown, debug 5v5 strength, PP select guard | `lib/rankings/entityMetricRankingReader.ts` + test, `lib/rankings/skaterWindowAggregation.test.ts`, `pages/api/v1/debug/rolling-player-metrics.ts` + test | those 3 test files (47) | After C02 |
| C04 | S-08 | Cover the unverified-id 401 in adminOnly | `__tests__/utils/adminOnlyMiddleware.test.ts`, `tasks/artifacts/security-candidates-2026-10-17/*` | `__tests__/utils/adminOnlyMiddleware.test.ts __tests__/pages/api/v1/db/operational-route-auth.test.ts __tests__/pages/api/v1/db/cron-auth-boundaries.test.ts` | Settle first: the tree shows `candidate-{a,b}-*.patch` as **deleted**, but S-08's plan says they were "restored". Keep them unless S-08 confirms |
| C05 | S-02 | Stable error codes for contextual rankings | 9 `pages/api/v1/contextual-rankings*` routes, new `lib/rankings/apiErrorResponse.ts`, `pages/rankings.tsx` (fetcher), `__tests__/pages/api/v1/contextual-rankings{,-comparison}.test.ts` | `__tests__/pages/api/v1/contextual-rankings.test.ts __tests__/pages/api/v1/contextual-rankings-comparison.test.ts` | `rankings.tsx` reads the new shape, so it ships with the routes |
| C06 | S-02 | Redact Trends and FORGE run-detail 500s | `pages/api/v1/trends/{team-power,team-sos,player-trends}.ts`, `pages/api/v1/runs/[runId].ts`, their tests (new `team-sos.test.ts`) | `__tests__/pages/api/v1/trends __tests__/pages/api/v1/runs` | — |
| C07 | S-02 | Redact the 11 account-route 500s | `pages/api/v1/account/{yahoo/{connect,disconnect,refresh,team-roster},espn/import,fantrax/import,patreon/{index,connect,disconnect,refresh,callback}}.ts`, the 7 account tests | `__tests__/pages/api/v1/account` | — |
| C08 | S-02 | POST-only, validated `createComment` | `pages/api/createComment.ts`, new `__tests__/pages/api/createComment.test.ts` | that file | The abuse control is TJ's decision and is not in this commit |
| C09 | S-02 | Reject backslash and control-character Yahoo next paths | `lib/integrations/yahoo/oauth.ts` + test | `lib/integrations/yahoo/oauth.test.ts` | — |
| C10 | S-02 (Q-02) | Grant-ordering tests for in-season commerce | `lib/in-season/commerce.test.ts` (test only) | `lib/in-season` | Q-02 decisions are recorded in `Q-02-auth-entitlements-billing.md` |
| C11 | S-13/S-20 follow-up | Safe Draft Pro private-import errors | `lib/draft-pro/privateImportTransport.ts` + test, `lib/draft-pro/api-tests/private-imports.test.ts`, `pages/api/v1/account/draft-pro/private-imports.ts`, `…/[uploadId]/stage.ts`, `…/[uploadId]/chunks/[ordinal].ts` | `lib/draft-pro/api-tests/private-imports.test.ts lib/draft-pro/privateImportTransport.test.ts` (21) | Uses the S-02 error form |
| C12 | S-19 | Command Center shows safe unavailable text | `lib/dashboard/clientFetchCache.ts`, `lib/dashboard/commandCenterData.test.ts`, `components/forge-command-center/CommandCenterShell.tsx`, `__tests__/pages/forge/command-center.test.tsx` | `__tests__/pages/forge/command-center.test.tsx lib/dashboard` (57) | Browser check still pending |
| C13 | S-13 | 400 for bad draft-ranker refresh input; Draft regressions | `pages/api/v1/db/refresh-draft-ranker-{community,discovery}.ts`, `__tests__/pages/api/v1/db/draft-ranker-health.test.ts`, `hooks/useProcessedProjectionsData.test.tsx`, `__tests__/components/DraftDashboard/ImportCsvModal.test.tsx`, the two `tasks/TASKS/draft-dashboard-yahoo/*` docs, `tasks/artifacts/draft-lane-2026-10-18/*` | the 3 test files | The draft docs are in S-04's scope too. Commit them once, here |
| C14 | S-03 | Deterministic paging tie-breaks | `lib/rankings/{teamMatrix,goalieMatrix,deploymentTiers}.ts`, `lib/underlying-stats/teamStatsQueries.ts` + their tests | the 4 test files | `fetchRollingPlayerAverages.ts` `fetchGames` goes with C16 (same file) |
| C15 | S-03 | Goalie-power: 1000-row pages, in-flight cleanup, redacted 500 | `pages/api/v1/trends/goalie-power.ts`, new `__tests__/pages/api/v1/trends/goalie-power.test.ts` | that file (3) | Already merged with S-02's hunk (Chef-verified) |
| C16 | S-03 | Trends player page reads the rolling sidecar; gated full refresh | `lib/supabase/Upserts/{fetchRollingPlayerAverages,rollingPlayerSupportPayload,rollingPlayerValidationPayload}.ts` + tests, `pages/trends/player/[playerId].tsx` + test, `lib/rollingPlayerOperationalPolicy.ts`, `pages/api/v1/db/update-rolling-player-averages.ts` + test, `tasks/artifacts/data-correctness-fixes-2026-10-18/DIARY.md` | `lib/supabase/Upserts "__tests__/pages/trends/player" __tests__/pages/api/v1/db/update-rolling-player-averages.test.ts` | One commit: `fetchRollingPlayerAverages.ts` carries three of the items |
| C17 | S-03 | Truthful game-prediction forecast response | `lib/game-predictions/workflow.ts` + test, `pages/api/v1/game-predictions/forecast.ts`, `__tests__/pages/api/v1/game-predictions/forecast.test.ts` | those 2 test files | Before C26 (S-18 edits sibling game-prediction files) |
| C18 | S-01 / Q-01 | Legacy Start Chart gate, flagged unverified; acceptance tests; null partial sums | `pages/api/v1/start-chart.ts`, `lib/projections/startChartContract.ts`, `__tests__/pages/api/v1/start-chart.test.ts`, `__tests__/pages/start-chart.test.tsx`, `tasks/artifacts/forge-serving-release-review-2026-10-17/*` | `__tests__/pages/api/v1/start-chart.test.ts __tests__/pages/start-chart.test.tsx` | The re-review covered earlier blobs, so `start-chart.ts` and `startChartContract.ts` need a fresh review before any `master` release. `startChartContract.ts` has also drifted from S-05's patch base (§3) |
| C19 | S-01 (Q-05) | Keep unknown goalie win probability null; qualify harness carries the label | `pages/api/v1/forge/goalies.ts` + test, `scripts/qualify-native-players-offline.ts` | `__tests__/pages/api/v1/forge/goalies.test.ts scripts/qualify-native-players-offline.test.ts` (9 and 56) | Fixes the 8 baseline qualify failures |
| C20 | S-01 | Pin the clock in the Sunday-dependent RSO test | `__tests__/components/RosterScheduleOptimizer/RosterScheduleOptimizer.test.tsx` | that file (208) | S-01's edit in an RSO-owned file. It is independent of H3 |
| C21 | S-06 | Live cron jobs in the inventory and gate tests | `tasks/TASKS/cron-operations/cron-schedule.md`, `__tests__/pages/api/v1/db/cron-audit-wrappers.test.ts`, `lib/cron/combinedCronInventory.test.ts`, `tasks/artifacts/ops-health-2026-10-17/*` | those 2 test files | `cron-schedule.md` is read at runtime and is a `web/vercel.json` build trigger |
| C22 | S-06 | NST gamelog burst cap 39 | `lib/cron/nstBurstPlans.ts` + test | `lib/cron/nstBurstPlans.test.ts` | Does not reopen the NST repairs |
| C23 | S-14 | Game Grid opponent role/category effects, team-expectation adapter (not wired), 32-team e2e | `components/GameGrid/{DesktopMasterTable,OpponentMetricsTable}.tsx` + scss, new `OpponentRoleToggle.{tsx,module.scss}`, new tests, `components/GameGrid/utils/{opponentCategoryEffects,teamGameExpectations}.ts` + tests, `pages/game-grid/[mode].tsx`, `e2e/game-grid-previews.spec.ts`, `e2e/fixtures/game-grid-previews/{App.tsx,data.ts,real-week-32.ts,README.md}`, `tasks/tasks-game-grid-execution-2026-10-07.md`, `tasks/artifacts/game-grid-lane-2026-10-18/**` (31 files, including 16 PNG) | `components/GameGrid` (232), then `cd e2e && npx playwright test -c game-grid-previews.config.ts` (15) | E2E uses the isolated fixture server; no Next server |
| C24 | S-16 | SKO Element and BLSH contracts, fixture previews (404 in production), complete sKO quarantine registry | new `lib/skoElement/*`, `lib/buyLowSellHigh/*`, `components/{skoElement,buyLowSellHigh}/*`, `pages/{sko-element,buy-low-sell-high}/preview.tsx`, `lib/predictions/legacyQuarantine.ts` + test, `tasks/tasks-prd-{sko-element,buy-low-sell-high}.md`, `tasks/TASKS/sko-charts/tasks-prd-sko-charts.md` | `lib/skoElement lib/buyLowSellHigh lib/predictions/legacyQuarantine.test.ts` | The SKO task doc is in S-04's scope too. Commit it once, here |
| C25 | S-17 | Exact-five PP units, per-second oracle, fixtures (offline) | new `lib/exactFivePp/*`, `tasks/artifacts/exact-five-pp-lane-2026-10-18/*` | `lib/exactFivePp` (30) | No production importer. The adapter and coverage sample need TJ |
| C26 | S-18 | xG gate rejects forbidden post-event features; game-prediction feature set v6 | `lib/xg/{baselineDataset,shotFeaturePersistence}.ts` + test, `scripts/train-nhl-xg-baseline.ts` + test, `lib/game-predictions/featureSources.ts`, `featureBuilder.test.ts`, `tasks/artifacts/xg-gate-lane-2026-10-18/S-18-report.md` | `lib/xg lib/game-predictions __tests__/pages/api/v1/game-predictions scripts/train-nhl-xg-baseline.test.ts` (275) | **Commit OK, release held:** the version bump changes production feature identity, so a `master` release needs TJ. After C17 |
| C27 | Q-03 | Accessible spinner status, global focus ring, lines header, team-explorer fix | `components/Spinner/Spinner.{tsx,module.scss}` + new test, `components/Comments/Comments.tsx`, `pages/lines/[abbreviation].{tsx,module.scss}` + new test, `pages/underlying-stats/playerStats/playerStats.module.scss`, `pages/underlying-stats/teamStats/index.tsx` + test, `styles/globals.css`, new `__tests__/styles/globalFocus.test.ts`, `tasks/artifacts/independent-audit-2026-10-17/q03/*` | the 70-test command in the S-09 diary, plus the 343-test Spinner-caller sweep | `globals.css` affects every page. Browser and keyboard checks are still pending |
| C28 | S-09 A | Homepage without moment-timezone zone data (−35.6 kB gz) | `components/HomePage/{homepageTime.ts,homepageTime.test.ts,homepageGameFormatting.ts,HomepageStandingsInjuriesSection.tsx,HomepageGamesSection.tsx}`, `pages/index.tsx` (one line), `tasks/artifacts/independent-audit-2026-10-17/s09/{s09-a-*.diff,first-load-*.tsv,README.md}` | `components/HomePage __tests__/index.test.tsx` (63; also with TZ at LA, London and Tokyo) | Independent of H1. A changes no dependency |

### T2: docs and evidence

| # | Lane | Commit | Files | Constraint |
|---|---|---|---|---|
| D1 | S-04 | Reconcile the Super Goal ledger with the 2026-10-17 audit | the 30 `tasks/TASKS/**` files tagged S-04 in the TSV, **excluding** the lane-claimed docs (cron-schedule, both draft docs, the SKO doc, the sustainability doc) and **excluding `super-goal-final-summary.md`** | That summary also carries S-02's migration-count line, which `supportedBaselineMigration.test.ts:768` checks. Commit it with H2. Committed earlier, the line would claim migrations that are not yet in the tree, and the test fails. Check with `python3 tasks/artifacts/super-goal-audit-2026-10-17/ledger_parity.py` (0/0) |
| D2 | S-05 | FORGE v2 integration patches and replay receipt (evidence only; **not applied**) | `tasks/artifacts/forge-v2-integration-2026-10-18/*` | Applying them is H5 |
| D3 | S-15 | Social share contract, rights checklist, synthetic exports | `tasks/artifacts/social-share-lane-2026-10-18/**` | Rights decisions are TJ's |
| D4 | S-09 | Audit diaries | `tasks/artifacts/independent-audit-2026-10-17/CHECKPOINT-DIARY-2026-10-18.md`, `s09/s09-heavy.sh` | — |
| D5 | Chef | Sprint register and working agreement | `tasks/sprint-2026-10-18/SPRINT-REGISTER.md`, `mise-en-place.md` | After the Vitest line is posted |
| D6 | S-10 | Release ledger: this plan, snapshot, manifests | `tasks/artifacts/release-ledger-2026-10-17/*` | Last |

### T3: hold

| # | Lane | Held change | Files | Blocker and release condition |
|---|---|---|---|---|
| H1 | S-09 B/C | Remove 7 unused dependencies plus `@types/formidable`; add a `typecheck` script | `web/package.json`, `web/package-lock.json`, `s09/s09-b-*.diff`, `s09/s09-c-*.diff` | **A clean `npm ci` has not been run.** The shared `node_modules` still has the removed packages. Release condition, in a clean copy: `npm ci`, then `npm run typecheck`, then `npm run test:full`, plus the locked compile build. Commit B and C separately; C is low risk |
| H2 | S-02 | Migrations 84 and 85 plus the authority pair | `supabase/migrations/20261018184229_restrict_provider_linkage_browser_writes.sql` (84), `supabase/migrations/20261018190022_restore_private_token_vault.sql` (85), `tasks/TASKS/repository-audit-remediation/migration-authority.json`, `lib/supabase/supportedBaselineMigration.test.ts`, `tasks/TASKS/super-goal/super-goal-final-summary.md`, the two PG harness scripts and results | (a) The file, authority row, test and count line must land in **one** commit. (b) IFTTT reserved authority entries 84–86 for SQL6–SQL8, so the migration owner must re-sequence one side. (c) A hosted apply is a separate ask-first decision. Test: `lib/supabase/supportedBaselineMigration.test.ts` (21) |
| H3 | S-12 | Zero Yahoo goalie minimum means none; goalie boost when at risk | `lib/integrations/yahoo/{liveDraft,rosterPlanning}.ts` + tests, `lib/rosterScheduleOptimizer/{planning,planningTypes,benchDecisions,candidatePlanMetrics}.ts` + tests, `components/RosterScheduleOptimizer/{CandidateBrowser,CandidateCard,RosterScheduleOptimizer}.tsx`, `CandidateBrowser.presentation.test.tsx` | **`planningTypes.ts` is in Monday's frozen 62-file FORGE import graph.** It is still the only dirty frozen path, and the run executes this working tree. Hold until after 2026-10-20 17:00 UTC, or have Chef accept the optional type field. `liveDraft.ts` also needs S-13's confirmation. The 102 unmatched Yahoo identities are a separate DB-write approval |
| H4 | none | Gamecenter normalization sweep route | `pages/api/v1/db/sweep-gamecenter-normalization.ts` + test | **Unclaimed.** It now type-checks (S-20's declaration). It needs an owner, an auth review and a cron decision |
| H5 | S-05 | Apply the FORGE v2 driver patches | `01`–`04` patches into the frozen driver | After 2026-10-20 17:00 UTC. `base-blobs.txt` has drifted: `web/lib/projections/startChartContract.ts` (base `d9dc8f3b`, now `7a2618ec`, from C18). Re-cut or rebase before `git apply --check`. The flags need TJ |

## 2. Order summary

```
C01 → C02 → C03 → (C04–C28 in the order listed)
D1–D6 any time after the source they describe; D6 last
H1–H5 held
```

A sliced `master` release needs separate approval: R and A1 in `APPROVAL-REQUESTS.md`. Its natural first slice is T0 plus the committed shift-charts fix.

## 3. Overlaps and unclaimed paths

| Path | Lanes | Resolution |
|---|---|---|
| `web/lib/rosterScheduleOptimizer/planningTypes.ts` | S-12, inside the frozen FORGE graph | H3 |
| `tasks/TASKS/repository-audit-remediation/migration-authority.json` | S-02 (orders 84 and 85) and IFTTT (84–86 reserved) | H2(b) |
| `tasks/TASKS/super-goal/super-goal-final-summary.md` | S-04 (roll-up) and S-02 (count line) | Commit with H2; excluded from D1 |
| `web/lib/projections/startChartContract.ts` | S-01 (C18) and the S-05 patch base | H5 rebase |
| `web/__tests__/components/RosterScheduleOptimizer/RosterScheduleOptimizer.test.tsx` | S-01 clock pin in an RSO-owned file | C20 |
| `web/pages/api/v1/trends/goalie-power.ts` | S-02 hunk handed to S-03 | C15 (merged, verified) |
| The two draft docs and the SKO task doc | S-13 / S-16, plus S-04's scope | C13 / C24 |
| `tasks/TASKS/cron-operations/cron-schedule.md` | S-06, plus S-04's scope | C21 |
| `web/lib/integrations/yahoo/liveDraft.ts` | S-12, in S-13's area | H3 |
| `sweep-gamecenter-normalization.ts` + test | **unclaimed** | H4 |

## 4. Exclusions (verified on this snapshot)

Not present in the 350 dirty paths:
- private data (`~/Documents/FHFH-private/**`) and `.env*`
- `.vercel/`
- npm `_cacache`
- Playwright output (`test-results/`, `playwright-report/`, `.last-run.json`)
- `supabase/.temp/`
- `.next*`

The 25 PNGs present are deliberate evidence: 16 Game Grid fixture screenshots and 9 synthetic social exports. The already-tracked cache, Playwright and `.temp` files are covered by approval C2.

Never run `git add -A`.
