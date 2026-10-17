# Path-level release ledger: octoberBranch vs production

Generated 2026-10-17T20:10:39Z. Base `origin/master` = production `457435eb`; head `octoberBranch` = `ceceb407a`. Scope: the 319 non-`tasks/` paths in `git diff --no-renames origin/master octoberBranch` (145 modified, 174 added; nothing deleted). The machine-readable copy, with full blob and sha256 hashes, import edges and receipts, is `path-ledger.json`.

## Totals

| Disposition | Paths |
|---|---|
| Already in production | **0**. By construction no diff path matches production; separately, all 37 paths of the 2026-10-16 release are byte-identical on octoberBranch |
| Accepted locally, unreleased (exact receipt) | **109** |
| Candidate needing review | **202** |
| Private / evidence only | **8** |
| Parked | **0**. No path maps, with evidence, to a parked register row (97–103) |
| Unknown owner | **0**. Every path has a workstream; 37 have no receipt at all (evidence E6) |

Evidence codes, strongest first:

- **E1** (93 paths): current bytes pinned by an accepting independent review of the same workstream.
- **E2** (6 paths): last touching commit independently accepted (Master Page) and bytes unchanged since.
- **E2a** (10 paths): last touching commit is one of the 3 new FORGE commits, agent-reviewed per FORGE LEDGER; owner sign-off pending.
- **E4** (107 paths): only owner checkpoint/receipt pins (no independent acceptance of these bytes).
- **E5** (66 paths): only audit/snapshot pins.
- **E6** (37 paths): no in-repo receipt for current bytes.

"Accepted" only means accepted at the reviewer's stated bound (local, shadow or engineering). None of it is production approval. The IFTTT reviews snapshot their dependency files, which include FORGE/RSO/OPS files. Those snapshots are **not** counted as acceptance of those files; they are listed under `cross_workstream_snapshot_reviews` in the JSON.

## Dependency structure (the main release constraint)

- **820 static import edges** connect the changed paths. **262 of the 319 paths form one connected component** spanning FORGE (91), RSO (75), IFTTT (63), OPS (15), Social (10) and Start Chart (8). The other 57 paths are split across 33 small components.
- Its hubs have no independent acceptance of their current bytes. Each count below is the number of changed paths that depend on the hub transitively:
  - `lib/player-forecasts/contributions.ts`: 111 (E4)
  - `sourceSnapshot.ts`: 94 (E4)
  - `rosterScheduleOptimizer/planningTypes.ts`, `resolvedPlanningForecast.ts`, `planningContributions.ts`: 91 each (E4)
  - `gameExpectations.ts`: 91 (E6, no receipt)
  - `sources/tweetInterpretation.ts`: 61 (E4)
  - `rosterScheduleData/types.ts`: 58 (E4)
- Only **33 accepted paths have an all-accepted changed-dependency closure.** Even those are not release units by themselves:
  - Some are imported only by candidates, which makes them inert alone (`periodBoundaries`, `privateParticipationScenario`).
  - Some are owner-excluded (the RSO diagnostic, "excluded from the release").
  - Some are activation-gated (IFTTT).
- Non-import edges are listed in `path-ledger.json` → `manual_edges`. The ones that bite:
  - `ForgeRouteNav.tsx` links to the new `/forge/forecasts` page.
  - `cron-report.ts` and `cronInventory.ts` alias the unreleased `refresh-roster-optimizer-schedule` route.
  - `supportedBaselineMigration.test.ts` counts all three new migrations and reads `tasks/TASKS/repository-audit-remediation/migration-authority.json`.
  - `tweetClaimOccurrenceIdentity.test.ts` reads a **gitignored** fixture under `tasks/ifttt-integration-2026-10-16/handoff/extracted-reviewed/`, so it fails on a clean clone or CI.
  - Several IFTTT and lines tests load fixtures or staged SQL from tracked `tasks/` paths.
- Accepted bases that were later overwritten: these paths had an accepted commit, but `7f094c8e6` ("big commit") or a later commit changed them afterwards. That delta is unreviewed.
  - `web/lib/projections/queries/skater-queries.test.ts`: accepted at 6767073ea, now last changed by 6e14053ff
  - `web/lib/projections/queries/skater-queries.ts`: accepted at 6767073ea, now last changed by 6e14053ff
  - `web/lib/sources/tweetInterpretation.ts`: accepted at 90ae40f01, now last changed by 7f094c8e6
  - `web/__tests__/pages/api/v1/start-chart.test.ts`: accepted at 0e8040da9, now last changed by 7f094c8e6
  - `web/__tests__/pages/start-chart.test.tsx`: accepted at 0e8040da9, now last changed by 7f094c8e6
  - `web/pages/start-chart.tsx`: accepted at 0e8040da9, now last changed by 7f094c8e6

## Cron, NST and operations: 23 paths (18 candidate, 5 accepted)

| Path | St | Disposition | Ev | Last commit | Receipt / evidence | Blob | Closure* |
|---|---|---|---|---|---|---|---|
| `web/lib/cron/cronInventory.ts` | M | accepted | E1 | `7f094c8e6` | schedule-refresh v2 ACCEPT (engineering proposal) | `387fa5cdb` | 0/0 |
| `web/pages/api/v1/db/cron-report.ts` | M | accepted | E1 | `7f094c8e6` | schedule-refresh v2 ACCEPT (engineering proposal) | `3e991cfa7` | 0/2 |
| `web/__tests__/pages/api/v1/db/cron-report.test.ts` | M | accepted | E2 | `26468a9fc` | 26468a9fc: Master Page: two-file cron-report fix independently accepted locally | `6725ddac8` | 0/3 |
| `web/lib/cron/withCronJobAudit.test.ts` | M | accepted | E2 | `569245efd` | 569245efd: Master Page: bounded-response fix independently accepted locally | `4df6e369d` | 0/1 |
| `web/lib/cron/withCronJobAudit.ts` | M | accepted | E2 | `569245efd` | 569245efd: Master Page: bounded-response fix independently accepted locally | `d604b720d` | 0/0 |
| `web/lib/fantasy-projections/fantasyProjections.test.ts` | M | candidate | E4 | `7f094c8e6` | owner pin: checkpoint-production-release-2026-10-16, forge-rso-completion-2026-10-15 | `c4d551f7e` | 1/1 |
| `web/lib/fantasy-projections/seasonJobs.ts` | M | candidate | E4 | `7f094c8e6` | owner pin: checkpoint-production-release-2026-10-16, forge-rso-completion-2026-10-15 | `439166391` | 0/0 |
| `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts` | M | candidate | E4 | `6e14053ff` | owner pin: ifttt/full-acceptance-reconciliation, ifttt/review-full52-reconciliation-v1 | `f2097d952` | 2/2 |
| `web/pages/api/v1/db/run-projection-accuracy.ts` | M | candidate | E4 | `7f094c8e6` | owner pin: forge-native-input-separation-2026-10-13, rso-consumer-checkpoint-2026-10-13 | `1ab40d0db` | 2/3 |
| `web/pages/api/v1/db/update-nst-gamelog.ts` | M | candidate | E4 | `7f094c8e6` | owner pin: ifttt/full-acceptance-reconciliation, ifttt/review-full52-reconciliation-v1 | `a96af4129` | 3/3 |
| `web/__tests__/pages/api/v1/db/update-nst-gamelog.test.ts` | M | candidate | E5 | `7f094c8e6` | snapshot/audit pins only (10 files) | `be5496c66` | 4/4 |
| `web/__tests__/pages/api/v1/db/update-players.test.ts` | M | candidate | E5 | `7f094c8e6` | snapshot/audit pins only (10 files) | `8d9ded277` | 2/3 |
| `web/lib/cron/nstBurstPlans.test.ts` | M | candidate | E5 | `7f094c8e6` | snapshot/audit pins only (11 files) | `ec6359b7a` | 1/1 |
| `web/lib/cron/nstBurstPlans.ts` | M | candidate | E5 | `7f094c8e6` | snapshot/audit pins only (10 files) | `257df865d` | 0/0 |
| `web/lib/nst/client.test.ts` | M | candidate | E5 | `7f094c8e6` | snapshot/audit pins only (10 files) | `6fa70fc81` | 2/2 |
| `web/lib/nst/client.ts` | M | candidate | E5 | `7f094c8e6` | snapshot/audit pins only (9 files) | `b42728cda` | 1/1 |
| `web/lib/nst/requestBudget.test.ts` | A | candidate | E5 | `7f094c8e6` | snapshot/audit pins only (10 files) | `627363fe9` | 1/1 |
| `web/lib/nst/requestBudget.ts` | A | candidate | E5 | `7f094c8e6` | snapshot/audit pins only (9 files) | `2874ed760` | 0/0 |
| `web/lib/rollingPlayerCountSupport.test.ts` | A | candidate | E5 | `6e14053ff` | snapshot/audit pins only (10 files) | `e0a0d5af5` | 1/1 |
| `web/lib/rollingPlayerCountSupport.ts` | A | candidate | E5 | `6e14053ff` | snapshot/audit pins only (9 files) | `6f315de42` | 0/0 |
| `web/lib/supabase/Upserts/fetchRollingPlayerAverages.test.ts` | M | candidate | E5 | `6e14053ff` | snapshot/audit pins only (10 files) | `38d002aa9` | 3/3 |
| `web/lib/supabase/Upserts/rollingPlayerSupportPayload.ts` | M | candidate | E5 | `6e14053ff` | snapshot/audit pins only (9 files) | `902e072d3` | 1/1 |
| `web/pages/api/v1/db/update-players.ts` | M | candidate | E5 | `7f094c8e6` | snapshot/audit pins only (10 files) | `14d220f7a` | 1/2 |

## FORGE / forecasting: 100 paths (86 candidate, 13 accepted, 1 private/evidence)

| Path | St | Disposition | Ev | Last commit | Receipt / evidence | Blob | Closure* |
|---|---|---|---|---|---|---|---|
| `web/components/forge-dashboard/ForgeRouteNav.tsx` | M | accepted | E1 | `7f094c8e6` | forge-release-path accepted_local_engineering_only | `af6dd8697` | 0/0 |
| `web/styles/ForgeForecasts.module.scss` | A | accepted | E1 | `7f094c8e6` | forge-release-path accepted_local_engineering_only | `fba1c1bd3` | 0/0 |
| `web/lib/projections/privateParticipationScenario.test.ts` | A | accepted | E2 | `971a43e78` | 971a43e78: Master Page: corrected participation pair accepted and frozen | `db870d946` | 0/1 |
| `web/lib/projections/privateParticipationScenario.ts` | A | accepted | E2 | `971a43e78` | 971a43e78: Master Page: corrected participation pair accepted and frozen | `12043cc96` | 0/0 |
| `web/lib/player-forecasts/nativeBaselineCadence.ts` | A | accepted | E2a | `a23728de2` | a23728de2: FORGE LEDGER §7/§11/§12 agent independent review; owner sign-off pending | `4bed141ef` | 32/34 |
| `web/lib/player-forecasts/nativeBaselinePublication.test.ts` | A | accepted | E2a | `ceceb407a` | ceceb407a: FORGE LEDGER §7/§11/§12 agent independent review; owner sign-off pending | `a86bd80ea` | 32/37 |
| `web/lib/player-forecasts/nativeCadenceOutputPreparation.ts` | A | accepted | E2a | `ceceb407a` | ceceb407a: FORGE LEDGER §7/§11/§12 agent independent review; owner sign-off pending | `fbc4e2c45` | 32/35 |
| `web/lib/player-forecasts/nativeDailyPipeline.test.ts` | A | accepted | E2a | `ceceb407a` | ceceb407a: FORGE LEDGER §7/§11/§12 agent independent review; owner sign-off pending | `1d39ec155` | 32/39 |
| `web/lib/player-forecasts/nativeDailyPipeline.ts` | A | accepted | E2a | `ceceb407a` | ceceb407a: FORGE LEDGER §7/§11/§12 agent independent review; owner sign-off pending | `7dd369c54` | 32/35 |
| `web/lib/player-forecasts/nativeInputMaterialization.ts` | A | accepted | E2a | `a23728de2` | a23728de2: FORGE LEDGER §7/§11/§12 agent independent review; owner sign-off pending | `907c4a4ec` | 25/26 |
| `web/lib/supabase/supportedBaselineMigration.test.ts` | M | accepted | E2a | `a23728de2` | a23728de2: FORGE LEDGER §7/§11/§12 agent independent review; owner sign-off pending | `4031e14f3` | 0/0 |
| `web/scripts/forge-daily.ts` | A | accepted | E2a | `ceceb407a` | ceceb407a: FORGE LEDGER §7/§11/§12 agent independent review; owner sign-off pending | `f0df93113` | 32/38 |
| `web/scripts/native-baseline-cadence.ts` | A | accepted | E2a | `ceceb407a` | ceceb407a: FORGE LEDGER §7/§11/§12 agent independent review; owner sign-off pending | `a1efa1dda` | 32/36 |
| `web/__tests__/fixtures/consumerGameRevision.ts` | M | candidate | E4 | `7f094c8e6` | owner pin: rso-consumer-checkpoint-2026-10-13 | `69ad5e9e4` | 8/8 |
| `web/__tests__/pages/api/v1/forge/__snapshots__/goalies.test.ts.snap` | M | candidate | E4 | `7f094c8e6` | owner pin: rso-consumer-checkpoint-2026-10-13 | `561db8bb5` | 0/0 |
| `web/__tests__/pages/api/v1/forge/goalies.test.ts` | M | candidate | E4 | `7f094c8e6` | owner pin: rso-consumer-checkpoint-2026-10-13 | `2dade77c0` | 3/3 |
| `web/__tests__/pages/api/v1/forge/players.test.ts` | M | candidate | E4 | `7f094c8e6` | owner pin: rso-consumer-checkpoint-2026-10-13 | `7f20ebad6` | 3/3 |
| `web/__tests__/pages/api/v1/projections/explicitRunAdmission.test.ts` | A | candidate | E4 | `7f094c8e6` | owner pin: forge-native-input-separation-2026-10-13, rso-consumer-checkpoint-2026-10-13 | `cfac7597a` | 5/5 |
| `web/lib/player-forecasts/contributions.test.ts` | M | candidate | E4 | `7f094c8e6` | owner pin: ifttt/review-raw-job-ack-v1 | `5c473f48a` | 12/12 |
| `web/lib/player-forecasts/contributions.ts` | M | candidate | E4 | `7f094c8e6` | owner pin: forge-rso-completion-2026-10-15, ifttt/dependency-compatibility-increment | `ab48ca967` | 0/0 |
| `web/lib/player-forecasts/currentRosterInjuryEvidence.ts` | A | candidate | E4 | `7f094c8e6` | owner pin: checkpoint-production-release-2026-10-16, forge-rso-completion-2026-10-15 | `773565711` | 2/3 |
| `web/lib/player-forecasts/currentRosterNativeInputs.ts` | A | candidate | E4 | `7f094c8e6` | owner pin: checkpoint-production-release-2026-10-16, forge-rso-completion-2026-10-15 | `230be3e08` | 18/19 |
| `web/lib/player-forecasts/gameExpectationReader.ts` | A | candidate | E4 | `7f094c8e6` | owner pin: forge-rso-completion-2026-10-15 | `c31004d7f` | 30/30 |
| `web/lib/player-forecasts/gameExpectations.test.ts` | A | candidate | E4 | `7f094c8e6` | owner pin: forge-rso-completion-2026-10-15 | `31111f697` | 36/36 |
| `web/lib/player-forecasts/goalieBaselineInputCapture.ts` | M | candidate | E4 | `7f094c8e6` | owner pin: forge-current-season-sog-admission-2026-10-15 | `3ebf28d72` | 6/6 |
| `web/lib/player-forecasts/modeledGoalieParticipation.test.ts` | A | candidate | E4 | `7f094c8e6` | owner pin: forge-rso-completion-2026-10-15 | `bb556b31c` | 6/6 |
| `web/lib/player-forecasts/modeledGoalieParticipation.ts` | A | candidate | E4 | `7f094c8e6` | owner pin: forge-rso-completion-2026-10-15, ifttt/durable-occurrence-increment | `fa662ad96` | 4/4 |
| `web/lib/player-forecasts/modeledGoalieParticipationStore.ts` | A | candidate | E4 | `7f094c8e6` | owner pin: forge-rso-completion-2026-10-15 | `2b7a3b811` | 5/5 |
| `web/lib/player-forecasts/modeledSkaterParticipation.test.ts` | A | candidate | E4 | `7f094c8e6` | owner pin: forge-rso-completion-2026-10-15 | `f52d2281b` | 5/5 |
| `web/lib/player-forecasts/modeledSkaterParticipation.ts` | A | candidate | E4 | `7f094c8e6` | owner pin: forge-rso-completion-2026-10-15, ifttt/durable-occurrence-increment | `17feca7da` | 4/4 |
| `web/lib/player-forecasts/nativeBaselinePublication.ts` | A | candidate | E4 | `7f094c8e6` | owner pin: forge-rso-completion-2026-10-15 | `1d48011d3` | 17/17 |
| `web/lib/player-forecasts/nativeCatalogHead.ts` | A | candidate | E4 | `7f094c8e6` | owner pin: forge-rso-completion-2026-10-15 | `e4bcbbd9d` | 9/9 |
| `web/lib/player-forecasts/nativePowerPlayPoints.test.ts` | A | candidate | E4 | `7f094c8e6` | owner pin: checkpoint-production-release-2026-10-16, forge-rso-completion-2026-10-15 | `0c00f6c05` | 3/3 |
| `web/lib/player-forecasts/nativePowerPlayPoints.ts` | A | candidate | E4 | `7f094c8e6` | owner pin: checkpoint-production-release-2026-10-16, forge-rso-completion-2026-10-15 | `b8ad5e16e` | 2/2 |
| `web/lib/player-forecasts/planningContributions.test.ts` | M | candidate | E4 | `7f094c8e6` | owner pin: forge-rso-completion-2026-10-15 | `3872c70b5` | 30/30 |
| `web/lib/player-forecasts/planningContributions.ts` | M | candidate | E4 | `7f094c8e6` | owner pin: forge-rso-completion-2026-10-15 | `348b9eca7` | 5/5 |
| `web/lib/player-forecasts/resolvedPlanningForecast.ts` | M | candidate | E4 | `7f094c8e6` | owner pin: forge-rso-completion-2026-10-15 | `89350de2d` | 5/5 |
| `web/lib/player-forecasts/scopeReads.ts` | M | candidate | E4 | `7f094c8e6` | owner pin: forge-current-season-sog-admission-2026-10-15, ifttt/consumer-binding-increment | `22c001469` | 4/4 |
| `web/lib/player-forecasts/seasonGameContributions.ts` | A | candidate | E4 | `7f094c8e6` | owner pin: checkpoint-production-release-2026-10-16, forge-rso-completion-2026-10-15 | `c95793aa8` | 5/5 |
| `web/lib/player-forecasts/sourceObservations.ts` | M | candidate | E4 | `7f094c8e6` | owner pin: ifttt/consumer-binding-increment | `b19dc5433` | 6/7 |
| `web/lib/player-forecasts/sourceSnapshot.ts` | M | candidate | E4 | `7f094c8e6` | owner pin: ifttt/dependency-compatibility-increment, ifttt/receiver-intake-bounds-v1 | `0d319794a` | 0/0 |
| `web/lib/player-forecasts/targetRosterObservation.ts` | A | candidate | E4 | `7f094c8e6` | owner pin: forge-rso-completion-2026-10-15 | `c47269517` | 4/4 |
| `web/lib/projections/apiHelpers.test.ts` | M | candidate | E4 | `7f094c8e6` | owner pin: forge-native-input-separation-2026-10-13, rso-consumer-checkpoint-2026-10-13 | `3ee68afaa` | 2/2 |
| `web/lib/projections/apiHelpers.ts` | M | candidate | E4 | `7f094c8e6` | owner pin: forge-native-input-separation-2026-10-13, rso-consumer-checkpoint-2026-10-13 | `f246f3dbd` | 1/1 |
| `web/lib/projections/calibrationEligibility.ts` | M | candidate | E4 | `7f094c8e6` | owner pin: forge-native-input-separation-2026-10-13, rso-consumer-checkpoint-2026-10-13 | `9285d2818` | 0/0 |
| `web/lib/projections/consumerRevisionAdmission.ts` | M | candidate | E4 | `7f094c8e6` | owner pin: rso-consumer-checkpoint-2026-10-13 | `1bd59c488` | 12/12 |
| `web/lib/projections/gameRevisions.ts` | M | candidate | E4 | `7f094c8e6` | owner pin: forge-native-input-separation-2026-10-13, rso-consumer-checkpoint-2026-10-13 | `5ed1227d0` | 2/2 |
| `web/lib/projections/issuedContext.ts` | M | candidate | E4 | `7f094c8e6` | owner pin: ifttt/consumer-binding-increment | `23030433e` | 1/1 |
| `web/lib/projections/nativeInputEligibility.test.ts` | A | candidate | E4 | `7f094c8e6` | owner pin: forge-native-input-separation-2026-10-13, rso-consumer-checkpoint-2026-10-13 | `8c9e4f6d2` | 0/0 |
| `web/lib/projections/queries/skater-queries.ts` | M | candidate | E4 | `6e14053ff` | owner pin: ifttt/full-acceptance-reconciliation, ifttt/review-full52-reconciliation-v1 | `7bc6fc1e1` | 5/5 |
| `web/lib/projections/stages/goalie-stage.ts` | M | candidate | E4 | `7f094c8e6` | owner pin: forge-native-input-separation-2026-10-13, rso-consumer-checkpoint-2026-10-13 | `0620b02ff` | 7/7 |
| `web/lib/projections/stages/skater-stage.ts` | M | candidate | E4 | `7f094c8e6` | owner pin: forge-native-input-separation-2026-10-13, rso-consumer-checkpoint-2026-10-13 | `a66b96a22` | 12/12 |
| `web/pages/api/v1/forge/goalies.ts` | M | candidate | E4 | `7f094c8e6` | owner pin: rso-consumer-checkpoint-2026-10-13, ifttt/full-acceptance-reconciliation | `5eed49893` | 2/2 |
| `web/pages/api/v1/forge/players.ts` | M | candidate | E4 | `7f094c8e6` | owner pin: rso-consumer-checkpoint-2026-10-13 | `fc3c920fb` | 2/2 |
| `web/pages/api/v1/projections/goalies.ts` | M | candidate | E4 | `7f094c8e6` | owner pin: forge-native-input-separation-2026-10-13, rso-consumer-checkpoint-2026-10-13 | `11da8c24a` | 2/2 |
| `web/pages/api/v1/projections/players.ts` | M | candidate | E4 | `7f094c8e6` | owner pin: forge-native-input-separation-2026-10-13, rso-consumer-checkpoint-2026-10-13 | `9bb408476` | 2/2 |
| `web/pages/api/v1/projections/teams.ts` | M | candidate | E4 | `7f094c8e6` | owner pin: forge-native-input-separation-2026-10-13, rso-consumer-checkpoint-2026-10-13 | `793fc272c` | 2/2 |
| `web/scripts/capture-current-season-sog-baseline.test.ts` | A | candidate | E4 | `7f094c8e6` | owner pin: checkpoint-production-release-2026-10-16, forge-rso-completion-2026-10-15 | `aab694641` | 20/21 |
| `web/scripts/capture-current-season-sog-baseline.ts` | A | candidate | E4 | `7f094c8e6` | owner pin: checkpoint-production-release-2026-10-16, forge-rso-completion-2026-10-15 | `deca04b6a` | 19/20 |
| `web/scripts/preview-native-baseline.ts` | A | candidate | E4 | `7f094c8e6` | owner pin: checkpoint-production-release-2026-10-16, forge-rso-completion-2026-10-15 | `fc5bec46f` | 14/14 |
| `web/lib/player-forecasts/currentSeasonSogBaseline.test.ts` | A | candidate | E5 | `7f094c8e6` | snapshot/audit pins only (3 files) | `14e781f4b` | 2/2 |
| `web/lib/player-forecasts/currentSeasonSogBaseline.ts` | A | candidate | E5 | `7f094c8e6` | snapshot/audit pins only (3 files) | `2cc53e1d3` | 1/1 |
| `web/lib/player-forecasts/currentSeasonSogContribution.test.ts` | A | candidate | E5 | `7f094c8e6` | snapshot/audit pins only (3 files) | `77d8c527b` | 16/16 |
| `web/lib/player-forecasts/currentSeasonSogContribution.ts` | A | candidate | E5 | `7f094c8e6` | snapshot/audit pins only (3 files) | `4bb96c24d` | 4/4 |
| `web/lib/player-forecasts/nativeParticipationFrame.test.ts` | A | candidate | E5 | `7f094c8e6` | snapshot/audit pins only (12 files) | `c6fb81ca1` | 1/1 |
| `web/lib/player-forecasts/nativeParticipationFrame.ts` | A | candidate | E5 | `7f094c8e6` | snapshot/audit pins only (12 files) | `9de94a32b` | 0/0 |
| `web/lib/player-forecasts/playerForecasts.test.ts` | M | candidate | E5 | `7f094c8e6` | snapshot/audit pins only (12 files) | `9340c2bc0` | 7/8 |
| `web/lib/projections/calculators/goalie-starter.ts` | M | candidate | E5 | `6e14053ff` | snapshot/audit pins only (11 files) | `5a10f9798` | 4/4 |
| `web/lib/projections/calculators/skater-adjustments.ts` | M | candidate | E5 | `6e14053ff` | snapshot/audit pins only (11 files) | `af0a94de1` | 4/4 |
| `web/lib/projections/goalieModel.test.ts` | M | candidate | E5 | `6e14053ff` | snapshot/audit pins only (12 files) | `a67ec31bc` | 1/1 |
| `web/lib/projections/goalieModel.ts` | M | candidate | E5 | `6e14053ff` | snapshot/audit pins only (11 files) | `dd0dd57d4` | 0/0 |
| `web/lib/projections/goaliePipeline.test.ts` | M | candidate | E5 | `6e14053ff` | snapshot/audit pins only (12 files) | `e7fdf9ff6` | 8/8 |
| `web/lib/projections/nativeGoalAccounting.test.ts` | M | candidate | E5 | `6e14053ff` | snapshot/audit pins only (12 files) | `1c775e226` | 13/13 |
| `web/lib/projections/nativeGoalAccounting.ts` | M | candidate | E5 | `6e14053ff` | snapshot/audit pins only (12 files) | `d84e7eaed` | 0/0 |
| `web/lib/projections/queries/skater-queries.test.ts` | M | candidate | E5 | `6e14053ff` | snapshot/audit pins only (12 files) | `1d4c3e9a2` | 6/6 |
| `web/lib/projections/run-forge-projections.local-attempt.test.ts` | M | candidate | E5 | `7f094c8e6` | snapshot/audit pins only (13 files) | `c348b1ea5` | 3/3 |
| `web/lib/projections/runProjectionV2.test.ts` | M | candidate | E5 | `6e14053ff` | snapshot/audit pins only (12 files) | `78a26d39a` | 6/6 |
| `web/lib/projections/types/run-forge-projections.types.ts` | M | candidate | E5 | `6e14053ff` | snapshot/audit pins only (11 files) | `164196f58` | 3/3 |
| `web/lib/projections/utils/projection-metadata-builders.ts` | M | candidate | E5 | `6e14053ff` | snapshot/audit pins only (11 files) | `b57f7cd64` | 5/5 |
| `web/scripts/qualify-native-players-offline.test.ts` | M | candidate | E5 | `7f094c8e6` | snapshot/audit pins only (11 files) | `3739a9d29` | 0/0 |
| `web/__tests__/pages/api/v1/forge/forecasts.test.ts` | A | candidate | E6 | `7f094c8e6` | no receipt for current bytes | `f5a9d73c0` | 33/33 |
| `web/__tests__/pages/forge/forecasts.test.tsx` | A | candidate | E6 | `7f094c8e6` | no receipt for current bytes | `4c46db7f2` | 7/8 |
| `web/lib/player-forecasts/baselineGeneration.ts` | M | candidate | E6 | `7f094c8e6` | no receipt for current bytes | `565ad6a2e` | 5/5 |
| `web/lib/player-forecasts/baselineRates.ts` | M | candidate | E6 | `7f094c8e6` | no receipt for current bytes | `9a115358a` | 1/1 |
| `web/lib/player-forecasts/contributionStore.test.ts` | M | candidate | E6 | `7f094c8e6` | no receipt for current bytes | `91e8b6f9d` | 3/3 |
| `web/lib/player-forecasts/contributionStore.ts` | M | candidate | E6 | `7f094c8e6` | no receipt for current bytes | `8ab7ac777` | 2/2 |
| `web/lib/player-forecasts/gameExpectationView.ts` | A | candidate | E6 | `7f094c8e6` | no receipt for current bytes | `9fd51af12` | 5/5 |
| `web/lib/player-forecasts/gameExpectations.ts` | A | candidate | E6 | `7f094c8e6` | no receipt for current bytes | `0c4c68094` | 5/5 |
| `web/lib/player-forecasts/goalieBaseline.test.ts` | M | candidate | E6 | `7f094c8e6` | no receipt for current bytes | `0f7bc4ed2` | 10/10 |
| `web/lib/player-forecasts/goalieBaselineRates.ts` | M | candidate | E6 | `7f094c8e6` | no receipt for current bytes | `19d6df67d` | 6/6 |
| `web/lib/player-forecasts/modeledSkaterParticipationStore.test.ts` | A | candidate | E6 | `7f094c8e6` | no receipt for current bytes | `ef97fca04` | 5/5 |
| `web/lib/player-forecasts/modeledSkaterParticipationStore.ts` | A | candidate | E6 | `7f094c8e6` | no receipt for current bytes | `379f5c10e` | 4/4 |
| `web/lib/player-forecasts/nativeContributionAdmission.test.ts` | A | candidate | E6 | `7f094c8e6` | no receipt for current bytes | `ddfaaa2d8` | 12/12 |
| `web/lib/player-forecasts/nativeContributionAdmission.ts` | A | candidate | E6 | `7f094c8e6` | no receipt for current bytes | `dc8569fab` | 11/11 |
| `web/lib/player-forecasts/nativeGoalieOutcomes.test.ts` | A | candidate | E6 | `7f094c8e6` | no receipt for current bytes | `3b2bf169f` | 6/6 |
| `web/lib/player-forecasts/nativeGoalieOutcomes.ts` | A | candidate | E6 | `7f094c8e6` | no receipt for current bytes | `dfafb8966` | 6/6 |
| `web/pages/api/v1/forge/forecasts.ts` | A | candidate | E6 | `7f094c8e6` | no receipt for current bytes | `acb2e66ee` | 32/32 |
| `web/pages/forge/forecasts.tsx` | A | candidate | E6 | `7f094c8e6` | no receipt for current bytes | `7e173c5e6` | 6/7 |
| `web/scripts/preview-native-baseline.test.ts` | A | candidate | E6 | `7f094c8e6` | no receipt for current bytes | `1d9a78abb` | 15/15 |
| `web/scripts/forge-walk-forward-native.ts` | A | private/evidence | E5 | `7f094c8e6` | snapshot/audit pins only (13 files) | `d8476f837` | 2/2 |

## Start Chart: 8 paths (8 candidate)

| Path | St | Disposition | Ev | Last commit | Receipt / evidence | Blob | Closure* |
|---|---|---|---|---|---|---|---|
| `web/__tests__/pages/api/v1/start-chart.test.ts` | M | candidate | E4 | `7f094c8e6` | owner pin: checkpoint-production-release-2026-10-16, forge-current-season-sog-admission-2026-10-15 | `49dc6a0db` | 35/36 |
| `web/lib/projections/starterBoardQueue.test.ts` | A | candidate | E4 | `7f094c8e6` | owner pin: checkpoint-production-release-2026-10-16, forge-rso-completion-2026-10-15 | `57b6311db` | 2/2 |
| `web/lib/projections/starterBoardQueue.ts` | M | candidate | E4 | `7f094c8e6` | owner pin: checkpoint-production-release-2026-10-16, forge-rso-completion-2026-10-15 | `42d3819e5` | 1/1 |
| `web/pages/api/v1/start-chart.ts` | M | candidate | E4 | `7f094c8e6` | owner pin: checkpoint-production-release-2026-10-16, schedule-refresh-recurring-2026-10-15 | `b88c55654` | 32/32 |
| `web/__tests__/pages/start-chart.test.tsx` | M | candidate | E6 | `7f094c8e6` | no receipt for current bytes | `5b455201e` | 7/7 |
| `web/lib/projections/startChartContract.ts` | M | candidate | E6 | `7f094c8e6` | no receipt for current bytes | `47bf2a6b8` | 5/5 |
| `web/lib/projections/startChartPipeline.test.ts` | M | candidate | E6 | `7f094c8e6` | no receipt for current bytes | `87c1c8261` | 22/22 |
| `web/pages/start-chart.tsx` | M | candidate | E6 | `7f094c8e6` | no receipt for current bytes | `438a3064e` | 6/6 |

## Roster Schedule Optimizer: 80 paths (42 candidate, 38 accepted)

| Path | St | Disposition | Ev | Last commit | Receipt / evidence | Blob | Closure* |
|---|---|---|---|---|---|---|---|
| `web/__tests__/components/RosterScheduleOptimizer/AcquisitionRules.integration.test.tsx` | A | accepted | E1 | `7f094c8e6` | rso-intraday-periods ACCEPT | `57d2629a0` | 18/34 |
| `web/__tests__/pages/api/v1/roster-schedule-optimizer/diagnostic-context.test.ts` | A | accepted | E1 | `7f094c8e6` | rso-readonly-diagnostic ACCEPT | `bcd5db279` | 0/3 |
| `web/components/RosterScheduleOptimizer/AcquisitionPeriodTimes.test.tsx` | A | accepted | E1 | `7f094c8e6` | rso-intraday-periods ACCEPT | `724a44dba` | 5/8 |
| `web/components/RosterScheduleOptimizer/AcquisitionPeriodTimes.tsx` | A | accepted | E1 | `7f094c8e6` | rso-intraday-periods ACCEPT | `98ff53eea` | 5/7 |
| `web/components/RosterScheduleOptimizer/CandidateBrowser.integration.test.tsx` | A | accepted | E1 | `7f094c8e6` | rso-candidate-pool ACCEPT | `d06f184b9` | 13/19 |
| `web/components/RosterScheduleOptimizer/CandidateBrowser.presentation.test.tsx` | A | accepted | E1 | `7f094c8e6` | rso-candidate-pool ACCEPT | `968aabbad` | 13/19 |
| `web/components/RosterScheduleOptimizer/CandidateBrowser.tsx` | M | accepted | E1 | `7f094c8e6` | rso-candidate-pool ACCEPT | `e8da39f16` | 13/16 |
| `web/components/RosterScheduleOptimizer/CandidateCard.module.scss` | A | accepted | E1 | `7f094c8e6` | rso-mockup-match bounded ACCEPT | `87d1b6d6f` | 0/0 |
| `web/components/RosterScheduleOptimizer/CompactSchedule.tsx` | M | accepted | E1 | `7f094c8e6` | rso-mockup-match bounded ACCEPT; rso-partial-discovery ACCEPT | `eb5a98a66` | 9/11 |
| `web/components/RosterScheduleOptimizer/RosterContribution.tsx` | A | accepted | E1 | `7f094c8e6` | rso-mockup-match bounded ACCEPT; rso-partial-discovery ACCEPT | `4011ba201` | 7/9 |
| `web/components/RosterScheduleOptimizer/RosterPlayerRow.tsx` | A | accepted | E1 | `7f094c8e6` | rso-mockup-match bounded ACCEPT | `03ba4b80c` | 7/10 |
| `web/components/RosterScheduleOptimizer/RosterScheduleOptimizer.module.scss` | M | accepted | E1 | `7f094c8e6` | rso-mockup-match bounded ACCEPT | `21cc9532d` | 0/0 |
| `web/components/RosterScheduleOptimizer/TeamScheduleContext.module.scss` | A | accepted | E1 | `7f094c8e6` | rso-mockup-match bounded ACCEPT | `47201e688` | 0/0 |
| `web/components/RosterScheduleOptimizer/TeamScheduleContext.test.tsx` | A | accepted | E1 | `7f094c8e6` | rso-mockup-match bounded ACCEPT | `76cf153b9` | 4/5 |
| `web/hooks/useCandidateMetrics.test.tsx` | M | accepted | E1 | `7f094c8e6` | rso-automatic-suggestions ACCEPT | `9e89de9ab` | 9/12 |
| `web/hooks/useYahooEligibility.test.tsx` | A | accepted | E1 | `7f094c8e6` | rso-candidate-admission ACCEPT | `d8eb52eae` | 6/7 |
| `web/hooks/useYahooEligibility.ts` | A | accepted | E1 | `7f094c8e6` | rso-candidate-admission ACCEPT | `9592c12db` | 6/6 |
| `web/lib/in-season/workspaceSchema.test.ts` | M | accepted | E1 | `7f094c8e6` | rso-intraday-periods ACCEPT | `bbdebc26e` | 5/6 |
| `web/lib/in-season/workspaceSchema.ts` | M | accepted | E1 | `7f094c8e6` | rso-intraday-periods ACCEPT | `ecee6875c` | 5/5 |
| `web/lib/integrations/yahoo/rosterPlanning.test.ts` | M | accepted | E1 | `7f094c8e6` | rso-discovery-observability ACCEPT | `1e461adb2` | 34/39 |
| `web/lib/integrations/yahoo/rosterPlanning.ts` | M | accepted | E1 | `7f094c8e6` | rso-discovery-observability ACCEPT | `cc25f8c7c` | 30/30 |
| `web/lib/rosterScheduleData/recurring.ts` | A | accepted | E1 | `7f094c8e6` | schedule-refresh v2 ACCEPT (engineering proposal) | `c690e0529` | 1/1 |
| `web/lib/rosterScheduleOptimizer/diagnostic.test.ts` | A | accepted | E1 | `7f094c8e6` | rso-readonly-diagnostic ACCEPT | `f9e9df809` | 0/1 |
| `web/lib/rosterScheduleOptimizer/diagnostic.ts` | A | accepted | E1 | `7f094c8e6` | rso-readonly-diagnostic ACCEPT | `cceab12f3` | 0/0 |
| `web/lib/rosterScheduleOptimizer/periodBoundaries.test.ts` | A | accepted | E1 | `7f094c8e6` | rso-intraday-periods ACCEPT | `fa913b318` | 0/1 |
| `web/lib/rosterScheduleOptimizer/periodBoundaries.ts` | A | accepted | E1 | `7f094c8e6` | rso-intraday-periods ACCEPT | `2d711664d` | 0/0 |
| `web/lib/rosterScheduleOptimizer/planningTimeline.ts` | M | accepted | E1 | `7f094c8e6` | rso-functional-checkpoint accepted-local-functional-slice; rso-mockup-match bounded ACCEPT | `a5398a8c6` | 5/5 |
| `web/lib/rosterScheduleOptimizer/providerRules.test.ts` | M | accepted | E1 | `7f094c8e6` | rso-weekly-rule-supplement v3 ACCEPT | `149eeb982` | 8/12 |
| `web/lib/rosterScheduleOptimizer/providerRules.ts` | M | accepted | E1 | `7f094c8e6` | rso-weekly-rule-supplement v3 ACCEPT | `8cba4db70` | 5/5 |
| `web/lib/rosterScheduleOptimizer/reconciliation.test.ts` | M | accepted | E1 | `7f094c8e6` | rso-functional-checkpoint accepted-local-functional-slice; rso-mockup-match bounded ACCEPT | `ab277ea73` | 5/9 |
| `web/lib/rosterScheduleOptimizer/reconciliation.ts` | M | accepted | E1 | `7f094c8e6` | rso-functional-checkpoint accepted-local-functional-slice; rso-mockup-match bounded ACCEPT | `dfbff3e1c` | 5/5 |
| `web/lib/rosterScheduleOptimizer/refreshForecastInputs.test.ts` | A | accepted | E1 | `7f094c8e6` | rso-participation-transport ACCEPT | `940ddc934` | 8/12 |
| `web/lib/rosterScheduleOptimizer/refreshForecastInputs.ts` | A | accepted | E1 | `7f094c8e6` | rso-participation-transport ACCEPT | `39d6fd786` | 5/5 |
| `web/lib/rosterScheduleOptimizer/workspace.test.ts` | M | accepted | E1 | `7f094c8e6` | rso-participation-transport ACCEPT | `86c0e3970` | 5/7 |
| `web/lib/rosterScheduleOptimizer/workspace.ts` | M | accepted | E1 | `7f094c8e6` | rso-participation-transport ACCEPT | `9ceb2c397` | 5/6 |
| `web/pages/api/v1/db/refresh-roster-optimizer-schedule.ts` | A | accepted | E1 | `7f094c8e6` | schedule-refresh v2 ACCEPT (engineering proposal) | `93a394053` | 2/3 |
| `web/pages/api/v1/roster-schedule-optimizer/diagnostic-context.ts` | A | accepted | E1 | `7f094c8e6` | rso-readonly-diagnostic ACCEPT | `876663263` | 0/1 |
| `web/pages/api/v1/roster-schedule-optimizer/diagnostic.ts` | A | accepted | E1 | `7f094c8e6` | rso-readonly-diagnostic ACCEPT | `79e733484` | 0/1 |
| `web/__tests__/components/RosterScheduleOptimizer/CategoryGains.test.tsx` | M | candidate | E4 | `7f094c8e6` | owner pin: checkpoint-production-release-2026-10-16, forge-rso-completion-2026-10-15 | `f1ef2858d` | 7/9 |
| `web/__tests__/pages/api/v1/db/update-roster-optimizer-schedule.test.ts` | M | candidate | E4 | `7f094c8e6` | owner pin: checkpoint-production-release-2026-10-16, forge-rso-completion-2026-10-15 | `501c00e10` | 3/3 |
| `web/__tests__/pages/api/v1/roster-schedule-optimizer/eligibility.test.ts` | A | candidate | E4 | `7f094c8e6` | owner pin: rso-visual-redesign-2026-10-13 | `c8defba56` | 12/12 |
| `web/components/RosterScheduleOptimizer/CandidateCard.tsx` | A | candidate | E4 | `7f094c8e6` | owner pin: forge-rso-completion-2026-10-15 | `b3eaa290a` | 9/11 |
| `web/components/RosterScheduleOptimizer/CategoryGains.tsx` | M | candidate | E4 | `7f094c8e6` | owner pin: checkpoint-production-release-2026-10-16, forge-rso-completion-2026-10-15 | `fa135d1a4` | 5/6 |
| `web/components/RosterScheduleOptimizer/InfoTooltip.module.scss` | A | candidate | E4 | `7f094c8e6` | owner pin: rso-mockup-match-2026-10-14 | `010a088ba` | 0/0 |
| `web/components/RosterScheduleOptimizer/InfoTooltip.test.tsx` | A | candidate | E4 | `7f094c8e6` | owner pin: rso-visual-redesign-2026-10-13 | `893ef1b55` | 2/2 |
| `web/components/RosterScheduleOptimizer/InfoTooltip.tsx` | A | candidate | E4 | `7f094c8e6` | owner pin: rso-mockup-match-2026-10-14 | `472492107` | 1/1 |
| `web/components/RosterScheduleOptimizer/canonicalSchedule.ts` | A | candidate | E4 | `7f094c8e6` | owner pin: forge-rso-completion-2026-10-15 | `3cb062f05` | 0/0 |
| `web/e2e/roster-schedule-optimizer.spec.ts` | M | candidate | E4 | `7f094c8e6` | owner pin: checkpoint-production-release-2026-10-16, forge-rso-completion-2026-10-15 | `b6bc5fb4b` | 5/6 |
| `web/hooks/candidateMetrics.worker.ts` | M | candidate | E4 | `7f094c8e6` | owner pin: rso-mockup-match-2026-10-14 | `cb950cb0e` | 8/9 |
| `web/hooks/useCandidateMetrics.ts` | M | candidate | E4 | `7f094c8e6` | owner pin: rso-candidate-pool-2026-10-16, rso-input-trace-2026-10-15 | `ea5a90a57` | 8/9 |
| `web/lib/rosterScheduleData/normalize.ts` | M | candidate | E4 | `7f094c8e6` | owner pin: checkpoint-production-release-2026-10-16, forge-rso-completion-2026-10-15 | `a1bb78e19` | 1/1 |
| `web/lib/rosterScheduleData/planning.test.ts` | M | candidate | E4 | `7f094c8e6` | owner pin: forge-rso-completion-2026-10-15 | `b30fff1ca` | 35/35 |
| `web/lib/rosterScheduleData/planning.ts` | M | candidate | E4 | `7f094c8e6` | owner pin: forge-rso-completion-2026-10-15 | `cc76828c0` | 29/29 |
| `web/lib/rosterScheduleData/planningDataTransport.ts` | A | candidate | E4 | `7f094c8e6` | owner pin: forge-rso-completion-2026-10-15 | `1d4abac74` | 5/5 |
| `web/lib/rosterScheduleData/planningInputs.ts` | M | candidate | E4 | `7f094c8e6` | owner pin: ifttt/full-acceptance-reconciliation, ifttt/review-full52-reconciliation-v1 | `d0e81b2bc` | 8/8 |
| `web/lib/rosterScheduleData/source.test.ts` | M | candidate | E4 | `7f094c8e6` | owner pin: checkpoint-production-release-2026-10-16, forge-rso-completion-2026-10-15 | `50af94783` | 3/3 |
| `web/lib/rosterScheduleData/source.ts` | M | candidate | E4 | `7f094c8e6` | owner pin: checkpoint-production-release-2026-10-16, forge-rso-completion-2026-10-15 | `9f7bab6dc` | 1/1 |
| `web/lib/rosterScheduleData/types.ts` | M | candidate | E4 | `7f094c8e6` | owner pin: checkpoint-production-release-2026-10-16, forge-rso-completion-2026-10-15 | `9f42b5525` | 0/0 |
| `web/lib/rosterScheduleOptimizer/candidatePlanMetrics.ts` | A | candidate | E4 | `7f094c8e6` | owner pin: forge-rso-completion-2026-10-15 | `132652021` | 7/8 |
| `web/lib/rosterScheduleOptimizer/contributionLedger.test.ts` | A | candidate | E4 | `7f094c8e6` | owner pin: rso-release-readiness-2026-10-15 | `fac47c34c` | 7/10 |
| `web/lib/rosterScheduleOptimizer/contributionLedger.ts` | A | candidate | E4 | `7f094c8e6` | owner pin: rso-mockup-match-2026-10-14 | `3f46f39e4` | 6/7 |
| `web/lib/rosterScheduleOptimizer/planningTypes.ts` | M | candidate | E4 | `7f094c8e6` | owner pin: forge-rso-completion-2026-10-15 | `d9a95c2e5` | 5/5 |
| `web/lib/rosterScheduleOptimizer/yahooEligibility.ts` | A | candidate | E4 | `7f094c8e6` | owner pin: rso-input-trace-2026-10-15, rso-mockup-match-2026-10-14 | `14bc0a332` | 5/5 |
| `web/lib/rosterScheduleOptimizer/yahooEligibilityCache.test.ts` | A | candidate | E4 | `7f094c8e6` | owner pin: rso-visual-redesign-2026-10-13 | `397e1265b` | 11/13 |
| `web/lib/rosterScheduleOptimizer/yahooEligibilityCache.ts` | A | candidate | E4 | `7f094c8e6` | owner pin: rso-input-trace-2026-10-15, rso-visual-redesign-2026-10-13 | `1a20763f3` | 10/10 |
| `web/pages/api/v1/db/update-roster-optimizer-schedule.ts` | M | candidate | E4 | `7f094c8e6` | owner pin: checkpoint-production-release-2026-10-16, forge-rso-completion-2026-10-15 | `3968b43d0` | 2/2 |
| `web/pages/api/v1/roster-schedule-optimizer/eligibility.ts` | A | candidate | E4 | `7f094c8e6` | owner pin: rso-input-trace-2026-10-15, rso-visual-redesign-2026-10-13 | `d84ac03d5` | 11/11 |
| `web/lib/in-season/workspaceRoutes.test.ts` | M | candidate | E5 | `6551974b2` | snapshot/audit pins only (10 files) | `4b2592fca` | 6/8 |
| `web/lib/rosterScheduleOptimizer/planningReproducibility.test.ts` | M | candidate | E5 | `1ddef915d` | snapshot/audit pins only (12 files) | `c8aa9bc68` | 6/7 |
| `web/pages/api/v1/roster-schedule-optimizer/provider.ts` | M | candidate | E5 | `1ddef915d` | snapshot/audit pins only (12 files) | `e0627a343` | 30/31 |
| `web/pages/api/v1/roster-schedule-optimizer/workspace.ts` | M | candidate | E5 | `6551974b2` | snapshot/audit pins only (12 files) | `e643d024f` | 5/7 |
| `web/__tests__/components/RosterScheduleOptimizer/RosterScheduleOptimizer.test.tsx` | M | candidate | E6 | `7f094c8e6` | no receipt for current bytes | `7184f3229` | 18/34 |
| `web/components/RosterScheduleOptimizer/CandidateCard.test.tsx` | A | candidate | E6 | `7f094c8e6` | no receipt for current bytes | `f651a2707` | 10/12 |
| `web/components/RosterScheduleOptimizer/RosterScheduleOptimizer.tsx` | M | candidate | E6 | `7f094c8e6` | no receipt for current bytes | `4cb8c50f5` | 17/33 |
| `web/components/RosterScheduleOptimizer/TeamScheduleContext.tsx` | A | candidate | E6 | `7f094c8e6` | no receipt for current bytes | `d3d10bdf6` | 3/4 |
| `web/components/RosterScheduleOptimizer/canonicalSchedule.test.ts` | A | candidate | E6 | `7f094c8e6` | no receipt for current bytes | `3e066cf70` | 1/1 |
| `web/lib/rosterScheduleOptimizer/candidatePlanMetrics.test.ts` | A | candidate | E6 | `7f094c8e6` | no receipt for current bytes | `bdbec1f31` | 8/11 |
| `web/lib/rosterScheduleOptimizer/planning.test.ts` | M | candidate | E6 | `7f094c8e6` | no receipt for current bytes | `c0302e1a6` | 6/8 |
| `web/lib/rosterScheduleOptimizer/planning.ts` | M | candidate | E6 | `7f094c8e6` | no receipt for current bytes | `c0aba8f5a` | 5/6 |
| `web/pages/api/v1/roster-schedule-optimizer/data.ts` | M | candidate | E6 | `7f094c8e6` | no receipt for current bytes | `6a331fa45` | 31/31 |

## IFTTT / claims / lines ingestion: 75 paths (52 accepted, 23 candidate)

| Path | St | Disposition | Ev | Last commit | Receipt / evidence | Blob | Closure* |
|---|---|---|---|---|---|---|---|
| `web/__tests__/pages/api/v1/db/update-line-sources.test.ts` | M | accepted | E1 | `7f094c8e6` | IFTTT review-raw-job-ack-v1 (accepted local held/shadow scope); IFTTT review-receiver-intake-bounds-v2 (accepted local held/shadow scope) (+2) | `de2cb6709` | 9/36 |
| `web/__tests__/pages/api/v1/db/update-lines-ccc.test.ts` | M | accepted | E1 | `7f094c8e6` | IFTTT review-consumer-binding-v2 (accepted local held/shadow scope); IFTTT review-durable-occurrence-v3 (accepted local held/shadow scope) (+9) | `8fda3c48c` | 9/35 |
| `web/components/NewsFeed/NewsCard.test.tsx` | M | accepted | E1 | `7f094c8e6` | IFTTT review-consumer-binding-v2 (accepted local held/shadow scope); IFTTT review-durable-occurrence-v3 (accepted local held/shadow scope) (+9) | `fccd2cc80` | 0/0 |
| `web/lib/lines/service.test.ts` | M | accepted | E1 | `7f094c8e6` | IFTTT review-consumer-binding-v2 (accepted local held/shadow scope); IFTTT review-durable-occurrence-v3 (accepted local held/shadow scope) (+9) | `2959a0221` | 1/4 |
| `web/lib/lines/service.ts` | M | accepted | E1 | `7f094c8e6` | IFTTT review-consumer-binding-v2 (accepted local held/shadow scope); IFTTT review-durable-occurrence-v3 (accepted local held/shadow scope) (+9) | `679d3c336` | 1/3 |
| `web/lib/newsFeed.test.ts` | M | accepted | E1 | `7f094c8e6` | IFTTT review-consumer-binding-v2 (accepted local held/shadow scope); IFTTT review-durable-occurrence-v3 (accepted local held/shadow scope) (+9) | `5c5ee4dda` | 1/3 |
| `web/lib/newsFeed.ts` | M | accepted | E1 | `7f094c8e6` | IFTTT review-consumer-binding-v2 (accepted local held/shadow scope); IFTTT review-durable-occurrence-v3 (accepted local held/shadow scope) (+9) | `b9a35eb55` | 1/2 |
| `web/lib/sources/fixtures/claimContextCases.json` | A | accepted | E1 | `7f094c8e6` | IFTTT review-consumer-binding-v2 (accepted local held/shadow scope); IFTTT review-durable-occurrence-v3 (accepted local held/shadow scope) (+9) | `bedab2731` | 0/0 |
| `web/lib/sources/fixtures/tweetClaimQualificationFixture.ts` | A | accepted | E1 | `7f094c8e6` | IFTTT review-consumer-binding-v2 (accepted local held/shadow scope); IFTTT review-durable-occurrence-v3 (accepted local held/shadow scope) (+9) | `c320de755` | 2/12 |
| `web/lib/sources/iftttIntakePolicy.test.ts` | A | accepted | E1 | `7f094c8e6` | IFTTT review-receiver-intake-bounds-v2 (accepted local held/shadow scope) | `09b340f60` | 0/1 |
| `web/lib/sources/iftttIntakePolicy.ts` | A | accepted | E1 | `7f094c8e6` | IFTTT review-receiver-intake-bounds-v2 (accepted local held/shadow scope) | `605a30311` | 0/0 |
| `web/lib/sources/lineSourceProcessing.ts` | M | accepted | E1 | `7f094c8e6` | IFTTT review-full52-reconciliation-v1 (accepted local held/shadow scope) | `1ffea0193` | 3/5 |
| `web/lib/sources/linesCccIngestion.ts` | M | accepted | E1 | `7f094c8e6` | IFTTT review-consumer-binding-v2 (accepted local held/shadow scope); IFTTT review-durable-occurrence-v3 (accepted local held/shadow scope) (+9) | `f7a5d6819` | 2/3 |
| `web/lib/sources/projectedLineups.test.ts` | M | accepted | E1 | `7f094c8e6` | IFTTT review-consumer-binding-v2 (accepted local held/shadow scope); IFTTT review-durable-occurrence-v3 (accepted local held/shadow scope) (+9) | `e0dfc59ac` | 8/30 |
| `web/lib/sources/tweetClaimApplicability.ts` | A | accepted | E1 | `7f094c8e6` | IFTTT review-consumer-binding-v2 (accepted local held/shadow scope); IFTTT review-durable-occurrence-v3 (accepted local held/shadow scope) (+7) | `3883ca89e` | 0/0 |
| `web/lib/sources/tweetClaimCompatibility.ts` | A | accepted | E1 | `7f094c8e6` | IFTTT review-consumer-binding-v2 (accepted local held/shadow scope); IFTTT review-durable-occurrence-v3 (accepted local held/shadow scope) (+9) | `dfeb381bc` | 2/11 |
| `web/lib/sources/tweetClaimEvaluation.ts` | A | accepted | E1 | `7f094c8e6` | IFTTT review-consumer-binding-v2 (accepted local held/shadow scope); IFTTT review-durable-occurrence-v3 (accepted local held/shadow scope) (+9) | `1f5069592` | 2/9 |
| `web/lib/sources/tweetClaimEvaluationBounds.test.ts` | A | accepted | E1 | `7f094c8e6` | IFTTT review-consumer-binding-v2 (accepted local held/shadow scope); IFTTT review-durable-occurrence-v3 (accepted local held/shadow scope) (+9) | `946bd4a97` | 2/11 |
| `web/lib/sources/tweetClaimEvaluationBounds.ts` | A | accepted | E1 | `7f094c8e6` | IFTTT review-consumer-binding-v2 (accepted local held/shadow scope); IFTTT review-durable-occurrence-v3 (accepted local held/shadow scope) (+9) | `6efa1bced` | 2/10 |
| `web/lib/sources/tweetClaimEvaluationIntake.test.ts` | A | accepted | E1 | `7f094c8e6` | IFTTT review-consumer-binding-v2 (accepted local held/shadow scope); IFTTT review-durable-occurrence-v3 (accepted local held/shadow scope) (+9) | `e7c8b35e2` | 2/12 |
| `web/lib/sources/tweetClaimEvaluationIntake.ts` | A | accepted | E1 | `7f094c8e6` | IFTTT review-consumer-binding-v2 (accepted local held/shadow scope); IFTTT review-durable-occurrence-v3 (accepted local held/shadow scope) (+9) | `ae127333f` | 2/11 |
| `web/lib/sources/tweetClaimEvidence.test.ts` | A | accepted | E1 | `7f094c8e6` | IFTTT review-consumer-binding-v2 (accepted local held/shadow scope); IFTTT review-durable-occurrence-v3 (accepted local held/shadow scope) (+7) | `6fe59ad85` | 2/13 |
| `web/lib/sources/tweetClaimEvidence.ts` | A | accepted | E1 | `7f094c8e6` | IFTTT review-consumer-binding-v2 (accepted local held/shadow scope); IFTTT review-durable-occurrence-v3 (accepted local held/shadow scope) (+7) | `e40e966a2` | 2/11 |
| `web/lib/sources/tweetClaimExtraction.test.ts` | A | accepted | E1 | `7f094c8e6` | IFTTT review-consumer-binding-v2 (accepted local held/shadow scope); IFTTT review-durable-occurrence-v3 (accepted local held/shadow scope) (+9) | `f4b65a885` | 2/10 |
| `web/lib/sources/tweetClaimExtraction.ts` | A | accepted | E1 | `7f094c8e6` | IFTTT review-consumer-binding-v2 (accepted local held/shadow scope); IFTTT review-durable-occurrence-v3 (accepted local held/shadow scope) (+7) | `b21440b4f` | 2/8 |
| `web/lib/sources/tweetClaimForecastDelivery.ts` | A | accepted | E1 | `7f094c8e6` | IFTTT review-consumer-binding-v2 (accepted local held/shadow scope); IFTTT review-full52-reconciliation-v1 (accepted local held/shadow scope) (+4) | `3979ae690` | 8/30 |
| `web/lib/sources/tweetClaimLineage.test.ts` | A | accepted | E1 | `7f094c8e6` | IFTTT review-consumer-binding-v2 (accepted local held/shadow scope); IFTTT review-durable-occurrence-v3 (accepted local held/shadow scope) (+9) | `f3ab48218` | 2/16 |
| `web/lib/sources/tweetClaimLineage.ts` | A | accepted | E1 | `7f094c8e6` | IFTTT review-consumer-binding-v2 (accepted local held/shadow scope); IFTTT review-durable-occurrence-v3 (accepted local held/shadow scope) (+7) | `1d96ae239` | 2/14 |
| `web/lib/sources/tweetClaimOccurrenceIdentity.test.ts` | A | accepted | E1 | `7f094c8e6` | IFTTT review-consumer-binding-v2 (accepted local held/shadow scope); IFTTT review-durable-occurrence-v3 (accepted local held/shadow scope) (+8) | `01cb9b152` | 0/2 |
| `web/lib/sources/tweetClaimOccurrenceIdentity.ts` | A | accepted | E1 | `7f094c8e6` | IFTTT review-consumer-binding-v2 (accepted local held/shadow scope); IFTTT review-durable-occurrence-v3 (accepted local held/shadow scope) (+8) | `a1afd9aae` | 0/1 |
| `web/lib/sources/tweetClaimOccurrenceStorage.ts` | A | accepted | E1 | `7f094c8e6` | IFTTT review-consumer-binding-v2 (accepted local held/shadow scope); IFTTT review-durable-occurrence-v3 (accepted local held/shadow scope) (+7) | `78cd9afb4` | 2/11 |
| `web/lib/sources/tweetClaimQualificationStorage.test.ts` | A | accepted | E1 | `7f094c8e6` | IFTTT review-receiver-intake-bounds-v2 (accepted local held/shadow scope); IFTTT review-receiver-variant-retention-v2 (accepted local held/shadow scope) (+1) | `5d49cbd88` | 8/31 |
| `web/lib/sources/tweetClaimQualificationStorage.ts` | A | accepted | E1 | `7f094c8e6` | IFTTT review-consumer-binding-v2 (accepted local held/shadow scope); IFTTT review-durable-occurrence-v3 (accepted local held/shadow scope) (+7) | `4593eb3b3` | 2/16 |
| `web/lib/sources/tweetClaimRawAcknowledgment.ts` | A | accepted | E1 | `7f094c8e6` | IFTTT review-receiver-intake-bounds-v2 (accepted local held/shadow scope); IFTTT review-receiver-variant-retention-v2 (accepted local held/shadow scope) (+1) | `df92d2098` | 0/0 |
| `web/lib/sources/tweetClaimReducerAdapter.ts` | A | accepted | E1 | `7f094c8e6` | IFTTT review-consumer-binding-v2 (accepted local held/shadow scope); IFTTT review-durable-occurrence-v3 (accepted local held/shadow scope) (+9) | `de5fac076` | 0/2 |
| `web/lib/sources/tweetClaimRegistry.test.ts` | A | accepted | E1 | `7f094c8e6` | IFTTT review-consumer-binding-v2 (accepted local held/shadow scope); IFTTT review-durable-occurrence-v3 (accepted local held/shadow scope) (+7) | `5d8186c78` | 8/30 |
| `web/lib/sources/tweetClaimRegistry.ts` | A | accepted | E1 | `7f094c8e6` | IFTTT review-receiver-intake-bounds-v2 (accepted local held/shadow scope); IFTTT review-receiver-variant-retention-v2 (accepted local held/shadow scope) (+1) | `0de1967ca` | 2/22 |
| `web/lib/sources/tweetClaimSourceHints.test.ts` | A | accepted | E1 | `7f094c8e6` | IFTTT review-consumer-binding-v2 (accepted local held/shadow scope); IFTTT review-durable-occurrence-v3 (accepted local held/shadow scope) (+9) | `97d435888` | 2/17 |
| `web/lib/sources/tweetClaimSourceHints.ts` | A | accepted | E1 | `7f094c8e6` | IFTTT review-consumer-binding-v2 (accepted local held/shadow scope); IFTTT review-durable-occurrence-v3 (accepted local held/shadow scope) (+9) | `bf9c7f5cb` | 2/12 |
| `web/lib/sources/tweetInterpretation.test.ts` | M | accepted | E1 | `7f094c8e6` | IFTTT review-consumer-binding-v2 (accepted local held/shadow scope); IFTTT review-durable-occurrence-v3 (accepted local held/shadow scope) (+9) | `c3a135100` | 9/12 |
| `web/lib/sources/tweetPlayerEvents.ts` | M | accepted | E1 | `7f094c8e6` | IFTTT review-consumer-binding-v2 (accepted local held/shadow scope); IFTTT review-durable-occurrence-v3 (accepted local held/shadow scope) (+9) | `4a7545321` | 1/2 |
| `web/lib/sources/tweetProcessingJobs.ts` | M | accepted | E1 | `7f094c8e6` | IFTTT review-receiver-intake-bounds-v2 (accepted local held/shadow scope); IFTTT review-receiver-variant-retention-v2 (accepted local held/shadow scope) (+1) | `cff1f2091` | 1/3 |
| `web/lib/sources/tweetProjectionStorage.ts` | M | accepted | E1 | `7f094c8e6` | IFTTT review-consumer-binding-v2 (accepted local held/shadow scope); IFTTT review-durable-occurrence-v3 (accepted local held/shadow scope) (+9) | `4fbfb24a6` | 8/29 |
| `web/lib/sources/tweetSemanticEvents.ts` | A | accepted | E1 | `7f094c8e6` | IFTTT review-consumer-binding-v2 (accepted local held/shadow scope); IFTTT review-durable-occurrence-v3 (accepted local held/shadow scope) (+8) | `468d265d8` | 0/0 |
| `web/lib/sources/tweetSourceClaimRegistry.ts` | A | accepted | E1 | `7f094c8e6` | IFTTT review-consumer-binding-v2 (accepted local held/shadow scope); IFTTT review-durable-occurrence-v3 (accepted local held/shadow scope) (+9) | `349e28226` | 0/0 |
| `web/lib/sources/tweetSourceDirectory.test.ts` | A | accepted | E1 | `7f094c8e6` | IFTTT review-consumer-binding-v2 (accepted local held/shadow scope); IFTTT review-durable-occurrence-v3 (accepted local held/shadow scope) (+9) | `80eaea605` | 2/6 |
| `web/lib/sources/tweetSourceDirectory.ts` | A | accepted | E1 | `7f094c8e6` | IFTTT review-consumer-binding-v2 (accepted local held/shadow scope); IFTTT review-durable-occurrence-v3 (accepted local held/shadow scope) (+9) | `38f722ac8` | 2/5 |
| `web/pages/api/v1/db/player-name-aliases.ts` | M | accepted | E1 | `7f094c8e6` | IFTTT review-full52-reconciliation-v1 (accepted local held/shadow scope) | `34dc4d38a` | 3/6 |
| `web/pages/api/v1/db/update-line-sources.ts` | M | accepted | E1 | `7f094c8e6` | IFTTT review-consumer-binding-v2 (accepted local held/shadow scope); IFTTT review-durable-occurrence-v3 (accepted local held/shadow scope) (+9) | `268ea6c66` | 9/34 |
| `web/pages/api/v1/db/update-lines-ccc.ts` | M | accepted | E1 | `7f094c8e6` | IFTTT review-consumer-binding-v2 (accepted local held/shadow scope); IFTTT review-durable-occurrence-v3 (accepted local held/shadow scope) (+9) | `fa8bccf0e` | 9/34 |
| `web/scripts/evaluate-tweet-claims.ts` | A | accepted | E1 | `7f094c8e6` | IFTTT review-consumer-binding-v2 (accepted local held/shadow scope); IFTTT review-durable-occurrence-v3 (accepted local held/shadow scope) (+9) | `b7085f6f9` | 2/10 |
| `web/lib/sources/fixtures/october11TroublesomeTweets.json` | A | accepted | E2 | `90ae40f01` | 90ae40f01: Master Page: six parser fixes independently accepted locally | `22809ae1d` | 0/0 |
| `web/__tests__/fixtures/lineupSectionFixtures.ts` | A | candidate | E4 | `7f094c8e6` | owner pin: ifttt-u05-01-acceptance-2026-10-15, ifttt/handoff | `6c4d32fc9` | 2/3 |
| `web/__tests__/pages/api/v1/db/player-name-aliases.test.ts` | M | candidate | E4 | `7f094c8e6` | owner pin: ifttt/handoff | `7886de47f` | 3/7 |
| `web/__tests__/pages/api/v1/sources/ifttt/DFOFantasy-tweet.test.ts` | A | candidate | E4 | `7f094c8e6` | owner pin: ifttt-u05-01-acceptance-2026-10-15, release-candidate-review-2026-10-15 | `d317eed01` | 4/5 |
| `web/__tests__/pages/api/v1/sources/ifttt/NHL-Rosters-tweet.test.ts` | A | candidate | E4 | `7f094c8e6` | owner pin: ifttt-u05-01-acceptance-2026-10-15, release-candidate-review-2026-10-15 | `685ddcc49` | 4/5 |
| `web/__tests__/pages/db/player-aliases.test.tsx` | M | candidate | E4 | `7f094c8e6` | owner pin: ifttt/handoff | `2258abae9` | 2/2 |
| `web/lib/sources/currentOrganizationSync.test.ts` | A | candidate | E4 | `7f094c8e6` | owner pin: ifttt/handoff | `6c5e5679e` | 1/1 |
| `web/lib/sources/currentOrganizationSync.ts` | A | candidate | E4 | `7f094c8e6` | owner pin: ifttt/handoff | `49c1d7d89` | 0/0 |
| `web/lib/sources/iftttReceiptRetention.ts` | A | candidate | E4 | `7f094c8e6` | owner pin: ifttt/review-rpc-deadline-reconciliation-v1 | `172d22424` | 1/2 |
| `web/lib/sources/iftttRpcDeadline.ts` | A | candidate | E4 | `7f094c8e6` | owner pin: ifttt/review-rpc-deadline-reconciliation-v1 | `cab09f4c7` | 0/0 |
| `web/lib/sources/lineSourceIftttReceiver.test.ts` | M | candidate | E4 | `7f094c8e6` | owner pin: ifttt/review-rpc-deadline-reconciliation-v1 | `6bf5426f6` | 3/4 |
| `web/lib/sources/lineSourceIftttReceiver.ts` | M | candidate | E4 | `7f094c8e6` | owner pin: ifttt/review-rpc-deadline-reconciliation-v1 | `ce606a172` | 2/3 |
| `web/lib/sources/lineSourceProcessing.test.ts` | M | candidate | E4 | `7f094c8e6` | owner pin: ifttt-u05-01-acceptance-2026-10-15, ifttt/handoff | `26655f4ef` | 9/32 |
| `web/lib/sources/linesCccIngestion.test.ts` | M | candidate | E4 | `7f094c8e6` | owner pin: ifttt-u05-01-acceptance-2026-10-15, ifttt/handoff | `49bca78b9` | 4/7 |
| `web/lib/sources/lineupSourceIngestion.test.ts` | M | candidate | E4 | `7f094c8e6` | owner pin: ifttt-u05-01-acceptance-2026-10-15, ifttt/handoff | `f689ba8b7` | 3/4 |
| `web/lib/sources/lineupSourceIngestion.ts` | M | candidate | E4 | `7f094c8e6` | owner pin: forge-rso-completion-2026-10-15, ifttt-u05-01-acceptance-2026-10-15 | `f59e141fe` | 1/2 |
| `web/lib/sources/playerAliasReview.ts` | A | candidate | E4 | `7f094c8e6` | owner pin: ifttt/handoff | `2e56efb91` | 0/0 |
| `web/lib/sources/tweetInterpretation.ts` | M | candidate | E4 | `7f094c8e6` | owner pin: forge-rso-completion-2026-10-15, ifttt-u05-01-acceptance-2026-10-15 | `7eeab99cb` | 1/2 |
| `web/lib/sources/tweetSemanticEvents.test.ts` | A | candidate | E4 | `7f094c8e6` | owner pin: ifttt/README.md, ifttt/handoff | `89c1d614d` | 0/1 |
| `web/pages/api/v1/sources/ifttt/DFOFantasy-tweet.ts` | A | candidate | E4 | `7f094c8e6` | owner pin: ifttt-u05-01-acceptance-2026-10-15, release-candidate-review-2026-10-15 | `b85e94d85` | 3/4 |
| `web/pages/api/v1/sources/ifttt/NHL-Rosters-tweet.ts` | A | candidate | E4 | `7f094c8e6` | owner pin: ifttt-u05-01-acceptance-2026-10-15, release-candidate-review-2026-10-15 | `c31470ef5` | 3/4 |
| `web/pages/db/player-aliases.tsx` | M | candidate | E4 | `7f094c8e6` | owner pin: ifttt/handoff | `18168df62` | 1/1 |
| `web/scripts/rehearse-exhausted-tweet-recovery.test.ts` | A | candidate | E5 | `7f094c8e6` | snapshot/audit pins only (10 files) | `33841a9d6` | 6/6 |
| `web/scripts/rehearse-exhausted-tweet-recovery.ts` | A | candidate | E5 | `7f094c8e6` | snapshot/audit pins only (9 files) | `ac33a6a1e` | 5/5 |

## Social share: 16 paths (16 candidate)

| Path | St | Disposition | Ev | Last commit | Receipt / evidence | Blob | Closure* |
|---|---|---|---|---|---|---|---|
| `web/public/fonts/social-share/RobotoCondensed-Variable.ttf` | A | candidate | E4 | `1ddef915d` | owner pin: rso-mockup-match-2026-10-14 | `221055572` | 0/0 |
| `web/components/SocialShare/SocialShare.module.scss` | A | candidate | E5 | `1ddef915d` | snapshot/audit pins only (2 files) | `e59e89a11` | 0/0 |
| `web/components/SocialShare/SocialShare.tsx` | A | candidate | E5 | `1ddef915d` | snapshot/audit pins only (9 files) | `98539796a` | 6/6 |
| `web/e2e/social-share.spec.ts` | A | candidate | E5 | `1ddef915d` | snapshot/audit pins only (10 files) | `3cb790bf9` | 4/4 |
| `web/lib/socialShare/export.ts` | A | candidate | E5 | `1ddef915d` | snapshot/audit pins only (9 files) | `3198fd1f2` | 1/1 |
| `web/lib/socialShare/schedule.test.ts` | A | candidate | E5 | `1ddef915d` | snapshot/audit pins only (10 files) | `38daa2cc6` | 7/7 |
| `web/lib/socialShare/schedule.ts` | A | candidate | E5 | `1ddef915d` | snapshot/audit pins only (9 files) | `3735d1b4b` | 3/3 |
| `web/lib/socialShare/server.ts` | A | candidate | E5 | `1ddef915d` | snapshot/audit pins only (9 files) | `fa6328ed9` | 4/4 |
| `web/lib/socialShare/types.ts` | A | candidate | E5 | `1ddef915d` | snapshot/audit pins only (9 files) | `5b250e2b9` | 0/0 |
| `web/pages/api/v1/social-share/[format].ts` | A | candidate | E5 | `1ddef915d` | snapshot/audit pins only (10 files) | `e2a332da9` | 5/5 |
| `web/pages/social-share/[format].tsx` | A | candidate | E5 | `1ddef915d` | snapshot/audit pins only (10 files) | `6945c1fca` | 7/7 |
| `web/public/fonts/social-share/martianmono-OFL.txt` | A | candidate | E5 | `1ddef915d` | snapshot/audit pins only (2 files) | `ec8a477ec` | 0/0 |
| `web/public/fonts/social-share/robotocondensed-OFL.txt` | A | candidate | E5 | `1ddef915d` | snapshot/audit pins only (2 files) | `bafe4a2cf` | 0/0 |
| `web/public/fonts/social-share/trainone-OFL.txt` | A | candidate | E5 | `1ddef915d` | snapshot/audit pins only (2 files) | `af80b6c36` | 0/0 |
| `web/public/fonts/social-share/MartianMono-Variable.ttf` | A | candidate | E6 | `1ddef915d` | no receipt for current bytes | `1dbec63b6` | 0/0 |
| `web/public/fonts/social-share/TrainOne-Regular.ttf` | A | candidate | E6 | `1ddef915d` | no receipt for current bytes | `0a44ad4e5` | 0/0 |

## In-season commerce (pricing/entitlements): 2 paths (2 candidate)

| Path | St | Disposition | Ev | Last commit | Receipt / evidence | Blob | Closure* |
|---|---|---|---|---|---|---|---|
| `web/lib/in-season/commerce.test.ts` | A | candidate | E5 | `1ddef915d` | snapshot/audit pins only (10 files) | `9080964fb` | 1/1 |
| `web/lib/in-season/commerce.ts` | A | candidate | E5 | `1ddef915d` | snapshot/audit pins only (9 files) | `413dfbd4e` | 0/0 |

## SEO: 2 paths (2 candidate)

| Path | St | Disposition | Ev | Last commit | Receipt / evidence | Blob | Closure* |
|---|---|---|---|---|---|---|---|
| `web/__tests__/seo.test.ts` | M | candidate | E5 | `1ddef915d` | snapshot/audit pins only (10 files) | `ae5e123e1` | 1/1 |
| `web/lib/seo.js` | M | candidate | E5 | `1ddef915d` | snapshot/audit pins only (6 files) | `8a53818ef` | 0/0 |

## Database SQL: 4 paths (3 candidate, 1 accepted)

| Path | St | Disposition | Ev | Last commit | Receipt / evidence | Blob | Closure* |
|---|---|---|---|---|---|---|---|
| `supabase/migrations/20261017183611_native_forecast_catalog_heads.sql` | A | accepted | E2a | `a23728de2` | a23728de2: FORGE LEDGER §7/§11/§12 agent independent review; owner sign-off pending | `2e9e2bfc8` | 0/0 |
| `supabase/migrations/20261011115124_preserve_projection_raw_shift_occurrences.sql` | A | candidate | E5 | `1ddef915d` | snapshot/audit pins only (3 files) | `aa64431e8` | 0/0 |
| `supabase/migrations/20261011160000_preserve_nst_pk_fractional_start_rates.sql` | A | candidate | E5 | `1ddef915d` | snapshot/audit pins only (3 files) | `f8d516341` | 0/0 |
| `supabase/tests/projection_raw_shift_occurrences.sql` | A | candidate | E5 | `1ddef915d` | snapshot/audit pins only (1 files) | `15360284c` | 0/0 |

## Repository instructions: 2 paths (2 candidate)

| Path | St | Disposition | Ev | Last commit | Receipt / evidence | Blob | Closure* |
|---|---|---|---|---|---|---|---|
| `AGENTS.md` | M | candidate | E6 | `7f094c8e6` | instruction-only; no runtime surface | `cb27c56bf` | 0/0 |
| `SPRINT-MODE.md` | A | candidate | E6 | `7f094c8e6` | instruction-only; no runtime surface | `95d450743` | 0/0 |

## Research and evidence: 7 paths (7 private/evidence)

| Path | St | Disposition | Ev | Last commit | Receipt / evidence | Blob | Closure* |
|---|---|---|---|---|---|---|---|
| `docs/player-projections/forge-pp-shot-evidence-packet.md` | A | private/evidence | E5 | `6551974b2` | snapshot/audit pins only (2 files) | `172d15171` | 0/0 |
| `docs/player-projections/forge-pp-shot-support.md` | A | private/evidence | E5 | `6551974b2` | snapshot/audit pins only (2 files) | `6779b847d` | 0/0 |
| `modeling/player_forecasts/forge_walk_forward.py` | A | private/evidence | E5 | `7f094c8e6` | snapshot/audit pins only (2 files) | `374aafd71` | 0/0 |
| `modeling/player_forecasts/pp_evidence_capture.py` | A | private/evidence | E5 | `6551974b2` | snapshot/audit pins only (2 files) | `157718023` | 0/0 |
| `modeling/player_forecasts/pp_shot_support.py` | A | private/evidence | E5 | `6551974b2` | snapshot/audit pins only (2 files) | `0fca07dab` | 0/0 |
| `modeling/player_forecasts/tests/test_harness.py` | M | private/evidence | E5 | `7f094c8e6` | snapshot/audit pins only (2 files) | `f109293b7` | 0/0 |
| `output/page-optimization-audit-20261015.md` | A | private/evidence | E6 | `7f094c8e6` | research/evidence; not imported by deployed code | `f47aca952` | 0/0 |

\* Closure = changed paths reachable through imports that are not accepted / all changed paths reachable. `0/0` means the path imports no other changed path.

## Not reopened

These items are recorded and not reopened: the completed NST repairs (`395282458d`, deployed; `cfaac232e4` merge), the evening cron removal (job 234 stays disabled), and the Oct 16 RPC privilege revocation (hosted ledger `20261016152305`). The current `update-nst-gamelog.ts` delta is a later change on top of the deployed repair. It is classified as a candidate only for that delta.
