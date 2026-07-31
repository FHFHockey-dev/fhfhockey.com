-- Repair the exact 2025-26 Utah WGO cohort from legacy team 59 to team 68.
--
-- The frozen value-free manifest digest covers:
--   source row id, date, mapped game id, mapped opponent id
-- in source-row-id order. The migration accepts only the complete pre-state
-- or the complete post-state so a physical replay performs no DML.

lock table public.wgo_team_stats in share row exclusive mode;

create temporary table wgo_utah_20252026_repair_manifest
on commit drop
as
select
  w.id,
  w.date,
  w.team_id,
  g.id as mapped_game_id,
  case
    when g."homeTeamId" = 68 then g."awayTeamId"
    else g."homeTeamId"
  end as mapped_opponent_id
from public.wgo_team_stats as w
join public.games as g
  on g."seasonId" = w.season_id
 and g.date = w.date
 and 68 in (g."homeTeamId", g."awayTeamId")
where w.season_id = 20252026
  and w.franchise_name = 'Utah Mammoth'
  and (
    (
      w.team_id = 59
      and w.game_id is null
      and w.opponent_id is null
    )
    or (
      w.team_id = 68
      and w.game_id = g.id
      and w.opponent_id = case
        when g."homeTeamId" = 68 then g."awayTeamId"
        else g."homeTeamId"
      end
    )
  );

do $repair$
declare
  manifest_count integer;
  manifest_digest text;
  pre_count integer;
  post_count integer;
  updated_count integer := 0;
begin
  -- The supported schema-only baseline contains no application rows. A hosted
  -- database with any WGO/game data must still satisfy the exact 88-row
  -- manifest and digest assertions below.
  if not exists (select 1 from public.wgo_team_stats)
     and not exists (select 1 from public.games) then
    raise notice 'Utah WGO repair skipped for data-free baseline replay';
    return;
  end if;

  select
    pg_catalog.count(*)::integer,
    pg_catalog.md5(
      pg_catalog.string_agg(
        id::text
          || ':' || date::text
          || ':' || mapped_game_id::text
          || ':' || mapped_opponent_id::text,
        ',' order by id
      )
    ),
    pg_catalog.count(*) filter (where team_id = 59)::integer,
    pg_catalog.count(*) filter (where team_id = 68)::integer
  into manifest_count, manifest_digest, pre_count, post_count
  from pg_temp.wgo_utah_20252026_repair_manifest;

  if manifest_count <> 88
    or manifest_digest <> 'dd27185df94d9f7e9816eb3a9a8a8b66'
  then
    raise exception using message = 'UTAH_WGO_REPAIR_MANIFEST_MISMATCH';
  end if;

  if not (
    (pre_count = 88 and post_count = 0)
    or (pre_count = 0 and post_count = 88)
  ) then
    raise exception using message = 'UTAH_WGO_REPAIR_STATE_MISMATCH';
  end if;

  if pre_count = 88 then
    update public.wgo_team_stats as w
    set
      team_id = 68,
      game_id = m.mapped_game_id,
      opponent_id = m.mapped_opponent_id
    from pg_temp.wgo_utah_20252026_repair_manifest as m
    where w.id = m.id
      and w.team_id = 59
      and w.game_id is null
      and w.opponent_id is null;

    get diagnostics updated_count = row_count;

    if updated_count <> 88 then
      raise exception using message = 'UTAH_WGO_REPAIR_UPDATE_COUNT_MISMATCH';
    end if;
  end if;

  if exists (
    select 1
    from pg_temp.wgo_utah_20252026_repair_manifest as m
    join public.wgo_team_stats as w on w.id = m.id
    where w.team_id <> 68
      or w.game_id is distinct from m.mapped_game_id
      or w.opponent_id is distinct from m.mapped_opponent_id
  ) then
    raise exception using message = 'UTAH_WGO_REPAIR_POSTCONDITION_MISMATCH';
  end if;
end;
$repair$;
