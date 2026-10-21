# S-B — Served-forecast ledger, naive controls and scoreboard: design (2026-10-21)

Purpose: measure, on identical player-games and under TJ's league weights, what the RSO is actually shown (bridge lines, exact vs re-aimed), against naive controls and — when a head exists — the native path, so model changes (Q7, Q8, S-C…) have a gate and the dashboard stops showing an opaque 0–1 "accuracy". Snapshot-only: nothing here changes serving.

## 1. What is captured, when
- **Snapshot** once per day at 12:30Z (after the 10:05–10:55Z pipeline and the 11:30Z accuracy job; hours before any puck drop — the earliest NHL start is ~16:30Z), for every game on `served_date` (ET date). Re-running the same date is idempotent (upsert on the PK); a snapshot taken after a game's start is refused for that game (`issued_at` must precede `scheduled_at`).
- **Universe (v1):** every identified skater and goalie on the two rosters of each game that day — the same identity rules the bridge uses (`planningInputs.ts:136-146`) — not a league roster. This is a superset of any league's roster, so "coverage" = share of dressed players who had a forecast, and "phantoms" = forecasts for players who did not dress.
- **Sources** (one row per source per player-game):
  - `bridge_exact` — the bridge's own-game row (run that projected this game, as issued);
  - `bridge_reaimed` — the bridge's copied latest line after team/rest/tilt re-aim. Exact vs re-aimed is derived without a bridge change: a forecast's `revisionId` is `<bridge version>:<run_id>`; the issuing run's `forge_runs.as_of_date` equals the game's date for an own-game row and differs for a copied line (the bridge only takes own-game rows from runs that projected that date);
  - `native` — when `PLAYER_FORECAST_NATIVE_CATALOG_HEAD_ID` is set and the head is valid (`resolvePlanningContributions`, `GameExpectation.targets`);
  - `naive_last5` — mean of the player's last 5 `wgo_skater_stats` games before the date (unconditional; dressed assumed); goalies: last-10 start share × per-start means from `wgo_goalie_stats` (last 10 starts);
  - `naive_season` — season-to-date means (same tables); win probability for both naive goalie rows = the bridge's team-xG estimate (`teamWinProbability`, exported) or 0.5 when no prior.
- **Settlement** next day at 11:00Z (WGO skaters 07:30Z, goalies 07:35Z, pipeline WGO step 10:05Z) for `served_date` and the two days before it (late corrections): actuals from `wgo_skater_stats` by (game_id, player_id) and `goalie_stats_unified` by (game_id, player_id) — never `player_id` alone; `dressed` = a WGO row exists; `started` for goalies. Unknown stays null, never 0 (same rule as R15's accuracy fix).

## 2. Table `forge_served_forecast_ledger` (migration, authority order 93, pending)
One row per (served_date, player_id, game_id, source); wide columns so SQL aggregation is plain.
```
served_date date, season_id int, player_id bigint, game_id bigint, source text check (source in ('bridge_exact','bridge_reaimed','native','naive_last5','naive_season')),
player_class text check ('skater','goalie'), team_id int, opponent_team_id int, is_home bool, scheduled_at timestamptz,
team_rest_days int null, opponent_rest_days int null,
-- provenance
run_id uuid null, source_watermark text, method_version text, cutoff_at timestamptz, issued_at timestamptz, expires_at timestamptz,
participation_probability numeric null, start_probability numeric null,
-- expectations (null = unknown)
exp_goals numeric, exp_assists numeric, exp_pp_points numeric, exp_shots numeric, exp_hits numeric, exp_blocks numeric,
exp_saves numeric, exp_goals_against numeric, exp_shots_against numeric, exp_win_prob numeric, exp_shutout_prob numeric,
exp_fantasy_points numeric,              -- league default weights (= TJ's); null if any weighted head unknown
-- settlement
act_goals numeric, act_assists numeric, act_pp_points numeric, act_shots numeric, act_hits numeric, act_blocks numeric,
act_saves numeric, act_goals_against numeric, act_shots_against numeric, act_win smallint, act_shutout smallint,
act_fantasy_points numeric, dressed bool null, started bool null, settled_at timestamptz null, outcome_source text null,
created_at timestamptz default now(), updated_at timestamptz default now(),
primary key (served_date, player_id, game_id, source)
```
Indexes: `(served_date, source)`, `(game_id)`. service_role only (D4 grants pattern); no browser access. ~1,600 rows/day (≈400 skater-games + goalies × ≤4 sources), ~150 B/row.

## 3. Code
- `web/lib/player-forecasts/servedForecastLedger.ts` — pure: `buildLedgerRows({ date, games, players, bridgeForecasts, nativeExpectations?, wgoGameRows, goalieGameRows, teamPriors, now }) → LedgerRow[]`; `settleLedgerRows(rows, actuals) → LedgerRow[]`; `scoreLedger(rows, weights) → per-source metrics` (MAE, signed bias, n, coverage, phantoms; decile calibration by expected goals; reliability bins (10) for win/shutout/start/appearance; B2B slice by `team_rest_days = 1`). Reuses `computeSkaterFantasyPoints`/`computeGoalieFantasyPoints` (`lib/projections/accuracy/fantasyPoints.ts`) and the bridge's exported `teamWinProbability`.
- `web/pages/api/v1/db/forge-served-forecast-snapshot.ts` — `POST ?date=` (cron-wrapped like `/db` siblings): loads the bridge inputs via the existing loader (`loadForgeDailyBridgeForecasts`) plus the naive-control reads (bounded: `wgo_skater_stats` for the universe's player ids, last ~25 games each; `wgo_goalie_stats` last 10 starts), builds rows, upserts in batches of 500. Refuses games already started. Returns counts per source.
- `web/pages/api/v1/db/forge-served-forecast-settle.ts` — `POST ?date=` (default yesterday, plus the two prior days): bounded actual reads, upsert settled columns only.
- `web/pages/api/v1/forge/scoreboard.ts` — `GET ?days=14&scope=skater|goalie` → per day × source: n, MAE/bias per head, FP MAE, coverage, phantoms; decile-10 ratio; reliability bins; B2B slice. Read-only, cached 5 min. Data from a SQL view `forge_served_forecast_scoreboard_daily` (per served_date × source × player_class aggregates) for the heavy part; calibration computed in the route from a bounded select.
- Cron entries in `web/vercel.json` (deploy-time change; TJ approves at release): snapshot `30 12 * * *`, settle `0 11 * * *`.
- Dashboard card (later slice): replace `accuracy_avg` with the scoreboard's FP MAE per source.

## 4. Frozen-cohort protocol (PRD-consistent)
Cohort = every ledger row with `issued_at < scheduled_at` and `settled_at` set, from the first snapshot date; evaluate by `calendarLeadDays` (0 = own-game run, 1–7 = carried bridge lines); paired comparisons on identical (player, game) keys only; baseline = `naive_season`, challengers ≤ 2 at a time (`tasks/TASKS/forge-projections/v1/tasks-prd-projection-model.md` ~l.242). The adapter `ledgerToIssuedObservations.ts` feeds `evaluateIssuedObservations` (`lib/player-forecasts/evaluation.ts:51-139`) when its paired MAE/Brier outputs are wanted.

## 5. Slices
- **S-B1** (M): migration 93 + `servedForecastLedger.ts` (build + settle + score, pure, fixture-tested) + snapshot route + test.
- **S-B2** (M): settle route + scoreboard view/route + tests; vercel.json cron entries proposed in the release note.
- **S-B3** (S, later): dashboard card; optional per-team breakdown.
Dependencies: W-A's `reaimed` tag in the bridge (S-B1 can start with the watermark-date fallback); none on Q7/Q8.

## 6. Open points for TJ
- Snapshot universe v1 is public rosters, not your league roster — fine for model gating; a league-scoped view can come from the RSO's own planning load later (S-B3).
- Retention: keep all rows (≈0.5 M/season, <100 MB) or roll up after 60 days.
- Native rows appear only once a head is set; until then the comparison is bridge vs naive.

## 7. Migration SQL (to be filed by the release session)
Proposed file name `supabase/migrations/20261021190000_forge_served_forecast_ledger.sql` (authority order 93, pending; not applied, not registered). Writer: `web/pages/api/v1/db/forge-served-forecast-snapshot.ts` (service role, upsert on the PK, so INSERT + UPDATE). No browser access: RLS on, no policies, anon/authenticated revoked (D4 pattern, `20261020224600_data_api_reviewed_object_grants.sql`). `updated_at` uses the shared `public.update_updated_at_column()` trigger function from the baseline.
```sql
-- S-B1: served-forecast ledger. One row per (served_date, player_id, game_id, source):
-- what the RSO bridge served (exact or re-aimed), the native head when set, and naive controls,
-- settled next day against WGO actuals. Unknown stays null, never 0.
begin;
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

commit;
```

View (optional; S-B2) — plain per served_date × source × player_class aggregate over settled rows for the dashboard. `n_*` counts only rows where both sides are known (unknown stays null, never 0). `dressed` = distinct dressed player-games of that class on that date across all sources; `covered` = those this source forecast; `phantoms` = this source's rows for players who did not dress.
```sql
begin;

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

commit;
```
