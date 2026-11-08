# RSO drop retention and future impact: assessment and staged plan

Claude orchestrator, 2026-10-29. Replies to `tasks/artifacts/rso-vorp-research-2026-10-29/RESEARCH.md` and `CLAUDE-HANDOFF.md`. This is planning only. No code, data, production, Git or deploy action was taken.

## Freshness

- `octoberBranch` HEAD `5453d2eca`. `git diff fec2ba2d2 HEAD` over `web/lib/rosterScheduleOptimizer`, `web/lib/rosterScheduleData` and `web/components/RosterScheduleOptimizer` is empty, and none of those paths is dirty. The research's pinned links describe the current code.
- No RSO session is running. All linked RSO sessions are idle, and nothing in flight touches the files below.

## Verdict

The design contract is sound and matches existing requirements: PRD line 118 ("Recommend drops only when both usable remaining contribution and projected value support the move against realistic replacements") and tasks T4 RSO-08 (future alternatives) and RSO-09 (safe drops, ranked alternatives, no-move). Adopt it with three corrections from the code:

1. **Most of the evaluator can be reused.** `evaluatePlan(snapshot, intent, objective, steps)` already does legal slot assignment, eligibility, locks, goalie handling and pooled category components for whatever dates the snapshot's `context` covers. A future-window value is that same evaluator run on a derived snapshot: context = F, roster = the boundary roster after P (or N), no steps. That gives ΔF as a whole-roster difference with no new scoring code and no second VORP penalty.
2. **The binding gap is data, not modelling.** The snapshot holds games only for the selected window (`planningInputs.ts:160`, ±1-day padding). FORGE bridge forecasts are read only through today + 6 days, one game ahead each (`forgeDailyBridge.ts:24-26`, `horizon_games === 1`). The payload budget is 2.5 MB of forecast wire bytes. Today, F has no admitted forecasts and no games, so ΔF can only be *unknown*. That is the correct output until a forecast source for F is approved.
3. **Safer alternatives disappear before any future value could save them.** Four places keep one winner by selected-window value alone. That can be fixed now, independent of ΔF, by keeping the best plan *per distinct dropped player* within disclosed caps.

## Reuse

| Need | Existing piece | Fit |
| --- | --- | --- |
| Whole-roster value over F | `evaluatePlan` on a derived snapshot | Direct reuse; needs F games and forecasts in the snapshot. |
| Boundary roster after P | Plan steps (add/drop/reserve, `effectiveAt`) | Small pure helper: apply the steps to the roster. A chain ends holding its last streamer. |
| League-specific replacement pool | Yahoo `players;status=A;sort=OR` league discovery, with a `complete`/`partial` flag (`rosterPlanning.ts:673,715`) | Real league availability, not platform ownership. Current only; future availability stays a scenario. |
| Category tradeoffs | `swapCategoryBreakdown`, pooled components, `categoryComparisonVerified` | Reuse unchanged for F. No scalar. |
| Goalie minimum | `rules.goalieMinimum`, `goalie.expectedStarts` | Applies per period. F's minimum is the next period's and starts from zero credited. |
| Ownership caution | `retentionCaution`, high-demand text | Keep as display only. It is not replacement value. |
| Draft VORP hook | `web/hooks/useVORPCalculations.ts` | Do not import; it is draft-pool based. |

## Where alternatives are lost today (all bounded, some undisclosed)

| Place | Behavior | Fix direction |
| --- | --- | --- |
| `retention.ts` `knownDropOrder` → `lineupGaps` DROP chip | Lowest selected-window contribution first. | Keep the order. Add a future note only when ΔF is known. Never use a D bonus. |
| `candidatePlanMetrics.ts` dominance (`retain`) | A plan with ≥ netAGP and ≥ netPoints discards a plan with a *different* drop. | Dominate only within the same drop set, or add ΔF as a third dimension when known. Keep max 2–3 drop variants per candidate. |
| `candidatePlanForSort` representative | One plan per candidate is shown. | Also expose the best plan with a different drop as "alternative". |
| `planning.ts` beam (`beamWidth` 8, `orderStates`) and first-two-drop proposals | States ranked by window objective; others pruned (`beamPruned` reported). | Reserve beam slots for distinct boundary rosters, and keep the `beamPruned` disclosure. |
| `streamingChain.ts` `top(ones)` / `top(twos)` | One best chain per spot count; `PAIR_DROPS = 4`, `GUARANTEED_DROPS = 3`. | Keep the best chain per distinct initial drop (top 3). The displayed totals stay the certified ones. |

## Gaps and blockers

- **F schedule.** Cheap: the same schedule read with a later end date. Changes the payload, so it needs the byte-budget check.
- **F forecasts.** None admitted. The bridge already stands in each player's latest daily projection for remaining window games. Extending that stand-in to F is a forecast-use decision for the FORGE/forecast-contract owner (Codex reservation on `web/lib/projections/**` and `web/lib/player-forecasts/**`). To fit the budget it should be a per-player rate times F games, not per-game rows.
- **Future availability and claim success.** Unknown. The first version holds both boundary rosters fixed with no further moves, labelled as such. Replacement shown separately as a diagnostic from today's observed league pool.
- **Historical shadow evaluation.** No archived decision-time league snapshots (rosters, pool, rules, forecasts) exist that I know of. Report this as a blocker rather than substituting today's data. The R-window results are aggregate read counts, not snapshots.
- **Ownership.** Codex holds a scope reservation (not an editing claim, as of 2026-10-28T04:00Z) over `web/lib/rosterScheduleOptimizer/**`, `rosterScheduleData/**` and the RSO components. Releases #395–#398 were edited here with TJ's approval. Before any edit, register an exact lease in `CLAUDE-LEASES.json` and post it to the mailbox.

## Staged path

Each stage is offline, locally tested, and changes no current ranking or displayed weekly number unless a later stage says so.

1. **S1: Keep distinct drops (search preservation).** Files: `candidatePlanMetrics.ts`, `streamingChain.ts`, `planning.ts` (beam ordering only), and their tests. Keep the best plan per distinct drop set within caps; report truncation. Synthetic fixtures where the first two drops are poor, and a window-dominated plan with a different drop. Compare against an exhaustive small-fixture oracle. Weekly winners and totals stay byte-identical (assert).
2. **S2: ΔF engine with unknown output.** New pure module `futureImpact.ts` and a test. Boundary-roster helper, derived-snapshot evaluation, fixed-roster continuation, explicit `unknown` with reasons when F games or forecasts are missing (today: always unknown in production). Fixtures cover every case in research milestone 2, including "a D is the right drop" and "the incoming player is a long-term upgrade". Also a separate replacement diagnostic from the observed pool.
3. **S3: F inputs (needs approvals).** F schedule plus a per-player rate stand-in, behind a flag, within the payload budget. Needs the forecast owner's agreement and TJ's horizon choice.
4. **S4: Display (informational).** Window gain unchanged; "Later (dates): ±x" beside it, with assumptions; a "safer alternative" row when one survives S1 with better known ΔF; no-move always shown. No re-ranking.
5. **S5: Ranking change**, only after a TJ-approved objective and, where possible, shadow evidence. Categories stay native-component tradeoffs with no scalar.

## Decisions for TJ

1. Start S1 now? It needs no new data or permissions; only the lease registration.
2. First future horizon: the next matchup week after the selected window, or the next 7 days after it.
3. Presentation: informational only first (no re-ranking), or opt-in ranking objective.
4. Whether to ask Codex for the F forecast stand-in (S3).

## TJ decisions, 2026-10-29 (pop-up)

1. **S1: start.** Keeping a viable alternative per drop can change which alternatives are shown, even when the weekly score and primary recommendation stay the same. Test both explicitly, and keep league legality and existing protections.
2. **Horizon: the next actual league matchup period** when known (`yahoo_matchup_weeks`). If the league's period isn't available, label the dates and the assumption instead of treating seven days as confirmed. Keep it separate from the current period.
3. **Display: informational first.** Weekly benefit and later impact shown separately, plus a safer alternative when supported. No invented number when future forecasts or replacement data are missing. Ranking changes are evaluated after validation, not made silently.
4. **Forecasts: ask Codex now**, naming exact files, dates, provenance and fallback. Approval to investigate or extend the stand-in is not proof that later-period projections are accurate.

Lease `RSO-ALT-DROPS` registered in `CLAUDE-LEASES.json` before any edit. Mailbox: CLAUDE-20261029-127 (lease), CLAUDE-20261029-128 (forecast request).

- **S2 timing (TJ pop-up, 2026-10-29):** start S2 once S1's receipt is verified, so the two never share files.
