create or replace function public.upsert_yahoo_players_atomic(players_data jsonb[])
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog
as $$
declare
  p jsonb;
  snapshot_date date;
  captured_at timestamptz;
  ownership_value double precision;
  processed_count integer := 0;
  ownership_history_count integer := 0;
  draft_history_count integer := 0;
  ownership_omitted_count integer := 0;
begin
  if players_data is null or coalesce(array_length(players_data, 1), 0) = 0 then
    return jsonb_build_object(
      'processed', 0,
      'ownershipHistoryUpserted', 0,
      'draftHistoryUpserted', 0,
      'ownershipOmitted', 0
    );
  end if;

  -- Validate the full batch before its first write. Any later cast or write
  -- error also aborts the function call, rolling back latest and both histories.
  foreach p in array players_data loop
    if nullif(btrim(p->>'player_key'), '') is null then
      raise exception using
        errcode = '22023',
        message = 'Yahoo player_key is required.';
    end if;
    if nullif(btrim(p->>'current_date'), '') is null then
      raise exception using
        errcode = '22023',
        message = 'Yahoo current_date is required.';
    end if;
    perform (p->>'current_date')::date;
    if coalesce(p->>'snapshot_status', 'observed') not in ('observed', 'omitted') then
      raise exception using
        errcode = '22023',
        message = 'Yahoo snapshot_status is invalid.';
    end if;
  end loop;

  foreach p in array players_data loop
    snapshot_date := (p->>'current_date')::date;
    captured_at := snapshot_date::timestamp at time zone 'UTC';
    ownership_value := case
      when p ? 'percent_ownership'
        and jsonb_typeof(p->'percent_ownership') = 'number'
      then (p->>'percent_ownership')::double precision
      else null
    end;

    insert into public.yahoo_players (
      player_key,
      player_id,
      player_name,
      draft_analysis,
      average_draft_pick,
      average_draft_round,
      average_draft_cost,
      percent_drafted,
      editorial_player_key,
      editorial_team_abbreviation,
      editorial_team_full_name,
      eligible_positions,
      display_position,
      headshot_url,
      injury_note,
      full_name,
      percent_ownership,
      game_id,
      season,
      position_type,
      status,
      status_full,
      last_updated,
      uniform_number,
      ownership_timeline
    )
    values (
      p->>'player_key',
      p->>'player_id',
      p->>'player_name',
      p->'draft_analysis',
      nullif(p->>'average_draft_pick', '')::double precision,
      nullif(p->>'average_draft_round', '')::double precision,
      nullif(p->>'average_draft_cost', '')::double precision,
      nullif(p->>'percent_drafted', '')::double precision,
      p->>'editorial_player_key',
      p->>'editorial_team_abbreviation',
      p->>'editorial_team_full_name',
      p->'eligible_positions',
      p->>'display_position',
      p->>'headshot_url',
      p->>'injury_note',
      p->>'full_name',
      ownership_value,
      case
        when (p->>'game_id') ~ '^[0-9]+$' then (p->>'game_id')::integer
        else null
      end,
      case
        when (p->>'season') ~ '^[0-9]+$' then (p->>'season')::integer
        else null
      end,
      p->>'position_type',
      p->>'status',
      p->>'status_full',
      coalesce(nullif(p->>'last_updated', '')::timestamp, now()),
      case
        when (p->>'uniform_number') ~ '^[0-9]+$'
          then (p->>'uniform_number')::smallint
        else null
      end,
      case
        when ownership_value is null then '[]'::jsonb
        else jsonb_build_array(
          jsonb_build_object(
            'date', to_char(snapshot_date, 'YYYY-MM-DD'),
            'value', ownership_value
          )
        )
      end
    )
    on conflict (player_key) do update set
      player_id = coalesce(excluded.player_id, yahoo_players.player_id),
      player_name = coalesce(excluded.player_name, yahoo_players.player_name),
      draft_analysis = coalesce(excluded.draft_analysis, yahoo_players.draft_analysis),
      average_draft_pick = coalesce(excluded.average_draft_pick, yahoo_players.average_draft_pick),
      average_draft_round = coalesce(excluded.average_draft_round, yahoo_players.average_draft_round),
      average_draft_cost = coalesce(excluded.average_draft_cost, yahoo_players.average_draft_cost),
      percent_drafted = coalesce(excluded.percent_drafted, yahoo_players.percent_drafted),
      editorial_player_key = coalesce(excluded.editorial_player_key, yahoo_players.editorial_player_key),
      editorial_team_abbreviation = coalesce(excluded.editorial_team_abbreviation, yahoo_players.editorial_team_abbreviation),
      editorial_team_full_name = coalesce(excluded.editorial_team_full_name, yahoo_players.editorial_team_full_name),
      eligible_positions = coalesce(excluded.eligible_positions, yahoo_players.eligible_positions),
      display_position = coalesce(excluded.display_position, yahoo_players.display_position),
      headshot_url = coalesce(excluded.headshot_url, yahoo_players.headshot_url),
      injury_note = coalesce(excluded.injury_note, yahoo_players.injury_note),
      full_name = coalesce(excluded.full_name, yahoo_players.full_name),
      percent_ownership = coalesce(excluded.percent_ownership, yahoo_players.percent_ownership),
      game_id = coalesce(excluded.game_id, yahoo_players.game_id),
      season = coalesce(excluded.season, yahoo_players.season),
      position_type = coalesce(excluded.position_type, yahoo_players.position_type),
      status = coalesce(excluded.status, yahoo_players.status),
      status_full = coalesce(excluded.status_full, yahoo_players.status_full),
      last_updated = greatest(
        coalesce(excluded.last_updated, yahoo_players.last_updated),
        yahoo_players.last_updated
      ),
      uniform_number = coalesce(excluded.uniform_number, yahoo_players.uniform_number),
      ownership_timeline = case
        when ownership_value is null then yahoo_players.ownership_timeline
        else
          coalesce(
            (
              select jsonb_agg(entry)
              from jsonb_array_elements(
                coalesce(yahoo_players.ownership_timeline, '[]'::jsonb)
              ) as timeline(entry)
              where entry->>'date' is distinct from to_char(snapshot_date, 'YYYY-MM-DD')
            ),
            '[]'::jsonb
          )
          || jsonb_build_array(
            jsonb_build_object(
              'date', to_char(snapshot_date, 'YYYY-MM-DD'),
              'value', ownership_value
            )
          )
      end;

    if ownership_value is not null then
      insert into public.yahoo_player_ownership_history (
        player_key,
        ownership_date,
        ownership_pct,
        source,
        player_name,
        player_id,
        game_id,
        season_start_year
      )
      values (
        p->>'player_key',
        snapshot_date,
        ownership_value,
        'upsert_yahoo_players_atomic',
        coalesce(p->>'player_name', p->>'full_name'),
        case
          when (p->>'player_id') ~ '^[0-9]+$' then (p->>'player_id')::bigint
          else null
        end,
        p->>'game_id',
        case
          when (p->>'season') ~ '^[0-9]+$' then (p->>'season')::integer
          else null
        end
      )
      on conflict (player_key, ownership_date) do update set
        ownership_pct = excluded.ownership_pct,
        source = excluded.source,
        player_name = coalesce(excluded.player_name, yahoo_player_ownership_history.player_name),
        player_id = coalesce(excluded.player_id, yahoo_player_ownership_history.player_id),
        game_id = coalesce(excluded.game_id, yahoo_player_ownership_history.game_id),
        season_start_year = coalesce(
          excluded.season_start_year,
          yahoo_player_ownership_history.season_start_year
        );
      ownership_history_count := ownership_history_count + 1;
    else
      ownership_omitted_count := ownership_omitted_count + 1;
    end if;

    if p ? 'draft_analysis'
      and p->'draft_analysis' is not null
      and p->'draft_analysis' <> 'null'::jsonb
      and p->'draft_analysis' <> '{}'::jsonb
    then
      insert into public.yahoo_player_draft_analysis_history (
        player_key,
        captured_at,
        average_draft_pick,
        average_draft_round,
        average_draft_cost,
        percent_drafted,
        raw,
        source
      )
      values (
        p->>'player_key',
        captured_at,
        nullif(p->>'average_draft_pick', '')::numeric,
        nullif(p->>'average_draft_round', '')::numeric,
        nullif(p->>'average_draft_cost', '')::numeric,
        nullif(p->>'percent_drafted', '')::numeric,
        p->'draft_analysis',
        'upsert_yahoo_players_atomic'
      )
      on conflict (player_key, captured_at) do update set
        average_draft_pick = excluded.average_draft_pick,
        average_draft_round = excluded.average_draft_round,
        average_draft_cost = excluded.average_draft_cost,
        percent_drafted = excluded.percent_drafted,
        raw = excluded.raw,
        source = excluded.source;
      draft_history_count := draft_history_count + 1;
    end if;

    processed_count := processed_count + 1;
  end loop;

  return jsonb_build_object(
    'processed', processed_count,
    'ownershipHistoryUpserted', ownership_history_count,
    'draftHistoryUpserted', draft_history_count,
    'ownershipOmitted', ownership_omitted_count
  );
end;
$$;

revoke all on function public.upsert_yahoo_players_atomic(jsonb[])
  from public, anon, authenticated;
grant execute on function public.upsert_yahoo_players_atomic(jsonb[])
  to service_role;

comment on function public.upsert_yahoo_players_atomic(jsonb[]) is
  'Atomic fail-closed Yahoo latest, daily ownership, and daily draft snapshot writer.';
