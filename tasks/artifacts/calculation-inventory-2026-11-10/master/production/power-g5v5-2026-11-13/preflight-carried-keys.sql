-- PREFLIGHT (read-only): team-dates in 2026-09-29..2026-11-13 the v4 writer cannot compute,
-- because the team has no genuine (gp = 1, situation 'all') NST row in its 150-day lookback
-- [D-150, D]. For each: the stored row now, the 2026-09-28 row the writer will carry
-- forward, and the evidence (gp values in the lookback, last genuine game before it).
with gen as (
  select team_abbreviation t, date
  from nst_team_gamelogs_as_rates
  where situation = 'all' and gp = 1 and date between '2025-09-01' and '2026-11-13'
),
keys as (
  select r.team_abbreviation t, r.date d
  from team_power_ratings_daily r
  where r.date between '2026-09-29' and '2026-11-13'
    and not exists (select 1 from gen where gen.t = r.team_abbreviation
                    and gen.date between r.date - 150 and r.date)
)
select k.t as team, k.d as date,
  cur.calculation_version as now_version, cur.source_through_date as now_source,
  round(cur.off_rating::numeric,2) now_off, round(cur.def_rating::numeric,2) now_def,
  round(cur.pace_rating::numeric,2) now_pace, round(cur.finishing_rating::numeric,2) now_fin,
  round(cur.goalie_rating::numeric,2) now_goalie, round(cur.danger_rating::numeric,2) now_danger,
  round(cur.special_rating::numeric,2) now_special, round(cur.discipline_rating::numeric,2) now_disc,
  round(cur.trend10::numeric,2) now_trend10, cur.pp_tier now_pp_tier, cur.pk_tier now_pk_tier,
  coalesce(p.calculation_version,'(null)') as carry_version, p.source_through_date as carry_source,
  round(p.off_rating::numeric,2) carry_off, round(p.def_rating::numeric,2) carry_def,
  round(p.pace_rating::numeric,2) carry_pace, round(p.finishing_rating::numeric,2) carry_fin,
  round(p.goalie_rating::numeric,2) carry_goalie, round(p.danger_rating::numeric,2) carry_danger,
  round(p.special_rating::numeric,2) carry_special, round(p.discipline_rating::numeric,2) carry_disc,
  round(p.trend10::numeric,2) carry_trend10,
  (k.d - 150) as lookback_start,
  (select count(*) from nst_team_gamelogs_as_rates a where a.situation = 'all'
     and a.team_abbreviation = k.t and a.date between k.d - 150 and k.d) as nst_rows_in_lookback,
  (select string_agg(distinct coalesce(a.gp::text,'null'), ',') from nst_team_gamelogs_as_rates a
     where a.situation = 'all' and a.team_abbreviation = k.t and a.date between k.d - 150 and k.d) as gp_values_in_lookback,
  (select max(gen.date) from gen where gen.t = k.t and gen.date < k.d) as last_genuine_game,
  (select min(gen.date) from gen where gen.t = k.t and gen.date > k.d) as next_genuine_game
from keys k
join team_power_ratings_daily cur on cur.team_abbreviation = k.t and cur.date = k.d
left join team_power_ratings_daily p on p.team_abbreviation = k.t and p.date = '2026-09-28'
order by k.d, k.t;
