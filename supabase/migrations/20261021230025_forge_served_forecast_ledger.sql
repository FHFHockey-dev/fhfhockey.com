-- Migration authority order 97: forge_served_forecast_ledger (S-B served-forecast ledger).
-- Release R19 (S-B). Applied 2026-10-21 as ledger version 20261021230025, before the R19 deploy. Source: tasks/artifacts/forge-projection-audit-2026-10-21/
-- s-b-served-forecast-ledger-design.md section 7, SQL unchanged; migration authority order 97.
-- The design proposed the file name 20261021190000_forge_served_forecast_ledger.sql;
-- it was renamed to the ledger version when filed, as was done for 92 and 95.
-- Apply BEFORE the R19 deploy: without the table the snapshot and settle routes return 500 and the public
-- /api/v1/forge/scoreboard returns 500.
-- Readers and writers (web/): pages/api/v1/db/forge-served-forecast-snapshot.ts (upsert on the PK),
-- pages/api/v1/db/forge-served-forecast-settle.ts (select, then upsert of the settlement columns),
-- pages/api/v1/forge/scoreboard.ts (select of settled rows). No browser access: RLS on, no policies,
-- explicit grants to service_role only (D4 pattern, 20261020224600_data_api_reviewed_object_grants.sql).
-- The second block (view forge_served_forecast_scoreboard_daily) is optional: no R19 code reads it.

-- S-B1: served-forecast ledger. One row per (served_date, player_id, game_id, source):
-- what the RSO bridge served (exact or re-aimed), the native head when set, and naive controls,
-- settled next day against WGO actuals. Unknown stays null, never 0.
set local lock_timeout = '5s';
set local statement_timeout = '30s';

create table if not exists public.forge_served_forecast_ledger (
  served_date date not null,
  season_id integer not null,
  player_id bigint not null,
  game_id bigint not null,
  source text not null check (source in ('bridge_exact', 'bridge_reaimed', 'native', 'naive_last5', 'naive_season')),
  player_class text not null check (player_class in ('skater', 'goalie')),
  team_id integer not null,
  opponent_team_id integer not null,
  is_home boolean not null,
  scheduled_at timestamptz not null,
  team_rest_days integer,
  opponent_rest_days integer,
  run_id uuid,
  source_watermark text,
  method_version text,
  cutoff_at timestamptz,
  issued_at timestamptz,
  expires_at timestamptz,
  participation_probability numeric,
  start_probability numeric,
  exp_goals numeric, exp_assists numeric, exp_pp_points numeric, exp_shots numeric, exp_hits numeric, exp_blocks numeric,
  exp_saves numeric, exp_goals_against numeric, exp_shots_against numeric, exp_win_prob numeric, exp_shutout_prob numeric,
  exp_fantasy_points numeric,
  act_goals numeric, act_assists numeric, act_pp_points numeric, act_shots numeric, act_hits numeric, act_blocks numeric,
  act_saves numeric, act_goals_against numeric, act_shots_against numeric, act_win smallint, act_shutout smallint,
  act_fantasy_points numeric,
  dressed boolean,
  started boolean,
  settled_at timestamptz,
  outcome_source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint forge_served_forecast_ledger_pkey primary key (served_date, player_id, game_id, source),
  constraint forge_served_forecast_ledger_issued_before_start check (issued_at is null or issued_at < scheduled_at)
);

comment on table public.forge_served_forecast_ledger is
  'S-B served-forecast ledger: per player-game forecasts the RSO was shown (bridge exact/re-aimed, native) and naive controls, settled against WGO actuals. Service role only.';

create index if not exists forge_served_forecast_ledger_served_date_source_idx
  on public.forge_served_forecast_ledger (served_date, source);
create index if not exists forge_served_forecast_ledger_game_id_idx
  on public.forge_served_forecast_ledger (game_id);

drop trigger if exists set_updated_at on public.forge_served_forecast_ledger;
create trigger set_updated_at before update on public.forge_served_forecast_ledger
  for each row execute function public.update_updated_at_column();

alter table public.forge_served_forecast_ledger enable row level security;

revoke all on table public.forge_served_forecast_ledger from public, anon, authenticated, service_role;
grant select, insert, update on table public.forge_served_forecast_ledger to service_role;


-- Optional (S-B2): per served_date x source x player_class aggregate over settled rows. No R19 code reads
-- this view; the scoreboard route scores a bounded select of the table instead.

create or replace view public.forge_served_forecast_scoreboard_daily
with (security_invoker = true) as
with settled as (
  select * from public.forge_served_forecast_ledger where settled_at is not null
), dressed as (
  select served_date, player_class, count(distinct (player_id, game_id)) as dressed
  from settled where dressed group by served_date, player_class
)
select s.served_date, s.source, s.player_class,
  count(*) as n,
  coalesce(d.dressed, 0) as dressed,
  count(distinct (s.player_id, s.game_id)) filter (where s.dressed) as covered,
  count(*) filter (where s.dressed = false) as phantoms,
  count(*) filter (where s.exp_fantasy_points is not null and s.act_fantasy_points is not null) as n_fantasy_points,
  avg(abs(s.exp_fantasy_points - s.act_fantasy_points)) as mae_fantasy_points, avg(s.exp_fantasy_points - s.act_fantasy_points) as bias_fantasy_points,
  avg(abs(s.exp_goals - s.act_goals)) as mae_goals, avg(s.exp_goals - s.act_goals) as bias_goals,
  avg(abs(s.exp_assists - s.act_assists)) as mae_assists, avg(s.exp_assists - s.act_assists) as bias_assists,
  avg(abs(s.exp_pp_points - s.act_pp_points)) as mae_pp_points, avg(s.exp_pp_points - s.act_pp_points) as bias_pp_points,
  avg(abs(s.exp_shots - s.act_shots)) as mae_shots, avg(s.exp_shots - s.act_shots) as bias_shots,
  avg(abs(s.exp_hits - s.act_hits)) as mae_hits, avg(s.exp_hits - s.act_hits) as bias_hits,
  avg(abs(s.exp_blocks - s.act_blocks)) as mae_blocks, avg(s.exp_blocks - s.act_blocks) as bias_blocks,
  avg(abs(s.exp_saves - s.act_saves)) as mae_saves, avg(s.exp_saves - s.act_saves) as bias_saves,
  avg(abs(s.exp_goals_against - s.act_goals_against)) as mae_goals_against, avg(s.exp_goals_against - s.act_goals_against) as bias_goals_against,
  avg(abs(s.exp_shots_against - s.act_shots_against)) as mae_shots_against, avg(s.exp_shots_against - s.act_shots_against) as bias_shots_against,
  avg(abs(s.exp_win_prob - s.act_win)) as mae_win, avg(s.exp_win_prob - s.act_win) as bias_win,
  avg(abs(s.exp_shutout_prob - s.act_shutout)) as mae_shutout, avg(s.exp_shutout_prob - s.act_shutout) as bias_shutout
from settled s
left join dressed d on d.served_date = s.served_date and d.player_class = s.player_class
group by s.served_date, s.source, s.player_class, d.dressed;

comment on view public.forge_served_forecast_scoreboard_daily is
  'S-B scoreboard: settled served-forecast ledger aggregates per served_date x source x player_class (n, dressed/covered/phantoms, MAE and bias per head and fantasy points). Service role only.';

revoke all on table public.forge_served_forecast_scoreboard_daily from public, anon, authenticated, service_role;
grant select on table public.forge_served_forecast_scoreboard_daily to service_role;

