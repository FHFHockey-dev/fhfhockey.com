alter table public."lineCombinations"
  add column if not exists source_kind text,
  add column if not exists source_key text,
  add column if not exists source_url text,
  add column if not exists source_capture_key text,
  add column if not exists observed_at timestamptz;

comment on column public."lineCombinations".source_kind is
  'Current row owner: gamecenter for canonical postgame builds or tweet for accepted first-arrival source snapshots.';
comment on column public."lineCombinations".source_key is
  'Stable provider/source key such as nhl_gamecenter, ccc, or gamedaylines.';
comment on column public."lineCombinations".source_url is
  'Canonical source URL for the current row contents.';
comment on column public."lineCombinations".source_capture_key is
  'Source snapshot capture key when source_kind=tweet; null for Gamecenter builds.';
comment on column public."lineCombinations".observed_at is
  'Time the current row contents were observed or rebuilt.';

create or replace function public.upsert_line_combinations_from_source(
  p_game_id bigint,
  p_team_id bigint,
  p_source_kind text,
  p_source_key text,
  p_source_url text,
  p_source_capture_key text,
  p_observed_at timestamptz,
  p_forwards bigint[] default null,
  p_defensemen bigint[] default null,
  p_goalies bigint[] default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  result_row public."lineCombinations"%rowtype;
begin
  if p_source_kind not in ('gamecenter', 'tweet') then
    raise exception 'Unsupported line-combination source kind: %', p_source_kind;
  end if;

  if p_forwards is null and p_defensemen is null and p_goalies is null then
    raise exception 'At least one line-combination player array is required.';
  end if;

  insert into public."lineCombinations" as current_row (
    "gameId",
    "teamId",
    forwards,
    defensemen,
    goalies,
    source_kind,
    source_key,
    source_url,
    source_capture_key,
    observed_at
  )
  values (
    p_game_id,
    p_team_id,
    coalesce(p_forwards, '{}'::bigint[]),
    coalesce(p_defensemen, '{}'::bigint[]),
    coalesce(p_goalies, '{}'::bigint[]),
    p_source_kind,
    p_source_key,
    p_source_url,
    p_source_capture_key,
    coalesce(p_observed_at, now())
  )
  on conflict ("gameId", "teamId") do update
  set
    forwards = coalesce(p_forwards, current_row.forwards),
    defensemen = coalesce(p_defensemen, current_row.defensemen),
    goalies = coalesce(p_goalies, current_row.goalies),
    source_kind = p_source_kind,
    source_key = p_source_key,
    source_url = p_source_url,
    source_capture_key = p_source_capture_key,
    observed_at = coalesce(p_observed_at, now())
  returning * into result_row;

  return to_jsonb(result_row);
end;
$$;

revoke all on function public.upsert_line_combinations_from_source(
  bigint,
  bigint,
  text,
  text,
  text,
  text,
  timestamptz,
  bigint[],
  bigint[],
  bigint[]
) from public, anon, authenticated;

grant execute on function public.upsert_line_combinations_from_source(
  bigint,
  bigint,
  text,
  text,
  text,
  text,
  timestamptz,
  bigint[],
  bigint[],
  bigint[]
) to service_role;
