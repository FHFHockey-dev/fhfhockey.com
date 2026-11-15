-- Rankings publication completion marker (Claude rankings lane; TJ 2026-11-15).
-- Source-authorized only: applying this migration needs TJ's own pop-up approval.
--
-- public.entity_metric_rankings is written in 100-row chunks that each commit on their own, so a
-- Rankings write that stops partway leaves a date with only some of its rows.
-- public.skater_composite_ratings is written in one atomic upsert. The live reader
-- (web/lib/rankings/entityMetricRankingReader.ts) only checks that both tables have the date.
--
-- One marker row per publication: surface x season x snapshot date x strength x window x peer
-- group. A writer inserts 'writing' before its first write and sets 'complete' only when the
-- counts the database returned match what it expected. The reader serves a date only when both
-- surfaces have a complete marker for it. The complete check refuses a complete marker without
-- completed_at, with a null or mismatched row count, or a null or mismatched entity count.
--
-- No trigger, RPC or policy. RLS is on: service_role bypasses it, every other role is denied.
-- Grants: select, insert and update to service_role only (no delete); anon, authenticated and
-- PUBLIC have none. Plan: tasks/artifacts/rankings-acceptance-2026-11-14/COMPLETION-MARKER-PLAN.md.

create table public.ranking_publications (
  surface text not null check (surface in ('entity_metric_rankings', 'skater_composite_ratings')),
  season_id integer not null,
  snapshot_date date not null,
  strength_state text not null check (strength_state in ('all', '5v5', 'ev', 'pp', 'pk')),
  window_type text not null,
  window_size integer not null check (window_size >= 0),
  peer_group_type text not null,
  peer_group_key text not null,
  metric_set text[] not null default '{}',
  min_gp integer,
  min_toi_seconds integer,
  methodology_version text not null,
  status text not null check (status in ('writing', 'complete')),
  expected_rows integer not null default 0 check (expected_rows >= 0),
  db_written_rows integer,
  expected_entities integer,
  written_entities integer,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (surface, season_id, snapshot_date, strength_state, window_type, window_size, peer_group_type, peer_group_key),
  constraint ranking_publications_complete_check check (
    status <> 'complete' or (
      completed_at is not null
      and db_written_rows is not null and db_written_rows = expected_rows
      and expected_entities is not null
      and written_entities is not null and written_entities = expected_entities
    )
  )
);

create index ranking_publications_reader_idx
  on public.ranking_publications (season_id, strength_state, status, snapshot_date desc);

alter table public.ranking_publications enable row level security;

revoke all on table public.ranking_publications from public, anon, authenticated, service_role;
grant select, insert, update on table public.ranking_publications to service_role;

comment on table public.ranking_publications is
  'Rankings publication completion marker: one row per publication (surface, season, snapshot date, strength, window, peer group). status = complete only when the database-returned row and entity counts match the expected counts. The reader serves a date only when both surfaces are complete for it.';
