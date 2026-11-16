# Fix lane L2-landing (player/goalie half of L2), 2026-11-11

## Scope
Player + goalie landing server, goalie files, player/goalie APIs and pages (file split of L2; L2 = team/xg/shared helpers). Findings: W2-P0-2, -3, -4, -5 (+W1 P0#4), -7, W1 P0#2 display, W1 P0#5, P1 list (D10/PR-U2/PR-U4, D12, D19, PR-U1, PR-U3/A1, D8+d94, D14+d96, D16, DR1, HD/SC labels).

## Where
octoberBranch, sole checkout. Claim appended to CLAUDE-TO-CODEX.md (CLAUDE-FIX-L2-LANDING-CLAIM-20261111). No Codex claim on these paths in CODEX-TO-CLAUDE tail.

## State / checks
- start: reading code.
- 19:05 New API-level harness: `web/__tests__/pages/api/v1/underlying-stats/landingMathFixture.ts` + `landingMath.test.ts` (fake Supabase, summary partitions written by the real refresh, read through the goalie/player/detail/chart route handlers).
- Failing on current code (before fixes): MD GA 2 vs 1 (allStrengths, tied, chart); GSAA -0.49 vs 0.2 (detail); unclassifiedGoalsAgainst/gsax absent; skater fiveOnFourPP → no row (split key pk); PBP fallback 5v4 goal 0 (away-first strength_exact compare), tied faceoffs/shots wrong (goal-only score fields, shots ignore score state); sort shootingPct desc → [null,null] first. Passing already (L1 parity): goalie PK orientation, skater PP/5v5/4v5 PK, parity score-state TOI (only the MD double failed there).

- Commits: 9a8f1c8bd (P0s + display + GSAA + distance + mailbox claim), 5ef993a62 (D8/d94, D14/d96, D16, D19).
- Checks: vitest underlying-stats player/goalie/API: 22 files, 187 tests pass. eslint changed files exit 0. typecheck exit 2 with 11 errors, none in my files (GoaliePage L3, xg test L14, 3 old api routes).
- Failing-first shown: landingMath (all P0s), position test vs HEAD queries, last-N test vs HEAD server, Row ordinal (old "Rank"/"1").

- 1922c6f3c: L2 shared predicate adopted; "#" column = server competition rank or paged ordinal; ratings overlay (handed over by L2) current-only with offense/defense dates. Overlay test fails on HEAD overlay (3/3), passes now. Vitest underlying-stats: 292 tests, only L2's in-progress xgExplorer fails. eslint 0. typecheck exit 2: 69 errors, all in L5 rankings and L2 xgExplorer (in progress).
- PR-U1: N/A in my files (no unified/QS read; goalies.js is L3). D12: team-side, done by L2. DR1: needs a decision (goalie refresh routes in pages/api/v1/db write goalie_underlying_summary_partitions; readers read nhl_api_game_payloads_raw).

- 857732315: PBP-only bucket-heuristic ixG retired (null). 90c6ace50: DR1 / decision 110 goalie readers on goalie_underlying_summary_partitions with formulaRevision 2 freshness, completeness via all/all partition, shared then raw fallback; seeding guard. 4 failing-first route tests. 306 tests pass; eslint 0; typecheck 2 errors (L5 rankings test only).
- Release-order hazard (goalie pages empty/heavy until goalie rebuild) reported to Chef; plan updated.

- 40b7cc4d3: decision 111 recalculating note (summaryStatus, not cached while pending) + page tests updated for earlier display changes (missed in earlier runs: __tests__/pages/underlying-stats). 363 tests pass; eslint 0; typecheck exit 0. Rebuild plan: step order added. Lane closed pending Chef ack.

## Next
- NOT done (usage limit): D10/PR-U2/PR-U4 sweep (scan found no unknown->0 in my readers beyond addNullable partial sums for hidden xG / FHFH SC fields: needs coverage flags), D12 official overlay provenance test, PR-U1 (goalieStatsServer has no advanced/unified read: likely N/A, verify), DR1 goalie-only refresh vs reader source.
- Rebuild plan: side-session note L2-landing-rebuild-plan.md.
- Ticket sent to L2: playerStatsSorting.test.ts xgfPct -> cfPct.

## Blockers

## Insights
