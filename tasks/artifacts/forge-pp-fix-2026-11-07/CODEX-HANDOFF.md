# Codex handoff: fix the rebuild's DB connection guard, then run the bounded 2026-27 FORGE derived rebuild

Written 2026-11-07 by the Claude forge-pp-fix lane, at TJ's request. Paste everything below the line into Codex.

---

You're taking over one bounded production job in the FHFHockey repo at `/Users/tim/Code/fhfhockey.com`. The checkout is shared, on `octoberBranch`. Read `AGENTS.md` first and follow it.

Before you change anything or write to production, tell me which files, logs or settings are still missing. In particular: the Supabase project's pooler connection string and whether this machine can reach IPv6.

## Objective
1. Find out why the rebuild script's database connection guard can't connect from this Mac, and fix it.
2. Run the approved bounded rebuild of FORGE's derived tables for 2026-27.
3. Run the read-only check afterwards and report.

## Background (already settled; don't reopen)
- **The bug.** FORGE's derived builder labelled every skater advantage as power play and ignored the goalie digits of the NHL `situationCode`. Pulled-goalie extra-attacker events and shootout attempts landed in the `*_pp` buckets of `forge_player_game_strength` and `forge_team_game_strength`, and shootout attempts landed in `forge_goalie_game`.
- **Evidence.** `tasks/artifacts/data-checks-2026-11-07/RESULTS.md` §7. For the 2026-27 regular season, FORGE shows 448 PPG against the NHL's 368.
- **The fix is live in production.** It's release #415, master `a68f9b3d2`, which contains `1bdcf6e3e`:
  - `web/lib/projections/derived/situation.ts`: a pulled goalie now counts as an extra attacker (a 6v5 is ES, a 6v4 during a penalty is PP), and a new `isShootoutPlay` check is used.
  - `buildStrengthTablesV2.ts` and `buildGoalieGameV2.ts` skip shootout events.
  - `/api/toi` now reads PP TOI from forge `toi_pp_seconds`.
- **TJ's decisions:**
  - Rebuild 2026-27 only.
  - 2025-26 stays as it is. It's flagged in `tasks/TASKS/forge-projections/context/forge-tables.md`. It can't be rebuilt anyway: an older writer created those rows, and they have no complete `projection_game_materialization_status`.
  - Run locally, not through the Vercel route.
- **Don't bump `PROJECTION_DERIVED_ALGORITHM_VERSION`.** A bump would send every game back into the scheduled queue, oldest first, at 3 dates per cron run. An explicit run still rewrites the rows: the corrected rows change the derived fingerprint, so `persist_projection_game_derived_v1` replaces them, and unchanged games come back `idempotent`.

## The script
- It's at `tasks/artifacts/forge-pp-fix-2026-11-07/rebuild-forge-derived-2026-27.ts`, with sizing in `REBUILD-SIZING.md` in the same folder.
- It does the same work as `processProjectionDerivedGame` in `web/pages/api/v1/db/build-projection-derived-v2.ts` (manifest → player → team → goalie → persist RPC), using the exported library functions.
- Bounds:
  - dates 2026-09-19..2026-11-06 only, one date at a time, one game at a time;
  - games whose manifest is unavailable are skipped, as the route does;
  - it stops on the first failure;
  - 3 seconds between dates.
- Before each date it counts `pg_stat_activity` connections for the current database. If the count is over 40 it waits 15 seconds, and it gives up after 20 waits. The database allows 60 connections.
- How it was run. A clean export of `a68f9b3d2` was taken with `git archive`, `web/node_modules` was symlinked in, and the script was copied to `web/scripts/`. Then, from `web/`:
  ```
  NODE_PATH=. DOTENV_CONFIG_PATH=/Users/tim/Code/fhfhockey.com/web/.env.local npx ts-node -r dotenv/config --transpile-only \
    --compiler-options '{"module":"commonjs","moduleResolution":"node"}' scripts/rebuild-forge-derived-2026-27.ts [--plan] [--start D --end D]
  ```
  `--plan` works and lists 49 dates.

## The failure to fix
```
{"event":"stopped_on_failure","error":"getaddrinfo ENOTFOUND db.fyhftlxokyjtpndbkfse.supabase.co"}
```
This happened at the first connection check, before any write. `SUPABASE_DB_URL` in `web/.env.local` points at the direct host `db.fyhftlxokyjtpndbkfse.supabase.co:5432`, and `dig` returns only an AAAA record for it: there's no IPv4 address. The Supavisor pooler hosts `aws-0-us-east-1.pooler.supabase.com` and `aws-1-us-east-1.pooler.supabase.com` both resolve to IPv4, but nobody has confirmed which one serves this project. The supabase-js REST client in the same script works, because it uses HTTPS and `NEXT_PUBLIC_SUPABASE_URL`.

Options to weigh (pick the safest one that works and explain why):
- the session pooler, port 5432 with user `postgres.<project-ref>`, for the read-only count. Get the exact string from the dashboard or from TJ; don't guess credentials. (Chef note, 2026-11-07: the Claude data-checks lane ran its read-only `pg_stat_activity` guard successfully through the IPv4 pooler `aws-0-us-east-1` on this Mac; see `tasks/diaries/2026-11-07-claude-data-checks.md` line ~171.);
- an existing read-only RPC or view that exposes the connection count;
- or another bounded guard.

Don't edit `web/.env.local` or any shared config without asking TJ. A process-local override for the guard is fine.

## Constraints
- **Production writes:** only this approved rebuild. Nothing outside 2026-09-19..2026-11-06; no 2025-26; no other routes, crons or recomputes. Projections and accuracy aren't re-run; that would need its own approval.
- **No parallel jobs.** Before you start, confirm with TJ or Chef (the Claude session "11-07-2026 Big Chef") that no other production job is running. Earlier, the data-checks lane was running a rolling rebuild.
- No pushes, deploys, Vercel actions, migrations or env changes.
- Never set `GIT_DIR` in tests. Commit only your own files, with explicit pathspecs.
- NST limits don't apply: this job makes no NST or NHL calls.

## Expected size (from an exact count on 2026-11-07)
- 2026-27: 329 games on 47 game dates. 257 have a complete status (2 preseason, 255 regular season); the other 72 will be skipped.
- About 9.8k player rows, 514 team rows and 544 goalie rows replaced.
- About 1.85k Supabase calls, roughly 6–13 minutes.

## Afterwards (read-only, run once with a 30-second statement_timeout)
Compare FORGE PPG/PPA with the NHL figures for the 2026-27 regular season. The diagnosis expects 368 PPG against NHL 368, with PPA close to 705. Also check McDavid (8478402) and Draisaitl (8477934) in games 2026020163, 2026020239 and 2026020260: their power-play goals and assists there should be 0 in both sources.

```sql
set statement_timeout = '30s';
select sum(f.goals_pp) forge_ppg, sum(f.assists_pp) forge_ppa
from forge_player_game_strength f join games g on g.id = f.game_id
where g."seasonId" = 20262027 and g.type = 2 and g.date <= '2026-11-06';
-- compare with sum("powerPlayGoals"), sum("powerPlayPoints" - "powerPlayGoals") from "skatersGameStats" for the same games
```

## Report back
- The guard fix and why you chose it.
- The run log (games rewritten, idempotent and skipped; the first and last dates; any stop).
- The check numbers.
- Anything left over.

Update `tasks/diaries/2026-11-07-claude-forge-pp-fix.md`, or start your own Codex diary.
