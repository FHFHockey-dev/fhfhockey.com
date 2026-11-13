-- PREFLIGHT (read-only) companion checks for preflight-carried-keys.sql.
\echo '== A. computed (v4) teams on 2026-09-29..10-02: genuine games in the 150-day lookback'
select d::date as date, a.team_abbreviation as team, count(*) as genuine_games,
       min(a.date) as first_game, max(a.date) as source_through_date
from generate_series('2026-09-29'::date, '2026-10-02'::date, interval '1 day') d
join nst_team_gamelogs_as_rates a on a.situation = 'all' and a.gp = 1
  and a.date between d::date - 150 and d::date
group by 1, 2 order by 1, 2;
\echo '== B. "slide-out": team with a genuine game in [D-151, D-1] but none in [D-150, D] (would carry a v4 label), D in 09-29..11-13'
with gen as (select team_abbreviation t, date from nst_team_gamelogs_as_rates
             where situation = 'all' and gp = 1 and date between '2026-04-01' and '2026-11-13')
select d::date as date, g.t as team
from generate_series('2026-09-29'::date, '2026-11-13'::date, interval '1 day') d
join gen g on g.date = d::date - 151
where not exists (select 1 from gen x where x.t = g.t and x.date between d::date - 150 and d::date)
order by 1, 2;
\echo '== C. team codes the writer could see but that are not among the 32 rated teams'
with rated as (select distinct team_abbreviation t from team_power_ratings_daily where date = '2026-09-29')
select 'nst gp=1 2026-05-02..11-13' as source, team_abbreviation, count(*)
from nst_team_gamelogs_as_rates
where situation = 'all' and gp = 1 and date between '2026-05-02' and '2026-11-13'
  and team_abbreviation not in (select t from rated) group by 1, 2
union all
select 'stored rows 2026-07-31..11-12', team_abbreviation, count(*)
from team_power_ratings_daily
where date between '2026-07-31' and '2026-11-12'
  and team_abbreviation not in (select t from rated) group by 1, 2;
\echo '== D. rows per date 2026-09-29..11-13 (count, distinct teams, versions)'
select date, count(*) as rows, count(distinct team_abbreviation) as teams,
       string_agg(distinct coalesce(calculation_version, 'null'), ',') as versions
from team_power_ratings_daily where date between '2026-09-29' and '2026-11-13'
group by 1 order by 1;
\echo '== E. 2026-09-28 rows (the carry-forward source)'
select count(*) as rows, string_agg(distinct coalesce(calculation_version, 'null'), ',') as versions,
       string_agg(distinct source_through_date::text, ',') as sources
from team_power_ratings_daily where date = '2026-09-28';
\echo '== F. dates before 2026-09-29 the writer reads as carry-forward (09-28 back to 07-31)'
select min(date), max(date), count(*), string_agg(distinct coalesce(calculation_version, 'null'), ',')
from team_power_ratings_daily where date between '2026-07-31' and '2026-09-28';
\echo '== G. genuine games 2026-05-02..11-13 without complete 5-on-5 goaltending inputs (es_counts 5v5: ga, sa, xga, toi_seconds > 0)'
select count(*) as genuine_games,
       count(*) filter (where e.team_abbreviation is null) as no_5v5_row,
       count(*) filter (where e.team_abbreviation is not null
                        and (e.ga is null or e.sa is null or e.xga is null or coalesce(e.toi_seconds, 0) <= 0)) as incomplete_5v5_row
from nst_team_gamelogs_as_rates a
left join nst_team_gamelogs_es_counts e on e.situation = '5v5'
  and e.team_abbreviation = a.team_abbreviation and e.date = a.date
where a.situation = 'all' and a.gp = 1 and a.date between '2026-05-02' and '2026-11-13';
