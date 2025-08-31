-- Migration: Add draft history table, mapping tables, and upsert_players_batch RPC
-- Date: 2025-08-27

-- Draft analysis history table
create table if not exists public.yahoo_player_draft_analysis_history (
  player_key text not null,
  captured_at timestamptz not null default now(),
  average_draft_pick numeric(8,3),
  average_draft_round numeric(6,3),
  average_draft_cost numeric(10,3),
  percent_drafted numeric(6,3),
  raw jsonb not null,
  source text default 'yahoo',
  primary key (player_key, captured_at)
);
create index if not exists ix_yahoo_player_draft_analysis_history_recent on public.yahoo_player_draft_analysis_history (player_key, captured_at desc);

-- Mapping table (authoritative)
-- NOTE: A database object named "yahoo_nhl_player_map" already exists in the
-- target database as a view. Creating a table (or an index on the same name)
-- will fail on that DB. We intentionally do not create/alter the
-- `yahoo_nhl_player_map` object here to avoid clobbering an existing view.
-- The repository contains a materialized table `yahoo_nhl_player_map_mat` that
-- is the operational target for upserts. The migration below will create the
-- unmatched queue and the draft-history table and install the upsert RPC.

-- Unmatched queue
create table if not exists public.yahoo_nhl_player_map_unmatched (
  id bigserial primary key,
  nhl_player_id text,
  nhl_player_name text,
  nhl_normalized text,
  candidate_yahoo jsonb,
  attempts int default 0,
  created_at timestamptz default now(),
  last_attempt_at timestamptz
);

-- Upsert RPC to write latest snapshot and append ownership + draft history
create or replace function public.upsert_players_batch(players_data jsonb)
returns jsonb language plpgsql as $$
declare
  rec jsonb;
  processed int := 0;
  history int := 0;
begin
  if players_data is null then
    return jsonb_build_object('processed', 0, 'history_inserted', 0);
  end if;

  for rec in select * from jsonb_array_elements(players_data) loop
    processed := processed + 1;

    -- Upsert latest player snapshot into yahoo_players
    begin
      insert into public.yahoo_players (
        player_key, player_id, player_name, draft_analysis, average_draft_pick,
        average_draft_round, average_draft_cost, percent_drafted, editorial_player_key,
        editorial_team_abbreviation, editorial_team_full_name, eligible_positions,
        display_position, headshot_url, injury_note, full_name, percent_ownership,
        percent_owned_value, position_type, status, status_full, last_updated, uniform_number
      ) values (
        rec->>'player_key', rec->>'player_id', rec->>'player_name', rec->'draft_analysis',
        (rec->>'average_draft_pick')::numeric, (rec->>'average_draft_round')::numeric, (rec->>'average_draft_cost')::numeric,
        (rec->>'percent_drafted')::numeric, rec->>'editorial_player_key', rec->>'editorial_team_abbreviation', rec->>'editorial_team_full_name',
        (rec->'eligible_positions')::jsonb, rec->>'display_position', rec->>'headshot_url', rec->>'injury_note', rec->>'full_name',
        (rec->>'percent_ownership')::numeric, (rec->>'percent_owned_value')::numeric, rec->>'position_type', rec->>'status', rec->>'status_full', now(),
        (rec->>'uniform_number')::int
      ) on conflict (player_key) do update set
        player_id = excluded.player_id,
        player_name = excluded.player_name,
        draft_analysis = excluded.draft_analysis,
        average_draft_pick = excluded.average_draft_pick,
        average_draft_round = excluded.average_draft_round,
        average_draft_cost = excluded.average_draft_cost,
        percent_drafted = excluded.percent_drafted,
        editorial_player_key = excluded.editorial_player_key,
        editorial_team_abbreviation = excluded.editorial_team_abbreviation,
        editorial_team_full_name = excluded.editorial_team_full_name,
        eligible_positions = excluded.eligible_positions,
        display_position = excluded.display_position,
        headshot_url = excluded.headshot_url,
        injury_note = excluded.injury_note,
        full_name = excluded.full_name,
        percent_ownership = excluded.percent_ownership,
        percent_owned_value = excluded.percent_owned_value,
        position_type = excluded.position_type,
        status = excluded.status,
        status_full = excluded.status_full,
        last_updated = now(),
        uniform_number = excluded.uniform_number;
    exception when others then
      -- swallow individual errors to allow batch progress; log minimal info
      raise notice 'Upsert yahoo_players failed for player_key=%', rec->>'player_key';
    end;

    -- Append ownership history if ownership information present
    begin
      if rec ? 'percent_ownership' then
        insert into public.yahoo_player_ownership_history(
          player_key, captured_at, ownership_pct, percent_drafted, average_draft_pick,
          average_draft_round, average_draft_cost, raw, source
        ) values (
          rec->>'player_key', now(), (rec->>'percent_ownership')::numeric, (rec->>'percent_drafted')::numeric,
          (rec->>'average_draft_pick')::numeric, (rec->>'average_draft_round')::numeric, (rec->>'average_draft_cost')::numeric, rec, 'yahoo'
        );
        history := history + 1;
      end if;
    exception when others then
      raise notice 'Append ownership history failed for player_key=%', rec->>'player_key';
    end;

    -- Append draft analysis history if draft_analysis present
    begin
      if rec ? 'draft_analysis' then
        insert into public.yahoo_player_draft_analysis_history(
          player_key, captured_at, average_draft_pick, average_draft_round, average_draft_cost, percent_drafted, raw, source
        ) values (
          rec->>'player_key', now(), (rec->>'average_draft_pick')::numeric, (rec->>'average_draft_round')::numeric,
          (rec->>'average_draft_cost')::numeric, (rec->>'percent_drafted')::numeric, rec, 'yahoo'
        );
      end if;
    exception when others then
      raise notice 'Append draft history failed for player_key=%', rec->>'player_key';
    end;

  end loop;

  return jsonb_build_object('processed', processed, 'history_inserted', history);
end; $$;
