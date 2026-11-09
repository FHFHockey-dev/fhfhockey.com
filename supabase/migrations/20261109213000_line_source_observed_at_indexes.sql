-- DRAFT, not applied. Needs TJ's pop-up approval before it runs anywhere.
--
-- The review sync behind /api/v1/db/auto-news-feed-items (syncTweetPatternReviewItems in
-- web/pages/api/v1/db/tweet-pattern-review.ts) reads the newest 500 rows of line_source_snapshots and of lines_ccc,
-- ordered by observed_at desc, every 30 minutes. Neither table has an index that can serve that order, so each read
-- scans and sorts the whole table, and the two reads carry raw_payload and metadata. On 2026-11-09 at 16:00 UTC,
-- under database stress, the line_source_snapshots read (7,505 rows, 55 MB) hit the 8 s statement timeout and failed
-- that run (postgres log: "canceling statement due to statement timeout", query on line_source_snapshots ordered by
-- observed_at desc limit 500). With these indexes each read is an index scan of its 500 newest rows.
-- observed_at is NOT NULL on both tables (baseline 20260716112908). Both tables are small, so the plain build below
-- takes well under a second and holds its lock only that long.
--
-- Applying by hand (optional form that never blocks the line-source writers; CONCURRENTLY cannot run inside a
-- transaction, so run each statement on its own in the SQL editor or psql, not through apply_migration):
--   create index concurrently if not exists line_source_snapshots_observed_at_idx
--     on public.line_source_snapshots (observed_at desc);
--   create index concurrently if not exists lines_ccc_observed_at_idx
--     on public.lines_ccc (observed_at desc);
-- Then check both are valid before recording the ledger row:
--   select indexrelid::regclass, indisvalid, indisready from pg_index
--    where indexrelid in ('public.line_source_snapshots_observed_at_idx'::regclass, 'public.lines_ccc_observed_at_idx'::regclass);
-- If a concurrent build fails it leaves an INVALID index: drop index concurrently if exists <name>; and retry.
-- Rollback: drop index concurrently if exists public.line_source_snapshots_observed_at_idx;
--           drop index concurrently if exists public.lines_ccc_observed_at_idx;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

create index if not exists line_source_snapshots_observed_at_idx
  on public.line_source_snapshots (observed_at desc);

create index if not exists lines_ccc_observed_at_idx
  on public.lines_ccc (observed_at desc);
