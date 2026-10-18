# FORGE v2 daily-driver integration: staged patches (sprint lane S-05, 2026-10-18)

This is the combined v2 driver: the Yahoo universe stage, fresh native means, and participation inputs. Participation uses the frozen-window method through 2026-10-27T04:00Z and the rolling 14-day method after that.

Everything here was built and tested in a scratch copy of `web/` outside the repo. Nothing was committed or pushed, no network call was made, and no frozen file was edited in the real checkout.

**Apply only after 2026-10-20 17:00 UTC.** Patches 02 and 04 edit run files that are frozen until then.

## Patches (apply in order from the repository root)

| # | File | sha256 | What |
|---|---|---|---|
| 01 | `01-kernel-export.patch` | `37150f82…1a23d05` | The rolling session's patch 01, byte-identical. It exports the frozen participation kernels |
| 02 | `02-integration-rebased.patch` | `3d1e2b0a…868752f` | The rolling session's patch 02, rebased (see below) |
| 03 | `03-v2-composition-new-files.patch` | `990a4e86…0a0` | New files only: `lib/player-forecasts/nativeDailyPipelineV2.ts` and its test, plus `scripts/forge-daily-v2.ts` |
| 04 | `04-v2-driver-wiring.patch` | `9a1ebfc8…795` | Frozen-file edits: the fresh-means branch in `nativeCadenceOutputPreparation.ts`, and 3 dispatch lines in `forge-daily.ts` |

**02 was rebased.** The rolling session's 02 (`75233836…`) no longer applies at two hunks, because other sessions changed those files after it was cut:
- `startChartContract.ts`: the function's return type was renamed.
- `planning.test.ts`: two import lines were added nearby.

Both are context drift only. The hunk content is unchanged, and the other 19 files are byte-identical to the original 02.

**Checks run:**
- All four patches pass `git apply --check` and apply in order, in a throwaway repo holding the current bytes of every touched file. The base blobs are in `base-blobs.txt`, cut at checkout HEAD `0de97e77d` plus the working tree.
- `git apply --check` of 01 also passes against the real checkout.

```bash
git apply --check tasks/artifacts/forge-v2-integration-2026-10-18/01-kernel-export.patch
```

```bash
git apply tasks/artifacts/forge-v2-integration-2026-10-18/01-kernel-export.patch
```

Repeat the check and apply for 02, 03 and 04, in order. To roll back, run `git apply -R` on 04, 03, 02 and 01, in that order.

## What the v2 path does

| Stage | Entry point | Notes |
|---|---|---|
| `universe` | `forge-daily universe …` → `forge-daily-universe.ts` | Unchanged CLI (Yahoo GETs plan-only unless `--execute true`) |
| `means` | `forge-daily means …` → `native-means-capture.ts` | Unchanged CLI (NHL GETs plan-only unless `--execute true`) |
| `inputs-v2` | `forge-daily inputs-v2 --universe … --means … --capture … --retained … --date D --out DIR [--flags F] [--approved-injury-policy-hash H]` | Offline. Universe gates, then participation by method: frozen through 2026-10-27T04:00Z, rolling after that only with the flag. Builds one bound materialization request. The fresh means are additional observations; parents are merged with participation first; the acquisition roster is the universe |
| `materialize` | `native-baseline-cadence.ts materialize` | Unchanged |
| `outputs-v2` | `forge-daily outputs-v2 --command … --proof … --templates … --approval-ref REF --max-null-participation N [--flags F] --out DIR` | Offline. A fresh bundle per policy, a policy row under the standing approval scoped to that day's candidate input hash, a pending review, and participation bundles. The templates (the reviewed plan) supply only each policy's terms |
| `review`, publish | Unchanged v1 stages | |

**Frozen-window participation in v2.**
- Templates apply only to universe members whose `(playerId, nhlPlayerId, teamId, rosterRevision)` is unchanged from the retained Oct 16 templates.
- Anyone else is reported as `no_frozen_window_template_or_identity_changed`, with no participation.
- Parents come from the unchanged v1 builder run over a copy of the retained request with its native data stripped.

## Flags (`NATIVE_DAILY_V2_FLAGS`, all off by default)

| Flag | When off | When on |
|---|---|---|
| `injuryPolicy` | No fresh `knownConflicts`; the v1 carry rule applies | Applies the proposed Yahoo policy, only when `--approved-injury-policy-hash` equals its hash |
| `nullGateNonConflictOnly` | Every null counts against `--max-null-participation` | Conflict-withheld nulls are reported but not counted |
| `universeThresholds` | U4 (≤5 unresolved) and U5 (≤10 added) are reported only. U3 (owned complete) always gates | U4 and U5 stop the run |
| `rollingFirstIssuance` | A cutoff after 2026-10-27T04:00Z stops with `rolling_first_issuance_not_approved` | The rolling 14-day methods are issued |

## Offline replay at 2026-10-21 clocks (flags off)

Harness: `replay-20261021.ts`. Receipt: `replay-receipt-20261021.json` (sha256 `89f0c518…f069`). It ran from the scratch copy with all patches applied: 0 network calls, 0 DB writes.

| Check | Result |
|---|---|
| Participation method | `frozen_window` (cutoff 2026-10-21T10:55Z) |
| Universe gate | 69 players (19 owned); 0 unresolved, 0 added; thresholds not applied (flag off) |
| Fresh means | 74 selected: 59 current-appearance, 1 prior, 7 volume, 6 win, 1 shutout |
| Materialization (simulated closure 12:05Z) | Request 40.2 MB, 471 parents, 1,260 participation inputs; 200 rows, 1,334 manifest items |
| Outputs (issued 12:10Z) | 94 rows, 74 native inputs, 577 sources, 5 fresh policy rows with 5 pending reviews |
| **Nulls** | **100 of 1,260, against a gate of 100**: passes, exactly at the bound. 20 of them are conflict-withheld, so the gated count would be 80 with `nullGateNonConflictOnly` |
| Null reasons | `unknown_eligibility_or_occurrence` 100, `no_eligible_history` 20, `known_current_roster_conflict` 20, `stale_eligible_history` 20 |
| Plan validation | Pending plan rejected before review (`Native publication admission failed.`, the same as v1). After a synthetic review, the reviewed plan validates: 94 rows |
| Cadence validation | `validateCadenceCommand`: 94 rows |
| Expiry | `2026-10-21T23:29:59.999Z`, the day's first bound game − 1 ms, inside the 12 h cap |

The replay uses three stand-ins:
- **Universe:** the retained 69-player scope; there was no Yahoo read.
- **Capture:** retained club rosters and history weeks, re-stamped to the run clock, with future weeks re-sliced from the retained schedules, as in the v1 dry-run.
- **Means:** history stops at 2026-10-12. Fiala's prior boxscores come from their retained original spans.

## Steps that need live captures or approvals on a real run

1. **Universe.**
   - 3 Yahoo GETs plus 1 read-only identity SQL query.
   - The identity SQL and the `rosterRevision` formatting have never run live (see the universe session's notes).
2. **NHL capture (v1 plan).**
   - 29 club rosters.
   - History weeks Sep 29 and Oct 6, plus future weeks.
3. **Means.**
   - The schedule weeks of Oct 13 and Oct 20, the boxscores and landings of Oct 13–20 (the means session estimated 111 requests / ≈1.64 MB seeded), and 7 goalie summaries.
   - In the replay, 6 of those summaries were not cached, so only 1 shutout policy and no summary-win were selected.
   - Prior-season game IDs for zero-appearance skaters (9603, 10609 and Fiala). They come from the scope stage or Supabase. Fiala's would add 20 requests, past the ≈120 bound; that is TJ's decision.
4. **Materialize, publish plus CAS, and readback.** Hosted writes, under the standing approval's bounds.
5. **The rolling method from the Oct 27 run.** It needs `rollingFirstIssuance` (TJ sign-off), plus the window schedule weeks and the final club boxscores.

## Risks for Chef and TJ

- **The null gate is exactly at its bound.** 100 nulls against a gate of 100. Any new null stops the run unless `nullGateNonConflictOnly` is approved, which would give 80.
- **Request size.**
  - It is 40.2 MB with history through Oct 12. Live Oct 13–20 history adds about 50%, which takes it to roughly 55–60 MB, against the materializer's 64 MiB bound.
  - It crosses the bound in late October, as the means session noted. One option is to split into several materializations.
- **Shared files.**
  - 02 and 04 edit files that other sessions also touch: `workspaceSchema.ts`, `startChartContract.ts` and `planning.test.ts` changed since the rolling session cut its 02.
  - Re-run the checks right before applying.
- **New `rosterRevision` values.** Frozen templates only cover unchanged revisions. If the live identity query formats revisions differently, most players lose participation until the rolling method takes over.

## Verification in the scratch copy (all patches applied)

| Check | Result |
|---|---|
| Focused Vitest suites (21 files) | **973 passed, 7 skipped, 0 failed.** Suites: rolling post-apply list incl. both CLI tests, means stage, v2 composition, `nativeDailyPipeline`, Yahoo universe ×3 |
| Scoped `tsc` (25 changed/new files and their imports) | Exit 0 |
| ESLint (25 changed/new files) | 0 errors, 0 warnings |
| Full `tsc` | Not run; it is in the post-apply list |

Post-apply, run in the canonical checkout:

```bash
npm test -- lib/player-forecasts/nativeDailyPipelineV2.test.ts lib/player-forecasts/nativeDailyMeansCapture.test.ts scripts/native-means-capture.test.ts lib/player-forecasts/nativeDailyPipeline.test.ts lib/player-forecasts/rollingWindowParticipation.test.ts lib/player-forecasts/rollingParticipationFrame.test.ts lib/player-forecasts/modeledSkaterParticipation.test.ts lib/player-forecasts/modeledGoalieParticipation.test.ts lib/player-forecasts/modeledSkaterParticipationStore.test.ts lib/player-forecasts/nativeBaselinePublication.test.ts lib/player-forecasts/contributions.test.ts lib/player-forecasts/planningContributions.test.ts lib/player-forecasts/gameExpectations.test.ts lib/rosterScheduleData/planning.test.ts lib/in-season/workspaceSchema.test.ts __tests__/pages/start-chart.test.tsx lib/player-forecasts/yahooUniverse.test.ts lib/player-forecasts/yahooUniverseCapture.test.ts scripts/forge-daily-universe.test.ts scripts/run-forge-local.test.ts scripts/qualify-native-players-offline.test.ts
```

```bash
NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit
```
