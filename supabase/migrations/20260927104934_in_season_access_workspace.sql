-- RSO grants are independent records. Commerce fulfillment remains unconfigured.
create table public.in_season_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null check (source in ('purchase', 'grandfather', 'common_preview')),
  source_reference text not null check (char_length(btrim(source_reference)) between 1 and 200),
  status text not null check (status in ('active', 'revoked')),
  effective_from timestamptz not null,
  effective_to timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (effective_to > effective_from),
  unique (source, source_reference)
);
create index in_season_grants_owner_idx on public.in_season_grants(user_id);

create table public.in_season_workspaces (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('manual', 'yahoo', 'fantrax')),
  league_id text not null check (char_length(btrim(league_id)) between 1 and 200),
  team_id text not null check (char_length(btrim(team_id)) between 1 and 200),
  season_id integer not null check (season_id between 20002001 and 21992200 and season_id % 10000 = season_id / 10000 + 1),
  start_date date not null,
  end_date date not null,
  lock_version integer not null default 1 check (lock_version >= 1),
  workspace jsonb not null,
  snapshot jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date),
  unique (user_id, provider, league_id, team_id, season_id, start_date, end_date)
);
create index in_season_workspaces_owner_idx on public.in_season_workspaces(user_id);

alter table public.in_season_grants enable row level security;
alter table public.in_season_workspaces enable row level security;
revoke all on table public.in_season_grants, public.in_season_workspaces from anon, authenticated;
grant select, insert, update, delete on table public.in_season_grants, public.in_season_workspaces to service_role;

create trigger in_season_grants_touch_updated_at before update on public.in_season_grants
  for each row execute function public.update_updated_at_column();
create trigger in_season_workspaces_touch_updated_at before update on public.in_season_workspaces
  for each row execute function public.update_updated_at_column();
