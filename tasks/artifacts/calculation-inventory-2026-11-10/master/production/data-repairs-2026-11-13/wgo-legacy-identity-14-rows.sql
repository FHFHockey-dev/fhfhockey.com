-- F18 Gap 2: legacy WGO game identity for the two players WiGO rejects.
-- Glenn Gawdin 8478446: 12 rows. Ben McCartney 8481827: 2 rows. 14 rows in all.
-- WiGO reads each player's last 20 games and stops at the first bad row, so
-- fixing only the two reported rows would expose the next null row.
-- Source: api-web.nhle.com/v1/player/{id}/game-log/{season}/2, read 2026-11-13
-- (trimmed copies in nhl-api-gamelogs/). Every row matches the NHL log on
-- date, TOI (seconds), goals, assists and shots.
-- current_team_abbreviation is left NULL: it records the team at scrape time,
-- which the legacy writer never stored.
--
-- Run order: hygiene check, section 1 (before), section 2 (apply), section 1 again (after).
-- Needs TJ's approval. Connect with $TMPDIR/pgpool.sh.

-- 0. Hygiene: stop if more than 5 active queries or any active longer than 10 s.
select count(*) filter (where state = 'active') as active,
       coalesce(max(extract(epoch from now() - query_start)) filter (where state = 'active'), 0)::int as max_s
from pg_stat_activity where datname = 'postgres' and pid <> pg_backend_pid();

-- 1. Readback (before and after). Before: game_id, team_abbrev, opponent_team_abbrev, home_road all NULL.
select id, player_id, date, season_id, game_id, team_abbrev, opponent_team_abbrev, home_road, toi_per_game
from public.wgo_skater_stats
where id in (2987300, 2987757, 2988229, 2988576, 2989158, 3008484, 3009190, 3010465, 3010730,
             3063581, 3064218, 3065086, 3015185, 3015612)
order by player_id, date;

-- 2. Apply. One statement; it aborts and changes nothing unless exactly 14 rows match.
set statement_timeout = '10s';
set lock_timeout = '3s';
do $$
declare n int;
begin
  update public.wgo_skater_stats w
  set game_id = f.game_id,
      team_abbrev = f.team_abbrev,
      opponent_team_abbrev = f.opponent_team_abbrev,
      home_road = f.home_road
  from (values
    (2987300, 8478446, date '2021-02-20', 20202021, 364, 2020020285::bigint, 'CGY', 'EDM', 'R'),
    (2987757, 8478446, date '2021-02-22', 20202021, 136, 2020020298::bigint, 'CGY', 'TOR', 'R'),
    (2988229, 8478446, date '2021-02-24', 20202021, 251, 2020020310::bigint, 'CGY', 'TOR', 'R'),
    (2988576, 8478446, date '2021-02-25', 20202021, 647, 2020020318::bigint, 'CGY', 'OTT', 'R'),
    (2989158, 8478446, date '2021-02-27', 20202021, 310, 2020020333::bigint, 'CGY', 'OTT', 'R'),
    (3008484, 8478446, date '2021-05-09', 20202021, 673, 2020020720::bigint, 'CGY', 'OTT', 'H'),
    (3009190, 8478446, date '2021-05-13', 20202021, 527, 2020020647::bigint, 'CGY', 'VAN', 'H'),
    (3010465, 8478446, date '2021-10-16', 20212022, 488, 2021020031::bigint, 'CGY', 'EDM', 'R'),
    (3010730, 8478446, date '2021-10-18', 20212022, 621, 2021020037::bigint, 'CGY', 'ANA', 'H'),
    (3063581, 8478446, date '2022-11-06', 20222023, 518, 2022020192::bigint, 'ANA', 'FLA', 'H'),
    (3064218, 8478446, date '2022-11-09', 20222023, 694, 2022020210::bigint, 'ANA', 'MIN', 'H'),
    (3065086, 8478446, date '2022-11-12', 20222023, 515, 2022020234::bigint, 'ANA', 'CHI', 'H'),
    (3015185, 8481827, date '2021-11-05', 20212022, 901, 2021020160::bigint, 'ARI', 'ANA', 'R'),
    (3015612, 8481827, date '2021-11-06', 20212022, 784, 2021020172::bigint, 'ARI', 'SEA', 'H')
  ) as f(id, player_id, date, season_id, toi, game_id, team_abbrev, opponent_team_abbrev, home_road)
  where w.id = f.id and w.player_id = f.player_id and w.date = f.date and w.season_id = f.season_id
    and w.toi_per_game = f.toi and w.games_played = 1
    and w.game_id is null and w.team_abbrev is null and w.opponent_team_abbrev is null and w.home_road is null;
  get diagnostics n = row_count;
  if n <> 14 then
    raise exception 'F18 WGO repair expected 14 rows, matched %; nothing changed', n;
  end if;
end $$;

-- 3. WiGO frame check (after). Each player's last 20 appearances must carry a
-- distinct regular-season game id that agrees with season_id; expect bad = 0.
select player_id, count(*) as games,
       count(*) filter (where game_id is null
                        or season_id <> (game_id / 1000000) * 10000 + (game_id / 1000000) + 1
                        or (game_id / 10000) % 100 <> 2) as bad,
       count(distinct game_id) as distinct_ids
from (
  select player_id, game_id, season_id,
         row_number() over (partition by player_id order by date desc, game_id desc) as rn
  from public.wgo_skater_stats
  where player_id in (8478446, 8481827) and games_played = 1
) s
where rn <= 20
group by player_id order by player_id;

-- 4. Rollback. The NOT VALID check wgo_skater_stats_game_id_required still applies
-- to updated rows, so game_id cannot be set back to NULL without dropping that
-- constraint (a schema change; not proposed). A wrong value is corrected by a
-- targeted UPDATE to the right regular-season game id instead. Team, opponent and
-- home/road can be reverted to NULL:
-- update public.wgo_skater_stats
-- set team_abbrev = null, opponent_team_abbrev = null, home_road = null
-- where id in (2987300, 2987757, 2988229, 2988576, 2989158, 3008484, 3009190, 3010465, 3010730,
--              3063581, 3064218, 3065086, 3015185, 3015612);
