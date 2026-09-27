-- Run after the in-season migration against a local database; no changes persist.
begin;
do $$
declare
  owner_a uuid := 'a7c03ee0-0000-4000-8000-000000000091';
  owner_b uuid := 'a7c03ee0-0000-4000-8000-000000000092';
  denied boolean := false;
  affected integer;
begin
  if not (select relrowsecurity from pg_class where oid = 'public.in_season_grants'::regclass)
    or not (select relrowsecurity from pg_class where oid = 'public.in_season_workspaces'::regclass)
    or has_table_privilege('anon', 'public.in_season_grants', 'select')
    or has_table_privilege('authenticated', 'public.in_season_grants', 'select')
    or has_table_privilege('anon', 'public.in_season_workspaces', 'select')
    or has_table_privilege('authenticated', 'public.in_season_workspaces', 'insert') then
    raise exception 'in-season table privileges or RLS are unsafe';
  end if;
  insert into auth.users(id) values (owner_a), (owner_b);
  insert into public.in_season_grants(user_id, source, source_reference, status, effective_from, effective_to)
    values (owner_a, 'grandfather', 'test:grandfather:91', 'active', now(), now() + interval '1 day');
  insert into public.in_season_grants(user_id, source, source_reference, status, effective_from, effective_to)
    values (owner_a, 'common_preview', 'test:preview:91', 'active', now(), now() + interval '1 day');
  begin
    insert into public.in_season_grants(user_id, source, source_reference, status, effective_from, effective_to)
      values (owner_b, 'grandfather', 'test:grandfather:91', 'active', now(), now() + interval '1 day');
  exception when unique_violation then denied := true;
  end;
  if not denied then raise exception 'grant source reference can be reassigned'; end if;
  insert into public.in_season_workspaces(user_id, provider, league_id, team_id, season_id, start_date, end_date, workspace)
    values (owner_a, 'manual', 'league', 'team', 20262027, '2026-10-05', '2026-10-11', '{}'),
           (owner_b, 'manual', 'league', 'team', 20262027, '2026-10-05', '2026-10-11', '{}');
  -- All browser roles must use the authenticated API, even the row owner.
  denied := false;
  begin
    set local role anon;
    perform id from public.in_season_workspaces;
  exception when insufficient_privilege then denied := true;
  end;
  reset role;
  if not denied then raise exception 'anonymous workspace read was allowed'; end if;
  denied := false;
  begin
    set local role authenticated;
    perform set_config('request.jwt.claim.sub', owner_a::text, true);
    update public.in_season_workspaces set workspace = '{"forged":true}' where user_id = owner_b;
  exception when insufficient_privilege then denied := true;
  end;
  reset role;
  if not denied then raise exception 'authenticated cross-account write was allowed'; end if;
  -- Mirror the service API's ownership filter and compare-and-swap.
  set local role service_role;
  update public.in_season_workspaces set lock_version = 2 where user_id = owner_a and lock_version = 1;
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'owner save did not update exactly one row'; end if;
  update public.in_season_workspaces set lock_version = 3 where user_id = owner_a and lock_version = 1;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'stale save overwrote the workspace'; end if;
  if (select lock_version from public.in_season_workspaces where user_id = owner_b) <> 1 then
    raise exception 'another account was modified';
  end if;
  reset role;
end $$;
rollback;
