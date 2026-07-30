-- Credential-free one-release tombstones for two legacy public RPC contracts.
--
-- Before applying, retain the exact hosted definitions in a secured,
-- value-free rollback receipt. Do not restore either historical body from
-- repository history because update_all_wgo_skaters() contained credential
-- material and get_skater_game_score_by_limit(...) had unsafe ownership and
-- SECURITY DEFINER semantics.

do $$
begin
  if to_regprocedure('public.update_all_wgo_skaters()') is null then
    raise exception 'expected public.update_all_wgo_skaters()';
  end if;

  if to_regprocedure(
    'public.get_skater_game_score_by_limit(bigint,integer)'
  ) is null then
    raise exception
      'expected public.get_skater_game_score_by_limit(bigint,integer)';
  end if;
end;
$$;

create or replace function public.update_all_wgo_skaters()
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception using
    errcode = '42501',
    message = 'Legacy RPC retired.';
end;
$$;

create or replace function public.get_skater_game_score_by_limit(
  player_id bigint,
  num_games integer
)
returns table (
  game_date date,
  game_score numeric
)
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception using
    errcode = '42501',
    message = 'Legacy RPC retired.';
end;
$$;

alter function public.update_all_wgo_skaters() owner to postgres;
alter function public.get_skater_game_score_by_limit(bigint, integer)
  owner to postgres;

revoke all on function public.update_all_wgo_skaters()
  from public, anon, authenticated, service_role;
revoke all on function public.get_skater_game_score_by_limit(bigint, integer)
  from public, anon, authenticated, service_role;

grant execute on function public.update_all_wgo_skaters() to service_role;
grant execute on function public.get_skater_game_score_by_limit(bigint, integer)
  to service_role;

comment on function public.update_all_wgo_skaters() is
  'One-release credential-free tombstone; browser execution revoked.';
comment on function public.get_skater_game_score_by_limit(bigint, integer) is
  'One-release credential-free tombstone; browser execution revoked.';
