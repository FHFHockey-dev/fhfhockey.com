# Chef re-checks of the blind audit (2026-11-16, ~14:35Z)

Read-only, through `ro_sql.py`. Queries are in the session scratchpad (`verify/v1.sql`–`v6.sql`); results are below.

## C1: the allowlist gap (confirmed)
- `forge_runs` created since 11-12: one `selected_games` run (11-13 01:40, as_of 11-12, closure `ee3f3ea3…`).
- Seven `full_slate` runs created 11-13 10:20–10:41 (as_of 11-13..11-19): SHA `e1ab46318e`, closure `ee5581d90197…`.
  No run has been created since.
- `grep ee5581d9 web/lib/projections/verifiedForgeReleases.ts` finds nothing. Closure `9b1821ff…` (the 11-09 runs) is
  at line 122. The file was last changed in `4243bcd4e` (2026-11-12 14:17 -05:00).
- The gate is in `externalInputProof.ts:80-98`: a run with no snapshot needs a listed closure.

## Availability signal (confirmed absent)
- `forge_roster_events`: 0 rows.
- `player_status_history`: 101 rows, last snapshot 2026-04-22. No pg_cron or Vercel schedule calls
  `update-player-statuses`.
- Today the only injury signal is RSO's live Yahoo read (`player.injury`; see `healthyReserves.ts`). FORGE has none.

## Rostered skaters with no line in today's run (run `26373189`, as_of 11-16, created 11-13 10:33)
Reasons by team. "Dressed this season" means they appear in a `lineCombinations` lineup for that team since 10-01.

| Team | Roster skaters | Projected | No line, dressed this season | No line, never dressed |
|---|---|---|---|---|
| 3 NYR | 29 | 18 | 6 | 5 |
| 8 MTL | 38 | 18 | 5 | 15 |
| 23 VAN | 41 | 18 | 6 | 17 |
| 68 UTA | 24 | 15 | 6 | 3 |

**23 skaters who dressed this season have no line.** Among them:
- Utah: Schmaltz, last dressed 11-11; Cooley and Guenther, 11-07; Schmidt, 11-05; Marino; DeSimone.
- Montreal: Demidov, last dressed 10-03.
- Vancouver: Willander, Chytil and Crotty, all 11-15.

There are two causes:
- **Out of the last lineup.** The lineup is the team's latest `lineCombinations` row, so anyone injured or scratched in
  the last game gets no line, and the reserve pass is off.
- **The run is three days old.** Vancouver's 11-15 lineup is newer than the run.

Separately, three Utah skaters dressed but have no `rosters` row and are dropped without a counter.

## Row cap (H5, still inferred)
- `pg_roles`: `authenticator` has `statement_timeout=8s`, `pgrst.db_aggregates_enabled=true` and no
  `pgrst.db_max_rows`, so the cap is set in the hosted API settings. Supabase's default there is 1,000.
- Not observed through the route.

## RSO load path (spot-checked)
- `currentPlanningRead.ts:68`: a 20 s abort, and a nonce on every read.
- `data.ts:26`: a nonce means `private, no-store`, so the CDN branch is never used.
- `RosterScheduleOptimizer.tsx:48,51`: provider refresh every 5 min, full snapshot every 30 min.

## Capture lane interaction (checked)
The pregame capture writes only through the `forge_pregame_capture_*_v1` RPCs, never to public `forge_runs`. Tonight's
run cannot create a `selected_games` run that public readers would pick up (H3).
