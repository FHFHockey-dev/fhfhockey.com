# FORGE Dashboard Component Remediation Closeout

## Status

The original remediation parents are complete. Option A is deployed with an authenticated weekly owner; the remaining Top Adds constraint is the explicitly retained prospective non-zero in-season evidence gate rather than missing implementation or cron ownership.

The refreshed component matrix contains 4 green, 3 yellow, and 3 red components. Red and yellow are deliberate operational classifications, not hidden failures.

## Production Trust Repairs Completed

- Production release commit `9d5cbb4749c101765f34aaff7826f048219c195f` is deployed as Vercel deployment `dpl_8n73AQz5yDZAfqQWuArXUgopbVBw` and serves `fhfhockey.com`.
- The deployed player-trend writer route exposes the expected POST-only contract; a GET returns 405 with `Allow: POST`.
- `player_trend_metrics_game_date_idx` is applied in production. The latest-date plan uses an index-only scan with no sort and completes in 2.842 ms.
- Active dependency ordering is WGO job 44 at 09:35 UTC, incremental NST team job 275 at 09:55, CTPI job 279 at 10:10, and team-power job 283 at 10:15. Full NST job 329 remains independently scheduled at 10:55. Player-trend job 392 runs at 12:00.
- Bounded production probes completed successfully: CTPI wrote 32 rows in 3.50s; team power wrote 32 rows in 3.59s and returned 32 distinct non-zero `trend10` values; player trends processed 52,153 source games in 17.33s and truthfully emitted no rows for the empty offseason seven-day window.
- Dashboard ownership reads are cap-safe, use Yahoo start-year season semantics, and join projections through stable NHL IDs rather than normalized-name fallback.
- CTPI, skater movement, and ownership freshness metadata now reflect source recency rather than request time. Dashboard/landing routes warn about materially mixed source dates.
- Date, mode, fallback, and return-path context are preserved through landing, dashboard, team, player, and explicit Trends handoffs.

## Verification

- Focused dashboard freshness, performance, ownership, and route group: 46/46 passed.
- Focused dashboard, landing, team, and player route group: 31/31 passed.
- Full Vitest gate after NEW 14 repairs: 399 files and 1,852/1,852 tests passed.
- `npx tsc --noEmit --pretty false`: passed.
- `npm run build`: passed, including type checking, optimized compilation, static generation, and sitemap generation.
- Production reconciliation confirmed 32 CTPI teams, 32 current team-rating rows with distinct trends, latest-eligible player trend data, same-day Start Chart data for the audited healthy scope, and truthful stale/blocked responses where current data does not exist.

## Components Promoted

- Team Trend Context: green after writer, pagination, schedule, and non-flat trend repairs.
- Team Drill-In: green after selected-date and stale-context continuity verification.
- Player Drill-In: green for route and scoring-context continuity; it does not override the separate weekly source gap.
- Route Navigation and Click Contract: green after date/mode/fallback/return-path regressions.
- Dashboard Slate: yellow because Start Chart behavior is healthy but an approved historical goalie-coverage exception remains.
- Hot/Cold and Trending: yellow because the current offseason source is latest-eligible and explicitly blocked as stale rather than misrepresented as current.
- FORGE Landing: yellow because its route behavior is repaired but its aggregate status inherits mixed source availability and retained component quarantines.

## Quarantine Retained

- Top Player Adds remains red for week mode. Production run `a40bd44b-98d4-4506-a3c4-90b2efa3985f` has 255 rows for `horizon=1` and zero for `horizon=5`; job 393 now owns future five-game output, but the first prospective non-zero in-season result is still required for promotion.
- Sustainability remains red for the owner-approved historical 2026-03-07 to 2026-03-20 `l10` gap. No present-day backfill may be represented as historical truth; prospective same-day evidence is required for promotion.
- Goalie and Risk remains red for the owner-approved missing 2026-03-29 FORGE-goalie rows. The reader must continue blocking the 2026-03-26 fallback; prospective same-day evidence is required for promotion.

## Remaining Decision and Exact Next Action

The owner selected option A on 2026-07-11. Daily job 308 remains the horizon-1 owner at 10:05 UTC. The weekly contract uses a separate `horizonGames=5` execution at 10:12, after the daily writer's 4m30s ceiling plus buffer. Same-date daily and weekly runs are compatible: the reader scans succeeded runs for the exact requested horizon and does not treat a newer other-horizon run as authoritative.

Local regressions prove both sides of the contract: a same-date weekly run is served even when the newest run owns only horizon 1, and a missing horizon-5 output produces an explicit blocked response/UI error rather than a healthy empty. No one-game row may be scaled or labeled as five-game output.

Production activation completed on 2026-07-12. The exposed credential was rotated in Vercel and Supabase Vault, all 60 affected commands were migrated (58 active and 2 inactive), the old token returned 401, and the new token returned 200 through a non-mutating auth probe. Daily job 308 and weekly job 393 use Vault-built headers; job 393 is active at 10:12 UTC. Keep Top Adds red until the first prospective non-zero in-season horizon-5 run.

## Follow-On Optimization Ownership

The existing remediation backlog continues to own lower-priority calibration, composite naming, duplicate-control, goalie-chain, rolling-pipeline, and legacy-reuse work. Those items do not override the red/yellow classifications or the explicit NEW 13 release gate.
