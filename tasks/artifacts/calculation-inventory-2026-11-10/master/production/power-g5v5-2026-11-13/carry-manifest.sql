-- Carry manifest (decision 150, read-only): the team-dates in 2026-09-29..2026-11-13 with no genuine
-- (gp = 1, situation 'all') NST game in the 150-day lookback, and the exact row the v4 writer must leave
-- on each: the team's 2026-09-28 snapshot (label, source date and the 17 copied columns, full precision).
with gen as (
  select team_abbreviation t, date from nst_team_gamelogs_as_rates
  where situation = 'all' and gp = 1 and date between '2025-09-01' and '2026-11-13'
),
keys as (
  select r.team_abbreviation t, r.date d from team_power_ratings_daily r
  where r.date between '2026-09-29' and '2026-11-13'
    and not exists (select 1 from gen where gen.t = r.team_abbreviation and gen.date between r.date - 150 and r.date)
)
select k.t as team_abbreviation, k.d as date, p.calculation_version, p.source_through_date,
  p.off_rating, p.def_rating, p.pace_rating, p.xgf60, p.gf60, p.sf60, p.xga60, p.ga60, p.sa60, p.pace60,
  p.finishing_rating, p.goalie_rating, p.danger_rating, p.special_rating, p.discipline_rating,
  p.variance_flag, p.trend10
from keys k join team_power_ratings_daily p on p.team_abbreviation = k.t and p.date = '2026-09-28'
order by k.d, k.t;
