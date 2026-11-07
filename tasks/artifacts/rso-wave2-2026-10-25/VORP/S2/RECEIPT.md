# VORP S2 receipt: later-impact (ΔF) engine

Lane `RSO-S2-FUTURE` (Claude, 2026-10-29). Stage S2 of `../ASSESSMENT.md`. Local edits and offline tests only. No commit, push, deploy, production or Yahoo access, migration, `PROJECTIONS_*` read, data loading or Next dev server. `planning.ts` and `planning.test.ts` matched their lease baselines (3eae2c8a… / 3b0dbc56…) and `futureImpact.*` were absent before any edit.

## Contract version: built to v2, not v1

The brief named contract v1 (sha256 ca0ab382…), and that was the file's hash when this lane started. While the lane was running, the orchestrator revised `S3-SCENARIO-CONTRACT.md` to **v2** (now sha256 `2f31491a6a63f52e2b6ec3f4eba6633928a14c1d4f6e625283eccf31fb7acca5`). This lane did not edit it. v2 rejects the v1 `finished_at` availability witness, so code that accepted it would have been wrong. I adapted the engine to v2:

- **§3 exact-output witness.** Only `observed_capture` is eligible. A row needs a trusted, pre-decision capture receipt that lists its full identity (run, slate, basis game, player, horizon, component set) with a matching checksum, a set checksum, and all five bindings: run succeeded, admission, identity, conditioning and proof. `availableAt` is the capture completion, labelled "observed available by".
- **§3 coherence.** All selected rows must come from one receipt. Otherwise both arms become `temporal_provenance_unavailable` with the reason `capture_not_coherent`.
- **§5 reason codes.** Every code is kept, for example `capture_after_decision` with `issue_age_exceeded`. The headline is the weakest state.
- **§2.6 claims.** `claims.withinBound`, `claims.scenarioInputsComplete` and `nativeForecasts: false` are reported separately, with the "rate scenario … not native F forecasts" label.
- **§9 cases.** v2's new exact-output and coverage-claim cases are tested.

`LATER_IMPACT_CONTRACT.version` is `"v2"`, and the contract stays `accepted: false`.

## What was built

`web/lib/rosterScheduleOptimizer/futureImpact.ts`. It is pure: every input is supplied, nothing is loaded, and no clock is read. It never feeds weekly gain, ranking or pruning.

| Piece | Behavior |
| --- | --- |
| `laterImpactForApp()` | **The app path.** It returns `scenario_contract_not_accepted` before reading any input. `evaluateLaterImpact(input)` does the same unless the synthetic tests pass `{ offlineFixture: true }`. That flag is not acceptance, and nothing in the app passes it. No UI or data is wired. |
| `resolveLaterPeriod` (§2) | Uses the first actual period starting after the window, with the exact league identity. If no actual period exists, it falls back to the labelled 7 days after the window, and never in place of a known ineligible period. The horizon is checked against the captured `forecast-calendar-v1` policy: `[decision date, decision date + calendarDays − 1]`, with the stricter of the UTC and league-local readings at each end, inside the same season. Actual dates are kept whole: no clipping and no fallback swap. Invalid policy, window or period, an ambiguous period, a mismatched league or an overlap gives `unknown`. |
| `sourceTiming` / `selectSourceRow` (§3) | The v2 witness, as above. Order must hold: `inputCutoff ≤ issuedAt ≤ availableAt ≤ decisionAsOf`. Issue and input ages must each be ≤ 8 × 24 h, measured inclusively on UTC instants. Reconstruction runs are excluded. Rows must pass h1 admission. Selection takes the greatest `availableAt` among rows with a valid witness, with ties broken by (`issuedAt`, `runId`, basis game), and never by slate order. Age ceilings then apply to the selected row. |
| `boundaryRosters` (§6) | Reuses `buildTimeline(...).at(far future)` for P, so the planner's own step legality applies: adds, drops, reserves, and a chain ending on its last held streamer. N is the frozen roster. An illegal plan gives `unknown` (`plan_illegal`). |
| `evaluateArm`, the private adapter (§4–§6) | Builds an in-memory derived snapshot: context = F, frozen roster, F schedule, zero banked stats, no opponent and no locks, with F's own goalie-minimum period. It adds one marked scenario row per F game with the row's real conditioning (`scenarioUse: "later_impact_informational"`, every native `allowedUses` false). It scores both arms through `evaluateScenarioPlan`, using the evaluator's own lineup, eligibility, totals, category values and coverage, with no duplicated scoring. Only numbers, states, coverage and the lineup come back; no forecast object does. |

## The `planning.ts` hook (exact diff summary for the forecast lead)

There is one hook: a module-scoped flag with one setter. The diff is +17/−1 lines in three places.

1. **`forecastAllows`.** Added `LATER_IMPACT_USE = "later_impact_informational"`, a private `let scenarioUse: … | null = null` and a `scenarioMark(forecast)` reader. One line is inserted after the existing conditioning check:
   ```ts
   if (scenarioUse || scenarioMark(forecast) !== undefined) return scenarioUse !== null && scenarioMark(forecast) === scenarioUse && use !== "conditionalTieBreak";
   ```
   - **Flag unset (every weekly caller):** a row without a `scenarioUse` property follows the original line unchanged. A row *with* one is refused for every use, even if its native `allowedUses` are all true.
   - **Flag set:** only marked, unconditional rows are allowed, for assignment, totals and comparison. Every unmarked row is refused, and conditional tie-breaks are refused.
2. **`prepareEvaluation`.** When the flag is set, it calls `sanitizeForecastInputs` only and skips `resolvePlanningContributions(…, { consumer: "rso" })`. Scenario rows therefore never reach the native contribution resolver or its RSO use policy, as the contract requires: they are never passed to the native serving selector. When the flag is unset, the call is unchanged.
3. **`evaluateScenarioPlan(snapshot, intent, objective, use)`.** This is the only setter. It requires `use === LATER_IMPACT_USE`, refuses nesting, and refuses any unmarked forecast or any `baselineSources`/`participationSources`. It sets the flag, calls `evaluatePlan(snapshot, { ...intent, steps: [] }, objective, [], false)` (frozen roster, no bench evidence), and clears the flag in `finally`. It returns `forecastInputs: []`.

The evaluator is synchronous, so no weekly call can run while the flag is set. A throw still clears it (tested). In weekly lineup mode, the evaluator's aggregate rows spread the original row, so they inherit the mark. They are read only for assignment. `forecastAllows` behavior for weekly callers, shared permissions and the weekly context are unchanged. The isolation harness below checks this byte for byte.

## Result states (contract §5)

| State | Raised by (reason codes) |
| --- | --- |
| `complete` | Both arms fully evidence-backed: every required component, denominator and eligibility is known, and the evaluator total is finite. |
| `complete_with_assumptions` | `reserve_conservative_zero:<id>` (the conditional line is kept in `conditionalLines`), `assumed_period_not_league_confirmed`, and `category_lineup_schedule_capacity`. The last one applies because F has no opponent, so the category lineup is chosen by schedule capacity. Labels are carried into both arms and the result. |
| `conditional` | `conditional_line:<id>`: a conditional or per-appearance skater line, or **any goalie with F games**. Goalies are conditional even when tagged unconditional: no start extrapolation and no zero fill. |
| `unknown` | `no_source_row`, `source_not_admitted`, `historical_reconstruction_excluded`, `conditioning_unknown`, `missing_component:<id>:<key>` (taken from the evaluator's coverage), `membership_unverified`, `membership_after_decision`, `team_mismatch` (a trade, or a row's team or season), `schedule_incomplete`, `schedule_range_mismatch`, `schedule_stale` (the evaluator's 36 h witness), `plan_illegal`, `evaluator_illegal`, `evaluator_total_unavailable`, `unknown_player`, `selection_invariant_breach` (defensive, unreachable), and the §2 period rejections. |
| `outside_scenario_horizon` | `beyond_calendar_policy` or `season_boundary`. The period's actual dates are kept, and arms are not evaluated. |
| `temporal_provenance_unavailable` | `missing_witness`, `no_exact_output_witness` (`finished_at`, `updated_at`, `run_status`), `immutable_publication_unavailable`, `missing_receipt`, `untrusted_capture`, `capture_time_invalid`, `capture_after_decision`, `row_not_in_capture`, `checksum_mismatch`, `missing_set_checksum`, `unbound_witness`, `missing_timestamp`, `timestamps_out_of_order`, and `capture_not_coherent`. |
| `stale` | `issue_age_exceeded` and `input_age_exceeded`. |
| `scenario_contract_not_accepted` | The app path and default, always, today. |

How states combine:

- **Weakness order:** complete < with assumptions < conditional < unknown < stale < temporal provenance unavailable < outside horizon < not accepted.
- **Delta:** takes the weaker arm. Numbers appear only when both arms are numeric. There are no partial totals.
- **Identical gaps:** identical unknowns in P and N weaken each arm and never cancel.
- **Three distinct cases:** a verified no-game player (`coverage.noGamePlayers`) is not missing, and neither is a non-applicable statistic (for example, a goalie stat for a skater). A missing line makes the arm unknown. Reserve and out players are in `coverage.notInLineup` and need no line.
- **Categories:** report native component deltas and pooled ratios (`numerator`, `denominator`, `value` per arm and delta), with no scalar.

## Tests

`futureImpact.test.ts` has 64 tests. All fixtures are synthetic, with independent oracles (an exhaustive daily lineup search, and rate × games sums).

- **Gate:** the default and app path give `scenario_contract_not_accepted`; the weakness order.
- **§2 horizon:**
  - a near-term pass;
  - a far-future window with fresh sources → outside;
  - an actual period straddling a 14-day bound kept whole, with no fallback;
  - the season boundary (by dates and by period season);
  - the assumed fallback (null, empty, and no later period), labelled in both arms and the result;
  - an irregular 10-day period;
  - a custom window spanning two periods → the third;
  - the UTC vs New York decision date (stricter end);
  - ambiguous, mismatched-league, invalid-period, invalid-policy and invalid-window cases.
- **§3 timing and witness:**
  - issue and input age at 8 × 24 h −1 s, exact and +1 s;
  - DST (8 wall-clock days = 193 h → stale; exactly 192 h → ok);
  - a valid pre-D capture with saved provenance;
  - 16 provenance-unavailable cases: finish time with acknowledgement after D, stale-run failure `finished_at`, `updated_at`, run status, missing immutable version, missing receipt, no witness, same-key overwrite checksum change, post-D capture, capture of other rows, unbound receipt, untrusted reader, missing set checksum, non-finite timestamp, reversed cutoff, issue after capture;
  - several codes kept together;
  - no backdating;
  - coherence (split receipts) and a partial capture;
  - reissued old-cutoff data → stale;
  - reconstruction excluded;
  - selection by `availableAt` and tie-breaks, not slate order;
  - a broken newest row skipped;
  - admission;
  - a stale row propagating to the arm and delta;
  - reload under two fake system times giving byte-identical output.
- **§6 rosters and evaluator:**
  - P and N rosters, a two-leg chain ending on its last streamer, and a reserve move;
  - slot displacement: on the 9th the new C takes C, `a` moves to UTIL and `b` is benched, while N plays `b` at UTIL. ΔF = oracle = 5.25;
  - a chain's held streamer scored;
  - IR players need no line;
  - an illegal plan.
- **§4–§5 states:**
  - §2.6 claims (complete, missing basis, outside the bound);
  - no-game vs missing line;
  - incomplete, unverified-off-day, range-mismatched and stale schedules;
  - a trade, membership after D, unverified membership, and a row team mismatch;
  - identical unknown goalies (no cancellation);
  - conditional goalies (both tags);
  - reserve zero vs missing line;
  - absent conditioning tag;
  - a conditional skater line;
  - native units and null components;
  - a non-applicable goalie stat;
  - pooled categories (G, SOG, SHPCT = ΣG/ΣSOG; deltas exact; no scalar);
  - a known G with a missing SOG denominator → unknown, no partial totals.
- **Leakage and isolation:**
  - marked rows are refused by `forecastAllows` for all four uses even with native uses true, while the same row unmarked is allowed;
  - the weekly `evaluatePlan` on marked rows gives null, and the native resolver strips them;
  - the entry point rejects unmarked rows, a wrong use and baseline sources, and the hook clears after throws (weekly output byte-identical before and after);
  - the result JSON contains no `scenarioUse`, `allowedUses`, `forecastInputs`, `stats` or `revisionId`, and the input is not mutated;
  - `planRoster` and `evaluatePlan` stay byte-identical with the scenario run vs not, for points, categories and missing data.

`planning.test.ts` is unchanged. The hook's tests live with its only caller.

## Isolation harness (S3 on/off vs accepted S1 `081fcb849`)

`run-isolation-harness.sh` (this folder) is adapted from `../S1/run-primary-harness.sh`. It runs the RSO engine tests (`planning`, `candidatePlanMetrics` and `streamingChain`; 234 tests) with four weekly entry points wrapped. Each call runs the S1 engine (`081fcb849`) and the working tree twice: once plainly (**off**), and once right after `evaluateScenarioPlan` has run over a marked copy of the same snapshot (**on**). It deep-compares the **full** output. The only exclusion is `planRoster`'s `search.elapsedMs`, so weekly scores, primary recommendation, alternative order, beam and pruning disclosure, streaming chains and no-move results are all covered.

```bash
tasks/artifacts/rso-wave2-2026-10-25/VORP/S2/run-isolation-harness.sh <empty scratch dir>
```

| Entry point | Calls | Scenario exercised | Mismatches vs S1, off | Mismatches vs S1, on |
| --- | --- | --- | --- | --- |
| `planRoster` | 123 | 123 | **0** | **0** |
| `evaluatePlan` | 238 | 238 | **0** | **0** |
| `candidatePlanMetrics` | 74 | 74 | **0** | **0** |
| `buildStreamingChains` (direct) | 1 | 1 | **0** | **0** |

**Negative control:** with `BASE=5453d2eca` (pre-S1), the same harness reports 92/123 planner, 67/74 Best Fit and 1/1 streaming mismatches, and 0 for `evaluatePlan`. Those are S1's intentional alternative fields, so the comparison does detect real differences.

## Commands run (from `web/`) and results

| Command | Result |
| --- | --- |
| `npx vitest run lib/rosterScheduleOptimizer/futureImpact.test.ts` | passed, 64 tests (rerun after the type fix) |
| `npx vitest run lib/rosterScheduleOptimizer components/RosterScheduleOptimizer __tests__/components/RosterScheduleOptimizer` | This lane, 17:36Z: passed, 46 files, 1,149 tests. Orchestrator, 17:40Z, same code: 1,147 of 1,149. Two tests timed out under machine load (load average about 15): the 1000-player 13-day planning test and the RosterScheduleOptimizer "reloads shared schedule data for manual" test. Both pass when run alone (13-day test 2.0 s). Neither touches `futureImpact`. |
| `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit` under `/private/tmp/fhfh-heavy.lock` (waited for another holder, then took it and released it) | Before the fix (17:41Z): exit 2, with two `futureImpact.ts` TS2345 errors, because `"ok"` was passed to `weakerState`. Fixed by real narrowing with no casts: `weakerState` is generic over `LaterImpactState`, a `weakerTiming` helper handles `"ok"`, and a no-row result with an `"ok"` timing now weakens to `unknown` with `selection_invariant_breach:<id>`. That last path is unreachable through `selectSourceRow`, whose no-row states start at `unknown`, so it has no test. After the fix (lock taken 17:42:58Z, released 17:44:05Z): exit 2, with **only** `lib/player-cards/currentNhl.test.ts(94,53)` TS2775. That file is another lane's uncommitted work outside RSO, and the error was already there. |
| `npx eslint --max-warnings 0 lib/rosterScheduleOptimizer/futureImpact.ts lib/rosterScheduleOptimizer/futureImpact.test.ts lib/rosterScheduleOptimizer/planning.ts` | passed, exit 0 |
| `run-isolation-harness.sh` (final code) | Run after the fix: 0 mismatches off and on for every entry point (`planRoster` 123, `evaluatePlan` 238, `candidatePlanMetrics` 74, streaming 1). The run before the fix and the orchestrator's run match. |

An earlier pass against the v1 witness code also passed: 46 files and 1,135 tests, and `tsc` exit 0. It was superseded by the v2 rerun above.

Not run: full `npm run lint`, the whole unit suite, Playwright and `npm run build`. There are no UI, SCSS or data changes.

## Limitations and notes for review

- **Set checksum.** It is required and saved, not recomputed. Its hashing scheme belongs to the S3 capture.
- **No opponent in F.** The category lineup is therefore schedule-capacity chosen, labelled `category_lineup_schedule_capacity`, so a category result is at best `complete_with_assumptions`. Points lineups are quality-chosen by the evaluator.
- **Goalies.** Any rostered goalie with F games makes that arm `conditional`, per §4. Today, a whole-roster ΔF number needs a goalie-free F schedule.
- **Selection.** Rows with a broken witness are skipped, and the newest valid one is chosen. This is v2's "among admitted rows with a valid exact-output witness". If no row is valid, the union of all reason codes is reported.
- **Duplicate reasons.** When a player is skipped (missing row, team mismatch, unknown conditioning), the evaluator's coverage also reports `missing_component:<id>:<key>` for the same games. Both codes are kept, per v2 §5.
- **Inputs for S3.** The engine takes membership, schedule, receipts and source rows as plain inputs. S3 owns producing them, including the server-side capture, the wire and save schema, and the §8 byte budgets. §8 storage and round-trip cases are not testable in S2, because there is no schema yet.

## sha256 of touched files

```
b67dcefe6bda50d41653123f15ca53aa0535e1713f79407e6d31c0eeac6ef88e  web/lib/rosterScheduleOptimizer/futureImpact.ts        (new)
f28d04be9b913f82bbf469b392751eab45dc2c53cd1c0c78dbd1f83819675aaf  web/lib/rosterScheduleOptimizer/futureImpact.test.ts   (new)
a6f6dbb477e39135654dee2d9d5464dce8c346980b39cfc94233be58d7f052ae  web/lib/rosterScheduleOptimizer/planning.ts            (baseline 3eae2c8a…)
3b0dbc56b1bb65d3526bc3001faa1e5fc12914c58c8f5f44fa717ef518c7fbf4  web/lib/rosterScheduleOptimizer/planning.test.ts       (unchanged = baseline)
dc7e5173a69bc67b9045d9a21ecb19b59568ea2b6a96b7387b16be712889c13c  tasks/artifacts/rso-wave2-2026-10-25/VORP/S2/run-isolation-harness.sh (new)
```

Built against `S3-SCENARIO-CONTRACT.md` v2, sha256 `2f31491a6a63f52e2b6ec3f4eba6633928a14c1d4f6e625283eccf31fb7acca5`. This lane did not edit it. This receipt and the diary `tasks/diaries/2026-10-29-claude-rso-future-impact.md` are also touched; they are written last, so their hashes are not listed.
