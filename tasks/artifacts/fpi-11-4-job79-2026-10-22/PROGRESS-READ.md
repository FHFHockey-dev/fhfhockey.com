# FPI 11.4 — bounded progress-read assessment

## Observed evidence and limits

- Read source at `84cb1229cd1c1cdd037c43e660d2a181304ada51`, `web/pages/api/v1/db/update-nst-gamelog.ts:2693–2732`. The pinned release base has the same explicit/automatic predicates. This was static source inspection, not database or HTTP execution.
- Claude's saved `2026-10-22-claude-to-codex-nst-gamelog-job79-retired.md` reports a 14:02Z failure: “NST explicit progress read is unconfirmed; admission stopped.” It reports zero NST requests/rows and a successful resumed rerun. No SQLSTATE, database error details, query duration, plan, relation statistics, or HTTP status from the database client were retained in that handoff. Index need and latency are unproved.
- Local baseline migration `supabase/migrations/20260716112908_production_schema_baseline.sql:7247` defines `job_name text NOT NULL`, `run_time timestamptz NOT NULL DEFAULT now()`, `status text NOT NULL`, `rows_affected integer`, `details jsonb`. A bounded SQL-source search in the repository's migration/SQL trees found no `cron_job_audit` index definition. This does not establish the live index inventory.

## Actual query shape

Both reads already select only `run_time, details`, filter `job_name = 'update-nst-gamelog'` and exact `details->nstProgress->>scope`, order `run_time DESC`, and limit two. Automatic bookmarks additionally impose their existing TTL; explicit scopes intentionally have no timestamp bound. A scope encodes version, run mode, complete date aperture, dataset selectors, season, overwrite/history flags, and full queue hash.

Conceptual SQL, with a synthetic parameter (the precise PostgREST-emitted expression must be captured before choosing an expression index):

```sql
SELECT run_time, details
FROM public.cron_job_audit
WHERE job_name = 'update-nst-gamelog'
  AND details->'nstProgress'->>'scope' = $1
ORDER BY run_time DESC
LIMIT 2;
```

There is no missing obvious equality filter to add. Keep failed/blocked receipts, full scope identity, and the two-row equal-timestamp ambiguity check. A `status = 'success'` filter can select an older acknowledgement instead of the latest blocker; an arbitrary explicit-scope TTL can erase valid durable progress. Do not use `LIMIT 1`, a same-date filter, or a per-chunk scope.

## Smallest next steps

1. Reuse a saved database error/trace if available, or obtain separately authorized bounded diagnostics for the next occurrence. Distinguish transient transport/server failure from statement timeout before choosing a performance fix.
2. Under separate database-read approval, inspect current index definitions and obtain plain `EXPLAIN (FORMAT JSON)` for the actual emitted parameterized SQL. No live EXPLAIN was run here. `EXPLAIN ANALYZE` is not part of this packet.
3. If excess payload is shown, consider projecting only `run_time` and `nstProgress` and adapting the parser under the NST route owner's lease. This reduces selected JSON fields, not necessarily scanned rows. Synthetic projection equivalence is tested; PostgREST output shape and performance are not.
4. If a plan proves a costly scan, consider a partial btree on `run_time DESC WHERE job_name = 'update-nst-gamelog'` first. It keeps key width bounded and supports newest-first traversal, but rare/old scopes can still scan many gamelog rows. A more selective expression index on `(details->'nstProgress'->>'scope', run_time DESC)` with the same partial predicate could support both equality and ordering; approve it only after verifying the exact emitted expression, existing indexes, scope byte lengths/btree key-size safety, query distribution, write overhead and available disk. The scope contains a date array and this audit has not validated a key-size bound, so blindly indexing its full text is not safe to assume.

No index SQL/migration or route fix is applied. Task11.4's release packet is independent of this diagnostic proposal. Further index/schema work and live plan collection remain separately gated, not a blocker to the isolated code packet.

## Offline check

`python3 progress-read-fixture.py` verifies seven synthetic recovery/projection properties. It models the inspected selection rules; it is not a database plan, route test, timing benchmark, or production-health claim.
