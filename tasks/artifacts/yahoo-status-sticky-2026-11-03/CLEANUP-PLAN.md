# Stale Yahoo status cleanup plan (not run)

Finding `CLAUDE-SS-YAHOO-STATUS-STICKY-20261103`. Fix: writer `status_observed` marker plus migration `supabase/migrations/20261104012000_clear_stale_yahoo_player_status.sql`. Nothing below has been run. Every write step needs TJ's pop-up approval.

## What the stale rows look like

These are read-only reads of Production taken 2026-11-04 at about 01:10 UTC, for game 477 (2026-27):

| status | rows |
|---|---|
| NA | 888 |
| DTD | 118 |
| IR | 102 |
| O | 40 |
| IR-NR | 28 |
| IR-LT | 22 |
| none | 410 |

There are 1,608 rows in total. Every row has an active key in `yahoo_player_keys` and was rewritten in the last two days. Every row has `full_name`, `display_position` and `position_type`, so every one passes the writer's full-read check.

## Why there is no SQL UPDATE

The database can't tell a stale flag from a real one; only Yahoo can.

- **Clear by heuristic** (for example, "played in a recent team game"): this also clears a player who was hurt last night.
- **Clear everything**: this erases every real flag until the next run.

The exact cleanup is the next full run after the fix. It re-reads all 1,608 keys, and each healthy player's payload then clears its own flag.

## Steps

### 0. Pre-check (SELECT only)
Confirm the live writer is still the definition the migration guards on. If this returns false, stop: the migration would refuse anyway.

```sql
select md5(pg_get_functiondef('public.upsert_yahoo_players_atomic(jsonb[])'::regprocedure))
  = '178d877fe2e1d29c37b94832c5f42c60' as writer_matches;
```

### 1. Audit snapshot (write, optional, needs approval)
This keeps the pre-fix flags so anyone can compare later. It follows the `blsh_wgo_repair_20261027` precedent: a dedicated schema that the Data API can't reach.

```sql
begin;
create schema yahoo_status_repair_20261104;
revoke all on schema yahoo_status_repair_20261104 from public, anon, authenticated;
create table yahoo_status_repair_20261104.pre_fix_status as
  select player_key, game_id, full_name, status, status_full, injury_note, last_updated,
         now() as snapshot_at
  from public.yahoo_players
  where status is not null or status_full is not null or injury_note is not null;
select count(*) from yahoo_status_repair_20261104.pre_fix_status;  -- expect about 1,198 for game 477, plus older games
commit;
```

### 2. Apply the migration (needs approval)
Apply `20261104012000_clear_stale_yahoo_player_status.sql` through the normal migration path. Then read back:

```sql
select md5(pg_get_functiondef('public.upsert_yahoo_players_atomic(jsonb[])'::regprocedure)) <> '178d877fe2e1d29c37b94832c5f42c60' as replaced,
       position('status_observed' in pg_get_functiondef('public.upsert_yahoo_players_atomic(jsonb[])'::regprocedure)) > 0 as has_marker,
       has_function_privilege('anon', 'public.upsert_yahoo_players_atomic(jsonb[])', 'execute') as anon_exec,        -- expect false
       has_function_privilege('service_role', 'public.upsert_yahoo_players_atomic(jsonb[])', 'execute') as service_exec; -- expect true
```

### 3. Release the writer change (needs approval)
The writer change ships in `playerWriter.ts`. The two halves can land in either order, but neither one clears anything on its own:

- **Old RPC with the new writer:** the old RPC ignores the extra `status_observed` key and merges as it does today.
- **New RPC with the old writer:** there's no marker, so the merge is the same as today.

### 4. The next normal scheduled run
There's no extra run or route call. The daily `update-yahoo-players` run rewrites every active key.

### 5. Verify (SELECT only)
Record the run's start time from the cron audit row. `last_updated` is written as UTC.

```sql
-- Coverage: every game-477 row refreshed by the run.
select count(*) filter (where last_updated >= :run_start_utc) as refreshed,
       count(*) as total
from public.yahoo_players where game_id = 477;

-- New distribution. NA, IR and DTD should drop to what Yahoo reports today.
select status, count(*) from public.yahoo_players where game_id = 477 group by 1 order by 2 desc;

-- The two named examples.
select full_name, status, status_full, injury_note, last_updated
from public.yahoo_players
where game_id = 477 and full_name in ('Charlie McAvoy', 'Connor Bedard');

-- Residual: flags on rows the run did not refresh (omitted or deferred keys).
select player_key, full_name, status, last_updated
from public.yahoo_players
where game_id = 477 and status is not null and last_updated < :run_start_utc
order by last_updated;
```

If the run was partial (HTTP 207, with `providerOmitted` or `deferredRows` above 0), the residual rows keep their old flag until the next complete run. No manual clear is needed.

### 6. Rollback
Re-create the previous definition, `20260723113533` plus the `20260725200808` repair, with a new migration. Cleared flags only come back if Yahoo reports them again. The step 1 snapshot can restore the old values, but it shouldn't be used that way: those values were stale.

## Not covered

- **`yahooAPI.py`** (env-gated maintenance, disabled by default): it sends no marker, so it keeps the old merge. Add the marker if anyone re-enables it.
- **Older games** (465, 453): the current-season run never re-reads them, so their flags stay as they are, stale ones included. Clearing them would need a read of those games from Yahoo; none is planned.
- **Off-Night Edge workaround** in `web/lib/socialShare/modules/offNightEdge.ts`: left alone. Its owner decides after step 5.
