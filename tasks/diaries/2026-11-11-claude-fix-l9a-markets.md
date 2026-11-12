# fix-l9a-markets (sub-lane of L9a), 2026-11-11

## Scope
Dormant sportsbook-market items (decision 30; odds ingestion stays off): BC W1-6 D4b (spread sign), D17 (yes-only de-vig monotone), D18 (lines averaged across books), W1-7 D6 (spread as cover probability vs de-vigged price per book), W3-4 N2 (`confidence_0_to_100` saturates).

## Where
- Branch `octoberBranch`, sole checkout. Owned: `web/lib/projections/utils/devig.ts`, `utils/market-output-builders.ts`, `queries/market-queries.ts`, their tests, and the game market-flag block of `run-forge-projections.ts` (~1049-1130).
- Mailbox: parent L9a claim `CLAUDE-FIX-L9a-CLAIM-20261111` covers `web/lib/projections/**`; Codex tail has no claim on these paths.

## Decisions
- D17: yes-only estimate is proportional (`implied / (1 + overround)`) only; the equal-margin path and its fallback are removed (that crossover made it non-monotone). A fitted power method needs data we do not have (ingestion off).
- D18: summaries carry per-book quotes (best source rank, fresh rows); `quotesFromMarketSummary` returns them, so the skater/goalie stage callers (not owned) get per-book quotes with no edit there. `averageLineValue` is null when books disagree on the line; `getConsensusLineValue` returns the modal per-book line.
- D4b/D6: spreads use P(home covers) from independent Poisson team means (the model's own team-goal distribution), OT rule stated: a regulation tie is settled by one goal (OT or shootout), so it never covers -1.5 and always covers +1.5; lines where the OT winner matters return unknown. Compared with each book's de-vigged pair; median across books at the modal line. Totals: same per-book path, Poisson total, nothing added for EN/OT (already in the means).
- N2: retire the value: flag rows write `confidence_0_to_100 = null`; the honest quantity goes in reasons as `edge_to_threshold_ratio` (unclipped |edge|/threshold). Column drop/rename = production step for TJ.

## State / checks
- New tests fail on HEAD (13 of 30 in devig/market-output-builders/market-queries tests; monotone test: +2400 gave .0370 after .0008); all 30 pass after. The game-flag tests fail on HEAD because no per-book builder existed; the old inline block on the same fixture gave margin - line = 0.8 - (-1.5) = +2.30 "model_home_cover"; now model_away_cover (P(cover) .3808 vs de-vigged .4356).
- Neighbour suites (utils, market-queries, goaliePipeline, goalieOutcomes, module-imports, servedForecastLedger, run-forge-projections*): 12 files, 167 tests pass.
- `npm run typecheck` exit 2: 9 errors, all in parent L9a's in-progress `queries/skater-queries.ts` and `stages/skater-stage.ts` (PK bucket); none in my files. ESLint on changed files exit 0.
- Gotcha: `market_inputs` in game prediction components now also carries per-book quotes (dormant; small).

## Next
- Commit, report to Chef. Production steps: none required; optional `confidence_0_to_100` drop/rename is TJ's call.
