alter table public.yahoo_player_keys
  add column if not exists game_id integer generated always as (
    case
      when player_key ~ '^[0-9]+[.]p[.][0-9]+$'
        then split_part(player_key, '.', 1)::integer
      else null
    end
  ) stored,
  add column if not exists is_active boolean not null default true,
  add column if not exists last_seen_at timestamp with time zone,
  add column if not exists snapshot_id uuid;

create index if not exists idx_yahoo_player_keys_game_active
  on public.yahoo_player_keys (game_id, is_active, player_key);

create table if not exists public.yahoo_player_key_snapshots (
  snapshot_id uuid primary key,
  game_id integer not null,
  payload_hash text not null,
  source_count integer not null check (source_count > 0),
  added_count integer not null check (added_count >= 0),
  reactivated_count integer not null check (reactivated_count >= 0),
  changed_count integer not null check (changed_count >= 0),
  deactivated_count integer not null check (deactivated_count >= 0),
  created_at timestamp with time zone not null default now()
);

alter table public.yahoo_player_key_snapshots enable row level security;
alter table public.yahoo_player_key_snapshots force row level security;

revoke all on table public.yahoo_player_key_snapshots
  from public, anon, authenticated;
grant select, insert on table public.yahoo_player_key_snapshots
  to service_role;

create or replace function public.replace_yahoo_player_keys_snapshot(
  p_game_id integer,
  p_snapshot_id uuid,
  p_players jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog
as $function$
declare
  normalized_players jsonb;
  normalized_hash text;
  source_count integer;
  added_count integer;
  reactivated_count integer;
  changed_count integer;
  deactivated_count integer;
  prior public.yahoo_player_key_snapshots%rowtype;
begin
  if p_game_id is null or p_game_id <= 0 then
    raise exception using
      errcode = '22023',
      message = 'Yahoo snapshot game ID is invalid.';
  end if;
  if p_snapshot_id is null then
    raise exception using
      errcode = '22023',
      message = 'Yahoo snapshot ID is required.';
  end if;
  if pg_catalog.jsonb_typeof(p_players) <> 'array'
    or pg_catalog.jsonb_array_length(p_players) = 0
  then
    raise exception using
      errcode = '22023',
      message = 'Yahoo snapshot must contain players.';
  end if;

  select
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'player_key', incoming.player_key,
        'player_id', incoming.player_id,
        'player_name', incoming.player_name
      )
      order by incoming.player_key
    ),
    pg_catalog.count(*)
  into normalized_players, source_count
  from pg_catalog.jsonb_to_recordset(p_players) as incoming(
    player_key text,
    player_id integer,
    player_name text
  );

  if source_count <> pg_catalog.jsonb_array_length(p_players)
    or exists (
      select 1
      from pg_catalog.jsonb_to_recordset(p_players) as incoming(
        player_key text,
        player_id integer,
        player_name text
      )
      where incoming.player_key is null
        or incoming.player_key !~ ('^' || p_game_id::text || '[.]p[.][0-9]+$')
    )
    or (
      select pg_catalog.count(distinct incoming.player_key)
      from pg_catalog.jsonb_to_recordset(p_players) as incoming(
        player_key text,
        player_id integer,
        player_name text
      )
    ) <> source_count
  then
    raise exception using
      errcode = '22023',
      message = 'Yahoo snapshot player rows are invalid.';
  end if;

  normalized_hash := pg_catalog.md5(normalized_players::text);
  perform pg_catalog.pg_advisory_xact_lock(21991, p_game_id);

  select *
  into prior
  from public.yahoo_player_key_snapshots
  where snapshot_id = p_snapshot_id;

  if found then
    if prior.game_id <> p_game_id or prior.payload_hash <> normalized_hash then
      raise exception using
        errcode = '22023',
        message = 'Yahoo snapshot replay does not match its original payload.';
    end if;

    return pg_catalog.jsonb_build_object(
      'snapshotId', prior.snapshot_id,
      'gameId', prior.game_id,
      'sourceCount', prior.source_count,
      'added', prior.added_count,
      'reactivated', prior.reactivated_count,
      'changed', prior.changed_count,
      'deactivated', prior.deactivated_count,
      'replayed', true
    );
  end if;

  select
    pg_catalog.count(*) filter (where existing.player_key is null),
    pg_catalog.count(*) filter (
      where existing.player_key is not null and not existing.is_active
    ),
    pg_catalog.count(*) filter (
      where existing.player_key is null
        or not existing.is_active
        or existing.player_id is distinct from incoming.player_id
        or existing.player_name is distinct from incoming.player_name
    )
  into added_count, reactivated_count, changed_count
  from pg_catalog.jsonb_to_recordset(normalized_players) as incoming(
    player_key text,
    player_id integer,
    player_name text
  )
  left join public.yahoo_player_keys as existing
    on existing.player_key = incoming.player_key;

  select pg_catalog.count(*)
  into deactivated_count
  from public.yahoo_player_keys as existing
  where existing.game_id = p_game_id
    and existing.is_active
    and not exists (
      select 1
      from pg_catalog.jsonb_to_recordset(normalized_players) as incoming(
        player_key text,
        player_id integer,
        player_name text
      )
      where incoming.player_key = existing.player_key
    );

  insert into public.yahoo_player_keys (
    player_key,
    player_id,
    player_name,
    last_updated,
    is_active,
    last_seen_at,
    snapshot_id
  )
  select
    incoming.player_key,
    incoming.player_id,
    incoming.player_name,
    pg_catalog.now()::timestamp without time zone,
    true,
    pg_catalog.now(),
    p_snapshot_id
  from pg_catalog.jsonb_to_recordset(normalized_players) as incoming(
    player_key text,
    player_id integer,
    player_name text
  )
  on conflict (player_key) do update set
    player_id = excluded.player_id,
    player_name = excluded.player_name,
    last_updated = excluded.last_updated,
    is_active = true,
    last_seen_at = excluded.last_seen_at,
    snapshot_id = excluded.snapshot_id;

  update public.yahoo_player_keys as existing
  set
    is_active = false,
    snapshot_id = p_snapshot_id
  where existing.game_id = p_game_id
    and existing.is_active
    and not exists (
      select 1
      from pg_catalog.jsonb_to_recordset(normalized_players) as incoming(
        player_key text,
        player_id integer,
        player_name text
      )
      where incoming.player_key = existing.player_key
    );

  insert into public.yahoo_player_key_snapshots (
    snapshot_id,
    game_id,
    payload_hash,
    source_count,
    added_count,
    reactivated_count,
    changed_count,
    deactivated_count
  )
  values (
    p_snapshot_id,
    p_game_id,
    normalized_hash,
    source_count,
    added_count,
    reactivated_count,
    changed_count,
    deactivated_count
  );

  return pg_catalog.jsonb_build_object(
    'snapshotId', p_snapshot_id,
    'gameId', p_game_id,
    'sourceCount', source_count,
    'added', added_count,
    'reactivated', reactivated_count,
    'changed', changed_count,
    'deactivated', deactivated_count,
    'replayed', false
  );
end
$function$;

revoke all on function public.replace_yahoo_player_keys_snapshot(
  integer,
  uuid,
  jsonb
) from public, anon, authenticated;
grant execute on function public.replace_yahoo_player_keys_snapshot(
  integer,
  uuid,
  jsonb
) to service_role;

comment on function public.replace_yahoo_player_keys_snapshot(
  integer,
  uuid,
  jsonb
) is
  'Atomically reconciles one complete Yahoo game-scoped player-key snapshot and deactivates absent keys only after full validation.';
