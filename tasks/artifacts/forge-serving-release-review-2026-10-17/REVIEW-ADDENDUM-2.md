# FORGE serving slice: review addendum 2 (gate restore, re-pin, accuracy proposal)

This is an independent re-review, using `REVIEW.md`'s legend. It was read-only: only this file was written. Nothing was committed or pushed, and no network, hosted Supabase, Vercel or production request was made. It covers:
- the restored legacy Start Chart gate
- the 2026-10-18 re-pin (`slice.json`, `generatedAt` 2026-10-18T18:32:12Z, HEAD `0de97e77d`)
- the `run-projection-accuracy` proposal in `BLOCKERS.md`
- the date-dependent RSO test

Every verdict applies to the blobs named here.

## 1. Pin set: no longer current

**Re-hash at 18:44:12Z.** All 124 pins were checked (blob, sha256, bytes): 70 runtime, 2 writers, 2 test support, 1 branch-only and 49 candidate tests.
- 115 match.
- **9 drifted.** All 9 were modified between 18:36:48Z and 18:39:45Z, after the pin. They are uncommitted, about +100/−25 against HEAD, and come from another session's RSO edit. They were not reviewed.

| File | Pinned | Working tree |
|---|---|---|
| `components/RosterScheduleOptimizer/CandidateBrowser.tsx` | `39b5ec90` | `0dd4743d` |
| `components/RosterScheduleOptimizer/CandidateCard.tsx` | `482f43e9` | `fb0b59c0` |
| `components/RosterScheduleOptimizer/RosterScheduleOptimizer.tsx` | `cb2632e8` | `849575ac` |
| `lib/rosterScheduleOptimizer/candidatePlanMetrics.ts` | `bac1159a` | `6f3bc840` |
| `lib/rosterScheduleOptimizer/planning.ts` | `c0aba8f5` | `ebd0e4d5` |
| `lib/rosterScheduleOptimizer/planningTypes.ts` | `14d64c9c` | `4b63f6be` |
| `components/RosterScheduleOptimizer/CandidateBrowser.presentation.test.tsx` (test) | `968aabba` | `cd78929b` |
| `lib/rosterScheduleOptimizer/candidatePlanMetrics.test.ts` (test) | `3e01abb9` | `09a7b2f1` |
| `lib/rosterScheduleOptimizer/planning.test.ts` (test) | `965f91fa` | `083e6ca1` |

**Re-hash at 18:48:48Z: 2 more drifted.** This is the serving-fix session's work in progress:
- `pages/api/v1/start-chart.ts`: `43046eb6` → `766f1a72`. Against HEAD, the only new hunk is `sumProjectionParts` (lines 738–746). **The gate hunk is unchanged** from the reviewed bytes.
- `__tests__/pages/api/v1/start-chart.test.ts`: `fa2f8447` → `515a58ed`.

**Do the pins match the tested bytes?** Probably, but this can't be checked.
- `test-evidence.json` and `slice.json` share `generatedAt` 18:32:12Z, and every drift happened after that.
- The evidence records no per-file hashes of the exported candidate tree, so I cannot show that what was tested equals the pins. Recording a sha256 manifest of the candidate tree in `test-evidence.json` would make that claim checkable.

**Verdict: needs change.** After the RSO edit and the serving-fix change land:
- re-pin all 11 files and re-run the candidate;
- independently review the 6 drifted runtime files and the new `sumProjectionParts` hunk. The earlier addendum's verdicts do not cover them.

## 2. Legacy Start Chart gate (`start-chart.ts` `43046eb6`; gate hunk unchanged in `766f1a72`)

**Verdict: accept with note.** It matches production exactly on the default (serving-off) path. Revision mode is not restored; see the gap below.

**Byte-level comparison with production `457435eb`:**
- The gate line `const forgeRun = selectedRun?.git_sha?.startsWith("local:") ? null : selectedRun;` is identical (production :906, current :913, now :915).
- These blocks are byte-identical to production:
  - the `provenanceEligibility` call (production :1426, current :1460);
  - the `unverified_projection_provenance` flag block (production :1549, current :1583);
  - the projection-state / `quarantined_or_missing_provenance` block (production :1864–1873, current :1898–1907).
- The whole production-to-current diff is 42 lines: the native path, the byte bound, cache clocks, and the comment. None of it touches the raw-run path.

**Labelled runs stay verified.** Eligibility needs both contracts, and `buildForgeInputProvenance({ externalFantasyInputsExcluded: true })` always stamps both. The rewritten test asserts `projection.state === "ready"` and no flag for a labelled run. For an unlabelled run it asserts:
- the run is served (`projectionRunId` set);
- the flag is present;
- the state is `partial`;
- `quarantined_or_missing_provenance` is set.

**Semantics note (intended, user-visible).** "Matches production" holds for *which* runs are served, not for how they are labelled.
- Production eligibility required only the rolling-history contract, so today production runs show `ready`.
- After A1 the same runs show `partial` plus the unverified flag and degraded reason, on Start Chart and on every dashboard caller.
- That is B1's honest outcome, but it is a visible change for TJ to expect.

**Gap: revision mode is not restored.** With `STARTER_BOARD_SERVING_ENABLED=true` (or the legacy `START_CHART_GAME_REVISIONS=true`):
- `fetchSlate` never uses the raw run: `forgeRun: starterBoardFlags().serving ? null : forgeRun`.
- Projections come only from admitted revisions.
- The slice's `consumerRevisionAdmission.ts` (+4 lines at :88) excludes every unlabelled revision as `use_not_approved`, so projections are `[]`.
- The test `withholds selected revisions with exclusion contract undefined` asserts exactly this.
- Production `457435eb` admitted those revisions.

**Production state of the flag.** Production has the variable set: `checkpoint-production-release-2026-10-16/vercel-trigger-and-flag-presence.json` lists it, but the value was not retained.
- If it is `"true"`, the restore changes nothing in production. The dashboard callers still get no FORGE projections, and `BLOCKERS.md`'s "get FORGE projections again" is false.
- **Before A1, either:**
  - read the flag's value (read-only, separate approval); or
  - accept the loss in revision mode.
- A code fix must keep RSO and native admission strict. That needs a legacy-board-only admission mode, which is a design change and should not be made blind.

## 3. `run-projection-accuracy` proposal (`BLOCKERS.md`)

**Verdict: sound structure; needs one change before it is applied.**

**Sound:**
- The 422 stays for a missing rolling-history contract, and production's message is correct for that case. The DB function `replace_forge_projection_results_atomic` also checks only that contract (`run-projection-accuracy.test.ts:278`). So scoring unlabelled runs needs no migration.
- It preserves today's production behaviour. Production eligibility checks only rolling history, so these same runs are scored daily now. The proposal adds an annotation; it does not widen anything.
- No slice file reads `forge_projection_calibration_daily`, `goalie_calibration_summary`, `accuracy_calibration` or the accuracy tables (grep across the slice). `forge/goalies` calibration hints continue as today.
- `updateRunCalibrationMetrics` (`accuracy_calibration[date]`) and the `forge_projection_calibration_daily.metrics` upsert both exist at production bytes (:1367, :1505).
- The rule that future native readers must positively filter on `"excluded"` is the right direction.

**Needs change: `externalFantasyInputs: "blended"` claims more than the job can verify.**
- At production bytes, external fantasy inputs enter only when `seasonBootstrap` is on (`run-forge-projections.ts` :405–410). That requires:
  - the compute flag;
  - a scoped canary run;
  - `STARTER_BOARD_SEASON_BOOTSTRAP_ENABLED === "true"`;
  - horizon 1, and no `decisionAsOf`.
- Only then do the stages call `loadSeasonBootstrap(…, true)`.
- `forge_runs.metrics` does not record whether it applied; only the captured snapshot's `seasonBootstrapApplied` does. A full-slate cron run with the bootstrap off has no external blend, but would be labelled "blended".
- That is the mirror image of B1's error: claiming contamination without proof instead of claiming exclusion without proof.
- **Fix:**
  - Record `externalFantasyInputs: "unverified"` (or `"not_excluded"`) when the label is missing, matching Start Chart's `unverified_projection_provenance`.
  - Reserve `"blended"` for runs whose snapshot shows `seasonBootstrapApplied === true`.
  - Keep `"excluded"` for labelled runs.

**Note: test evidence.**
- The proposal says the accuracy test is "in the candidate set". It is not among the 49 `candidateTests`, and `test-evidence.json` does not mention it.
- Its production version exercises only the freshness 422 (:122) and the SQL text (:278), not eligibility.
- So tests (a)–(d) are all new coverage. That is fine, but correct the statement.

**The alternative** (200 `skipped_unverified_provenance`) is honest too. It trades accuracy history for silence, and that choice is TJ's.

## 4. Sunday-only RSO test

**The test:** `RosterScheduleOptimizer.test.tsx` › `requires input review and renews it after rule changes without certifying unknown scoring`. The file is a pinned candidate test, `5a738316`, committed and unchanged.

**Verdict: date-dependent, confirmed; a test defect, not a slice regression.**
- The test uses the real clock: no `vi.useFakeTimers`. `defaultWorkspace()` builds the current Mon–Sun week in local time, and the `add` step is at `Date.now() + 86_400_000`.
- On a local Sunday, "tomorrow" is the next Monday, outside the period. The plan correctly fails the rule check, so the runtime behaviour is right.
- **Reproduced:**

  | Run | Local time | Result |
  |---|---|---|
  | Default time zone | 2026-10-18 14:48 EDT (Sunday) | **fails** |
  | `TZ=Pacific/Kiritimati` | 2026-10-19 08:48 +14 (Monday) | **passes** |

  Both runs used the same bytes at the same instant. The component was at the drifted working-tree blob (`849575ac`); the time-zone swap shows that the dependence is in the test.

**Scope.**
- It is not "outside the slice" as a file: it is a candidate test of a slice component.
- The cause is outside the slice runtime.
- Either pin its clock with `vi.setSystemTime` to a mid-week instant, or don't run the release gate on a local Sunday. Otherwise the "candidate failures ⊆ baseline" gate fails one day a week.

## Summary

| Item | Verdict |
|---|---|
| Pin set (`slice.json` 18:32:12Z) | **needs change.** 11 files drifted after pinning: 9 RSO, plus `start-chart.ts` (`sumProjectionParts`) and its test. Re-pin, re-run, and review the new hunks. Tested = pinned is plausible but not provable without a candidate manifest |
| Start Chart legacy gate | **accept with note.** Byte-identical to `457435eb` on the serving-off path, and labelled runs stay `ready`. **Gap:** with `STARTER_BOARD_SERVING_ENABLED=true` (set in production, value unknown), unlabelled revisions are still dropped. Check the value before A1 |
| Accuracy proposal | **needs change before applying.** Record `"unverified"`, not `"blended"`, unless the snapshot shows `seasonBootstrapApplied`. Otherwise sound: no migration, status quo preserved, no slice reader |
| Sunday RSO test | date-dependent (reproduced); a test defect, not a slice regression. Pin its clock |
