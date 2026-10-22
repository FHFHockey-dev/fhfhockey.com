# §5.3 / §5.4 — proposed bounded reads, awaiting TJ

TJ subsequently approved exactly these three reads directly in this chat. They completed read-only; the budget is exhausted. See [findings](PRODUCTION-FINDINGS.md) and [exact receipt](PRODUCTION-READS.json). The original proposed bounds follow: three sequential read-only SQL executions, each `BEGIN READ ONLY`, 10-second statement timeout, no API/cron/ingest/refresh calls. Stop on a timeout, schema mismatch, unexpected volume or conclusive result; do not retry automatically. No credentials, account identifiers or whole audit payloads in output.

1. §5.3: the [NST coverage query](NST-DATE.md), eight named tables, 21 calendar dates (2026-09-28 through 10-18), at most 168 output rows. Counts and schedule alignment can flag suspicious dates; they cannot establish which invocation created a row or prove value-date identity. No repair is included.
2. §5.4 sustainability, at most eight aggregate date rows:

```sql
BEGIN READ ONLY;
SET LOCAL statement_timeout = '10s';
WITH degraded AS (
  SELECT DISTINCT s.snapshot_date, s.player_id, s.window_code,
    regexp_replace(w.warning, '^missing_window_z_', '') AS stat_code
  FROM public.sustainability_scores s
  CROSS JOIN LATERAL jsonb_array_elements_text(
    CASE WHEN jsonb_typeof(s.components->'warnings')='array'
      THEN s.components->'warnings' ELSE '[]'::jsonb END
  ) w(warning)
  WHERE s.snapshot_date >= date '2026-10-13'
    AND s.snapshot_date < date '2026-10-21'
    AND w.warning LIKE 'missing\_window\_z\_%' ESCAPE '\'
)
SELECT snapshot_date, count(*) AS missing_stat_keys,
  count(*) FILTER (WHERE EXISTS (
    SELECT 1 FROM public.sustainability_window_z z
    WHERE z.snapshot_date=d.snapshot_date AND z.player_id=d.player_id
      AND z.window_code=d.window_code AND z.stat_code=d.stat_code
  )) AS now_repairable_stat_keys
FROM degraded d GROUP BY snapshot_date ORDER BY snapshot_date;
ROLLBACK;
```

Nonzero repairable keys show a remaining source-supported repair candidate; zero does not prove a rerun occurred. A row may have disappeared, changed policy or never been degraded. Match exact snapshot/player/window/stat keys, not just the latest date. Aggregate counts do not prove batch completeness or model quality.

3. §5.4 sweep, at most 32 date rows:

```sql
BEGIN READ ONLY;
SET LOCAL statement_timeout = '10s';
WITH status AS (
  SELECT game_id,game_date,status,completed_at FROM public.nhl_api_game_normalization_status
  WHERE game_date >= date '2026-09-19' AND game_date < date '2026-10-21'
), marked AS (
  SELECT s.*, (
    SELECT max(p.fetched_at) FROM public.nhl_api_game_payloads_raw p
    WHERE p.game_id=s.game_id AND p.endpoint='landing'
      AND p.source_url='derived://underlying-player-summary-v2/individual/allStrengths/' || s.game_id::text
  ) AS summary_marker_at FROM status s
)
SELECT game_date, count(*) AS games,
  count(*) FILTER (WHERE status IS DISTINCT FROM 'complete') AS normalization_incomplete,
  count(*) FILTER (WHERE status='complete' AND
    (summary_marker_at IS NULL OR completed_at IS NULL OR summary_marker_at < completed_at)) AS summary_marker_missing_or_stale
FROM marked GROUP BY game_date ORDER BY game_date;
ROLLBACK;
```

This mirrors the released sweep's source-marker test and includes older outstanding games without running the sweep. A fresh marker is stage evidence; the handoff records a partial-summary marker weakness, so it does not prove every player/team summary cell was rebuilt. If stronger proof is required, prepare a separately bounded row-level read after inspecting these aggregates. No automatic write, trigger, materialized-view refresh or catch-up is authorized.

All table/column and marker names above were checked against local source. SQL syntax/runtime and live schema have not been exercised; a mismatch is a stop, not permission to broaden the read.
