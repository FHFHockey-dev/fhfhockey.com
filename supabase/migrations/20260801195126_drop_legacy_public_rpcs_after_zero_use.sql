-- Final removal of the two legacy RPC contracts after the recorded
-- one-release zero-use observation. This migration is intentionally narrow:
-- it drops only these exact signatures and never restores either historical
-- body. The dependency guard fails closed if a new catalog consumer appears
-- between monitoring and application.

do $$
declare
  dependency_count bigint;
begin
  select count(*)
    into dependency_count
  from pg_depend as dependency
  where dependency.refobjid in (
    to_regprocedure('public.update_all_wgo_skaters()'),
    to_regprocedure('public.get_skater_game_score_by_limit(bigint,integer)')
  )
    and dependency.refobjid is not null;

  if dependency_count > 0 then
    raise exception using
      errcode = '2BP01',
      message = format(
        'Legacy RPC final drop blocked by %s catalog dependencies.',
        dependency_count
      );
  end if;
end;
$$;

drop function if exists public.update_all_wgo_skaters();
drop function if exists public.get_skater_game_score_by_limit(bigint, integer);
