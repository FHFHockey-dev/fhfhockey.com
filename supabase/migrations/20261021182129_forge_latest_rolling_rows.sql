-- FORGE skater reader (web/lib/projections/queries/skater-queries.ts, fetchRollingRows):
-- the latest rolling row per requested player for one strength before p_before
-- (exclusive), with only the sidecar keys FORGE hydrates. It replaces paging every
-- row of the 365 days before the cutoff (count=exact on each page) plus each row's
-- whole support_payload: about 4,900 wide rows and sidecars per team-game to use
-- about 60 (2026-10-21 audit, proposal Q-3).
--
-- One output row per distinct requested player id, in player_id order, so the
-- reader proves coverage without a count. rolling_row is null when the player has
-- no row for p_strength before p_before; support_row is null when that row has no
-- sidecar.
-- * rolling_row keeps only the wide columns named in p_columns (the reader's
--   ROLLING_ROW_SELECT_CLAUSE). The list keeps one owner and a reader change needs
--   no migration; a name that is not a column is absent and the reader rejects it.
-- * support_row carries the sidecar identity for the reader's anchor checks and
--   the support_payload keys FORGE reads: historicalCompatibility (trimmed to
--   p_columns when it is an object) and alignedCountSupport. An absent key stays
--   absent; any other value passes through for the reader to validate.
-- Each player is one backward probe of the wide primary key
-- (player_id, game_date, strength_state) plus one sidecar primary-key lookup. The
-- key makes game_date unique per player and strength, so "order by game_date desc
-- limit 1" is the DISTINCT ON (player_id) ... ORDER BY player_id, game_date DESC,
-- game_id DESC row, without reading and sorting each player's whole history.
-- Read-only and STABLE, so the reader calls it by GET.

create or replace function public.forge_latest_rolling_rows(
  p_player_ids bigint[],
  p_strength text,
  p_before date,
  p_columns text[]
)
returns table (
  player_id bigint,
  rolling_row jsonb,
  support_row jsonb
)
language sql
stable
security invoker
set search_path = pg_catalog
as $$
  select
    requested.player_id,
    case when latest.player_id is not null then coalesce((
      select pg_catalog.jsonb_object_agg(selected.name, latest.row_json -> selected.name)
      from pg_catalog.unnest(p_columns) as selected(name)
      where latest.row_json ? selected.name
    ), '{}'::jsonb) end,
    case when support.player_id is not null then pg_catalog.jsonb_build_object(
      'player_id', support.player_id,
      'game_id', support.game_id,
      'game_date', support.game_date,
      'season', support.season,
      'strength_state', support.strength_state,
      'payload_schema_version', support.payload_schema_version,
      'support_payload', (
        select coalesce(pg_catalog.jsonb_object_agg(
          kept.name,
          case
            when kept.name = 'historicalCompatibility'
              and pg_catalog.jsonb_typeof(support.support_payload -> kept.name) = 'object'
            then (
              select coalesce(pg_catalog.jsonb_object_agg(
                field.name, support.support_payload -> kept.name -> field.name
              ), '{}'::jsonb)
              from pg_catalog.unnest(p_columns) as field(name)
              where (support.support_payload -> kept.name) ? field.name
            )
            else support.support_payload -> kept.name
          end
        ), '{}'::jsonb)
        from (values ('historicalCompatibility'), ('alignedCountSupport')) as kept(name)
        where support.support_payload ? kept.name
      )
    ) end
  from (
    select distinct ids.player_id
    from pg_catalog.unnest(p_player_ids) as ids(player_id)
    where ids.player_id is not null
  ) as requested
  left join lateral (
    select m.player_id, m.game_date, m.strength_state, pg_catalog.to_jsonb(m) as row_json
    from public.rolling_player_game_metrics as m
    where m.player_id = requested.player_id
      and m.strength_state = p_strength
      and m.game_date < p_before
    order by m.game_date desc
    limit 1
  ) as latest on true
  left join public.rolling_player_metric_support_payloads as support
    on support.player_id = latest.player_id
    and support.game_date = latest.game_date
    and support.strength_state = latest.strength_state
  order by requested.player_id;
$$;

revoke all on function public.forge_latest_rolling_rows(
  bigint[],
  text,
  date,
  text[]
) from public, anon, authenticated;
grant execute on function public.forge_latest_rolling_rows(
  bigint[],
  text,
  date,
  text[]
) to service_role;

comment on function public.forge_latest_rolling_rows(
  bigint[],
  text,
  date,
  text[]
) is
  'FORGE skater reader: latest rolling_player_game_metrics row per requested player for one strength before p_before, with the sidecar keys FORGE hydrates.';
