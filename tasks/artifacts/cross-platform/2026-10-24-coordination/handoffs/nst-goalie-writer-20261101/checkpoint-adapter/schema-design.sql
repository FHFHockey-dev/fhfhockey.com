-- REVIEW DRAFT ONLY. Not a registered migration, not applied or SQL-tested.
-- The six RPC bodies in RPC-CONTRACT.md are intentionally not implemented here.
-- Generate a canonical migration with Supabase CLI only after local allocation.
-- No scheduler, provider call, existing table change, or data repair is included.

create table public.nst_goalie_cohorts (
  scope text primary key check (scope ~ '^[a-f0-9]{64}$'),
  season integer not null,
  source_version text not null check (length(source_version) between 1 and 128),
  start_date date not null,
  end_date date not null,
  planned_request_count integer not null check (planned_request_count between 0 and 140),
  original_manifest jsonb not null check (jsonb_typeof(original_manifest) = 'object'),
  source_observation jsonb not null check (jsonb_typeof(source_observation) = 'object'),
  runner_job_id uuid unique references public.route_runner_jobs(id),
  created_at timestamptz not null default now(),
  check (end_date <= start_date + 13)
);

-- Global unit identity outlives a cohort/day/source version. A new cohort must
-- not erase an existing held state or create an overlapping in-flight unit.
create table public.nst_goalie_units (
  unit_key text primary key,
  season integer not null,
  game_date date not null,
  dataset text not null check (dataset in ('5v5Counts','5v5Rates','evCounts','evRates',
    'allCounts','allRates','ppCounts','ppRates','pkCounts','pkRates')),
  state text not null check (state in ('pending','in_flight','complete','empty_valid','no_games','held')),
  source_version text not null,
  hold_reason text,
  updated_at timestamptz not null default now(),
  unique (season, game_date, dataset),
  check (unit_key = season::text || '/' || to_char(game_date, 'YYYY-MM-DD') || '/' || dataset),
  check (state <> 'held' or coalesce(length(trim(hold_reason)), 0) > 0)
);
create table public.nst_goalie_cohort_units (
  scope text not null references public.nst_goalie_cohorts(scope),
  unit_key text not null references public.nst_goalie_units(unit_key),
  ordinal integer not null check (ordinal between 1 and 140),
  primary key (scope, unit_key),
  unique (scope, ordinal)
);

-- attempts_charged includes outstanding reservations until positively settled.
-- Reserving is conservative; only an acknowledged finish may refund unused work.
create table public.nst_goalie_daily_budget (
  utc_day date primary key,
  steps integer not null default 0 check (steps between 0 and 7),
  attempts_charged integer not null default 0 check (attempts_charged between 0 and 60)
);
create table public.nst_goalie_claims (
  claim_id uuid primary key default gen_random_uuid(),
  scope text not null references public.nst_goalie_cohorts(scope),
  utc_day date not null references public.nst_goalie_daily_budget(utc_day),
  state text not null check (state in ('claimed','finished','held')),
  unit_keys text[] not null check (cardinality(unit_keys) between 1 and 20),
  attempts_reserved integer not null check (attempts_reserved between 1 and 60),
  attempts_used integer check (attempts_used between 0 and attempts_reserved),
  deadline_at timestamptz not null,
  claimed_at timestamptz not null default now(),
  finished_at timestamptz,
  hold_reason text,
  check (state <> 'held' or coalesce(length(trim(hold_reason)), 0) > 0),
  check (state <> 'finished' or (attempts_used is not null and finished_at is not null))
);
-- Conservative recovery fence: unresolved execution also blocks a new cohort.
-- Manual reconciliation is required before transitioning held -> finished.
create unique index nst_goalie_one_unreconciled_claim
  on public.nst_goalie_claims ((true)) where state in ('claimed','held');

create table public.nst_goalie_unit_receipts (
  receipt_id uuid primary key default gen_random_uuid(),
  scope text not null,
  unit_key text not null,
  claim_id uuid not null references public.nst_goalie_claims(claim_id),
  source_version text not null,
  status text not null check (status in ('complete','empty_valid')),
  source_fingerprint text not null check (source_fingerprint ~ '^[a-f0-9]{64}$'),
  output_fingerprint text not null check (output_fingerprint ~ '^[a-f0-9]{64}$'),
  parsed_rows integer not null check (parsed_rows between 0 and 100),
  mapped_rows integer not null,
  written_rows integer not null,
  observed_at timestamptz not null,
  committed_at timestamptz not null default now(),
  foreign key (scope, unit_key) references public.nst_goalie_cohort_units(scope, unit_key),
  unique (scope, unit_key, source_version),
  unique (claim_id, unit_key),
  check (parsed_rows = mapped_rows and mapped_rows = written_rows),
  check ((status = 'complete' and written_rows > 0) or (status = 'empty_valid' and written_rows = 0))
);

alter table public.nst_goalie_cohorts enable row level security;
alter table public.nst_goalie_units enable row level security;
alter table public.nst_goalie_cohort_units enable row level security;
alter table public.nst_goalie_daily_budget enable row level security;
alter table public.nst_goalie_claims enable row level security;
alter table public.nst_goalie_unit_receipts enable row level security;
revoke all on public.nst_goalie_cohorts, public.nst_goalie_units, public.nst_goalie_cohort_units,
  public.nst_goalie_daily_budget, public.nst_goalie_claims, public.nst_goalie_unit_receipts
  from public, anon, authenticated;
grant select, insert, update on public.nst_goalie_cohorts, public.nst_goalie_units,
  public.nst_goalie_cohort_units, public.nst_goalie_daily_budget, public.nst_goalie_claims,
  public.nst_goalie_unit_receipts to service_role;

-- RPC implementations must be SECURITY INVOKER with a fixed search_path,
-- schema-qualified references, no untrusted dynamic identifiers, and EXECUTE
-- revoked from PUBLIC/anon/authenticated and granted only to service_role.
-- Keep the existing shared NST admission SQL independent and prerequisite-first.
