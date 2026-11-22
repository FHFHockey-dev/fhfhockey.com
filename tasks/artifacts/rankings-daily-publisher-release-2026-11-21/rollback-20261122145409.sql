-- Rollback for 20261122145409_rankings_readiness_standalone_wgo: restore the
-- 20261118151903 readiness body, then drop the digest helper. Run in one transaction.
-- ORDER: the FORGE daily WGO gate (candidates M/R, Nov 22) also calls
-- wgo_skater_date_digest and defers every scheduled FORGE run without it. Roll
-- back or replace that FORGE release first; run this only after no deployed
-- build calls the RPC.
create or replace function public.read_rankings_publication_readiness(
  p_season integer,
  p_last_served date,
  p_cutoff date
) returns jsonb
language plpgsql stable security invoker
set search_path = ''
set timezone = 'UTC'
as $$
declare
  season_year integer := p_season / 10000;
  season_start date;
  receipt jsonb;
begin
  if p_season is null or season_year not between 2000 and 2099
      or p_season % 10000 <> season_year + 1
      or p_last_served is null or p_cutoff is null then
    return jsonb_build_object('status', 'blocked', 'reason', 'invalid_scope');
  end if;
  season_start := make_date(season_year, 9, 1);
  if p_last_served < season_start or p_cutoff > make_date(season_year + 1, 6, 30)
      or p_cutoff - p_last_served not between 1 and 14 then
    return jsonb_build_object('status', 'blocked', 'reason', 'invalid_scope');
  end if;

  with calendar as materialized (
    select a.run_time, a.status, a.details #> '{responseOutcome,rankingsCalendar}' as proof
    from public.cron_job_audit a
    where a.job_name = '/api/v1/db/update-games'
      and a.run_time >= p_cutoff and a.run_time < p_cutoff + 2
      and a.details #>> '{responseOutcome,rankingsCalendar,version}' = '1'
      and (a.details #>> '{responseOutcome,rankingsCalendar,seasonId}' = p_season::text
        or a.details #> '{responseOutcome,rankingsCalendar,seasonId}' = 'null'::jsonb)
    order by a.run_time desc limit 1
  ), slate as materialized (
    select g.id, g.date, g."homeTeamId", g."awayTeamId", g."startTime",
      g.game_state_observed_at,
      case
        when g.game_state_observed_at is null then 'unknown'
        when g.game_schedule_state in ('PPD', 'SUSP', 'CNCL') then 'unplayed'
        when g.game_schedule_state = 'OK' and g.game_state in ('FINAL', 'OFF') then 'final'
        when g.game_schedule_state = 'OK' and g.game_state in ('FUT', 'PRE', 'LIVE', 'CRIT') then 'awaiting_final'
        else 'unknown'
      end as state
    from public.games g
    where g."seasonId" = p_season and g.type = 2
      and g.date > p_last_served and g.date <= p_cutoff
    order by g.date, g.id
    limit 225
  ), boxscores as materialized (
    select g.*, raw.payload, raw.payload_hash, raw.fetched_at
    from slate g
    left join public.nhl_api_game_payload_snapshot_heads head
      on head.game_id = g.id and head.endpoint = 'boxscore'
    left join public.nhl_api_game_payloads_raw raw
      on raw.id = head.raw_payload_id and raw.game_id = head.game_id
      and raw.endpoint = head.endpoint and raw.payload_hash = head.payload_hash
      and raw.game_date = g.date and raw.season_id = p_season
      and raw.fetched_at >= g."startTime"
      and (g.state = 'final' or raw.fetched_at >= g.game_state_observed_at)
      and raw.source_url = 'https://api-web.nhle.com/v1/gamecenter/' || g.id || '/boxscore'
    where g.state in ('final', 'awaiting_final')
  ), roster_arrays as materialized (
    select b.id, b.date, side.team, position.position,
      b.payload #> array['playerByGameStats', side.team, position.position] as players
    from boxscores b
    cross join (values ('homeTeam'), ('awayTeam')) side(team)
    cross join (values ('forwards'), ('defense')) position(position)
  ), roster as materialized (
    select a.id, a.date, a.team, a.position,
      case when jsonb_typeof(player->'playerId') = 'number'
        and player->>'playerId' ~ '^[1-9][0-9]{0,9}$'
        then (player->>'playerId')::bigint end as player_id,
      case when jsonb_typeof(player->'toi') = 'string'
        and player->>'toi' ~ '^[0-9]{1,3}:[0-5][0-9]$'
        then split_part(player->>'toi', ':', 1)::integer * 60
          + split_part(player->>'toi', ':', 2)::integer end as toi
    from roster_arrays a
    cross join lateral jsonb_array_elements(
      case when jsonb_typeof(a.players) = 'array' then a.players else '[]'::jsonb end
    ) as players(player)
  ), appearances as materialized (
    select id as game_id, date as game_date, player_id
    from roster
    where player_id is not null and toi > 0
  ), played_dates as (
    select distinct date from boxscores
  ), stages as materialized (
    select d.date, upstream.created_at as source_started_at,
      upstream.updated_at as source_completed_at,
      rolling.created_at as rolling_started_at,
      rolling.updated_at as rolling_completed_at,
      upstream.revision as source_revision, rolling.revision as rolling_revision,
      upstream.status = 'complete' and rolling.status = 'complete'
        and upstream.updated_at <= rolling.created_at as complete
    from played_dates d
    left join public.projection_pipeline_state upstream
      on upstream.pipeline_key = 'rolling_forge_pipeline'
      and upstream.scope_key = 'daily_incremental:' || (d.date + 1)
      and upstream.operation_key = 'upstream_skater_sources'
      and upstream.range_start_date = d.date + 1 and upstream.range_end_date = d.date + 1
    left join public.projection_pipeline_state rolling
      on rolling.pipeline_key = upstream.pipeline_key and rolling.scope_key = upstream.scope_key
      and rolling.operation_key = 'rolling_player_recompute'
      and rolling.range_start_date = d.date + 1 and rolling.range_end_date = d.date + 1
  ), source_receipts as materialized (
    select s.*,
      (select a.run_time
        from (
          select a.run_time, a.status, a.details
          from public.cron_job_audit a
          where a.run_time >= s.date + 1 and a.run_time < p_cutoff + 2
            and a.job_name = 'update-nst-gamelog'
            and (a.details->>'rankingsSourceDate' = s.date::text
              or a.details #>> '{nstProgress,scope}' like
                '{"version":2,"runMode":"incremental","dates":["' || s.date || '"],%')
          order by a.run_time desc limit 1
        ) a
        where a.status = 'success'
          -- The route stores scope as JSON text. Match the known leading
          -- v2/single-date header without casting unrelated legacy audit text.
          and a.details #>> '{nstProgress,scope}' like
            '{"version":2,"runMode":"incremental","dates":["' || s.date || '"],%'
          and a.details #>> '{nstProgress,scope}' not like '%"datasetType":%'
          and a.details #>> '{nstProgress,scope}' not like '%"datasetGroup":%'
          and a.details #>> '{nstProgress,scope}' not like '%"allowHistoricalDatedRequests":true%'
          and a.details #>> '{nstProgress,state}' = 'attempts_finished_coverage_unverified'
          and a.details #>> '{nstProgress,sourceOutcomes,unresolvedCount}' = '0'
          and a.details #> '{nstProgress,sourceDown}' = 'null'::jsonb
          and a.details #>> '{nstProgress,stoppedEarly}' = 'false'
          and a.details->>'auditPersistence' is distinct from 'not_confirmed'
          and a.details->>'writePersistence' is distinct from 'not_confirmed'
          and a.details #>> '{nstProgress,continuation,blocked}' = 'false'
          and a.details #>> '{nstProgress,continuation,nextIndex}' =
            a.details #>> '{nstProgress,continuation,totalUrls}'
          and a.details #>> '{nstProgress,plannedRequestCount}' ~ '^[1-9][0-9]*$'
          and a.details #>> '{nstProgress,plannedRequestCount}' =
            a.details #>> '{nstProgress,continuation,totalUrls}') as nst_completed_at,
      (select a.run_time
        from (
          select a.run_time, a.status, a.details, a.job_name, a.rows_affected
          from public.cron_job_audit a
          where a.run_time >= s.date + 1 and a.run_time < p_cutoff + 2
            and a.job_name in ('update-all-wgo-skaters', '/api/v1/db/update-wgo-skaters')
            and (a.details->>'rankingsSourceDate' = s.date::text
              or a.details #>> '{context,startDate}' = s.date::text
              or a.details->>'url' ~ ('[?&](date|startDate)=' || s.date || '(&|$)'))
          order by a.run_time desc limit 1
        ) a
        where a.status = 'success'
          and a.details #>> '{context,startDate}' = s.date::text
          and a.details #>> '{context,failedDatesCount}' = '0'
          and a.details->>'auditPersistence' is distinct from 'not_confirmed'
          and a.details->>'writePersistence' is distinct from 'not_confirmed'
          and (
            (a.job_name = 'update-all-wgo-skaters'
              and a.details #> '{context,datesProcessed}' ? (s.date::text))
            or
            (a.job_name = '/api/v1/db/update-wgo-skaters' and a.rows_affected > 0
              and a.details #>> '{context,season}' = p_season::text
              and a.details #>> '{context,endDate}' = s.date::text
              and a.details #>> '{context,skippedDatesCount}' = '0')
          )) as wgo_completed_at
    from stages s
  ), producer_receipts as materialized (
    select s.date, s.source_revision, s.rolling_revision, s.nst_completed_at, s.wgo_completed_at,
      coalesce(repair.started_at, daily.started_at) as rolling_started_at,
      coalesce(repair.completed_at, daily.completed_at) as rolling_completed_at
    from source_receipts s
    left join lateral (
      select s.rolling_started_at as started_at, s.rolling_completed_at as completed_at
      where s.complete and s.nst_completed_at between s.source_started_at and s.source_completed_at
        and s.wgo_completed_at between s.nst_completed_at and s.source_completed_at
    ) daily on true
    left join lateral (
      -- Allow a later, explicitly scoped rolling repair after both durable
      -- provider receipts. The rolling route emits this compact terminal
      -- proof only after an untruncated whole-cohort 5v5 write.
      select scoped.started_at, scoped.run_time as completed_at
      from (
        select a.run_time, case when a.details #>> '{timing,startedAt}' ~
          '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$'
          then (a.details #>> '{timing,startedAt}')::timestamptz end as started_at
        from public.cron_job_audit a
        where a.run_time >= s.date + 1 and a.run_time < p_cutoff + 2
          and a.job_name = '/api/v1/db/update-rolling-player-averages'
          and a.status = 'success'
          and a.details #>> '{responseOutcome,success}' = 'true'
          and a.details #>> '{responseOutcome,rankingSourceDate}' = s.date::text
          and a.details #>> '{responseOutcome,rankingSourceSeason}' = p_season::text
      ) scoped
      where s.nst_completed_at is not null and s.wgo_completed_at is not null
        and scoped.started_at between greatest(s.nst_completed_at, s.wgo_completed_at) and scoped.run_time
        and scoped.run_time - scoped.started_at <= interval '240 seconds'
        and (daily.completed_at is null or scoped.run_time > daily.completed_at)
      order by scoped.run_time desc limit 1
    ) repair on true
  ), wgo_source as materialized (
    select w.player_id, w.game_id, w.date as game_date, w.toi_per_game_5v5
    from public.wgo_skater_stats w
    where w.season_id = p_season and w.games_played = 1
      and w.date between season_start and p_cutoff
    limit 60001
  ), wgo as materialized (
    select * from wgo_source
    where game_id / 1000000 = season_year and game_id / 10000 % 100 = 2
  ), baseline as (
    select distinct player_id from wgo where game_date <= p_last_served
  ), published_baseline as materialized (
    select r.entity_id as player_id
    from public.entity_metric_rankings r
    where r.entity_type = 'skater' and r.season_id = p_season
      and r.snapshot_date = p_last_served and r.strength_state = '5v5'
      and r.window_type = 'season' and r.window_size = 0
      and r.metric_key = 'points_per_60' and r.peer_group_type = 'all_skaters'
      and r.peer_group_key = 'all'
    limit 1001
  ), latest as materialized (
    select distinct on (player_id) player_id, game_id, game_date
    from wgo
    order by player_id, game_date desc, game_id
    limit 1001
  ), rolling_expected as (
    select player_id, game_id, game_date from latest
    union select player_id, game_id, game_date from appearances
  ), rolling as materialized (
    select e.*, row.updated_at, support.updated_at as support_updated_at,
      row.game_id = e.game_id and support.game_id = e.game_id
        and support.support_payload #>> '{windowCountSupport,version}' =
          'rolling-player-window-counts-v1' as exact_source
    from rolling_expected e
    left join public.rolling_player_game_metrics row on row.player_id = e.player_id
      and row.game_date = e.game_date and row.strength_state = '5v5' and row.season = p_season
    left join public.rolling_player_metric_support_payloads support
      on support.player_id = e.player_id and support.game_date = e.game_date
      and support.strength_state = '5v5' and support.season = p_season
  ), contradictions as (
    select 'official_boxscore_without_scheduled_final' as reason
    from public.nhl_api_game_payloads_raw raw
    join public.nhl_api_game_payload_snapshot_heads head on head.raw_payload_id = raw.id
      and head.game_id = raw.game_id and head.endpoint = raw.endpoint and head.payload_hash = raw.payload_hash
    where raw.season_id = p_season and raw.endpoint = 'boxscore'
      and raw.game_date > p_last_served and raw.game_date <= p_cutoff
      and raw.payload->>'gameType' = '2'
      and raw.payload->>'gameState' in ('FINAL', 'OFF')
      and not exists (select 1 from slate g
        where g.id = raw.game_id and g.date = raw.game_date and g.state in ('final', 'awaiting_final'))
  ), gaps as (
    select 'unknown_schedule' as reason from slate where state = 'unknown'
    union all select reason from contradictions
    union all select 'cutoff_schedule_unverified' where not exists (
      select 1 from calendar where status = 'success' and proof->>'status' = 'complete'
        and jsonb_typeof(proof->'days'->p_cutoff::text) = 'array'
    )
    union all select 'calendar_slate_mismatch'
      from generate_series(1, p_cutoff - p_last_served) days(offset_days)
      cross join calendar
      where proof->'days'->((p_last_served + offset_days)::text) is distinct from
        coalesce((select jsonb_agg(g.id order by g.id)
          from slate g where g.date = p_last_served + offset_days), '[]'::jsonb)
    union all select 'game_budget' where (select count(*) from slate) >= 225
    union all select 'invalid_boxscore' from boxscores b
      where (b.payload->'id' = to_jsonb(b.id) and b.payload->'season' = to_jsonb(p_season)
        and b.payload->'gameDate' = to_jsonb(b.date) and b.payload->'gameType' = '2'::jsonb
        and b.payload->>'gameState' in ('FINAL', 'OFF') and b.payload->>'gameScheduleState' = 'OK'
        and b.payload #> '{homeTeam,id}' = to_jsonb(b."homeTeamId")
        and b.payload #> '{awayTeam,id}' = to_jsonb(b."awayTeamId")) is not true
    union all select 'invalid_official_roster' from roster_arrays a
      where jsonb_typeof(a.players) is distinct from 'array'
        or not exists (select 1 from roster r where r.id = a.id and r.team = a.team and r.toi > 0)
    union all select 'invalid_official_roster' from roster where player_id is null or toi is null
    union all select 'ambiguous_official_appearance' from roster group by player_id, date having count(*) > 1
    union all select 'upstream_receipt_missing' from producer_receipts
      where nst_completed_at is null or wgo_completed_at is null
    union all select 'rolling_receipt_missing' from producer_receipts where rolling_started_at is null
    union all select 'wgo_budget' where (select count(*) from wgo_source) > 60000
    union all select 'invalid_wgo_identity' from wgo_source
      where game_id is null or player_id <= 0 or game_id / 1000000 <> season_year
    union all select 'ambiguous_wgo_appearance' from wgo group by player_id, game_date having count(*) > 1
    union all select 'baseline_cohort_mismatch'
      where not exists (select 1 from published_baseline)
        or exists (select player_id from baseline except select player_id from published_baseline)
        or exists (select player_id from published_baseline except select player_id from baseline)
    union all select 'wgo_appearance_mismatch' where
      exists (select player_id, game_id, game_date from appearances
        except select player_id, game_id, game_date from wgo where game_date > p_last_served)
      or exists (select player_id, game_id, game_date from wgo where game_date > p_last_served
        except select player_id, game_id, game_date from appearances)
    union all select 'nst_5v5_input_missing'
      from wgo w
      join appearances a using (player_id, game_id, game_date)
      left join public.nst_gamelog_5v5_counts counts on counts.player_id = w.player_id
        and counts.date_scraped = w.game_date and counts.season = p_season
      left join public.nst_gamelog_5v5_counts_oi oi on oi.player_id = w.player_id
        and oi.date_scraped = w.game_date and oi.season = p_season
      where not coalesce(
        (w.toi_per_game_5v5 = 0 and coalesce(counts.toi, 0) = 0 and coalesce(oi.toi, 0) = 0)
        or (
          -- Match the rolling producer's precedence. Rates and secondary
          -- fields can legitimately be absent when raw counts supply values.
          counts.toi > 0 and oi.toi > 0 and counts.goals is not null
          and counts.total_points is not null and counts.total_assists is not null
          and counts.first_assists is not null and counts.shots is not null
          and counts.icf is not null and counts.iff is not null and counts.ixg is not null
          and oi.gf is not null and oi.ga is not null and oi.xgf is not null and oi.xga is not null
        ), false)
    union all select 'cohort_budget' where (select count(*) from latest) not between 1 and 1000
    union all select 'rolling_5v5_source_missing' from rolling r
      left join producer_receipts d on d.date = r.game_date
      where r.exact_source is not true or r.updated_at is null or r.support_updated_at is null
        -- Pre-baseline inputs can predate the shared stamp. A newer support
        -- row still signals a write the corresponding rolling row never saw.
        or r.support_updated_at > r.updated_at
        or (r.game_date > p_last_served and (
          r.updated_at is distinct from r.support_updated_at
          or r.updated_at < d.rolling_started_at or r.updated_at > d.rolling_completed_at
        ))
  ), detail as (
    select array(select distinct reason from gaps order by reason) as reasons,
      (select count(*) from slate) as games,
      (select count(*) from appearances) as appearances
  )
  select case
    when cardinality(detail.reasons) > 0 then jsonb_build_object(
      'status', 'blocked', 'reason', 'source_incomplete', 'details', detail.reasons)
    when not exists (select 1 from slate where date = p_cutoff and state in ('final', 'awaiting_final'))
      then jsonb_build_object('status', 'no_slate', 'cutoffDate', p_cutoff)
    else jsonb_build_object(
      'status', 'ready', 'cutoffDate', p_cutoff,
      'readyAt', greatest(
        (select run_time from calendar),
        (select max(greatest(fetched_at, game_state_observed_at)) from boxscores),
        (select max(rolling_completed_at) from producer_receipts),
        (select max(greatest(updated_at, support_updated_at)) from rolling)
      ),
      'expectedRollingSources', (
        select jsonb_agg(jsonb_build_object('playerId', r.player_id, 'gameId', r.game_id,
          'gameDate', r.game_date, 'updatedAt', r.updated_at, 'supportUpdatedAt', r.support_updated_at)
          order by r.player_id)
        from latest l join rolling r using (player_id, game_id, game_date)
      ),
      'evidence', jsonb_build_object(
        'games', detail.games, 'appearances', detail.appearances,
        'calendar', (select jsonb_build_array(run_time, proof) from calendar),
        'slate', (select jsonb_agg(jsonb_build_array(id, date, state, game_state_observed_at)
          order by id) from slate),
        'boxscores', (select jsonb_agg(jsonb_build_array(id, payload_hash) order by id) from boxscores),
        'stages', (select jsonb_agg(to_jsonb(d) order by d.date) from producer_receipts d),
        'rollingGap', (select jsonb_agg(jsonb_build_array(player_id, game_id, game_date,
          updated_at, support_updated_at) order by player_id, game_date)
          from rolling where game_date > p_last_served)
      )
    )
    end
  into receipt
  from detail;
  return receipt;
end;
$$;

revoke all on function public.read_rankings_publication_readiness(integer, date, date)
  from public, anon, authenticated;
grant execute on function public.read_rankings_publication_readiness(integer, date, date)
  to service_role;

drop function public.wgo_skater_date_digest(date);
delete from supabase_migrations.schema_migrations where version = '20261122145409';
