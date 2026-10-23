# RSO + FORGE hand-over: Claude lanes → Codex (2026-10-23)

TJ approved this hand-over (Claude session, 2026-10-23). It moves the remaining RSO and FORGE work from Claude's lanes to Codex, so free Codex quota can carry the token-heavy loops. It complements the broader review in [2026-10-23-claude-to-codex-unfinished-work-review.md](2026-10-23-claude-to-codex-unfinished-work-review.md). Put these tickets into your register; this note is not a second one.

## Ownership transfer

Claude's lanes are closed and idle. They write nothing further in these areas unless TJ reassigns them.
- **Model lane:** `local_892c107c…`. Final note: [2026-10-22-claude-forge-model-lane-handover.md](2026-10-22-claude-forge-model-lane-handover.md).
- **RSO lane:** `local_2b2dada1…`.
- **Healthy-IR alert:** `local_ea29a832…`.
- **Goalie marks:** `local_be6bf680…`. Note: [2026-10-22-claude-to-codex-yahoo-goalie-starting-status.md](2026-10-22-claude-to-codex-yahoo-goalie-starting-status.md).
- **Ledger lane:** `local_7113ecc7…`.

Codex now holds single-writer custody of:
- **FORGE model:** `web/lib/projections/stages/{skater,goalie}-stage.ts`, `calculators/skater-adjustments.ts`, `constants/projection-weights.ts`, `goalie/*`, `utils/{devig,market-output-builders}.ts`, `uncertainty.ts`, `dispersion.ts`, `queries/skater-queries.ts`, `run-forge-projections.ts`, `runProjectionV2.test.ts`.
- **Ledger:** `web/lib/player-forecasts/servedForecastLedger.ts`, `pages/api/v1/db/forge-served-forecast-{snapshot,settle}.ts`, `pages/api/v1/forge/scoreboard.ts`.
- **RSO (Claude-authored):** `web/lib/rosterScheduleOptimizer/{healthyReserves,providerGoalieStarts,lineupGaps}.ts`, `web/components/RosterScheduleOptimizer/{HealthyReserveAlert,RosterPlayerRow,ForecastPoints,SlotWeekGrid}.*`, `web/e2e/roster-schedule-optimizer.spec.ts`.

**Overlaps you already hold:** at 12:15–12:50Z the release lane had uncommitted edits in `currentPlanningRead.ts`, `executionAdapter.test.ts`, `rsoUsePolicy.ts`, `resolvedPlanningForecast.ts`, `planningReproducibility.test.ts` (+69/−4) and `forgeDailyBridge.test.ts`, plus `release-integration-2026-10-23/{yahoo-correction,production-model-prototype,unreleased-skater-*.patch}`. Tickets R1, R4 and F7 may already be partly done there. Check before dispatching.

## Gate kit (FORGE model tests)

- **Durable inputs:** [`tasks/artifacts/forge-gate-kit-2026-10-23/`](../forge-gate-kit-2026-10-23/)
  - `games-all.txt`: the 62-game cohort, 10-13..10-20.
  - `cohort/s3_actuals.json`, `s5_pp_actuals.json`, `s9_hits_blocks.json`: actuals reused from the 10-21 cohort; public NHL stats, no league data.
  - `gate_ci.py`: bootstrap CIs by game, 2000 reps, seed 1.
  - `mz.py`: Mincer–Zarnowitz slopes.
- **Scorer:** `tasks/artifacts/forge-task3-gate-2026-10-22/score_pair.py` (`main(out_dir, base, cand, actuals_path, hb_path)`).
- **Capture runner:**
  - `web/scripts/capture-forge-reconstruction.ts`, driven by `tasks/artifacts/forge-task3-gate-2026-10-22/run-captures-v.sh`.
  - Change its hard-coded `R=` scratch root (line 6) to a directory you own.
  - It runs sequentially, concurrency 1, with `unset GIT_DIR`.
  - Stop rules: more than 500 reads per run, more than 4 h, or more than 60k GETs in total.
  - It makes no NST calls.
- **Baseline captures:**
  - Variant f is the release C model. Its captures, along with c/d/g/h/i, sit in volatile `/private/tmp/claude-501/-Users-tim-Code-fhfhockey-com/d6739ede-de35-4524-8a93-c5011c5e6ee8/scratchpad/recon/out/<v>/`, about 1 GB each and 12 GB in total.
  - A reboot loses them. If they're gone, or your sandbox can't read them, re-capture the baseline from master `d4c2632d3`. That's another ~7.5k reads and needs TJ's approval.
- **Build base:** build variants on master `d4c2632d3` + `0dd535e0d`. Don't build on octoberBranch's `skater-stage.ts`: it still carries the HOLD code (about 278 lines of drift).
- **Approval:** every capture is production Supabase GETs, about 7.5k per variant. It needs **TJ's explicit approval per test**, asked before the capture starts. Report reads used against the approved budget.
- **Pass bar** (vs f, 2,079 dressed player-games):
  - FP ΔRMSE CI ≤ 0;
  - relative bias within ±10% on changed heads;
  - top decile 0.9–1.1;
  - MZ slopes moving toward 1;
  - D in the top FP decile not worse (f: 26 vs 38 actual).

## RSO tickets (priority order)

| ID | Outcome | Files | Acceptance | Needs TJ |
|---|---|---|---|---|
| R1 | Yahoo goalie marks done right. A forged or old saved mark never changes start chance or stats. With option (b), a fresh server-observed same-day mark does: applied on the server in the data route/bridge before fingerprinting, with source time shown. | `currentPlanningRead.ts` (yours), `providerGoalieStarts.ts`, `pages/api/v1/roster-schedule-optimizer/data.ts`, `rosterScheduleData/forgeDailyBridge.ts`, e2e goalie case | `provider-start-authority.test.ts` cases all pass; e2e updated | **Choice:** badge only (your current correction) vs (b). Option (b) adds one Yahoo roster read per data request |
| R2 | One message per healthy reserve. Suppress the drop-notice reserve line and the `unprojectedReason` chip title for `healthyReserves` players. Keep both for injured players without IR eligibility and for manual/retained rosters (where the alert never fires). | `RosterScheduleOptimizer.tsx:1039-1046`, `lineupGaps.ts:83-87`, `RosterPlayerRow.tsx` | lineupGaps / HealthyReserveAlert / RSO tests show exactly one message | — |
| R3 | Healthy-IR follow-ups: (a) a "DTD in IR+, may play" note; (b) an activation plan step (today the move is suggested but can't be added to a plan); (c) current-period locks in weekly leagues. | `healthyReserves.ts`, `planningTypes.ts`, `HealthyReserveAlert.tsx`, `executionAdapter.ts` | unit cases for each | — |
| R4 | P07 re-check gap: a baseline-rate + issued-participation row is denied on re-resolution, because `forecastFromContributions` sets `modelVersion` to the rate's `policyVersion`. Carry the issued `codeVersion` on the participation receipt and in the save schema. | `player-forecasts/planningContributions.ts`, `rsoUsePolicy.ts`, `in-season/workspaceSchema.ts`, `planningReproducibility.test.ts:179` | the former `it.fails` "baseline" case passes as a normal test. **Your release lane is already editing this test; check first** | — |
| R5 | Drop policy when one player is unprojected (today it suggests no drop at all). Prototype both options behind one switch, each with tests: (a) suggest nothing (current); (b) rank drops excluding the unknown player, who is never suggested. | `retention.ts`, `lineupGaps.ts`, `candidatePlanMetrics.ts` | both modes tested; the unknown player is never the drop | **Policy pick** |
| R6 | Browser specs, written: e2e data-route mocks echo the current-read nonce and `evaluatedAt`, so projected points render under P07; P07/task-10 acceptance specs for slot-grid "—"/partial states and if-starts values. | `web/e2e/roster-schedule-optimizer.spec.ts` + fixtures | Specs committed. **Running them goes to a Claude lane** (your Chromium fails with MachPort 1100) on `PLAYWRIGHT_ISOLATED_NEXT=1` :3100 | — |
| R7 | Dead code: delete `web/hooks/candidateMetrics.worker.ts` (nothing spawns it after P07). If R1 lands badge-only, `providerGoalieStarts.ts` becomes test-only, so delete or keep it deliberately. | as named | `rg` finds no consumers; tsc passes | — |

## FORGE tickets (priority order)

| ID | Outcome | Files / inputs | Acceptance | Needs TJ |
|---|---|---|---|---|
| F1 | **PPP + compression variant** (one variant). Forwards' PP goals per shot are 0.20 predicted vs 0.17 actual; the model puts 27% of goals on the PP vs about 21% actual. The context goal multipliers compound to about 1.3 (opponent goalie 1.18, shot quality 1.10, on-ice 1.07). The shot-quality multiplier double-counts finishing that conversion history already holds. A second small-sample shrink (mean weight 0.63, cap 0.76) compresses goals. Give finishing one owner: damp or drop the shot-quality goal multiplier, relax the second shrink, and consider reconciling team PP goals to PP opportunities × PP%. | `skater-stage.ts`, `skater-adjustments.ts` (`computeStrengthSplitConversionRates`, `resolveSkaterConversionRates`), `projection-weights.ts`; gate kit; [task9 VERDICT](../forge-task9-gate-2026-10-22/VERDICT.md), [k-refit VERDICT](../forge-k-refit-gate-2026-10-22/VERDICT.md) | PPP bias within ±10%, forward PP goals per shot ≈ 0.17, PPP top decile ≥ 0.95; G/A/FP MZ slopes (1.14/1.30/1.12) toward 1; FP ΔRMSE CI ≤ 0 | Capture approval |
| F2 | **ES dilution.** About 2 non-dressed projected skaters per team (124 rows / 62 games) take team ES TOI and shot share before `reconcileTeamToPlayers`. First diagnose offline from the existing captures (no reads), then build a variant. | `skater-stage.ts`, `lib/projections/reconcile.ts`; captures | dressed ES SOG bias within ±5% (SOG −9.2% today) | Capture approval for the variant |
| F3 | **HIT/BLK over-prediction** (+10.9% / +11.6%; HIT top decile 0.883). Prefer variant g's role-stability-as-uncertainty piece alone (HIT RMSE −0.016, BLK −0.006). Alternatives: re-fit `SKATER_PHYSICAL_RATE_PRIORS`, or migration 88 (kept off by TJ). | `computeSkaterPhysicalEventRates`, `projection-weights.ts` | HIT top decile ≥ 0.95, bias within ±10% | Capture approval; aggregate query if re-fitting; migration 88 is TJ's |
| F4 | **Task 9, one effect at a time** (home/rest evidence-sized fit, per-effect toggles). Q7 stays out; Q8 must not ship as written. | `skater-stage.ts`, [task9 VERDICT](../forge-task9-gate-2026-10-22/VERDICT.md) | per effect: FP ΔRMSE CI ≤ 0, flat SOG deciles, D top decile not worse | Capture approval per effect |
| F5 | **Release candidate for `0dd535e0d`** (k re-fit: assist-share + conversion k only). Build d4c2632d3 + only its hunks (`projection-weights.ts`, `runProjectionV2.test.ts`), then gate it: full vitest, eslint, tsc under `lockf /private/tmp/fhfh-heavy.lock`, `qualify-native-players-offline.test.ts`. | [k-refit VERDICT](../forge-k-refit-gate-2026-10-22/VERDICT.md) | baseline-only failures (master's `supportedBaselineMigration`); candidate SHA recorded | **Push timing.** Avoid splitting the first Release C ledger week (10-23..10-30); it can ride with F1 |
| F6 | **Ledger-week audit, prepared now.** Write the FP audit Q3/Q4 and Q5/Q6 queries and scripts, split by run `git_sha`, with the **Release C baseline** (the "R23 baseline" wording is stale). Release C first served 10-23 (snapshot 12:30Z), so 7 settled days are reached around **10-30**. Targets: dressed-only FP \|bias\| ≤ 0.10, Σactual/Σexpected 0.95–1.05, decile 10 between 0.9 and 1.1; zero-hit/block projections < 10%; PP A per PP G ≈ 1.8–1.91. | `tasks/artifacts/fantasy-point-audit-2026-10-22/REPORT.md` (Q-defs and targets, appendix and lines 229-237), `servedForecastLedger.ts` | scripts dry-run against fixtures | Production reads on ~10-30 |
| F7 | **HOLD disposition, both options ready.** octoberBranch still carries `65fc4b9ee` (Q7/Q8), `07c7f71af`, `f0ab2b9fd`, `e316db4c0` and the skater part of `6e14053ff`. Prepare (a) a revert patch and (b) a flagged-off alternative, each with tests, so `skater-stage.ts` on octoberBranch converges with master. | your `unreleased-skater-*.patch` may already cover the diff | both patches apply cleanly; tests green | **Revert vs flag** |
| F8 | **Small model items:** (a) 7.3 remainder: move the xG `teamWinProbability` (`forgeDailyBridge.ts:171`, used at `forge-served-forecast-snapshot.ts:9,76-77`) into the ledger/snapshot as an explicitly **naive** control. Don't switch it to FORGE's win model, which would stop it being naive. (b) Add the missing `lib/projections/reconcile.test.ts`. (c) Prepare the season-current priors refresh from `forge-priors-2026-10-22/priors-aggregate.sql` + `derive.py`. | as named | (a) bridge no longer exports it and naive values are byte-identical; (b) Σ player TOI/shots per strength = team targets; (c) dry output shape | (c) running the aggregate query |
| F9 | **Ledger lane leftovers, drafts only:** (a) task 1.2 F/D and expected/actual TOI + PP TOI slices (`servedForecastLedger.ts:316-317, 472` currently report `unavailable_*`); (b) A4 coverage universe: durable dressed-universe storage design (`scoreboard.ts:66`); (c) the release candidate for 6.3 market rows (`64b6bb8db`, `6f2f3ac58`; migration 99 is applied, but master has no market code). Its value is limited until decimal odds in `price_american` are fixed. | ledger files (yours) | code + tests behind the missing columns; migration drafted, not applied | Migrations; 6.3 push |
| F10 | **FORGE task-list cleanup.** In `tasks/TASKS/forge-projections/tasks-forge-projection-improvements-2026-10-22.md`: header line 8 and the 1.0 lease note at line 69 are stale; tick 2.0–2.5, 3.0–3.4, 4.2–4.3 and 8.0. In the streamlining list, tick parents 1.0/2.0/3.0/7.0. | docs | boxes match the release records | — |

**Not for Codex:**
- **Browser runs** (R6, CR-REL-04) and the **D4 grants local replay**: your sandbox blocks Chromium and initdb. Route them to a Claude lane.
- **Anything touching TJ's live Yahoo league.**
- **Task 5 (SH/PK):** TJ deferred it. It needs the native goal-accounting contract versioned to ES+PP+PK.

**Standing rules:**
- No production writes, migrations, cron/env changes, deploys or pushes without TJ's explicit approval.
- Commit with explicit pathspecs only; never `git add -A` (large untracked binaries).
- Never set `GIT_DIR` in test runs.
- A second `next dev` must use `PLAYWRIGHT_ISOLATED_NEXT=1`, never :3000/:3105.
- Run the CSS Modules pure-selector check after any `.module.scss` edit.
- NST limits: 40/1m, 80/5m, 100/15m, 180/h.
- Never commit TJ's league evidence.
