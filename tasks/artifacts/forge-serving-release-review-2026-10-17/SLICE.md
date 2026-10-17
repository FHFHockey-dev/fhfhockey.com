# FORGE serving slice: import closure with hashes

Review only. No source, ref, index, remote, Vercel or database state was changed.

- **Base:** production `master` = `457435eb3010c5b3dd92d2e1a46d9c75d851780a`.
- **Bytes reviewed:** the working tree of `/Users/tim/Code/fhfhockey.com` on `octoberBranch` (HEAD `ceceb407a`), hashed at **2026-10-17T21:50:17Z**.
  - Re-hashed at 21:54:12Z and 22:03:34Z: 0 of 70 drifted.
  - 7 of the 70 are **uncommitted** edits by other sessions.
- **Machine-readable copy:** `slice.json`, with full blobs, sha256, production blobs and in-slice importers.

> **Revision 2026-10-17 ~22:45Z (blocker fixes).** `slice.json` is now the authority for pins.
> - **Re-pinned:** `calibrationEligibility.ts` (B1); `startChartContract.ts` and `start-chart.ts` (N1); `gameExpectationView.ts` (N2); `forge/forecasts.ts` (N3); `lib/in-season/workspaceSchema.ts` (W1, `catalogExpiresAt`). The hash rows below for these six are stale.
> - **New sections:** `scheduleWriters` (the two B2 files below, at unchanged bytes); `testSupport` (`scripts/preview-native-baseline.ts`, `seasonGameContributions.ts`: inert, no `pages/` importer, Monday-frozen and not edited); `candidateTests` (49); `excludedFromCandidate`; `branchOnlyRuntime` (`run-forge-projections.ts`, which stays at production bytes).
> - **Superseded:** the B3 table at the end ("cannot run on a master candidate"). See `BLOCKERS.md` status.

## How the slice was derived

1. **Static import graph.** Every `import`/`export from`/dynamic `import()`, `require()`, `new URL(…, import.meta.url)` worker, and SCSS `@use`/`@import` was traced, using the TypeScript scanner (`ts.preProcessFile`) and `tsconfig` path aliases.
   - Entry points: the three serving routes `pages/api/v1/forge/forecasts.ts`, `pages/api/v1/start-chart.ts` and `pages/api/v1/roster-schedule-optimizer/data.ts`, plus the pages `/start-chart`, `/roster-schedule-optimizer` and `/forge/forecasts`, and `_app`/`_document`.
   - Result: 206 files, 77 of which differ from production.
2. **HTTP contract edges**, which the import graph cannot see:
   - **RSO data route ↔ RSO page.** `data.ts` now returns `encodePlanningDataTransport(data)` (`{version, data, catalogs}`). Production's `RosterScheduleOptimizer.tsx` reads `body.data as PlanningData` and cannot decode it, so the route and the page tree must ship together.
   - **The RSO page at current bytes calls** `/api/v1/roster-schedule-optimizer/eligibility` (new route) and `?preservation=…` on `/workspace` (changed route). Both routes are included.
   - The `provider` route change only adds `retryAfterSeconds` to error bodies, which the page does not read. It is excluded.
3. **Necessity, not reachability.** A changed file is in the slice only if a changed slice file imports it directly. Seeds: the 3 routes, the Start Chart page, `RosterScheduleOptimizer.tsx`, and the `eligibility` and `workspace` routes.
   - Changed files that are reached only through unchanged production files stay at production bytes. Their production importers are consistent with them.
   - This removed `scopeReads.ts`, `run-forge-projections.types.ts` and `rollingPlayerCountSupport.ts`. Their inclusion caused the only 2 candidate type errors: production `calculators/goalie-starter.ts` against a nullable `proj_win_prob`.
4. **Excluded:** IFTTT receivers and research code. None is imported by the slice. The IFTTT/lines crons import shared slice modules, and are listed below as affected production importers.

**Result: 70 runtime files**, plus **2 must-land-together additions** (B2), plus their tests. The candidate is import-closed: production plus the 70 has 0 unresolved local imports.

| | Files |
|---|---|
| Runtime slice | 70 (34 added, 36 modified; 7 uncommitted) |
| Reusable independent receipt at exact current bytes (ledger E1, blob equal) | 14 |
| E1 receipt whose bytes have since changed (uncommitted delta reviewed here) | 2 |
| Owner/snapshot pins only (E4/E5) | 38 |
| No receipt (E6) | 16 |
| Must-land-together additions (B2) | 2 |
| Optional add-on (`/forge/forecasts` page) | 2 |

## Runtime slice (70)

### Shared admission and serving core (30)

| Path | St | Tree | Blob | sha256 | Bytes | Ledger | Receipt at these bytes |
|---|---|---|---|---|---|---|---|
| `web/lib/player-forecasts/baselineGeneration.ts` | M | committed | `565ad6a2e4` | `d70d75a099c7c025` | 17044 | E6 | none |
| `web/lib/player-forecasts/baselineRates.ts` | M | committed | `9a115358a2` | `47e440853fc1eb63` | 17088 | E6 | none |
| `web/lib/player-forecasts/contributionStore.ts` | M | committed | `8ab7ac7776` | `39129a51cf6d14a2` | 21506 | E6 | none |
| `web/lib/player-forecasts/contributions.ts` | M | committed | `ab48ca9675` | `1f08b1c5ca9ea296` | 22784 | E4 | owner/snapshot pin only |
| `web/lib/player-forecasts/currentSeasonSogBaseline.ts` | A | committed | `2cc53e1d36` | `9d62bc660a4f5443` | 14220 | E5 | owner/snapshot pin only |
| `web/lib/player-forecasts/currentSeasonSogContribution.ts` | A | **uncommitted** | `61cc9debda` | `f5dc3e77654e8fed` | 6467 | E5 | owner/snapshot pin only |
| `web/lib/player-forecasts/gameExpectations.ts` | A | committed | `0c4c68094d` | `6e3995d94f189832` | 17562 | E6 | none |
| `web/lib/player-forecasts/goalieBaselineInputCapture.ts` | M | committed | `3ebf28d727` | `8d4361eac8e424c5` | 17890 | E4 | owner/snapshot pin only |
| `web/lib/player-forecasts/goalieBaselineRates.ts` | M | committed | `19d6df67d3` | `9151ca9ee7d47465` | 29525 | E6 | none |
| `web/lib/player-forecasts/modeledGoalieParticipation.ts` | A | committed | `fa662ad96e` | `3b6fb3222837a652` | 17591 | E4 | owner/snapshot pin only |
| `web/lib/player-forecasts/modeledGoalieParticipationStore.ts` | A | committed | `2b7a3b811d` | `37f94d22a8a0971c` | 11696 | E4 | owner/snapshot pin only |
| `web/lib/player-forecasts/modeledSkaterParticipation.ts` | A | committed | `17feca7da1` | `c06406adfbdb7ccf` | 17776 | E4 | owner/snapshot pin only |
| `web/lib/player-forecasts/modeledSkaterParticipationStore.ts` | A | committed | `379f5c10e2` | `0e1363974e01b38c` | 9901 | E6 | none |
| `web/lib/player-forecasts/nativeCatalogHead.ts` | A | committed | `e4bcbbd9db` | `9f1696d991959cab` | 13926 | E4 | owner/snapshot pin only |
| `web/lib/player-forecasts/nativeContributionAdmission.ts` | A | committed | `dc8569fab5` | `533dedd6625688fb` | 8816 | E6 | none |
| `web/lib/player-forecasts/nativeGoalieOutcomes.ts` | A | committed | `dfafb89667` | `4ec9fa3356113480` | 16535 | E6 | none |
| `web/lib/player-forecasts/nativePowerPlayPoints.ts` | A | committed | `b8ad5e16e2` | `7079c0dd49a44267` | 8030 | E4 | owner/snapshot pin only |
| `web/lib/player-forecasts/planningContributions.ts` | M | committed | `348b9eca7f` | `93aea19b144c6057` | 18315 | E4 | owner/snapshot pin only |
| `web/lib/player-forecasts/resolvedPlanningForecast.ts` | M | committed | `89350de2d0` | `2070019c4ea4d9c8` | 16856 | E4 | owner/snapshot pin only |
| `web/lib/player-forecasts/sourceSnapshot.ts` | M | committed | `0d319794a2` | `7ec78dcefc5dd0d6` | 4315 | E4 | owner/snapshot pin only |
| `web/lib/player-forecasts/targetRosterObservation.ts` | A | committed | `c47269517f` | `d77157d4e3915efd` | 5311 | E4 | owner/snapshot pin only |
| `web/lib/projections/calibrationEligibility.ts` | M | committed | `9285d2818e` | `65749b0a1e4fe8c1` | 2130 | E4 | owner/snapshot pin only |
| `web/lib/projections/consumerRevisionAdmission.ts` | M | committed | `1bd59c4888` | `303a0c9896f6277e` | 18269 | E4 | owner/snapshot pin only |
| `web/lib/projections/gameRevisions.ts` | M | committed | `5ed1227d02` | `2b16ffb05973d007` | 10870 | E4 | owner/snapshot pin only |
| `web/lib/projections/issuedContext.ts` | M | committed | `23030433e9` | `8d2aeb9d1c01f951` | 11570 | E4 | owner/snapshot pin only |
| `web/lib/rosterScheduleData/normalize.ts` | M | committed | `a1bb78e19a` | `bf6a30c1ea38903f` | 7007 | E4 | owner/snapshot pin only |
| `web/lib/rosterScheduleData/planning.ts` | M | committed | `cc76828c0e` | `c91ec8dfa117499b` | 22115 | E4 | owner/snapshot pin only |
| `web/lib/rosterScheduleData/planningInputs.ts` | M | committed | `d0e81b2bcc` | `0a7e6ba064567c7c` | 13125 | E4 | owner/snapshot pin only |
| `web/lib/rosterScheduleData/types.ts` | M | committed | `9f42b55254` | `7ee4dcccf5eef024` | 1893 | E4 | owner/snapshot pin only |
| `web/lib/rosterScheduleOptimizer/planningTypes.ts` | M | committed | `d9a95c2e58` | `b372bf556d1bcb90` | 14326 | E4 | owner/snapshot pin only |

### FORGE API (3)

| Path | St | Tree | Blob | sha256 | Bytes | Ledger | Receipt at these bytes |
|---|---|---|---|---|---|---|---|
| `web/lib/player-forecasts/gameExpectationReader.ts` | A | committed | `c31004d7f5` | `f872ed9bffdab300` | 2246 | E4 | owner/snapshot pin only |
| `web/lib/player-forecasts/gameExpectationView.ts` | A | committed | `9fd51af120` | `0ddb55e2722867ac` | 15723 | E6 | none |
| `web/pages/api/v1/forge/forecasts.ts` | A | committed | `acb2e66eec` | `44904ec95c1a36c8` | 1461 | E6 | none |

### Start Chart API and page (3)

| Path | St | Tree | Blob | sha256 | Bytes | Ledger | Receipt at these bytes |
|---|---|---|---|---|---|---|---|
| `web/lib/projections/startChartContract.ts` | M | committed | `47bf2a6b8a` | `82d9937255c50224` | 42579 | E6 | none |
| `web/pages/api/v1/start-chart.ts` | M | committed | `b88c556545` | `29a743a0a9b5f9f6` | 83744 | E4 | owner/snapshot pin only |
| `web/pages/start-chart.tsx` | M | committed | `438a3064ea` | `aefcecfc76da56c6` | 82791 | E6 | none |

### RSO routes and transport (4)

| Path | St | Tree | Blob | sha256 | Bytes | Ledger | Receipt at these bytes |
|---|---|---|---|---|---|---|---|
| `web/lib/rosterScheduleData/planningDataTransport.ts` | A | committed | `1d4abac740` | `1191818b7d1b3e69` | 10169 | E4 | owner/snapshot pin only |
| `web/pages/api/v1/roster-schedule-optimizer/data.ts` | M | committed | `6a331fa45b` | `dbad098b221e7106` | 1378 | E6 | none |
| `web/pages/api/v1/roster-schedule-optimizer/eligibility.ts` | A | committed | `d84ac03d58` | `f5447e4c9de58133` | 1312 | E4 | owner/snapshot pin only |
| `web/pages/api/v1/roster-schedule-optimizer/workspace.ts` | M | committed | `e643d024fc` | `65a709a8f54af63e` | 13559 | E5 | owner/snapshot pin only |

### RSO page tree (contract-coupled to the RSO data route) (30)

| Path | St | Tree | Blob | sha256 | Bytes | Ledger | Receipt at these bytes |
|---|---|---|---|---|---|---|---|
| `web/components/RosterScheduleOptimizer/AcquisitionPeriodTimes.tsx` | A | committed | `98ff53eea5` | `ba4a9703f5f94f56` | 3224 | E1 | yes: rso-intraday-periods ACCEPT |
| `web/components/RosterScheduleOptimizer/CandidateBrowser.tsx` | M | **uncommitted** | `39b5ec90e3` | `97e5916c669d655a` | 19265 | E1 | no (uncommitted delta): rso-candidate-pool ACCEPT |
| `web/components/RosterScheduleOptimizer/CandidateCard.module.scss` | A | committed | `87d1b6d6f6` | `1d0c789531949408` | 3584 | E1 | yes: rso-mockup-match bounded ACCEPT |
| `web/components/RosterScheduleOptimizer/CandidateCard.tsx` | A | **uncommitted** | `482f43e916` | `26748a79cb6e4a50` | 10358 | E4 | owner/snapshot pin only |
| `web/components/RosterScheduleOptimizer/CategoryGains.tsx` | M | committed | `fa135d1a49` | `045576ab1e07d945` | 5108 | E4 | owner/snapshot pin only |
| `web/components/RosterScheduleOptimizer/CompactSchedule.tsx` | M | committed | `eb5a98a664` | `5afb93882b164795` | 30981 | E1 | yes: rso-mockup-match bounded ACCEPT; rso-partial-discovery ACCEPT |
| `web/components/RosterScheduleOptimizer/InfoTooltip.module.scss` | A | committed | `010a088ba5` | `ed103a66cd13c204` | 1104 | E4 | owner/snapshot pin only |
| `web/components/RosterScheduleOptimizer/InfoTooltip.tsx` | A | committed | `472492107b` | `edbf37198e956772` | 3232 | E4 | owner/snapshot pin only |
| `web/components/RosterScheduleOptimizer/RosterContribution.tsx` | A | committed | `4011ba2014` | `b217dc9f03df5862` | 3580 | E1 | yes: rso-mockup-match bounded ACCEPT; rso-partial-discovery ACCEPT |
| `web/components/RosterScheduleOptimizer/RosterPlayerRow.tsx` | A | committed | `03ba4b80c0` | `17a63315cdbf2f82` | 2798 | E1 | yes: rso-mockup-match bounded ACCEPT |
| `web/components/RosterScheduleOptimizer/RosterScheduleOptimizer.module.scss` | M | committed | `21cc9532d3` | `975438c669762c48` | 42254 | E1 | yes: rso-mockup-match bounded ACCEPT |
| `web/components/RosterScheduleOptimizer/RosterScheduleOptimizer.tsx` | M | committed | `4cb8c50f52` | `38106572657bc6b1` | 165565 | E6 | none |
| `web/components/RosterScheduleOptimizer/TeamScheduleContext.module.scss` | A | committed | `47201e6880` | `ce76ae849c331ad4` | 3137 | E1 | yes: rso-mockup-match bounded ACCEPT |
| `web/components/RosterScheduleOptimizer/TeamScheduleContext.tsx` | A | committed | `d3d10bdf68` | `677a53f151c6d1c1` | 5872 | E6 | none |
| `web/components/RosterScheduleOptimizer/canonicalSchedule.ts` | A | committed | `3cb062f05d` | `9d39752f8cf62e8a` | 13432 | E4 | owner/snapshot pin only |
| `web/hooks/candidateMetrics.worker.ts` | M | **uncommitted** | `2b1709c344` | `6bd2629ad5c6dd96` | 619 | E4 | owner/snapshot pin only |
| `web/hooks/useCandidateMetrics.ts` | M | **uncommitted** | `e6a2bbc758` | `10e129a291310bf5` | 2528 | E4 | owner/snapshot pin only |
| `web/hooks/useYahooEligibility.ts` | A | committed | `9592c12dbb` | `5a8ff56cd3cf1896` | 3947 | E1 | yes: rso-candidate-admission ACCEPT |
| `web/lib/in-season/workspaceSchema.ts` | M | **uncommitted** | `965bef395a` | `ba918a4f55c1bcde` | 16544 | E1 | no (uncommitted delta): rso-intraday-periods ACCEPT |
| `web/lib/rosterScheduleOptimizer/candidatePlanMetrics.ts` | A | **uncommitted** | `bac1159a3b` | `b0e06a29c30fd8cb` | 15587 | E4 | owner/snapshot pin only |
| `web/lib/rosterScheduleOptimizer/contributionLedger.ts` | A | committed | `3f46f39e44` | `27c3a2242e1781a8` | 6738 | E4 | owner/snapshot pin only |
| `web/lib/rosterScheduleOptimizer/periodBoundaries.ts` | A | committed | `2d711664dc` | `0e777c8af2b61ebe` | 2331 | E1 | yes: rso-intraday-periods ACCEPT |
| `web/lib/rosterScheduleOptimizer/planning.ts` | M | committed | `c0aba8f5a0` | `706af5ea9559866c` | 98946 | E6 | none |
| `web/lib/rosterScheduleOptimizer/planningTimeline.ts` | M | committed | `a5398a8c6f` | `e61be30023f555e7` | 11886 | E1 | yes: rso-functional-checkpoint accepted-local-functional-slice; rso-mockup-match bounded ACCEPT |
| `web/lib/rosterScheduleOptimizer/providerRules.ts` | M | committed | `8cba4db703` | `c78853d6e8b7a5eb` | 8198 | E1 | yes: rso-weekly-rule-supplement v3 ACCEPT |
| `web/lib/rosterScheduleOptimizer/reconciliation.ts` | M | committed | `dfbff3e1cc` | `f43c7f84cd408d95` | 6645 | E1 | yes: rso-functional-checkpoint accepted-local-functional-slice; rso-mockup-match bounded ACCEPT |
| `web/lib/rosterScheduleOptimizer/refreshForecastInputs.ts` | A | committed | `39d6fd786d` | `a77283cfdced0080` | 2215 | E1 | yes: rso-participation-transport ACCEPT |
| `web/lib/rosterScheduleOptimizer/workspace.ts` | M | committed | `9ceb2c397e` | `8a82c0f7c21f0314` | 21941 | E1 | yes: rso-participation-transport ACCEPT |
| `web/lib/rosterScheduleOptimizer/yahooEligibility.ts` | A | committed | `14bc0a332e` | `11c94952da445a91` | 2610 | E4 | owner/snapshot pin only |
| `web/lib/rosterScheduleOptimizer/yahooEligibilityCache.ts` | A | committed | `1a20763f3b` | `f34826b36757033c` | 6153 | E4 | owner/snapshot pin only |

## Must land together: schedule-coverage witness writer (B2)

`planningInputs.ts` (in slice) treats a horizon as complete only when every date carries a `source_metadata.scheduleCoverage` (`nhl-source-days-v1`) witness that is fresh within 36 h. Only these two out-of-slice files write that witness. The production bytes of the route never write it, whether or not a hosted pg_cron job calls the route (see `REVIEW.md` B2). Their other changed dependencies, `types.ts` and `normalize.ts`, are already in the slice.

| Path | Production blob | Current blob | sha256 | Diff vs prod | Tree |
|---|---|---|---|---|---|
| `web/lib/rosterScheduleData/source.ts` | `a7543f164c` | `9f7bab6dc5` | `770c0dd5820aaf74` | 12/1 | committed |
| `web/pages/api/v1/db/update-roster-optimizer-schedule.ts` | `1a68e62a65` | `3968b43d00` | `ff6dcdf25e0d7f9d` | 1/0 | committed |

## Optional add-on: the `/forge/forecasts` page

This is a new page with no production consumer and no production nav link: `ForgeRouteNav.tsx` stays at production bytes. The FORGE API it reads (`gameExpectationView.ts`) is already in the slice. Add these two files only if a FORGE UI should ship. Its current test, `__tests__/pages/forge/forecasts.test.tsx`, passes on octoberBranch.

| Path | Production blob | Current blob | sha256 | Diff vs prod | Tree |
|---|---|---|---|---|---|
| `web/pages/forge/forecasts.tsx` | `--` | `7e173c5e61` | `1d175eec95911e2a` | new | committed |
| `web/styles/ForgeForecasts.module.scss` | `--` | `fba1c1bd32` | `2adffb14d0cdb6d1` | new | committed |

## In the closure but out of slice: stays at production bytes

Each of these is reachable from an entry point, but no changed slice file imports it directly. The candidate typechecks and runs with production bytes for all of them.

| Path | Production blob | Current blob | sha256 | Diff vs prod | Tree | Why out |
|---|---|---|---|---|---|---|
| `web/lib/cron/withCronJobAudit.ts` | `0a0e7387d2` | `d604b720d2` | `eb3991f64e5e37f2` | 55/1 | committed | Reached via lib/NHL/server → update-player route only; R1 cron unit owns it |
| `web/utils/adminOnlyMiddleware.ts` | `a0e860e374` | `c8ac51a8b6` | `de749fa9e811aacb` | 41/16 | uncommitted | Security session (candidate B) owns it; reached only via update-player route |
| `web/components/GameGrid/utils/calcWinOdds.ts` | `83c9990ca0` | `e361097dc4` | `ddc00c4a09a9794d` | 0/13 | uncommitted | Unused-function removal; reached via scheduleSummary only |
| `web/pages/_app.tsx` | `7283509962` | `780e2df13b` | `b7688198aac927bf` | 22/15 | uncommitted | Audit Patch 01 (still changing during this review: f71c934e → 780e2df1) |
| `web/lib/seo.js` | `98601a94a4` | `8a53818ef6` | `111c7150078315f8` | 1/1 | committed | SEO noindex for unreleased /social-share |
| `web/lib/player-forecasts/scopeReads.ts` | `b98f68e69e` | `22c001469a` | `804d79e6e67091dd` | 22/6 | committed | Reached only via unchanged importers (lines/projected, IFTTT crons) |
| `web/lib/projections/types/run-forge-projections.types.ts` | `fbc9aaf65f` | `164196f58c` | `02076eb3d71a2f7f` | 4/1 | committed | Imported only by unchanged production files (e.g. `dailyBoardEvidence.ts`); including it broke production `goalie-starter.ts` typing (2 candidate tsc errors) |
| `web/lib/rollingPlayerCountSupport.ts` | `--` | `6f315de42b` | `c16d7a4a1b8667aa` | new | committed | No slice file imports it (only the excluded types file and out-of-slice rolling-average code) |
| `web/pages/api/v1/roster-schedule-optimizer/provider.ts` | `e992a4c06c` | `e0627a3433` | `ed073c5092902d11` | 1/1 | committed | Page does not read retryAfterSeconds; optional RSO companion |
| `web/lib/integrations/yahoo/rosterPlanning.ts` | `0ff990e7e4` | `cc25f8c7cd` | `709b5cba1cdf7340` | 59/13 | committed | Reserve-slot mapping fix (accepted E1); only via provider route; optional RSO companion |

The FORGE projection stage files are **not** in the slice. They carry the external-fantasy exclusion (B1) plus many unrelated pipeline changes:

| Path | Production blob | Current blob | sha256 | Diff vs prod | Tree |
|---|---|---|---|---|---|
| `web/lib/projections/stages/skater-stage.ts` | `f9d51ff07a` | `a66b96a227` | `f44feb8db443221b` | 37/52 | committed |
| `web/lib/projections/stages/goalie-stage.ts` | `47ff76974c` | `0620b02ff0` | `7eb6abfcdef2505d` | 13/12 | committed |

## Unchanged production entry points that will run against slice modules (32)

These are not in the slice, but releasing it changes what their bundles execute. The candidate's focused run executed every test that reaches a slice file: 114 files.
- `web/pages/FORGE.tsx`: via `contributions.ts`, `gameExpectations.ts`, `planningContributions.ts`, `resolvedPlanningForecast.ts`, `sourceSnapshot.ts`, `issuedContext.ts` +2
- `web/pages/api/internal/forecast-calendar.ts`: via `baselineGeneration.ts`, `baselineRates.ts`, `contributionStore.ts`, `contributions.ts`, `currentSeasonSogBaseline.ts`, `currentSeasonSogContribution.ts` +26
- `web/pages/api/internal/starter-board.ts`: via `contributions.ts`, `gameExpectations.ts`, `planningContributions.ts`, `resolvedPlanningForecast.ts`, `sourceSnapshot.ts`, `calibrationEligibility.ts` +3
- `web/pages/api/underlying-stats/landing.ts`: via `contributions.ts`, `gameExpectations.ts`, `planningContributions.ts`, `resolvedPlanningForecast.ts`, `sourceSnapshot.ts`, `issuedContext.ts` +2
- `web/pages/api/underlying-stats/team-ratings.ts`: via `contributions.ts`, `gameExpectations.ts`, `planningContributions.ts`, `resolvedPlanningForecast.ts`, `sourceSnapshot.ts`, `issuedContext.ts` +2
- `web/pages/api/v1/account/draft-pro/reports/index.ts`: via `normalize.ts`, `types.ts`
- `web/pages/api/v1/account/draft-pro/scenarios/index.ts`: via `normalize.ts`, `types.ts`
- `web/pages/api/v1/account/yahoo/starter-board.ts`: via `contributions.ts`, `gameExpectations.ts`, `planningContributions.ts`, `resolvedPlanningForecast.ts`, `sourceSnapshot.ts`, `gameRevisions.ts` +2
- `web/pages/api/v1/db/drain-starter-board.ts`: via `contributions.ts`, `gameExpectations.ts`, `planningContributions.ts`, `resolvedPlanningForecast.ts`, `sourceSnapshot.ts`, `calibrationEligibility.ts` +3
- `web/pages/api/v1/db/run-fetch-wgo-data.ts`: via `sourceSnapshot.ts`
- `web/pages/api/v1/db/run-projection-accuracy.ts`: via `contributions.ts`, `gameExpectations.ts`, `planningContributions.ts`, `resolvedPlanningForecast.ts`, `sourceSnapshot.ts`, `calibrationEligibility.ts` +3
- `web/pages/api/v1/db/run-projection-v2.ts`: via `contributions.ts`, `gameExpectations.ts`, `planningContributions.ts`, `resolvedPlanningForecast.ts`, `sourceSnapshot.ts`, `calibrationEligibility.ts` +3
- `web/pages/api/v1/db/run-rolling-forge-pipeline.ts`: via `contributions.ts`, `gameExpectations.ts`, `planningContributions.ts`, `resolvedPlanningForecast.ts`, `sourceSnapshot.ts`, `calibrationEligibility.ts` +3
- `web/pages/api/v1/db/update-line-sources.ts`: via `contributions.ts`, `sourceSnapshot.ts`, `issuedContext.ts`, `normalize.ts`, `types.ts`
- `web/pages/api/v1/db/update-lines-ccc.ts`: via `contributions.ts`, `sourceSnapshot.ts`, `issuedContext.ts`, `normalize.ts`, `types.ts`
- `web/pages/api/v1/db/update-nst-current-season.ts`: via `sourceSnapshot.ts`
- `web/pages/api/v1/db/update-roster-optimizer-schedule.ts`: via `normalize.ts`, `types.ts`
- `web/pages/api/v1/draft-pro/dust.ts`: via `normalize.ts`, `types.ts`
- `web/pages/api/v1/lines/projected.ts`: via `contributions.ts`, `sourceSnapshot.ts`, `issuedContext.ts`, `normalize.ts`, `types.ts`
- `web/pages/api/v1/player-forecasts/accountability.ts`: via `contributions.ts`
- `web/pages/api/v1/player-forecasts/dashboard.ts`: via `contributions.ts`
- `web/pages/api/v1/player-forecasts/history.ts`: via `contributions.ts`
- `web/pages/api/v1/player-forecasts/jobs/daily.ts`: via `contributions.ts`, `gameExpectations.ts`, `planningContributions.ts`, `resolvedPlanningForecast.ts`, `sourceSnapshot.ts`, `gameRevisions.ts` +4
- `web/pages/api/v1/player-forecasts/jobs/drain.ts`: via `contributions.ts`, `gameExpectations.ts`, `planningContributions.ts`, `resolvedPlanningForecast.ts`, `sourceSnapshot.ts`, `gameRevisions.ts` +4
- `web/pages/api/v1/player-forecasts/latest.ts`: via `contributions.ts`
- `web/pages/api/v1/roster-schedule-optimizer/provider.ts`: via `baselineGeneration.ts`, `baselineRates.ts`, `contributionStore.ts`, `contributions.ts`, `currentSeasonSogBaseline.ts`, `currentSeasonSogContribution.ts` +24
- `web/pages/api/v1/roster-schedule-optimizer/schedule.ts`: via `normalize.ts`, `types.ts`
- `web/pages/forge/command-center.tsx`: via `contributions.ts`, `gameExpectations.ts`, `planningContributions.ts`, `resolvedPlanningForecast.ts`, `sourceSnapshot.ts`, `issuedContext.ts` +2
- `web/pages/forge/team/[teamId].tsx`: via `contributions.ts`, `gameExpectations.ts`, `planningContributions.ts`, `resolvedPlanningForecast.ts`, `sourceSnapshot.ts`, `issuedContext.ts` +2
- `web/pages/roster-schedule-optimizer.tsx`: via `AcquisitionPeriodTimes.tsx`, `CandidateBrowser.tsx`, `CandidateCard.module.scss`, `CandidateCard.tsx`, `CategoryGains.tsx`, `CompactSchedule.tsx` +29
- `web/pages/stats/team/[teamAbbreviation].tsx`: via `contributions.ts`, `gameExpectations.ts`, `planningContributions.ts`, `resolvedPlanningForecast.ts`, `sourceSnapshot.ts`, `issuedContext.ts` +2
- `web/pages/underlying-stats/index.tsx`: via `contributions.ts`, `gameExpectations.ts`, `planningContributions.ts`, `resolvedPlanningForecast.ts`, `sourceSnapshot.ts`, `issuedContext.ts` +2

Cron/writer importers whose behaviour changes: `run-projection-v2`, `run-rolling-forge-pipeline`, `drain-starter-board`, `internal/starter-board` and `run-projection-accuracy`. All of them call production `run-forge-projections.ts` → the slice's `buildForgeInputProvenance()` (B1), and the slice's `forgeScheduleRevision()` (new ISO normalization). `update-line-sources`/`update-lines-ccc` pick up `sourceSnapshot.ts`, `contributions.ts` and `issuedContext.ts`. `run-fetch-wgo-data`/`update-nst-current-season` pick up `sourceSnapshot.ts`, whose change is additive.

## Tests that ship with the slice (current bytes, 43 files)

These are current-version tests whose direct imports all resolve to slice or unchanged production files:

- `web/__tests__/components/RosterScheduleOptimizer/AcquisitionRules.integration.test.tsx`
- `web/__tests__/components/RosterScheduleOptimizer/CategoryGains.test.tsx`
- `web/__tests__/components/RosterScheduleOptimizer/RosterScheduleOptimizer.test.tsx`
- `web/__tests__/fixtures/consumerGameRevision.ts`
- `web/__tests__/pages/api/v1/forge/forecasts.test.ts`
- `web/__tests__/pages/api/v1/roster-schedule-optimizer/eligibility.test.ts`
- `web/__tests__/pages/api/v1/start-chart.test.ts`
- `web/__tests__/pages/start-chart.test.tsx`
- `web/components/RosterScheduleOptimizer/AcquisitionPeriodTimes.test.tsx`
- `web/components/RosterScheduleOptimizer/CandidateBrowser.integration.test.tsx`
- `web/components/RosterScheduleOptimizer/CandidateBrowser.presentation.test.tsx`
- `web/components/RosterScheduleOptimizer/CandidateCard.test.tsx`
- `web/components/RosterScheduleOptimizer/InfoTooltip.test.tsx`
- `web/components/RosterScheduleOptimizer/TeamScheduleContext.test.tsx`
- `web/components/RosterScheduleOptimizer/canonicalSchedule.test.ts`
- `web/hooks/useCandidateMetrics.test.tsx`
- `web/hooks/useYahooEligibility.test.tsx`
- `web/lib/in-season/workspaceRoutes.test.ts`
- `web/lib/in-season/workspaceSchema.test.ts`
- `web/lib/player-forecasts/contributionStore.test.ts`
- `web/lib/player-forecasts/contributions.test.ts`
- `web/lib/player-forecasts/currentSeasonSogBaseline.test.ts`
- `web/lib/player-forecasts/currentSeasonSogContribution.test.ts`
- `web/lib/player-forecasts/goalieBaseline.test.ts`
- `web/lib/player-forecasts/modeledGoalieParticipation.test.ts`
- `web/lib/player-forecasts/modeledSkaterParticipation.test.ts`
- `web/lib/player-forecasts/modeledSkaterParticipationStore.test.ts`
- `web/lib/player-forecasts/nativeContributionAdmission.test.ts`
- `web/lib/player-forecasts/nativeGoalieOutcomes.test.ts`
- `web/lib/player-forecasts/nativePowerPlayPoints.test.ts`
- `web/lib/player-forecasts/planningContributions.test.ts`
- `web/lib/projections/nativeInputEligibility.test.ts`
- `web/lib/projections/run-forge-projections.local-attempt.test.ts`
- `web/lib/rosterScheduleOptimizer/candidatePlanMetrics.test.ts`
- `web/lib/rosterScheduleOptimizer/contributionLedger.test.ts`
- `web/lib/rosterScheduleOptimizer/periodBoundaries.test.ts`
- `web/lib/rosterScheduleOptimizer/planning.test.ts`
- `web/lib/rosterScheduleOptimizer/planningReproducibility.test.ts`
- `web/lib/rosterScheduleOptimizer/providerRules.test.ts`
- `web/lib/rosterScheduleOptimizer/reconciliation.test.ts`
- `web/lib/rosterScheduleOptimizer/refreshForecastInputs.test.ts`
- `web/lib/rosterScheduleOptimizer/workspace.test.ts`
- `web/lib/rosterScheduleOptimizer/yahooEligibilityCache.test.ts`

`lib/projections/nativeInputEligibility.test.ts` is listed because it resolves, but it **fails** in the candidate (B1). It belongs with the projection-stage fix, not with this slice.

Tests the slice needs that **cannot** run on a master candidate today (B3):

| Test | Blocking out-of-slice import |
|---|---|
| `lib/rosterScheduleData/planning.test.ts` | `lib/projections/nativeGoalAccounting.ts` (`buildNativeSkaterParticipationFields`) |
| `lib/player-forecasts/gameExpectations.test.ts` | `scripts/preview-native-baseline.ts`, `lib/player-forecasts/seasonGameContributions.ts` |
| `lib/player-forecasts/nativeBaselinePublication.test.ts` | `nativeBaselinePublication.ts`, `nativeBaselineCadence.ts`, `nativeInputMaterialization.ts`, `nativeCadenceOutputPreparation.ts`, `currentRosterNativeInputs.ts`, `scripts/native-baseline-cadence.ts` |
| `__tests__/pages/api/v1/db/update-roster-optimizer-schedule.test.ts` (current) | needs the B2 route bytes |
