# Item 6: bounded read-only schema check plan (Chef, 2026-11-13)

**State:** plan only. Nothing has run.
- The migration `20261113190000_fix_team_goalie_game_stats_placeholders_nullable.sql` (authority order 147) is in Git with sha256 `a623eec8…a4a9d`. Its authority status is `pending`.
- Being in Git doesn't establish the live state; this plan establishes it.
- The migration and any release stay held. The apply is a **separate** TJ approval after these results.
- Codex's local candidate: `a36a878c5`, worktree `/private/tmp/fhfh-item6-readers-20261113`. Reported: 151 app tests, typecheck, and 149 disposable-database checks.

## What the migration changes
1. `teamGameStats."powerPlayToi"` loses NOT NULL.
2. `goaliesGameStats` loses NOT NULL on `evenStrengthShotsAgainst`, `powerPlayShotsAgainst`, `shorthandedShotsAgainst` and `saveShotsAgainst`.
3. `public.persist_complete_game_stats_v1(...)` is replaced. The only change is that six text validations accept null: `"powerPlayToi" is null or …` (team), the four goalie ratios, and the goalie `toi`.
4. It runs in one transaction with `lock_timeout 5s` and `statement_timeout 30s`. DROP NOT NULL is catalog-only (no table rewrite), but it takes a brief ACCESS EXCLUSIVE lock on both tables.

## The check: one session, catalog only, no table data
**Bounds:**
- 1 psql session through the session pooler, `statement_timeout 5s`.
- 6 catalog SELECTs, run sequentially.
- No reads of `teamGameStats` or `goaliesGameStats` rows; size estimates come from `pg_class.reltuples`.
- No writes, no DDL, no RPC calls, no application or provider requests.

**Gate first:** the `pg_stat_activity` check. Stop if more than 5 queries are active or any has run longer than 10 s.

| # | Query (read-only) | Expected if not applied | Stop / reconcile if |
|---|---|---|---|
| 1 | `supabase_migrations.schema_migrations` where `version = '20261113190000'` | 0 rows | a row exists (applied outside the ledger record) |
| 2 | `information_schema.columns`: `is_nullable`, `data_type` for the 5 columns | all `NO` | any `YES` (partial or prior apply) |
| 3 | `pg_proc` for `persist_complete_game_stats_v1`: argument types, return type, `prosecdef`, `proconfig` (search_path), owner; `md5(pg_get_functiondef(oid))`; and markers: `position('"powerPlayToi" is null or' in prosrc) > 0`, plus the four goalie-ratio and goalie-toi `is null or` markers | exactly 1 function with the 7-argument signature; markers false (the body predates item 6) | 0 or more than 1 overloads; any marker true |
| 4 | `information_schema.routine_privileges`, plus `has_function_privilege` for `anon`, `authenticated` and `service_role` on that function | record as is; the migration keeps the same grants | grants differ from the migration's intent (to compare in review) |
| 5 | `pg_class.reltuples` and `pg_total_relation_size` for both tables; `pg_locks` held on them right now | record; no lock is waiting | an existing lock wait |
| 6 | `cron.job` rows whose command calls `update-stats` or the game-stats persistence route: schedule and active flag | record, to pick an apply window away from them | — |

**Output:** results recorded in this file (§Results) and the queue. A compare against the disposable-database expectations from Codex's 149 checks, where the md5 of the pre-item-6 function definition is known. No secrets are printed.

## Then, separately (each with its own TJ pop-up)
1. **Migration apply** (only if checks 1–3 say "not applied" and nothing is waiting):
   - apply this single file through the session pooler with `psql -1`, verifying its sha256 first;
   - run outside the game-stats cron windows;
   - read back checks 1–4 again: nullable `YES`, markers true, grants unchanged;
   - write the ledger row and update the authority to applied, keeping the baseline test green.
2. **Readers first:** ship the reader fixes (Splits, season bootstrap, Lines utilities, the DRM regression test) **with or before** the nullable writer `c89ff5d24`. Never the writer alone.
3. **Readback after release:** the next scheduled game-stats write produces nulls only where the source is unknown, and readers show them as unavailable. No manual reruns.

## Results
_(not run)_
