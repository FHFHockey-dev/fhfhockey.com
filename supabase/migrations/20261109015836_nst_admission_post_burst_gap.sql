-- DRAFT, NOT APPLIED. Requires Chef review and TJ's explicit approval before any hosted apply.
-- Project fyhftlxokyjtpndbkfse; role postgres. Prerequisites: shared admission install
-- and 20261101161622 (which renamed the budget body to nst_admit_attempt_budget_v1).
--
-- TJ rule (2026-11-09): "21s is the safe time between, for longer runs. Anything under
-- 39 URLs can be bursted, and then needs at least 60s before a single call following."
-- Clarified: the 60 s gap is additional; 39/1m, 80/5m, 100/15m and 180/h must all hold
-- together, across every caller.
--
-- Change: after a burst attempt, nothing is admitted for 60 s except the same burst's
-- own next attempts. A burst is one eligible plan (1..78 attempts, as before); it
-- continues only while its planned allotment remains and its previous attempt was
-- under 30 s ago. Paced 22 s spacing and all four window caps are unchanged.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

alter table public.nst_request_admission_state
  add column burst_remaining integer not null default 0 check (burst_remaining between 0 and 77),
  add column burst_last_at timestamptz;

create or replace function public.nst_admit_attempt_budget_v1(p_burst boolean default false, p_planned_requests integer default null)
returns jsonb language plpgsql security invoker set search_path = pg_catalog, public as $$
declare
  entries timestamptz[];
  observed timestamptz;
  prior_spacing integer;
  remaining integer;
  burst_last timestamptz;
  eligible_burst boolean := p_burst is true and p_planned_requests between 1 and 78;
  continuing boolean;
  requested_spacing integer := case when p_burst is true and p_planned_requests between 1 and 78 then 0 else 22000 end;
  delay_ms bigint := 0;
  window_ms integer;
  cap integer;
  count_in_window integer;
  oldest timestamptz;
begin
  select attempts, last_spacing_ms, burst_remaining, burst_last_at
    into strict entries, prior_spacing, remaining, burst_last
    from public.nst_request_admission_state where singleton = true for update;
  observed := clock_timestamp();
  select coalesce(array_agg(t order by t), '{}'::timestamptz[]) into entries
    from unnest(entries) t where t >= observed - interval '3601 seconds';
  continuing := eligible_burst and remaining > 0 and burst_last is not null and observed < burst_last + interval '30 seconds';
  if not continuing then
    if cardinality(entries) > 0 then
      delay_ms := greatest(0, ceil(extract(epoch from (entries[cardinality(entries)] + (greatest(prior_spacing, requested_spacing) * interval '1 millisecond') - observed))*1000)::bigint);
    end if;
    -- Post-burst cool-down, for every caller: 60 s after the last burst attempt.
    if burst_last is not null then
      delay_ms := greatest(delay_ms, ceil(extract(epoch from (burst_last + interval '60 seconds' - observed))*1000)::bigint);
    end if;
  end if;
  -- All four windows still apply to every attempt, including a continuing burst.
  for window_ms, cap in select * from (values (60000,39),(300000,80),(900000,100),(3600000,180)) limits(ms,cap)
  loop
    select count(*), min(t) into count_in_window, oldest from unnest(entries) t
      where t >= observed - ((window_ms + 1000) * interval '1 millisecond');
    if count_in_window >= cap then
      delay_ms := greatest(delay_ms, ceil(extract(epoch from (oldest + ((window_ms + 1001) * interval '1 millisecond') - observed))*1000)::bigint);
    end if;
  end loop;
  if delay_ms > 0 then
    return jsonb_build_object('version',1,'scope','global-nst','allowed',false,'waitMs',delay_ms,'permitTtlMs',1000);
  end if;
  update public.nst_request_admission_state set
    attempts = array_append(entries, observed),
    last_spacing_ms = requested_spacing,
    burst_remaining = case when continuing then remaining - 1 when eligible_burst then p_planned_requests - 1 else 0 end,
    burst_last_at = case when eligible_burst then observed else burst_last end
    where singleton = true;
  return jsonb_build_object('version',1,'scope','global-nst','allowed',true,'waitMs',0,'permitTtlMs',1000);
end;
$$;
-- CREATE OR REPLACE keeps the existing owner and ACL (EXECUTE: postgres, service_role).

commit;

-- READBACK (read-only, after apply):
-- select md5(p.prosrc), pg_get_function_identity_arguments(p.oid), p.proacl::text, p.proconfig
--   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname = 'public' and p.proname = 'nst_admit_attempt_budget_v1';
--   -- expect one row; ACL {postgres=X/postgres,service_role=X/postgres}; config search_path=pg_catalog, public;
--   -- md5 equals the body between the $$ quotes above.
-- select column_name, data_type, column_default, is_nullable from information_schema.columns
--   where table_schema = 'public' and table_name = 'nst_request_admission_state' order by ordinal_position;
--   -- expect burst_remaining integer default 0 not null, burst_last_at timestamptz nullable.
-- select singleton, cardinality(attempts), last_spacing_ms, burst_remaining, burst_last_at from public.nst_request_admission_state;
-- select has_function_privilege('anon','public.nst_admit_attempt_budget_v1(boolean,integer)','EXECUTE'),
--        has_function_privilege('authenticated','public.nst_admit_attempt_budget_v1(boolean,integer)','EXECUTE');  -- expect false, false

-- ROLLBACK (one transaction; restores the accepted body aefd3c20 verbatim):
-- See supabase/tests/nst_admission_post_burst_gap_rollback.sql.
