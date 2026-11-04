# P-1 and P-2: migration drafts (2026-11-03)

Status: **P-1 applied to production on 2026-11-04 at 01:07 UTC** (TJ: "Apply P-1 now") and verified (see "P-1 production result"). **P-2 applied to production on 2026-11-04 at about 01:10 UTC** (TJ: "Yes, apply P-2") and verified (see "P-2 production result"). Nothing was pushed, deployed or run as a route.

| Step | File | What it fixes |
|---|---|---|
| P-1 | `supabase/migrations/20261104010705_nst_gamelog_season_indexes.sql` (renamed to the version production recorded) | ES, PP and PK percentile views time out (57014), so Ratings never load |
| P-2 | `supabase/migrations/20261104011002_nst_percentile_as_from_gamelogs.sql` (renamed to the version production recorded) | AS percentiles and the "All" ratings have no 20262027 data, and nothing writes them |

## P-1 production result

TJ approved three check reads by pop-up (R1-R3), all read-only, all run.

| Check | Before | After |
|---|---|---|
| R1: catalog | none of these indexes | All 6 `*_season_player_idx` indexes exist; all 6 tables have `autovacuum_analyze_scale_factor=0.002` |
| R2: `nst_percentile_es_offense`, page 1 | 7,575 ms | **66 ms** (first read after the change) |
| R3: `nst_percentile_es_defense`, page 1 | 4,941 ms | **12 ms** |

Both plans now use the new index on both sides with a merge left join. The season estimate is now 7,953 rows against 5,477 actual (it was 1). The plan has no nested loop and touches about 11k buffers, down from 1.72M. PP and PK use the same view shape and were not measured.

**Apply note:** P-1 was applied twice at the same moment, by this session and by the planning thread, both on TJ's word. One of the two calls returned `40P01` deadlock detected. A catalog check afterwards showed everything in place, with one migration row (`20261104010705`). Do not apply a migration from two sessions at once.

## P-2 production result

Applied with Supabase MCP `apply_migration`, which returned success. It is recorded as version `20261104011002`, and the repo file was renamed to match. TJ approved three check reads by pop-up, all read-only and all run.

| Check | Result |
|---|---|
| Catalog | `nst_percentile_as_offense` and `_defense` are views (`v`); the `_legacy` tables exist; both `nst_gamelog_as_counts*_season_player_idx` indexes exist. Migration rows: `20261104010705`, `20261104011002` |
| Count for 20262027 | **743 players**, max GP **16**, 1 player with no on-ice row (null `cf_per_60`) |
| `EXPLAIN ANALYZE` page 1 (500 rows), run as `anon` with a 3 s timeout | **33.6 ms**: index scans on both new indexes, merge left joins, no nested loop. Was 9,344 ms for the AS aggregate before |

`nst_percentile_as_defense` was not timed; it has the same shape as the ES defense view (12 ms). The page itself was not loaded. October GP stays low until P-5 (the NST backfill for 10-04 to 10-06).

Both files are in `supabase/migrations/`, the tree that holds the baseline definitions of these views.

## Production evidence (TJ approved 5 reads by pop-up; all 5 run, read-only)

| # | Read | Result |
|---|---|---|
| Q1 | Catalog: sizes, row estimates, indexes | Game logs hold 139k to 229k rows each (56 to 161 MB). Every index on them is `(player_id, date_scraped[, season])`; **none leads with season**. `nst_percentile_as_*` are plain tables of 4,144 rows; ES, PP and PK percentiles are views. |
| Q2 | Catalog: functions, cron jobs, role settings | **No function or cron job writes `nst_percentile_as_*`** (the only NST cron job refreshes `mv_team_stats_nst_wgo`). So there is no writer in the database either, not just in the repo. `anon` has `statement_timeout=3s`; `authenticated` and `authenticator` have 8 s. |
| Q3 | `EXPLAIN ANALYZE` of `nst_percentile_es_offense`, 20262027, page 1 (500 rows) | **7,575 ms**, 1.72M buffer hits |
| Q4 | Same for `nst_percentile_es_defense` | **4,941 ms**, 1.72M buffer hits |
| Q5 | AS season aggregate (`nst_seasonlong_as_rates` LEFT JOIN `_rates_oi`), 20262027 | **9,344 ms**, 3.69M buffer hits, **743 players**: AS can be built from the game logs today |

### Why the views are slow

1. **The estimate is 1 row for the new season.** Every scan says `rows=1` for `season = 20262027`, while the actual count is 5,477 (ES) and 7,990 (AS). The season is not in the column statistics yet. It is 2 to 3% of each table, and daily inserts never reach the default 10% autoanalyze threshold, so the statistics stay stale until mid-season.
2. **With that estimate, the planner uses a nested loop.** It re-aggregates the whole on-ice game log once per player: `loops=500`, 7 to 12 ms per loop, `Rows Removed by Join Filter: 124750`. That is about 85% of the time.
3. **No index leads with season.** The planner walks the whole `(player_id, date_scraped, season)` index to find one season. That costs 1.2 to 1.4 s for the outer side alone.

The views themselves are correct (lane C confirmed the ES values). Only the query plan is the problem.

## What each migration changes

**P-1** (6 tables: `nst_gamelog_{es,pp,pk}_counts` and `_counts_oi`):
- Adds a `(season, player_id)` index on each table. The planner can then find one season directly, and the rows come out already in `player_id` order for the `GROUP BY` and `ORDER BY`.
- Sets `autovacuum_analyze_scale_factor = 0.002` on each table, the same setting as `20261021172444`. That re-analyzes a table after about 330 to 510 changed rows (50 plus 0.2% of the table), roughly one night of games, so a new season enters the statistics within days.
- Runs `ANALYZE` on all six tables so the fix takes effect at once.
- Does not change the views.

**P-2** (AS):
- Adds the same index and analyze setting to `nst_gamelog_as_counts` and `_counts_oi`, then runs `ANALYZE` on both.
- Renames the snapshot tables to `nst_percentile_as_offense_legacy` and `nst_percentile_as_defense_legacy` (kept for rollback) and revokes browser access to them.
- Creates the views `nst_percentile_as_offense` and `_defense` over `nst_seasonlong_as_rates` and `_rates_oi`. They are built exactly like the ES, PP and PK views. Column names, order and types are identical to the old tables (checked: 65 of 65 columns), so the client needs no change.
- Uses `security_invoker = true`, so the new views add no "security definer view" advisor finding. `anon` already has SELECT on the `nst_seasonlong_as_*` views.
- Grants SELECT to anon, authenticated and service_role, and runs `notify pgrst, 'reload schema'`.

**Not a stored table, so nothing writes or refreshes it.** The plan expected P-2 to share a stored table with P-1. The EXPLAIN shows the cost comes from the plan, not from the volume: a season is only about 5k to 45k rows per table. So both steps use live views. The AS source is computed when it is read, from `nst_gamelog_as_counts` and `_counts_oi`. The NST game log ingest (Codex lane) already writes those tables every day (B-09). No new cron job is needed, and the missing writer no longer matters.

## Expected query time after applying

These figures are not measured in production. They come from a local check: PostgreSQL 15 with the baseline table and view definitions, both migrations applied, and synthetic data of the same volume (5 past seasons of 44,100 rows plus 8,140 for 20262027, about 228k rows per table).

| Query | Before (production) | After (local, synthetic) | Expected in production |
|---|---|---|---|
| Current season, page 1 (500 rows) | 4.9 to 7.6 s (ES), 9.3 s (AS aggregate) | **3 ms** (index scan, hash aggregate, merge join) | Tens of ms. Production rows are wider and the cache may be cold |
| Full past season, page 2 | (not measured) | **14 ms** | Up to a few hundred ms by season end, still far under 3 s |

The local plan uses the new index on both sides with a merge left join. There is no nested loop.

**Residual risk:** at the start of each season, the 1-row estimate comes back until the first analyze, which should now be within about a day. In that window the nested loop rescans only that season's rows through the new index, and a season has few rows at its start, so it stays well below the old cost.

## Local verification run

- Both migrations applied in order, each in one transaction (`psql -1`), on a throwaway PostgreSQL 15.19 cluster in the session scratchpad. The cluster was stopped by exact PID afterwards.
- AS view columns are identical to the old tables. As `anon`, both views return computed rows, and the legacy tables give `permission denied`.
- **Not run:** the migrations against production or a Supabase branch, and the CLI `db push`.

## Apply steps for TJ (each one needs approval)

Steps 1 to 3 are done for P-1. P-2 does not depend on P-1, but the two notes refer to each other. The Supabase MCP `apply_migration` stamps the current time as the version. After applying, rename the local file to the version that `list_migrations` reports, so that `supabase db push` stays in sync.

1. **Pick a time outside the NST game log ingest.** Each `CREATE INDEX` briefly blocks writes, not reads, on one table: well under a second each at about 230k rows. `lock_timeout = 5s` makes the migration fail cleanly rather than wait behind the ingest. If it fails on the lock, re-run it.
2. Apply **P-1**: `supabase db push` from `web/` (`npm run supabase:safe -- db push` if sandboxed), or the Supabase MCP `apply_migration` with the file's contents.
3. **Check P-1:** re-run Q3 and Q4 above. They should show `Index Scan`/`Bitmap Index Scan using ..._season_player_idx`, no `loops=500`, and a time under 100 ms. Optionally load one WiGO player page and confirm that Ratings load.
4. Apply **P-2** the same way.
5. **Check P-2:** `select count(*), max(gp) from nst_percentile_as_offense where season = 20262027`. Expect about 743 rows and a max GP near the league leader's games played. Then re-run Q5 for timing. On the page, the AS tab and Offense/Defense/Overall "All" ratings should fill in.
6. **No refresh step and no schedule.** The values update whenever the NST game logs update.
7. Optional, later: regenerate `web/lib/supabase/database-generated.types.ts`, where `nst_percentile_as_*` moves from Tables to Views. Runtime is not affected, because the client already casts the table names.

**Rollback for P-2:**

```sql
drop view public.nst_percentile_as_offense;
drop view public.nst_percentile_as_defense;
alter table public.nst_percentile_as_offense_legacy rename to nst_percentile_as_offense;
alter table public.nst_percentile_as_defense_legacy rename to nst_percentile_as_defense;
grant select on public.nst_percentile_as_offense, public.nst_percentile_as_defense to anon, authenticated;
notify pgrst, 'reload schema';
```

The legacy tables keep their RLS `public_read` policies. **Rollback for P-1:** drop the six `*_season_player_idx` indexes and `alter table ... reset (autovacuum_analyze_scale_factor)`.

## Caveats and follow-ups (not done here)

- **GP undercount in October.** The AS (and ES) game logs have no rows for 10-05 and 10-06, and on-ice has none for 10-04. GP and rates miss those games until P-5 (Codex lane backfill).
- **Past seasons change for AS.** 20242025 and 20252026 are now recomputed from the game logs, replacing the snapshot (GP up to 119 in 20242025, a 5-GP stub in 20252026). If NST game logs include playoff dates, past-season GP includes playoffs. That is the same behaviour ES, PP and PK already have.
- **Duplicate indexes.** `nst_gamelog_as_counts` and `_counts_oi` each carry three identical `(player_id, date_scraped, season)` indexes and two identical unique `(player_id, date_scraped)` indexes. The ES, PP and PK tables carry duplicate unique indexes too. They slow every ingest write. Dropping them is a separate change; the indexes belong to the NST tables, so the decision sits with the Codex lane.
- `migrations/20260604_secure_public_data_api_tables.sql` (the legacy tree, already applied) lists `nst_percentile_as_*` as tables. Re-running it after P-2 would hit a view. It is historical and not part of `supabase/migrations`.
- P-10 (server-side cohort aggregation) can build on these indexes later.
