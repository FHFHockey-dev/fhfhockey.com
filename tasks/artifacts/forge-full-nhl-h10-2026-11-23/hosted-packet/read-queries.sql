-- PROPOSED BOUNDED PRODUCTION READ (read-only; for Chef to put to TJ). These are the exact SELECTs the hosted route
-- runs (web/lib/forge-v2/h10Reader.server.ts H10_SQL), with $1/$2 bound below. Run once, read-only, as one
-- `begin read only; ... rollback;` session, with statement_timeout 30s, and save each result as CSV next to the
-- receipts. That allows a local run of the producer on real inputs against a disposable database. No writes, no
-- NST, no route or cron.
-- Expected sizes: games ≤ 1,312; rosters ≤ ~1,400; logs ≤ ~25,000 (60-day window); roster events ≤ 500;
-- queries 6–8 are diagnostics, ≤ 20, ≤ 50 and ≤ 300 rows.
begin read only;
set local statement_timeout = '30s';
-- 1. Season schedule (start, home/away, state, observed clock).
select g.id::text as id, g."seasonId"::text as season_id, g.type, g."homeTeamId" as home_team_id, g."awayTeamId" as away_team_id, g.date::text as date,
  g."startTime" as start_time, g.game_schedule_state, g.game_state, coalesce(g.game_state_observed_at, g.created_at) as observed_at
from public.games g where g."seasonId" = 20262027 and g.type = 2 order by g.id limit 1500;
-- 2. Current rosters with the official-roster clock and position.
select r."playerId"::text as player_id, r."teamId" as team_id, r.official_seen_at, p.position::text as position
from public.rosters r join public.players p on p.id = r."playerId"
where r."seasonId" = 20262027 and r.is_current order by r."playerId" limit 3000;
-- 3. Skater game lines for the training window (60 days before the cutoff).
select w.player_id, w.game_id::text as game_id, w.season_id, t.id as team_id, o.id as opponent_id, w.home_road, w.goals, w.assists, w.pp_points, w.shots, w.hits,
  w.blocked_shots, w.penalty_minutes, g."startTime" as start_time
from public.wgo_skater_stats w
join public.teams t on t.abbreviation = w.team_abbrev
join public.teams o on o.abbreviation = w.opponent_team_abbrev
join public.games g on g.id = w.game_id
where w.season_id = 20262027 and w.date >= date '2026-09-24' and w.game_id is not null order by w.game_id, w.player_id limit 40000;
-- 4. Roster events since the nightly cutoff (material availability changes).
select e.event_id::text as event_id, e.player_id::text as player_id, e.team_id, e.event_type, e.effective_from, e.created_at
from public.forge_roster_events e where e.created_at > timestamptz '2026-11-23 09:00:00+00' and e.player_id is not null order by e.event_id limit 500;
-- 5. Schema facts the hosted packet depends on (no row data).
select to_regclass('forge_v2_private.forge_v2_vintages') is not null as v2_schema_applied,
  (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'wgo_skater_stats' and column_name in ('created_at','updated_at')) as wgo_receipt_clock_columns;
-- 6. The traded players' rosters rows (does the official roster feed show the 2026-11-22 trade, and when?).
select r."playerId", r."teamId", r.is_current, r.official_seen_at, r.created_at, r.ended_at
from public.rosters r where r."seasonId" = 20262027 and r."playerId" in (8477946, 8481523, 8478470) order by r."playerId", r.created_at limit 20;
-- 7. What the roster-event feed carries (material-update coverage), counts only.
select e.event_type, count(*) as n, min(e.created_at) as first_at, max(e.created_at) as last_at
from public.forge_roster_events e where e.created_at > timestamptz '2026-10-01 00:00:00+00' group by e.event_type order by n desc limit 50;
-- 8. Candidate trade-evidence source (decision D1): published trade, roster-move and waiver cards since 2026-11-15,
--    with linked players and teams. Is the Larkin, Dach and Montembeault trade there, and when was it first published?
select i.category, i.published_at, i.observed_at, i.created_at, p.player_id, p.team_id, p.role
from public.news_feed_items i join public.news_feed_item_players p on p.news_item_id = i.id
where i.card_status = 'published' and upper(i.category) in ('TRADE', 'ROSTER MOVE', 'WAIVER', 'TRANSACTION', 'SIGNING')
  and i.published_at > timestamptz '2026-11-15 00:00:00+00' order by i.published_at limit 300;
rollback;
