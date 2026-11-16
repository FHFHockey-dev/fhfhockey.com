# fix-f14 goalie OT split + odds pairing (Astra AF-03, AF-04), 2026-11-13

## Scope
- AF-03 (P1, decision 45): FORGE `teamWinProbability` OT split `f/(f+a)` -> shared 50/50 rule (`overtimeRule.ts`). Keep regulation/tie model (shrink 0.75, tie x1.33).
- AF-04 (P1, conditional on market use): goalie h2h de-vig from complete, fresh, same-book, same-snapshot pairs before aggregation; no stale fallback; reject untimestamped.
- Freeze 18:30 UTC.

## Where
- `octoberBranch`, sole checkout. Owned: `web/lib/projections/goalie/goalieOutcomes.ts`, `web/lib/projections/queries/market-queries.ts`, `overtimeRule.ts` (helper only), their tests; goalie served-output fixtures in `goaliePipeline.test.ts` (test-only, appended).
- Not touched: `goalie-stage.ts` (Codex; call sites :381-384 keep 3-arg/2-arg signatures), F12/F13/F7/F15 files, L22 `game-predictions/**`.

## Decisions
- AF-03: route through `finalWinProbabilitiesFromRegulation` with the team in the home slot; exact because the rule is side-neutral (homeShareOfTie 0.5). Test tripwire asserts 0.5 so a future home edge forces this consumer to pass the side.
- AF-04: quotes carry `source_observed_at`/`freshness_expires_at`; helper pairs per book (exactly one quote per side, same observation time), de-vigs each book proportionally, median across books. Summary-level averages no longer feed the goalie path. `isFreshAt` requires both timestamps and observed <= now <= expiry; the all-stale fallback is gone (affects prop summaries too: stale props now yield no summary).
- Market flags, from code: no flag gates FORGE's `market_prices_daily` read (preflight always fetches); `LEDGER_MARKET_ENABLED=false` gates only the ledger scoreboard. The writer route `update-market-prices` has no cron in either vercel.json. So the path is reachable but data-dependent: live only if rows exist for the run's snapshot date (decision 30 says ingestion is off).

## State / checks
- Committed `150e57cc0` (5 files). 8 new/changed tests fail on HEAD source, pass after.
- Focused: goalieOutcomes, market-queries, goaliePipeline, goalie/** -> 14 files, 173 tests pass. Neighbours (stages, run-forge-projections*, module-imports, player-forecasts, forge-served-forecast-snapshot, game-predictions) -> 56 files, 1612 pass.
- `npm run typecheck` exit 0; ESLint on the 5 changed files exit 0.
- goalie-stage.ts untouched; its 3-arg/2-arg calls unchanged.

## Gotchas
- Stale-fallback removal also applies to prop summaries (skater/goalie prop flags): stale props now give no summary instead of stale quotes.
- Hand-built h2h summaries without per-book timestamped quotes now return null (no market); tests updated.

## Next
- Report sent to Chef. Diary can retire once Chef records the outcome.
