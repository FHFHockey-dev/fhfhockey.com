# Fix lane L5 diary (Claude, 2026-11-11)

## Scope
Brief: `tasks/artifacts/calculation-inventory-2026-11-10/master/fix-lanes/L5.md`. Rankings goalie/team/player matrices, last-N window counts (W2-P0-9/10/11, W1 P0 #10 consumer), W3-6 N1, W2-4 D3/D5/D6/D7/D8/D9/D10/D11/D12/D13/A1/A2/A3, W2-6 §3 team unit TOI, decision 90 mid-rank percentiles.
Owned: `web/lib/rankings/**`, `web/components/Rankings/**`, `web/pages/rankings.tsx`, `web/pages/api/v1/rankings.ts`, `web/lib/splits/**`, `web/lib/ratings/**`.

## Where
Branch octoberBranch (sole checkout). Claim appended to CLAUDE-TO-CODEX.md (CLAUDE-FIX-L5-CLAIM-20261111). No Codex claim on owned paths in last 60 lines of CODEX-TO-CLAUDE.md. Owned files clean at start.

## State / checks
- e922bb6c0: decision 90 mid-rank in `rankingCalculator.ts` (singleton 50; ties shared); fixtures/tests updated; explanation/legend text reworded. Before fix, 21 tests in lib/rankings failed with the change (tie/singleton expectations); all 422 lib/rankings + components/Rankings pass after. eslint 0.
- Ranks stay dense (existing explicit rule); brief said "competition" — flag to Chef.
- Sub-sessions started: fix-l5-goalie (local_4feaa76e…, goalieMatrix/goalieMethodology/goaliePopulation/splits/lib/splits/GoalieMatrixTable/SplitsPanel: W2-P0-9, D9, 104, 106, 98) and fix-l5-team (local_9094aefb…, teamMatrix/teamStyleMethodology/xgDenominatorSemantics/teamUnitToi*/TeamMatrixTable: W2-P0-10, A1, W2-6 §3, 102).
- D10 reader is `web/lib/underlying-stats/entityRatingsOverlay.ts` (L2's file, decision 91) → ticket to Chef, not mine.

## Next
Skater: W2-P0-11 + N1 + D5 + D6/D8/A2 (skaterWindowAggregation, rollingRankingSelectFields, rankingQueries, playerMatrix), D3 luck, D7/A3 composites, D12 season resolver.

## Resumed
- ee075a1b5: L14 ticket (decision 100): adjusted-impact promotion refused unless emptyNetTreatment.validation === "validated" (3 new cases fail on old code).
- f5d60829a: W2-P0-11, N1, D3, D5, D6, D8/A2 (support join in rankingQueries, deploymentTiers, composite source loader, luck; new GAx/60 & Unrealized xG/60). New tests fail on old code (10 in skaterWindowAggregation, 4 in resultsLuckSources, 1 in playerMatrix), all pass after. eslint 0.
- Typecheck run 1 (before luck/playerMatrix): exit 2; errors only in goalie-session WIP (`GoalieTeamMatrixTable.test.tsx`, `__tests__/pages/rankings.test.tsx` goalie types) + my resultsLuckIndex.test (fixed).
- TJ by pop-up: Quality Start = original Vollman (SV% ≥ league avg, or ≥ .885 with ≤ 20 shots). Relayed to fix-l5-goalie.
- Sub-sessions resumed (goalie, team). Team ticket accepted: forward min_gp in buildTeamMatrixRequestPath + show min-GP control for teams.

- e6c7b4c01 composites (D7/A3, 74, 102); 87dfa76ea D12 + team floor; 6c236b079 goalie page wiring (L5a ticket).
- Sub-lanes done: L5a e023c5ee5, 96a935599; L5b 2870d41cb.
- Final: vitest 57 files/535 tests pass; typecheck exit 0; eslint 0 errors.
- Full hand-over: side-session-notes/<chef>/L5-handover-2026-11-11.md.

## Next
Chef review. Deferred: decision 103 (L6 current-season counts), season SAX%/Offense/luck (L6 season iFF), D10 (L2), D11/D13 small items, BEAST re-evaluation.

## Chef verification (2026-11-11)
All 9 SHAs verified by Chef. Dense ranks confirmed (54f5cb7ae labels them). Routed: 103 + season iFF to L6; goalie season view to L4a; D10 to L2-landing (decision 91); splits/TeamDashboard QS labels to owners; BEAST re-evaluation to the debrief. Lane stays open only for decision 103: when Chef reports L6's season-truncated window counts, wire the current-season default with the actual n plus a labelled cross-season option (`windowMembership` in skaterWindowAggregation is ready).

## Decision 103 closed (daf4357b6)
L6 51ab213f3 currentSeason block consumed: current-season default (actual n), labelled cross_season view (rolling path only), season xS%/SAX% from season iFF totals, luck SAX baseline (neutral now publishes 100). New tests fail on HEAD module (3 aggregation, served route, luck). typecheck exit 0; eslint 0 errors. Lane closed pending Chef.

## Blockers / approvals
None yet.

## Insights
- L6 contract: `windowCountSupport` in support payload; absent = unknown. `_total_lastN` still holds RATE.
