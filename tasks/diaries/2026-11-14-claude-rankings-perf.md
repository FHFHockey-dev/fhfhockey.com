# 2026-11-14 Claude: Rankings offline slow-path review

## Scope
Offline review of Rankings read paths at deployed `89da739cb` (#446). Code + existing Vercel logs only. No new prod/app/DB/provider requests, no source edits, no git mutations. Parent: Chef session `local_a9638be4`.

## Where
- Branch `octoberBranch`, HEAD `9a312597e`; `git diff --stat 89da739cb -- <rankings paths>` (working tree) empty, so line numbers = deployed.
- Deliverable: `tasks/artifacts/rankings-acceptance-2026-11-14/perf/REPORT.md`.
- Bench: same folder — `rankings-perf.bench.test.ts`, `ladder-probe.bench.test.ts`, `vitest.perf.config.mjs`, `bench-results.json`, `ladder-probe-results.json`, run logs.
- Nothing committed (task said no git mutations).

## State / checks
- DONE. Report written; bench 12/12 passed + probe 1/1 passed, `fetchCalls = 0` (fail-closed).
- Skater paths traced myself; goalie/team + page fan-out via 2 read-only Explore agents, citations spot-checked.
- Vercel MCP: Pro retention 1 day (7d refused 400). 23h window 2026-11-14T02:13Z→2026-11-15T01:13Z: no Rankings records (handlers don't log on success → inconclusive); runtime errors 7d none. maxDuration 240 s.

## Next
- Chef decides whether to ask TJ for the 5-GET protocol in REPORT §5.

## Blockers / approvals
- Production GETs need TJ approval via Chef.

## Insights
- Fallback default matrix: common case 88 RT / 25k rows; full ladder 1,130 RT / 396k rows when any default 5v5 metric is never calculable (SAX% season needs L6 currentSeason.seasonTotals). Bench can't tell which case prod hits; GET 1 `meta.unavailableMetrics` does.
- CORRECTION (advisor): first draft claimed default comparison 400s — wrong, `uniqueNumbers` slices ids to 6 (rankings.tsx:1158-1166). Default comparison = one 50-row matrix build.
- First bench comparison-default run scanned 15 pages because `top` was built without clearing caches; fixed with clearAll().
- Durable default matrix ≈ 77 RT / 26k rows: entity_metric_rankings read with no entity filter, all ~17 metrics × cohort, per peer surface.
- Snapshot/comparison rebuild full matrix per 50-row page (durable last-page snapshot 864 RT).
- Selecting a skater row changes the matrix SWR key → full refetch. No debounce, no abort.
- Trending always rolling fallback; auto-fires on skater load.
- Vite blocks files outside web/ — use a perf-local config with `server.fs.allow` and absolute imports; `timeout` binary not on macOS.

## Follow-up (Chef): team matrix cost — DONE
- Appended REPORT §7. Team cold ≈ 42 RT / ~36k rows, ~39 sequential; `team_unit_toi` latest snapshot = whole season (nightly appends to current snapshot) ≈ 35 sequential 1,000-row pages, ~96% of rows, mostly discarded.
- Proposed (not edited): `.or("unit_type.eq.power_play,unit_number.eq.1")` in fetchTeamUnitToiRows (teamMatrix.ts:1338-1346); exact-semantics argument in §7.
- Addendum §7.1 (statement timeout): failing query = fetchTeamUnitToiRows page query (teamMatrix.ts:1338-1348). Schema has (season_id, snapshot_date, …) indexes; likely cause is random heap fetch of the whole snapshot per offset page + sort by game_date,id (no game_date index). Fix: same unit filter (index-resolvable); index only if prod lacks idx_team_unit_toi_latest (TJ).
