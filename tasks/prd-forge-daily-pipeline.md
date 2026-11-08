# PRD: Checked-in daily FORGE native pipeline

## Problem

The only native FORGE forecasts ever produced (2026-10-16) came from about 15–20 private one-off scripts with hard-coded dates, IDs, counts and hashes. No repo code can produce a fresh day's forecasts, so every day's run means rebuilding the chain by hand. The materialize → prepare → publish → catalog-head stages are already checked in. Everything before them is not.

## Goal

One checked-in driver produces a bounded, reviewable native forecast publication for any New York date D. It reuses the existing builders and stages, and it hands off to the checked-in materialization, cadence, publication and catalog-head code.

## Stages (`web/scripts/forge-daily.ts`; pure logic in `web/lib/player-forecasts/nativeDailyPipeline.ts`)

| Stage | Network / DB | Output |
|---|---|---|
| `scope` | Read-only Yahoo (owned roster plus first two available-player pages) and Supabase reads (identity mapping, schedule) | Universe (owned and candidate canonical IDs, clubs, classes) and next-20 bindings |
| `capture` | NHL GETs only, bounded and serial with no retries; reuses retained immutable receipts | Club rosters, schedule weeks, boxscores/landings, goalie summaries |
| `inputs` | none | Native observations, policy selection, participation inputs, and a bound materialization request |
| `materialize` (existing) | Hosted inserts into `player_forecast_source_observations` | Closed input proof |
| `outputs` | none; issued after the closure and the 08:00 New York due time | Bundles, participation receipts, policy rows and pending review rows |
| `review` | none; applies an independent reviewer's decision file | Reviewed plan and cadence command |
| `publish` (existing) | Journaled inserts plus one catalog-head CAS | Selected catalog |

The only network access is through each stage's explicit `--execute` flags. Every stage defaults to offline/dry-run, writes into a new private directory (exclusive create), and pins its inputs by SHA-256.

## Requirements

1. **Parameterization.** No hard-coded date, player, game or count. Everything comes from the date, the scope and the capture receipts.
2. **Reuse.** Use `assembleCurrentRosterNativeInputs`, the `buildNative*` producers, the participation receipt builders, `targetRosterObservationFromReceipt`, `validateNativeBaselinePublication`, `bindNativeCadenceMaterialization` and the existing cadence stages. Introduce no new model or method.
3. **Policy assignment** follows the 2026-10-16 rules:
   - skaters with verified current appearances → `current-appearance-skater-rates-v1`
   - skaters with none, but captured prior-season boxscores → `native-prior-appearance-skater-rates-v1`
   - goalies → volume and win
   - goalies with a captured official summary → shutout
   - win held for missing decisions → summary win only when the official summary closes the gap
4. **Expiry rule.** The earliest of issuance + 12 h, the universe's first bound game − 1 ms, and the day's first league game − 1 ms.
   - Reissuing never renews an original expiry. A daily run is a **new issuance**: new row IDs, new reviews and a stated new expiry, with unchanged means, cutoffs and approved candidate hashes.
   - Each review row discloses the original bundle, its original issuance and expiry, and the native input cutoff.
   - TJ chose this v1 re-issue of the frozen Oct 16 means explicitly on 2026-10-17.
5. **Unknowns stay unknown.** A missing input never becomes a zero, and partial coverage is reported by key.
6. **Reserved outcomes.** Walk-forward reserved game IDs were excluded from capture until the experiment's readout (2026-10-28 noon ET).
   - Superseded on 2026-10-17: the experiment was closed and all reserved games released (see v2 decision 1).
   - v1's frozen Sep 29–Oct 12 window never included them.
7. **Dry-run acceptance.** On retained 2026-10-16 receipts, the `inputs` + `outputs` stages must reproduce the reviewed Oct 16 means (same source IDs and identical means), with zero network calls.

## v1 scope (TJ decision 2026-10-17)

v1 refreshes club rosters, the schedule, the frozen-window scope evidence and all participation inputs. It re-issues the frozen Oct 16 native means.

- **Why the means stay frozen.** Walk-forward reserved games (most of Oct 13–25) stay sealed until the 2026-10-28 readout, so the means could barely change before then.
- **Frozen window re-observed.** The frozen participation window's two schedule weeks (Sep 29 and Oct 6) are re-captured each run. The run stops if any club's frame changed. A fresh derived manifest is the history scope evidence; the method requires scope evidence ≤ 24 h old.
- **Gates:**
  - The capture must equal the plan and be taken on the run date.
  - Every universe club roster must be present.
  - `outputs` refuses above a stated null-participation ceiling.
- **Not in v1:** a fresh Yahoo universe or injury read. Carried conflicts persist only as `true`, a conservative withhold; a carried `false` becomes unknown.
- **v2, after the readout:** fresh-capture means plus a rolling-window participation method, which needs owner approval.

## Known constraints and decisions

- **Participation method window.** The roster-observation participation methods hard-code the Sep 29–Oct 13 history window and accept cutoffs only within 14 days of it, so up to 2026-10-27 04:00Z. After that a rolling-window method version is needed. That is a method change for owner approval and is out of scope here.
- **Universe.** The owned roster plus the first 50 available players by Yahoo overall rank, as on Oct 16. This is a partial candidate pool.
- **Policy approval.** TJ approved the live sequence on 2026-10-17 and delegated the publish decision to Chef, with review by a separate reviewer agent. Policy rows cite that decision.

## Out of scope

Scheduler binding and public activation; new participation or rate methods; the RSO and Start Chart test failures (prompts 02 and 03).

## v2 decisions (TJ, 2026-10-17)

1. **Walk-forward experiment closed.** It had been dormant since 2026-10-15. The record is `FHFH-private/forge-walk-forward-20261014-v1/protocol/closure-decision-20261017.json` (sha256 `1046139d…`).
   - **Still sealed:** only the 8 games of 2026-10-14/15: 2026020106, 2026020108, 2026020109, 2026020110, 2026020111, 2026020114, 2026020116, 2026020117.
   - **Released:** the 44 reserved games of 2026-10-16..25 are now ordinary production inputs.
   - **Amended the same day: all 8 released.** TJ approved scoring the 2026-10-15 issuance first.
     - 7 read-only boxscore GETs were made, about 93 KB.
     - The scoring record is `FHFH-private/forge-walk-forward-postclosure-scoring-20261017-v1/score.json` (sha256 `7e210a39…`). It is descriptive only: 8 of 10 forecasts had positive-TOI labels and 7 of 13 pairs could be evaluated.
     - The amendment is `protocol/closure-amendment-20261017-v1.json` (sha256 `e2c5f491…`), with `stillSealedGameIds: []`.
     - No walk-forward game is excluded from capture any more. Rolling participation from Oct 27 has no sealed-game nulls.
2. **Rolling-window participation approved.** A new method version uses the same appearance-frequency estimator and the same label, eligibility, staleness and conflict rules as the roster-observation method. The only change is the history window: the 14 days of club games before each cutoff (half-open, America/New_York), replacing the hard-coded Sep 29–Oct 13 window. Existing method versions and their published bundles stay unchanged.
3. **Standing approval for daily runs.**
   - Unchanged method versions publish after an automated independent-reviewer agent approves the exact plan hash, with no per-day sign-off from TJ.
   - "Unchanged" means the same policy version and definition hash, the same participation method version, and every run gate passing.
   - Each daily issuance gets policy rows citing this standing approval (the ref `tj-standing-approval-2026-10-17:forge-daily`), scoped to that day's candidate input hash.
   - Any new or changed method, policy or definition hash, or any gate exception, still goes to TJ.
   - The run's operational bounds (provider reads, materialize, publish plus one CAS, ≤5 readback requests) are as approved on 2026-10-17. Scheduler binding, public activation, deploys and pushes remain separate approvals.

## v2 build ownership (parallel sessions, 2026-10-17)

- Until 2026-10-20 17:00 UTC (Monday's live run), nobody edits files the run uses: `web/scripts/forge-daily.ts`, `web/scripts/native-baseline-cadence.ts`, `web/lib/player-forecasts/{nativeDailyPipeline,nativeCadenceOutputPreparation,nativeInputMaterialization,nativeBaselineCadence,nativeBaselinePublication,nativeCatalogHead,currentRosterNativeInputs,modeledSkaterParticipation,modeledGoalieParticipation,modeledSkaterParticipationStore,modeledGoalieParticipationStore,targetRosterObservation,contributionStore,baselineGeneration,goalieBaselineRates,baselineRates,sourceSnapshot}.ts`.
- New work goes in new files. Chef (the FORGE owner session) integrates into the driver after the run.
