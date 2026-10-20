# R10 candidate piece: S-1 wave 1a, dark forecast-source selection for RSO (2026-10-20)

**Status:** patch only. Built and verified in a scratch `git archive` of `origin/master` = `c2ed28384` (R8, the local ref; no fetch). Nothing was committed, pushed or deployed, and no env or database was touched. If R9 lands first, re-run `git apply --check` on the new master before using it.

| File | sha256 |
|---|---|
| `S1-WAVE1-master.patch` | `5db477e8fcc5e1eb3a22c4f721b0332a9a850646771057c9fb06e1650ac0ed63` |

**Scope change from the ticket: this is wave 1a, not the whole wave 1.** The native catalog readers are not in it. See "Why the native readers are not here", below.

## What it changes (9 files, +523 −11)

| File | Change |
|---|---|
| `web/lib/player-forecasts/forecastServingSource.ts` (+ test) | **New.** Byte-identical to `octoberBranch` |
| `web/lib/player-forecasts/nativeCatalogHead.ts` (+ test) | **New.** Byte-identical to `octoberBranch` |
| `web/lib/player-forecasts/sourceSnapshot.ts` | The `octoberBranch` hunks, +36 −5:<br>• new exports `PlannedSourceObservation`, `SOURCE_OBSERVATION_COLUMNS`, `validPlannedObservationId`, `matchesPlannedObservation`, `verifyPlannedObservation`;<br>• an optional `observationId` on `capturePlayerForecastSourceObservation`. Without it, the insert row is the same as before |
| `web/lib/rosterScheduleData/planning.ts` | **Master's file, plus:**<br>• an optional `source`; when the caller gives none, it is selected here;<br>• with `legacy`, every read is master's;<br>• any other kind serves no baselines and no interim bridge, with a limitation: the D-2 reason, or `native_catalog_readers_not_released` for a native head.<br>Master's revision admission (`consumerRevisionAdmission`) is untouched; no branch label gate is imported |
| `web/pages/api/v1/roster-schedule-optimizer/data.ts` | **Master's file, plus:**<br>• one selection per request, passed to planning;<br>• `forecastSource` added to the body **only when the kind is not `legacy`**;<br>• a native `s-maxage` cap.<br>Before activation, the body and headers are exactly master's |
| `web/lib/rosterScheduleData/planning.test.ts`, `__tests__/pages/api/v1/roster-schedule-optimizer/data.test.ts` | One new test each (below) |

## Dark until `PLAYER_FORECAST_NATIVE_CATALOG_HEAD_ID` is set

**Evidence:**
- **Selection with the head unset:** `selectForecastServingSource` returns `legacy` before any read. The data-route test uses a database stub with no methods, so any lookup would throw.
- **New planning test (S-1):** head unset gives exactly the same table/method call sequence, RPC count and result as an explicit legacy source, with no `native_forecast_catalog_heads` read, and still serves the interim bridge.
  - A set but invalid head gives `empty`: no baseline read, no bridge read, and limitation `native_catalog_head_unavailable_or_invalid`.
  - A native head gives `native_catalog_readers_not_released` and no forecasts.
- **New data-route test (S-1):** with the head unset, the body equals master's shape with no `forecastSource`, and `Cache-Control` is unchanged. With an unusable head, `forecastSource.kind = empty`.
- **Both new tests fail** against master's original `planning.ts` and `data.ts`.
- **Differential check (scratch only, not in the patch):** master's original `planning.ts` and the patched one, run side by side with the head unset, across 16 combinations: bridge on/off × serving on/off × `RSO_FORGE_DAILY_BRIDGE` unset/off × baseline pins unset/set. All 16 gave **identical DB call logs (with arguments), identical RPC calls and identical JSON results**.

**Do not set the head env in production until wave 1b ships.** With wave 1a alone, a set head turns RSO's interim bridge off (fail-closed) and serves no native forecasts.

## Checks (scratch `origin/master` export + patch; Node 22.11.0, no `GIT_DIR`)

| Check | Result |
|---|---|
| `git apply --check` / `git apply` on a fresh `origin/master` export | **PASS**; the result is byte-identical to the tested tree |
| Focused Vitest (planning, data route, serving source, catalog head, bridge, `lib/rosterScheduleOptimizer/`, workspace schema, every test importing `sourceSnapshot`, start-chart API and page), under `/private/tmp/fhfh-heavy.lock` | **28 files, 934 passed**, 0 failed |
| Full `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit`, under the lock | **exit 0** after one correction. The first run flagged a test-only type (`Parameters<…>[2]` may be undefined), fixed with `NonNullable` |
| G1 guard (`release-r7-2026-10-20/G1-CONTRACT-MANIFEST.md` §3) on the candidate, checks 1, 2 and 4 | **PASS**. Run in the scratch repo with `G1_BASE` = the master export commit |
| G1 check 3 (wholesale reader files) | **PASS.** None of the 15 listed reader files differs from master in the candidate (blob IDs compared against `octoberBranch`, read-only) |
| G1 check 4 (cache paths) | **PASS**, none |
| ESLint, the 7 changed source and test files | exit 0 |

## Why the native readers are not here (wave 1b inventory)

DECISIONS.md listed wave 1 as "new files plus hunk ports of `sourceSnapshot`, `planning`, `data`". That under-scoped it. The native readers (`nativeContributionAdmission.ts`, `modeledSkaterParticipationStore.ts`, `modeledGoalieParticipationStore.ts`) import the native model code.

**Their closure against master:**
- **13 files absent on master (about 2,200 lines):**
  - `currentSeasonSogBaseline`, `currentSeasonSogContribution`;
  - `gameExpectations`;
  - `modeledGoalieParticipation`, `modeledGoalieParticipationStore`, `modeledSkaterParticipation`, `modeledSkaterParticipationStore`;
  - `nativeContributionAdmission`, `nativeGoalieOutcomes`, `nativePowerPlayPoints`;
  - `rollingWindowParticipation`, `targetRosterObservation`;
  - plus the two shipped here.
- **9 shared master files that would need non-additive hunk ports.** Missing exports are noted where the import check found them:

| File | Diff vs master | Missing on master |
|---|---|---|
| `baselineGeneration.ts` | +136 −10 | `buildNativeSkaterBaselineSnapshot` |
| `baselineRates.ts` | +83 −1 | the current/prior appearance policy builders, versions and definition hashes |
| `contributions.ts` | +120 −20 | `catalogParticipation`, `admittedModeledStart`, `CURRENT_SEASON_SOG_CONTRIBUTION_VERSION` |
| `goalieBaselineRates.ts` | +181 −7 | the 4 native goalie policy builders and versions |
| `resolvedPlanningForecast.ts` | +71 −6 | `applyModeledStartMetadata` |
| `planningContributions.ts` | +23 −4 | — |
| `contributionStore.ts` | +55 −26 | — |
| `goalieBaselineInputCapture.ts` | +32 −2 | — |
| `planningTypes.ts`, `planningInputs.ts` | +2 −1 each | — |

**Why 1b needs its own reviewed slice:**
- Several of these files carry the **native definition hashes** that the standing approval pins, so a hunk port must keep them byte-equal.
- Others are **client-side RSO resolution** (`planningContributions`, `resolvedPlanningForecast`, `contributions`), so they change what users see before activation unless they are proven inert.
- The proof needs a differential test like the one above, but for the client resolution.
- 1b also has to add the native branch in `planning.ts`: the native baseline and participation loaders reading `source.environment`, and `participationSources` in `PlanningData`.

**Suggested order:** wave 1a (this patch, inert) → wave 1b (native readers and model closure, with its own differential and definition-hash checks) → activation per D-3.

---

# Wave 1b: native catalog readers (A′, TJ 2026-10-20: "port as-is, measure first")

| File | Base | sha256 |
|---|---|---|
| `S1-WAVE1B-master.patch` | `origin/master` `b5e801d8f` (R9) **plus** `S1-WAVE1-master.patch` (1a, which still applies on R9 unchanged) | `4c2965ff0f35dc91c2365903c43a2a22278b6927eadb3a27f59e9a38d321ca19` |

Apply 1a, then 1b, from the repository root. To roll back, run `git apply -R` on 1b, then on 1a.

## Step 1: save-size gate (PASS)

The fixture is synthetic and local: 7-day range, 32 teams × 4 games, 1,800 players (non-ASCII names) = **7,200 bridge rows**, a 17-player roster and 20 intent steps. It is measured with R6's `jsonUtf8Bytes` against `WORKSPACE_SAVE_BYTE_BUDGET` = 3,996,000 B.

| Body | Bytes | Share of budget |
|---|---|---|
| **Actual save body**: `packPlanningSnapshots({ workspace, snapshot, expectedVersion })`, the same under R9 and A′ | **1,818,213** | **45.5 %**; the gate is ≤ 80 % = 3,196,800. **PASS** |
| Hypothetical: resolved rows saved, R9 resolver | 7,565,384 | over |
| Hypothetical: resolved rows saved, A′ resolver (`powerPlayRole` on all 7,200 rows) | 8,371,304 (+805,920) | over |

**Why the A′ resolver does not reach saves:** the client saves the raw input snapshot from `/data`, packed (`RosterScheduleOptimizer.tsx` `saveAccountNow` and the preservation backup). The resolver runs only for display and optimization. The hypothetical rows bound what a future change to the save path would cost.

## What 1b ships (29 files, +4,803 −61)

**Byte-identical octoberBranch files, 17 in all.**
- **Replaced:**
  - the client resolver: `contributions.ts`, `planningContributions.ts`, `resolvedPlanningForecast.ts`;
  - exports the readers need: `baselineRates.ts`, `baselineGeneration.ts`, `goalieBaselineRates.ts`.
- **New:**
  - the readers: `nativeContributionAdmission.ts`, `modeledSkaterParticipationStore.ts`, `modeledGoalieParticipationStore.ts`;
  - the model code they import: `modeledSkaterParticipation.ts`, `modeledGoalieParticipation.ts`, `rollingWindowParticipation.ts`, `targetRosterObservation.ts`, `nativeGoalieOutcomes.ts`, `nativePowerPlayPoints.ts`, `currentSeasonSogBaseline.ts`, `currentSeasonSogContribution.ts`.
- R9 did not change any of the replaced files after R8, so no R9 work is reverted.
- The closure was computed by import, adding a shared file only where a missing export required it. `contributionStore.ts`, `goalieBaselineInputCapture.ts`, `planningTypes.ts` and `planningInputs.ts` keep R9's version. In particular, **HEAD's ISO schedule-revision hash in `planningInputs.ts` is not ported.**

**`planning.ts` (on top of 1a):**
- A `native` source reads the head's catalog only: native baselines, roster-observation and rolling participation, using `source.environment`.
- The participation checksum uses octoberBranch's formula. The legacy and frozen groups are blank under a head, so they are null.
- Participation joins the manifest, evidence and `PlanningData` **only for a native source**.
- `legacy` stays master's exact path. Master's revision admission is unchanged.

**Tests:**
- The octoberBranch tests for the copied files: `contributions`, `planningContributions`, both participation models, the skater store, admission, goalie outcomes, power-play points, rolling and current-season SOG baseline.
- The 1a S-1 test, updated for a native source: no legacy baseline read and no bridge.
- `currentSeasonSogContribution.test.ts` is **not** included. It needs `gameExpectations.ts`, which belongs to the FORGE next-N slice.

**Not touched:** any G1 §2 reader (guard check 3), the label gate, the ISO hash, Start Chart admission, the B2 writers and the cron.

## Accepted pre-activation client changes (A′)

They are visible in resolver output before activation, and none reaches the save body:

1. **`powerPlayRole`** is stamped on every resolved forecast: `unavailable` for skaters, `not_applicable` for goalies. That is about 112 B per row in memory. R9's UI renders no `powerPlayRole`.
2. **Raw-row hardening:** a raw detailed row (no contributions) with conditioning other than `unconditional` is rejected as `unsupported_conditioning`, and its `startParticipation` is stripped before reconstruction. This matters only when game-revision serving is on, which it is not in production.
3. **`participationSources`** is cleared from the resolved snapshot, like `baselineSources`. Before activation there are none.

## Proofs

| Proof | Result |
|---|---|
| **Server, head unset:** R9's `loadPlanningData` vs patched, 16 combinations (bridge on/off × serving on/off × `RSO_FORGE_DAILY_BRIDGE` unset/off × baseline pins unset/set), scratch only | **Identical** DB call logs (with arguments), RPC calls and JSON results in all 16 |
| **Client, the same 16 planning results:** R9's `resolvePlanningContributions` vs A′ | **Identical except `powerPlayRole`**, which is present with `value: null` on every row |
| **R9's own tests against the ported code**, before the octoberBranch tests replaced theirs (`contributions`, `planningContributions`, `goalieBaseline`, `contributionStore`, `playerForecasts`, RSO planning, `lib/rosterScheduleOptimizer/`) | 682 of 683 passed. The one failure was 1a's native expectation, since updated |
| **Definition hashes**, recomputed with the repo's own functions on the patched tree and on octoberBranch HEAD | All 6 native policies are **byte-identical on both and equal to the pins** in `NATIVE_DAILY_APPROVED_METHODS`: `96bce3cf`, `879b96c7`, `e60cd76f`, `112fe51e`, `fc6c6849`, `e715b40b`. The legacy skater and goalie hashes (`bb9e1586`, `a2db2ec4`) are unchanged from R9 |

## Checks (scratch: R9 export + 1a + 1b; Node 22.11.0, no `GIT_DIR`)

| Check | Result |
|---|---|
| Fresh R9 export: `git apply --check` and apply for 1a, then 1b | **PASS**; the result is byte-identical to the tested tree |
| G1 guard, checks 1, 2 and 4 (scratch repo, `G1_BASE` = the R9 export commit) | **PASS** |
| G1 check 3 (the 15 listed reader files), plus `planningInputs.ts` | **PASS**: none differs from R9 |
| Focused Vitest under the heavy lock: `lib/player-forecasts/`, `lib/rosterScheduleData/`, `lib/rosterScheduleOptimizer/`, `lib/in-season/`, the RSO API routes, the start-chart API and page, and every test importing a replaced file | **48 files, 1,785 passed**, 0 failed |
| Full `tsc --noEmit` (8 GB) under the heavy lock | **exit 0**, no diagnostics (lock 23:20:35Z–23:21:51Z) |

**Still required before activation (D-3):** two clean v2 issuances on one head, read back locally. Then set the head env, after which RSO and FORGE next-N read native. FORGE next-N (`forge/forecasts` + `gameExpectations*`) is not in 1a or 1b; it is the remaining serving slice.
