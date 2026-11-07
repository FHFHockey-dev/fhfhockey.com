# VORP S1 receipt: keep distinct drops

Lane `RSO-ALT-DROPS` (Claude, 2026-10-29). Stage S1 of `../ASSESSMENT.md`. Local edits and offline tests only. No commit, push, deploy, production or Yahoo access, migration, `PROJECTIONS_*` read, or Next dev server. Every leased file matched its lease baseline sha256 before editing.

## What changed

The rule throughout: **existing outputs stay exactly as they were, and alternatives are added beside them.** Nothing is re-ranked, no new number is invented, and every alternative's totals are its own evaluator-certified ones.

| Place | Before | After |
| --- | --- | --- |
| `candidatePlanMetrics.ts` (Best Fit) | A plan with ≥ net AGP and ≥ net points discarded a plan with a different drop. One representative per candidate. | The same `plans` and dominance rule (so the representative, `activePoints` and `activeGames` are unchanged). New `CandidateComparison.alternatives`: for each sort order, the best legal plan of each of the top **3** dropped-player sets, when `plans` doesn't already hold it. `alternativesTruncated` counts the further sets. New `candidateAlternativeForSort(comparison, sort)` returns the best plan with a different drop set than the representative. |
| `planning.ts` (planner beam) | Beam kept `beamWidth − 1` states per depth and objective. The list showed the first `alternativeCount − 1` plans in score order, often all with the same drop. | The main search, budget and frontier are unchanged. **Beam reserve:** at each pruned depth, up to **2** pruned states per objective whose drop set no kept state has are given one more move after the search. That pass runs only when the main search finished within its own work and time bounds, and is capped at one phase budget. Its plans are alternative-only. **List:** places 0 (no move) and 1 (best plan) are unchanged. Up to **2** of the remaining places go first to the best plan of a not-yet-shown drop set; the rest fill in the old order; everything after the best plan stays in score order. Disclosure: `Beam reserve: N of M pruned plans with a different drop were offered one more move as alternatives only (E new evaluations); deeper sequences for them are unexplored.` The existing "Beam width pruned…" line and `search.complete = false` remain whenever pruning happened. |
| `streamingChain.ts` | `top(ones)` / `top(twos)`: one chain per spot count. | `chains` and `recommended` are unchanged. New `alternatives`: the best certified chain for each initial-drop set the offered chains don't start with, ranked by the same chain order, top **3**, with `alternativesTruncated`. These come from chains already built and certified, so there is no extra search. The type is `StreamingPlanWithAlternatives` in `streamingChain.ts`, because `planningTypes.ts` is outside the lease. |
| `StreamingItinerary.tsx` | Picker showed the offered chains. | Alternatives follow in the picker as `Alternative · drop <name> · ±n AGP`, never marked "suggested". Choosing one shows "Alternative with a different first drop, not the suggested plan. Its totals are its own checked plan." |
| `CandidateBrowser.tsx` | Card only. | Under a card: `Alternative: drop <name> · Net Pts ±x · Net AGP ±y` (Net Pts is omitted in category leagues). Ranking still uses the representative alone. `CandidateCard.tsx` is untouched. |

Preserved, with no edit to `retention.ts` or `lineupGaps.ts`: league legality, `budgetVerified`, protections, reserve, out and unknown gates, no-move, and goalie-minimum ranking. Alternatives come from the same proposal generators and the same evaluator. There is no defenseman bonus, no future value (ΔF) and no data or forecast change.

Caps used: Best Fit 3 drop sets per sort; planner `BEAM_RESERVE = 2` (per depth and objective) and `DISTINCT_DROP_SLOTS = 2`; streaming `ALTERNATIVE_DROPS = 3`. These are bounded searches. Nothing here claims an exhaustive search.

## Primary results are byte-identical (old vs new on the same inputs)

`run-primary-harness.sh` (this folder) runs the pre-S1 test files with the three engine entry points wrapped. Each call runs the pre-S1 engine (`5453d2eca`) and the working-tree engine on the same input and deep-compares the primary output:

- `planRoster`: everything except list places after index 1, the new "Beam reserve" line, `elapsedMs` and the streaming alternatives fields. This includes `selected`, `baseline`, no-move plans, `alternatives[0..1]`, `scheduleFits`, `noClaimContinuations`, `search` (evaluated, candidates, complete, bench evidence, other limitations) and the streaming `chains`, `recommended` and `limitations`.
- `candidatePlanMetrics`: everything except each candidate's `alternatives` and `alternativesTruncated`. This covers `plans`, `diagnostics`, `points`, `activePoints`, `activeGames`, `baseline` and `search`.
- `buildStreamingChains`: everything except `alternatives` and `alternativesTruncated`.

```bash
tasks/artifacts/rso-wave2-2026-10-25/VORP/S1/run-primary-harness.sh <empty scratch dir>            # pre-S1 tests (HEAD)
tasks/artifacts/rso-wave2-2026-10-25/VORP/S1/run-primary-harness.sh <empty scratch dir> worktree   # + the new S1 tests
```

| Fixture set | Calls | Primary mismatches |
| --- | --- | --- |
| Existing (HEAD) tests, 223 passing | Best Fit 69, planner 111, direct streaming 1 | **0 / 0 / 0**; streaming `chains` identical in all 111 planner calls |
| Existing + new S1 tests, 234 passing | Best Fit 74, planner 123, direct streaming 1 | **0 / 0 / 0** |

## Alternatives before and after (existing fixtures, same harness)

| Surface | Before | After |
| --- | --- | --- |
| Best Fit: distinct drop sets available across 380 candidates | 469 | **637** (+169 alternative plans; 0 sets truncated). 13 of 69 calls changed. |
| Planner list: plans shown after "no move" | 339 | 339 (same count; membership changed only beyond the best plan) |
| Planner list: distinct drop sets shown | 145 | **151**. 6 calls gained sets and none lost any. 18 calls ran the beam reserve. |
| Streaming (via planner): offered chains | 39 | 39 (identical) |
| Streaming: initial-drop alternatives | n/a | **24**, in 12 calls |

With the new S1 fixtures included: Best Fit drop sets 474 → 654 (4 truncated); planner sets 177 → 188; 25 calls ran the beam reserve; streaming offered 60 chains plus 49 alternatives.

## New tests (synthetic, with independent oracles)

`candidatePlanMetrics.test.ts`, "distinct drop alternatives (VORP S1)". The oracle is an exhaustive assignment (`exhaustiveDayPoints`, extended for UTIL) over every allowed drop.

- (a) + (b): the first two ordered drops (the only two D) are poor (+4 and +3, −1 AGP), and the third (u1) wins (+5, 0 AGP), dominating both in the window. `plans` keeps only u1, as before. The alternatives are exactly d1, d2 and c1, each at its exhaustive best. `candidateAlternativeForSort` gives d1 by points and c1 by starts.
- (d): a D candidate with a valuable UTIL: dropping the weakest D is still right (+9). The other D (+8) is the alternative. c1 (−40) is past the cap and reported in `alternativesTruncated = 1`.
- (e): protected, provider-out (`O`) and IR+ players never appear as a drop in `plans` or `alternatives`.
- Cap: five interchangeable drops give two alternative sets per sort and `alternativesTruncated = 2`.

`planning.test.ts`, "distinct drop alternatives in the planner (VORP S1)". The oracle sums each all-C roster independently.

- (b): pure score order would list four r3 drops (19, 18, 17, 16). The list is now r3 19, r3 18, r2 12, r1 11, each matching the oracle's best for its drop. `alternativeCount: 2` gives the identical first two entries.
- Beam reserve: with `beamWidth: 2`, only the reserve pass reaches the r1 + r2 roster (oracle +22). The disclosure reads `4 of 4`; the beam-pruned line and `complete = false` stay; the best plan matches a wide-beam run.
- (e): provider-out r1 and protected r2 are never dropped in the reserve or the list.

`streamingChain.test.ts`, "streaming chain alternatives (VORP S1)":

- (a): with most starts, the first two ordered drops trade a start for a start, and the third (g3) gives the only chain (+6 AGP). No alternatives are invented for the poor drops.
- (c): with best points, the offered chains are unchanged (two-spot d1 + d2, one-spot d1). The alternatives are d1 + g3, d2 + g3 and d2. g3 alone is fourth and counted in `alternativesTruncated`. Each alternative is legal and budget-verified, and its net games and points equal its own evaluation minus the baseline. Oracle: with every other drop protected, the planner's own chain for d2 equals the d2 alternative exactly.
- (e): protected, out and IR+ players never start or continue a chain.
- Protecting g3 changes only the alternatives (leaving `["d2"]`); `recommended` and `chains` are identical.

UI: `StreamingItinerary.test.tsx` checks the labelled alternative button, the note, its own totals, and that selecting it sends its steps. `CandidateBrowser.presentation.test.tsx` checks that the alternative line shows its own numbers and that cards still rank by the representative.

## Commands run (from `web/`) and results

| Command | Result |
| --- | --- |
| `npx vitest run lib/rosterScheduleOptimizer/candidatePlanMetrics.test.ts lib/rosterScheduleOptimizer/streamingChain.test.ts lib/rosterScheduleOptimizer/planning.test.ts components/RosterScheduleOptimizer/CandidateBrowser.presentation.test.tsx __tests__/components/RosterScheduleOptimizer/StreamingItinerary.test.tsx` | passed, 5 files, 268 tests |
| `npx vitest run lib/rosterScheduleOptimizer components/RosterScheduleOptimizer __tests__/components/RosterScheduleOptimizer` | passed, 45 files, 1,085 tests |
| `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit`, under `/private/tmp/fhfh-heavy.lock` (free when taken, released after) | passed, exit 0. The first attempt without the heap flag ran out of memory, so it was rerun with it. |
| `npx eslint --max-warnings 0` on the 10 touched source and test files | passed, exit 0 |
| `run-primary-harness.sh` (HEAD tests, then worktree tests) | 0 primary mismatches; numbers above |

Not run: full `npm run lint`, the whole unit suite, Playwright, and `npm run build`. There were no SCSS changes; the new elements reuse existing classes.

## Limitations and notes for review

- Planner reserve-pass plans can outscore a listed plan, but are never placed above the best plan. They compete only for the distinct-drop places, and the rest of the list stays in score order.
- The new disclosure adds one string to `search.limitations` whenever a reserve was taken. That is the only change to the planner's search metadata.
- In the streaming points-first fixture, the games-best g3 chain is fourth by points and truncated. The cap follows the chain objective. Show-both-objectives is a candidate for S4.
- `CandidateBrowser` shows the alternative line whenever one exists, so most cards will gain a line in real leagues. Display wording and density belong to S4.

## sha256 of touched files

```
4fdeaded7cd7c1412da1defa269541786478a153af8a30e0af6b6e60f3cee835  web/lib/rosterScheduleOptimizer/candidatePlanMetrics.ts
f2c15fd91aa0c20b1a01b8ecb1fa84d63de3a3e544c2ad3a0fbc41bf3a2dbfd0  web/lib/rosterScheduleOptimizer/candidatePlanMetrics.test.ts
3eae2c8a5aef6a40457750879603d173393858fc1a30a923df99ecdb629eae01  web/lib/rosterScheduleOptimizer/planning.ts
3b0dbc56b1bb65d3526bc3001faa1e5fc12914c58c8f5f44fa717ef518c7fbf4  web/lib/rosterScheduleOptimizer/planning.test.ts
4ae8fae63e2903ceb4c1e7e006e54906728510d3cde2f0eaf7e1d47dea9fcd4c  web/lib/rosterScheduleOptimizer/streamingChain.ts
0f96ce24389e2278fd94bba314d2420f14e6260cd275cb17afd74d29c5f1407e  web/lib/rosterScheduleOptimizer/streamingChain.test.ts
d9380c4178077971dbcaeca1ae478cd63af419ef8ee875a7bff1c93f6b49d8f1  web/components/RosterScheduleOptimizer/StreamingItinerary.tsx
60ccee0401f914ba526403c270b0707e309fe56e7442d2c8b964e573bb9bd8fe  web/__tests__/components/RosterScheduleOptimizer/StreamingItinerary.test.tsx
5fbab4edbb3280bceadfc9ee4c158d9e3ab6c2f69700b29d772c33822aa128d5  web/components/RosterScheduleOptimizer/CandidateBrowser.tsx
59790f4a33f63e1ab594945fa2f494a595d694506445e07ccb42f4af9ab1d179  web/components/RosterScheduleOptimizer/CandidateBrowser.presentation.test.tsx
d93537ef79e6da655a2433dbf2401d74ab9be2e1e32602b8ffadee6c71a20d70  tasks/artifacts/rso-wave2-2026-10-25/VORP/S1/run-primary-harness.sh
```

The diary `tasks/diaries/2026-10-29-claude-rso-alt-drops.md` is updated after this receipt, so its hash is not listed here.
