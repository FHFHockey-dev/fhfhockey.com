# FORGE PP fix: bounded derived-rebuild sizing (not run)

Lane forge-pp-fix, 2026-11-07. Candidate `refs/rc/forge-pp-fix-20261107-01`. Runs only after that candidate is released to production.

## What the fix changes in stored rows
- Goals, shots and assists credited at a pulled-goalie extra-attacker 6v5 move from PP to ES. A 6v4 goal during a penalty stays PP.
- Shootout attempts (period type SO, or period 5+ in preseason/regular season) are dropped from every bucket: player/team shots, goals and assists, and goalie shots against, goals allowed and saves.
- `toi_*_seconds` are unchanged because they come from shift_charts.
- The algorithm version is NOT bumped, on purpose. A bump would send every stored game back into the scheduled queue (3 dates per cron run, oldest first), which would hold back each night's new games behind about 330 backlog dates. An explicit date range rewrites rows anyway: the new rows change the derived fingerprint, so the RPC deletes and replaces them, and untouched games come back idempotent.

## Scope: exact counts (Q1, run once 2026-11-07 after the DB restart, statement_timeout 30s)
| Season / type | Dates | Games | derived_complete | Player / team / goalie rows (status) |
|---|---|---|---|---|
| 2025-26 preseason | 2025-09-20 → 10-04 (15) | 104 | 0 | — |
| 2025-26 regular | 2025-10-07 → 2026-04-16 (167) | 1,312 | 0 | — |
| 2025-26 playoffs | 2026-04-18 → 06-17 (51) | 105 | 1 | 38 / 2 / 2 |
| 2026-27 preseason | 2026-09-19 → 09-26 (8) | 65 | 3 | 117 / 6 / 9 |
| 2026-27 regular | 2026-09-29 → 11-06 (39) | 264 | 254 | 9,678 / 508 / 535 |

**Key finding: the current route can only rebuild 2026-27.** Only 258 games have a complete materialization status (1 from 2025-26 and 257 from 2026-27). The 2025-26 forge rows, which hold the 985 vs 789 PPG gap, were written by an older writer before the manifest and status pipeline existed. For those games, `build-projection-derived-v2` reads the manifest, finds it unavailable and skips the game as `projection_inputs_unavailable`. It does not fail and it does not rewrite. A 2025-26 correction needs its own decision:
- (a) leave 2025-26 as it is and flag it;
- (b) backfill the manifest and relationship stages for 2025-26 first (much larger, with its own sizing);
- (c) run a targeted correction script against the legacy rows (its own review).

**2026-27 rebuild (doable with the route as it is):** 47 dates (2026-09-19 → 2026-11-06), 257 complete games, about 9,800 player rows, 514 team rows and 544 goalie rows replaced. The 72 games without a complete status are skipped, the same as tonight.

## Requests and runtime
- External: none. No NHL, NST or Yahoo calls; the route reads stored shift_charts, pbp_plays, pbp_games and the manifest.
- Supabase per game: about 7 calls (manifest, raw shift manifest, shift_charts, pbp_games, pbp_plays, the persist RPC, plus a games list per date). For the 2026-27 scope that is about 1,850 calls for 257 games.
- Runtime: an unmeasured estimate of 1.5–3 s per game, about 6–13 minutes for 2026-27.
- Plan A (recommended, zero Vercel cost): a local background script calling the same handler against production with the service role, one date at a time, sequentially, concurrency 1, stopping on the first failure and logging each date's receipt.
- Plan B (Vercel): `POST /api/v1/db/build-projection-derived-v2?startDate=…&endDate=…&chunkDays=7&maxDurationMs=270000`, sequentially following `nextStartDate`. For 2026-27 that is about 7 invocations of up to 4.5 minutes each, roughly 0.5 function-hours, with no parallelism.
- Stop conditions: any 207 or failure, any `PROJECTION_DERIVED_*` RPC refusal, or a fingerprint collision.

## Writes
Per game, the RPC replaces player, team and goalie rows in one transaction. There are no deletes outside each game's own scope. The status row's derived_version and fingerprint advance for rewritten games.

## Downstream readers affected (none of them re-run automatically)
- FORGE projections (`run-forge-projections`, `run-projection-v2`): PP shot and goal rates and team context. Only future runs pick up corrected rates. Past projection rows and accuracy stay as they are unless they are re-run, which is a separate approval.
- Goalie: `goaliePipeline`, `goalie-queries`, `leagueSavePct`. Shootout attempts no longer inflate shots against or saves.
- `/splits` (`lib/splits/splitsServer.ts`), `PowerPlayCombos` (PP SOG and TOI), and the Lines PPP figures.
- Game predictions `featureBuilder`, `homepageGameAnalytics`, `run-projection-accuracy`.
- `/api/toi` (TimeOnIceChart) reads only `toi_pp_seconds`, which doesn't change. It works from the release with no rebuild.

## Post-rebuild check (read-only)
Forge sum(goals_pp) should equal skatersGameStats sum(powerPlayGoals) per season (2026-27 regular season: 368). The same check applies to PPA. McDavid and Draisaitl should match in 163, 239 and 260.
