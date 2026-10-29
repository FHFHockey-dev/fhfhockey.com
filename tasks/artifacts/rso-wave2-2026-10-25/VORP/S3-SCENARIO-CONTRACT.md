# RSO later-impact rate scenario: proposed use contract (v1, for forecast-lead disposition)

Claude orchestrator, 2026-10-29.

- **v1** applies all four amendments from `CODEX-RSO-CLAUDE129-S3-V0-REVIEW-20261029` (`tasks/artifacts/rso-forecast-coordination-2026-10-29/CLAUDE-129-S3-V0-REVIEW.md`, sha256 9f8026f8…). It supersedes v0 (sha256 6e4bf911c0b3df3e9e58b78a7957f10710a9018015eeaedb3da16755f06433df).
- It also adopts every requirement in `CLAUDE-127-128-DECISION.md` (sha256 291b2a24…).

This is a proposal only. It activates nothing, grants no native forecast use, and serves no number. Until the forecast lead accepts it, ΔF is `unknown` with the reason `scenario_contract_not_accepted`.

**What the 8-day figure is.** It is a provisional offline ceiling on source and input age for investigation. It is not evidence of accuracy, and it is not a prospective horizon: §2 bounds the horizon separately.

## 1. Name and scope

- **Name:** `rso-later-impact-rate-scenario`, version `v1`. It is a separate payload with its own version, never a `GameForecast` that is returned or persisted, never a native admitted revision, and never fed into weekly totals.
- **Single permitted use:** an informational whole-roster comparison over the later period F. It compares the frozen boundary roster after a plan with the frozen boundary roster after no move.
- **Not permitted:**
  - lineup assignment or totals in the selected window;
  - adding ΔF to the weekly gain;
  - ranking, sorting, selecting, suppressing or pruning anything weekly;
  - a second VORP or position penalty;
  - claims of calibration or accuracy.

## 2. The later period F and its horizon bound

1. **Default F:** the first actual, unambiguous league/provider/season matchup period that starts after the selected window ends.
   - League time zone and date convention.
   - The league identity must match the workspace's league. A season-wide `game_key` row alone is not proof.
2. **Fallback F:** the 7 calendar dates after the window, labelled "assumed period, not league-confirmed". It is used **only when no actual league period is available**, never to replace a known period that is ineligible.
3. **Horizon bound, independent of source age.** This uses the captured planning calendar policy at decision time, `forecastCalendarPolicy` (`forecast-calendar-v1`; default 14 calendar days, valid 1–21; `player-forecasts/contributions.ts:9-17`). The policy is saved with the scenario.
   - Every F date must lie within `[decision date, decision date + calendarDays − 1]` under the policy's named UTC convention.
   - Where the league-local date and the UTC date differ, the stricter (earlier-ending) reading applies.
   - F must lie in the same season as the decision.
   - If any date of an actual period falls outside, the result is `outside_scenario_horizon`. The actual dates are kept, with no clipping and no relabelled slice, and the fallback is not used instead.
   - This is a proposed operational bound, not accuracy evidence. Any other bound needs an explicit contract change.
4. **Rejected F:** overlap with the window, an invalid interval, or ambiguous or mismatched league identity gives `unknown`.
5. **Schedule and team coverage:**
   - Complete, fresh schedule and verified off-day evidence for the *same full F*, plus current verified team membership for every player in both boundary rosters.
   - All of it is known, or the result is `unknown`.
   - A trade or membership mismatch gives `unknown`.
   - For an earlier decision, membership history is never rebuilt from today's roster.

## 3. Source admission, timing and age

- **Admission:** succeeded, public, released h1 FORGE daily rows that pass the existing external-input exclusion proof.
- **Timestamps:** finite, ordered and saved, as `inputCutoff ≤ issuedAt ≤ availableAt ≤ decisionAsOf`.
  - `issuedAt` keeps the bridge's current meaning (`forge_runs.created_at`, `forgeDailyBridge.ts:296-300`). It is not proof of availability.
  - `availableAt` is a reliable completion or publication witness. The proposed witness is the run's finalization time (`finished_at`, set at finalize in `run-lifecycle-queries.ts:112`), subject to the forecast lead's confirmation. `updated_at` is not a witness.
  - A missing, non-finite or reversed timestamp, or a run that finalized after the decision, gives `temporal_provenance_unavailable`. No timestamp is ever guessed.
- **Age ceilings (provisional, offline):** both issue age `decisionAsOf − issuedAt` and input age `decisionAsOf − inputCutoff` must be ≤ 8 × 24 hours of elapsed time.
  - Ages are measured on UTC instants, so DST cannot shift them. They are non-negative, and the boundary is inclusive.
  - Older rows are `stale`, which reads as `unknown`.
  - These ceilings do not restrict the historical span of a model's legitimate long-term features.
- **Historical reconstruction runs** (`run-forge-projections.ts:574-576`) are **excluded** from v1 whatever their issue time. Making them eligible would need a separately reviewed rule.
- **Selection:** among admitted rows, the row with the greatest `availableAt` ≤ decision. The tie-break is (`issuedAt`, `run_id`, basis `game_id`). It is never chosen by slate order. `as_of_date` stays the slate date and is not lookahead proof.
- **Fixed decision clock:** a saved scenario keeps its original `decisionAsOf` and its evidence. Reload never substitutes "now" or re-issues. Re-evaluation creates a new, separately identified scenario.

## 4. Rate basis and conditioning

- **Skater rate:**
  - Native per-game components from the selected row, in native units.
  - The rate policy is `last-available-line-per-game`.
  - No season-rate substitutes are filled in.
  - The rate applies only to F games of the player's verified current team.
- **Conditioning:** an unconditional basis must be established positively from the source's conditioning field. A missing tag means `unknown`, not unconditional.
- **Conditional lines:** a conditional or per-appearance line is never multiplied by scheduled games into an unconditional expectation.
- **Reserve rows:** a reserve conservative zero is a labelled assumption, not evidence of absence. Its conditional line is kept beside it.
- **Goalies:** `conditional` or `unknown`. Starter probability is not extrapolated, and there is no assumed one-start-per-game and no 0 fill.
- **No other sources:** no `PROJECTIONS_*` tables and no synthetic zero for a missing line.

## 5. Result states and aggregation

**Per-arm and result states.** Each arm (P and N) and the delta carry exactly one state:

| State | Meaning |
| --- | --- |
| `complete` | Every required input is evidence-backed. |
| `complete_with_assumptions` | Complete only by using named assumptions, such as a reserve zero. The labels are carried into both arms and the result. |
| `conditional` | Rests on at least one conditional line, such as a goalie or per-appearance line. |
| `unknown` | Something required is missing (the reason is given). |
| `outside_scenario_horizon` | An actual-period date falls outside the §2 bound. |
| `temporal_provenance_unavailable` | Required timing evidence is missing or out of order. |
| `stale` | A source row exceeds an age ceiling. |
| `scenario_contract_not_accepted` | The forecast lead has not accepted this contract. |

**Coverage rule.** For points and categories alike, every *required active scoring component* must be known in **both arms**. That includes:

- category numerators and denominators;
- relevant appearances and starts;
- eligibility and lineup constraints.

Three cases are kept distinct:

- a non-applicable statistic;
- a verified no-game opportunity (a complete schedule with an off day);
- missing required data.

Only the third makes a result unknown.

**Propagation:**

- Any relevant conditional or unknown goalie, component or schedule input makes the affected full total and the delta `conditional` or `unknown`.
- There are no partial totals, and identical unknowns in P and N are never treated as cancelling out.
- The delta takes the weaker state of its two arms.
- A partial or conditional diagnostic may be shown only with its scope named, such as "skaters only, goalies unknown". It is never labelled whole-roster ΔF.

**Numeric output.** ΔF = value(P, F) − value(N, F) is shown as a number only when both arms are `complete` or `complete_with_assumptions`. In the second case the assumption labels are shown with it. Categories show native component deltas and pooled ratios only, with no scalar.

## 6. Evaluator boundary and weekly isolation

- **Fixed rosters:** boundary rosters for P and N are built by applying the plan steps, including a chain's last held streamer, reserves and drops. Both are frozen, and no transactions are allowed in F.
- **Reuse, no duplication:** scoring is reused from the existing evaluator without duplicating or broadly refactoring it, through **one private scenario adapter** in the new `futureImpact.ts`:
  - It builds an in-memory derived snapshot (context = F) and in-memory forecast objects. These are marked with a scenario-only use, `later_impact_informational`, and keep their real conditioning.
  - They are evaluated through a scenario entry point that accepts only that scenario use. The weekly path never sets it.
  - Existing `forecastAllows` behavior for weekly callers is unchanged, as are shared permissions and the weekly context.
  - The objects are never returned, persisted or passed to the native or legacy serving selector.
  - The exact hook, a narrow parameter on the internal evaluation, is settled in S2 after S1 releases `planning.ts`, and it is shown to the forecast lead before S3 serves anything.
- **Isolation invariants:** with S3 on versus off, ignoring the new annotation fields, these must all be identical:
  - weekly scores;
  - the primary recommendation;
  - candidate and alternative order;
  - beam, frontier and pruning decisions;
  - streaming chains;
  - the no-move result.
  - The comparison baseline is the accepted S1 output, so S1's intentional alternative changes are not mistaken for S3 effects. A "safer" annotation never selects, sorts or suppresses weekly options.

## 7. Provenance (server-admitted, saved, not response-only)

The following is saved with every scenario:

- **Source row:** `run_id`, slate date, basis game, player, team, season, and the source-row checksum.
- **Timestamps:** `created_at`/`issuedAt`, `availableAt` with the witness kind, `inputCutoff`, and the replay or reconstruction classification.
- **Versions:** model, bridge, rate-policy and contract versions.
- **Data meaning:** native component units and conditioning.
- **Proof:** basis, hash and reference.
- **Context:** the captured calendar policy, F dates and period identity (actual or assumed), schedule and roster revisions, `decisionAsOf`, and the limitations.

Client-supplied labels or checksums alone never create admission or a use permission. Old snapshots without the scenario stay valid and show `unknown`.

## 8. Payload

- **Budget:** the combined payload is measured as bridge wire + scenario rates + F schedule + provenance + other response fields. Existing limits still bind: 2.5 MB bridge wire, 6 MB expanded, and 4,000,000-byte planning/workspace transport.
- **When a complete scenario cannot fit:** the truncation is disclosed and the number withheld (`unknown`). A partial result is never shown as complete.
- **Schemas:** strict schema plus wire, save, export, preservation and old-snapshot round-trip tests.

## 9. Offline acceptance cases (behavior and provenance only, not calibration)

- **Timing:**
  - source age just below, exactly at and just above 8 × 24 h, for both issue and input age;
  - a DST boundary;
  - missing or reversed timestamps;
  - created before the decision but published after it;
  - recently reissued old-cutoff data;
  - a historical-reconstruction run;
  - reload not resetting the clock.
- **Horizon:**
  - a near-term period that passes;
  - a far-future selected window with a fresh source, which gives `outside_scenario_horizon`;
  - an F straddling the horizon boundary;
  - a season boundary;
  - a known actual period that is ineligible and must not be swapped for the fallback;
  - the assumed fallback when no actual period exists.
- **Periods:** an irregular actual period; a custom window spanning two periods; UTC and league date boundaries; incomplete schedule versus verified off days; a trade.
- **States:**
  - a known points component with a missing category denominator;
  - unknown goalie coverage in otherwise identical rosters, where there is no cancellation;
  - reserve-assumed zero versus a missing line;
  - an absent conditioning tag;
  - conditional goalies;
  - native units and nulls.
- **Evaluator:**
  - an adapter-leakage fixture: scenario rows never reach weekly, native or legacy paths, or persistence;
  - two boundary rosters with slot displacement;
  - points and pooled categories;
  - S3 on/off invariants across points, categories and missing data.
- **Storage:** strict schema/wire/save/export/old-snapshot round-trip and combined byte budgets.

## 10. Owner and exact paths

- **S2 (no shared data files):**
  - A new lane at start registers exact paths and absence for `web/lib/rosterScheduleOptimizer/futureImpact.ts` and `futureImpact.test.ts`.
  - It also registers the narrow `web/lib/rosterScheduleOptimizer/planning.ts` hook only after S1 releases that file.
  - It runs on synthetic snapshots and always yields `unknown` in the app. TJ: start once S1's receipt is verified.
- **S3 (data):**
  - Lane `RSO-S3-SCENARIO`. It takes the exact-path handoff recorded as proposed in `CLAUDE-LEASES.json` (`FORGE-RESERVE.handoff_proposed_2026-10-29`):
    - `forgeDailyBridge.ts`(+test);
    - `bridgeForecastWire.ts`;
    - `rosterScheduleData/planning.ts`(+test).
  - The handoff takes effect only when that lane starts with TJ's go-ahead. At start it registers baselines for `planningInputs.ts`, `workspaceSchema.ts` and any transport/type files it names.
  - It is offline only until the forecast lead accepts the contract.

## Correction carried from v0

The bridge reads runs through now + 7 days (`forgeDailyBridge.ts:24-27,736-740`). The producer covers today through today + 6, and `horizon_games = 1` is the per-game basis. Neither establishes next-period coverage.
