# DB proposal: rolling support-payload upsert timeouts (2026-10-21)

Status: step 1 (the index drop) was EXECUTED on production on 2026-10-21 (between 14:16Z and 14:20Z) with TJ's explicit authorization, via `set lock_timeout = '5s'; drop index if exists public.idx_rolling_player_metric_support_payloads_payload_gin;` — remaining indexes: `rolling_player_metric_support_payloads_pkey`, `idx_rolling_player_metric_support_payloads_snapshot`. Steps 2 and 3 are still proposals; nothing else has been run. No migration file records the drop yet: add one to the migration tree the schema workflow uses so a fresh environment does not recreate the index.

## Evidence (read-only, 2026-10-21)

- `pg_roles.rolconfig`: `authenticator` has `statement_timeout=8s`; `service_role` has no override. PostgREST connects as `authenticator` and switches role, so the 8 s cap applies to every PostgREST statement the rolling writer sends, including service-role upserts.
- `rolling_player_metric_support_payloads`: 66k live rows, table 8 MB, **total 1.58 GB**. The size is the GIN index `idx_rolling_player_metric_support_payloads_payload_gin ON (support_payload jsonb_path_ops)` plus TOAST.
- Production logs, 2026-10-21 10:15:42Z: `splitting timed-out upsert batch {"label":"rolling_player_metric_support_payloads","rows":5,...,"error":"canceling statement due to statement timeout"}` — a 5-row upsert hit 8 s only 15 s into the run, under light load. The writer then splits, retries with backoff (up to 30 s sleeps, 5 attempts) and the in-flight tail runs past the 240 s function cap.
- No code queries `support_payload` by containment (`@>` / `cs`): readers select the column by key (`lib/projections/queries/skater-queries.ts`, `pages/trends/player/[playerId].tsx`, `rollingPlayerValidationPayload.ts`). The GIN index serves no query path; every upsert pays for it (GIN pending-list inserts and their cleanups serialize concurrent writers).
- `rolling_player_game_metrics`: 1,114 columns, 6.6 GB, `last_autovacuum` and `last_autoanalyze` null (planner stats are stale).

## Proposed change (ask-first; one transaction per step)

1. Drop the unused GIN index (removes the slow path for every support-payload upsert):

```sql
DROP INDEX CONCURRENTLY IF EXISTS public.idx_rolling_player_metric_support_payloads_payload_gin;
```

   Rollback (recreate; takes minutes and 1.5 GB):

```sql
CREATE INDEX CONCURRENTLY idx_rolling_player_metric_support_payloads_payload_gin
  ON public.rolling_player_metric_support_payloads USING gin (support_payload jsonb_path_ops);
```

   Lower-risk alternative if the index must stay: stop the pending-list behaviour only.

```sql
ALTER INDEX public.idx_rolling_player_metric_support_payloads_payload_gin SET (fastupdate = off);
```

2. Give the service role a statement timeout that fits wide-row upserts without removing the guard (the pipeline's own deadlines bound the run; the 8 s cap still applies to `anon`/`authenticated`):

```sql
ALTER ROLE service_role SET statement_timeout = '30s';
```

   Rollback:

```sql
ALTER ROLE service_role RESET statement_timeout;
```

   Note: PostgREST applies the role's `SET` on `SET ROLE service_role` only for settings configured on that role; verify after the change with one read-only probe through PostgREST (`select current_setting('statement_timeout')` via an RPC, or the Supabase SQL editor as `service_role`).

3. Refresh planner stats on the big table (read-only impact, runs in the background):

```sql
ANALYZE public.rolling_player_game_metrics;
```

## What the code fix already does without this

- Chunked rolling with persisted cursors, a hard in-flight deadline and retry sleeps bounded by it. A timed-out upsert now costs one chunk at most, never the day.
- With the index gone, the 5-row support upserts should drop well under the 8 s cap, and step 2 becomes optional.

## Out of scope

- No change to `anon`/`authenticated` timeouts, RLS, or table shapes.
