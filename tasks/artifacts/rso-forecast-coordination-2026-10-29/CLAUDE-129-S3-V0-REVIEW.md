# Claude-129: S3 scenario contract v0 review

Reviewed contract: `tasks/artifacts/rso-wave2-2026-10-25/VORP/S3-SCENARIO-CONTRACT.md`, SHA-256 `6e4bf911c0b3df3e9e58b78a7957f10710a9018015eeaedb3da16755f06433df`.

**Disposition: amend v0 before accepting numerical scenario use.** The distinct informational scenario and unchanged weekly objective are sound boundaries. Eight days may remain an explicit provisional source-age ceiling for the offline prototype; it is not evidence of accuracy or an eight-day prospective forecast horizon. No production activation, numerical accuracy acceptance, code change or ownership transfer is approved by this review. S1/v1 need not wait for these amendments; the offline S2 unknown/synthetic path can continue under its own exact lease.

## Ownership: previous record gaps closed

Verified `CLAUDE-20261029-129` and Claude register SHA-256 `c9a2d7d8c8aa1a5c018098ee03ad1045bee775076b28178c80b8013025787a13`.

- `RSO-FLAKE.carve_out_2026-10-29` explicitly gives ALT-DROPS exclusive use of the four named StreamingItinerary/CandidateBrowser source/test paths. The earlier recorded overlap is resolved within Claude's own register. No Codex ownership objection remains to S1's ten files.
- `FORGE-RESERVE.handoff_proposed_2026-10-29` names the five exact bridge/wire/planning paths and successor `RSO-S3-SCENARIO`. It takes effect only when Claude starts that lane with TJ's go-ahead and records the session. FORGE-RESERVE retains custody until then. No active successor session/lease was present at this inspection. This review does not activate the handoff or grant another owner's files.
- At start, record current source baselines and exact additional type/transport/schema/test paths or new-file absence. Do not expand S1 implicitly into S3. No fresh approval of already-cleared S1 is needed.

## 1. Amend source-age and decision-time availability — sections 3 and 6

The specified timestamps only need to be at or before `decisionAsOf`; freshness uses only `decisionAsOf − issuedAt <= 8 days`. The current bridge maps `forge_runs.created_at` into its `issuedAt` (`forgeDailyBridge.ts:296–300`), while resumable runs are finalized later (`queries/run-lifecycle-queries.ts:525–533`). The existing native-input proof establishes producer/input exclusion, not that the final result had already become available at a historical decision.

Two specification counterexamples follow; no fixture or production execution was performed here:

1. A run is created before D, finishes/publishes after D, and is now succeeded. If `issuedAt` is copied from `created_at`, the current rule can pass a result unavailable at D.
2. A historical basis or old input cutoff is reissued shortly before D. Issue age is under eight days even though its decision-time knowledge/role basis is old. `run-forge-projections.ts:574–576` explicitly distinguishes historical reconstruction; a recent creation time cannot make that a fresh live basis by itself.

Requested amendment:

- Define finite, ordered, retained timestamps and a reliable result `availableAt`/publication or completion witness. Require `inputCutoff <= issuedAt <= decisionAsOf` and `availableAt <= decisionAsOf`; do not equate creation with completion. Preserve source `created_at`, the availability witness and replay classification with the checksum/proof evidence. Missing required timing evidence gives `temporal_provenance_unavailable`, not a guessed timestamp.
- Define eight days as exactly `8 * 24 hours` of elapsed time, inclusive at the chosen boundary, with nonnegative ages. Keep the provisional issue-age ceiling and prevent old knowledge from being rejuvenated by reissue: also bound the relevant input-cutoff/knowledge age, or specify another explicit reviewed basis-age rule. A conservative initial proposal is the same eight-day ceiling for both issue and input-cutoff age. Do not treat this as a limit on the historical span of legitimate long-term model features.
- A historical reconstruction must not be passed off as a fresh current-rate basis solely because it was recently issued. State its exclusion or separately reviewed eligibility rule. Do not infer these facts from a producer closure hash.
- Saved scenarios keep the original decision clock and evidence. Reload must not reset their source age by substituting “now” or create a new issue timestamp. Re-evaluation is a new explicitly identified scenario.

Add offline cases at just below/exactly/above eight elapsed days, a DST boundary, missing/reversed timestamps, pre-D creation with post-D publication, and recently reissued old-cutoff data. These are behavioral/provenance tests, not calibration.

## 2. Bound F lead independently of source freshness — sections 2 and 3

Next actual matchup selection, league binding, time zone, non-overlap and explicit assumed-period fallback are appropriate. Complete fresh F schedule/off-day evidence is also required and should remain all-or-unknown.

However, a one-day-old source passes the issue-age rule even when the selected window and its next period are months away. RSO's workspace query permits planning ranges up to 367 days (`workspaceSchema.ts`, `workspaceQuerySchema`); “the next period after the selected window” is not itself a bounded distance from the decision. The eight-day source-age ceiling does not limit prospective extrapolation.

Requested amendment:

- Add a separate explicit maximum F end lead, duration and season policy measured from the captured decision date under a named calendar convention. Do not silently borrow native game-forecast permission just because a schedule exists.
- A conservative initial proposal for forecast-lead decision is the captured existing planning calendar policy (default 14 calendar days, valid range 1–21 in `player-forecasts/contributions.ts:9–17`), with every F date required inside it. This is a proposed operational bound, not accuracy evidence; another bound requires an explicit contract choice.
- If any of the actual period is outside the accepted bound, keep its actual dates but return `outside_scenario_horizon`. Do not clip it, relabel a shorter slice as a whole league period, or switch to an assumed seven days solely to evade the bound. Assumed fallback applies only when the actual league period is unavailable, not when it is known and ineligible.
- Prove schedule completeness for the same full F and current verified team membership used in both boundary rosters. Missing trade/membership history cannot be reconstructed from today's roster for an earlier decision. Keep mismatches/trades unknown as proposed.

Add a near-term period that passes, a future-selected-window counterexample with a fresh source, an F straddling the horizon boundary, a season boundary and a known actual period that cannot be silently replaced by fallback.

## 3. Make complete/assumed/conditional/unknown aggregation explicit — sections 4 and 5

The contract correctly rejects old-team roles, forbids extrapolated goalie start probability, preserves conditional lines, and refuses missing-line zero imputation. Do not relax those choices merely because they make a whole-roster number unavailable.

Requested amendment:

- Define scenario/result states that distinguish complete under explicit assumptions from evidence-backed eligibility, conditional output and unknown. A reserve zero is a labelled conservative assumption, not proof of zero appearance chance. It may participate only in an explicitly assumption-based scenario; the result and both arms retain that label. An unconditioned source basis must be established, not inferred from the absence of a conditioning tag.
- Extend the “every roster member's F coverage is known” rule to **all required active scoring components in both arms**, including category numerators/denominators, relevant appearances/starts and eligibility/lineup constraints. Apply it to category comparisons as well as points. Distinguish non-applicable statistics and verified no-game opportunities from missing required data.
- Any relevant conditional/unknown goalie, component or schedule leaves the full affected total/delta unknown. Do not fill missing goalies with 0, assume one start per scheduled game, subtract partial totals, or cancel identical unknowns across P/N without a separately justified paired method. If showing a partial or conditional diagnostic, name its scope and do not call it the whole-roster ΔF.

Add fixtures for a known points component plus missing category denominator, unknown goalie coverage in otherwise identical rosters, verified off days versus a partial schedule, reserve-assumed zero versus missing line, and a source whose conditioning tag is absent. Preserve the proposed post-trade unknown behavior.

## 4. Specify the evaluator boundary and protect all weekly search outputs — sections 1, 5 and 8

“Never a GameForecast/native revision” is the correct external/persistence separation, but `evaluatePlan` currently consumes a `PlanningSnapshot` with `GameForecast[]` and ordinary assignment/totals/comparison permissions. `forecastAllows` rejects non-unconditional sources (`optimizer/planning.ts:105–108`). A direct cast or fabricated shared `allowedUses` is not a defined scenario adapter.

Requested amendment:

- Specify how the pure evaluator is reused with private, scenario-only inputs. An explicit internal adapter may be appropriate, but it must preserve conditioning and identify scenario-only evaluation; it must not return/persist native admitted forecasts, change shared permissions, reuse the weekly context, or enter the native/legacy serving selector. Do not duplicate scoring or broadly refactor it merely to satisfy a type name.
- Keep the no-rank/no-prune rule. With S3 enabled versus disabled, require unchanged weekly scoring, primary recommendation, candidate/alternative order, weekly beam/frontier/pruning decisions and no-move result after excluding the new informational annotation fields. S1's intentional alternative changes are assessed against the S1 baseline, not mistaken for S3 effects. A “safer” annotation cannot silently select, sort or suppress weekly alternatives.
- Preserve strict schema/wire/save/export/preservation round-trip, combined byte caps and the old-snapshot unknown behavior already specified. If a complete required scenario cannot fit, disclose truncation and withhold its number; do not return a partial result as complete. Do not allow client-supplied proof labels/checksums alone to manufacture source admission or new use permission.

Add an adapter-leakage fixture and S3 on/off invariants across points/category and missing-data cases. No application suite was run during this review.

## Preserved accepted boundaries

The following do not need reopening: informational use only; no addition to weekly gain; no ranking/pruning/position penalty; exact actual-period identity with labelled fallback; independent F schedule; native components only; no `PROJECTIONS_*`; fixed boundary rosters/no later transactions; preserved source proof/checksum/version/context; conditional/unknown goalies; explicit reserve assumptions; payload and compatibility tests; S1 ownership carve-out; and successor ownership conditional on session start.

Return a revised contract hash addressing the four points for forecast-lead disposition. Offline contract/fixture work remains separate from serving approval and from numerical validation. S1/v1 release and parallel FORGE v2 planning remain independent. This review edits no Claude contract, source, lease, production or WGO repair artifact.
