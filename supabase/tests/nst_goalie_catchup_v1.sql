-- Executed only by the isolated fixture harness.
do $$ declare p record; t record; begin
  for p in select oid,proname,prosecdef,proconfig from pg_proc where pronamespace='public'::regnamespace and (proname like 'nst_goalie_%_v1' or proname like 'nst_job_%_v1' or proname in ('nst_admit_attempt_v1','nst_admit_job_attempt_v1')) loop
    assert not p.prosecdef, 'Checkpoint RPC must be SECURITY INVOKER';
    assert p.proconfig @> array['search_path=pg_catalog, public'];
    assert not has_function_privilege('anon',p.oid,'execute');
    assert not has_function_privilege('authenticated',p.oid,'execute');
    assert has_function_privilege('service_role',p.oid,'execute');
  end loop;
  for t in select oid,relrowsecurity from pg_class where relnamespace='public'::regnamespace and (relname like 'nst_goalie_%' or relname like 'nst_job%') and relkind='r' loop
    assert t.relrowsecurity;
    assert not has_table_privilege('anon',t.oid,'select,insert,update,delete');
    assert not has_table_privilege('authenticated',t.oid,'select,insert,update,delete');
  end loop;
  assert not has_column_privilege('service_role','public.nst_goalie_control','enabled','update');
  assert has_table_privilege('service_role','public.nst_goalie_day_evidence','insert');
  assert not has_table_privilege('service_role','public.nst_goalie_day_evidence','update,delete');
  assert not has_column_privilege('service_role','public.nst_goalie_control','bootstrap_date','update');
  assert not has_column_privilege('service_role','public.nst_goalie_control','enabled_at','update');
  assert not has_column_privilege('service_role','public.nst_job_control','enforced','update');
  assert not has_column_privilege('service_role','public.nst_job_control','qualified_at','update');
  assert (select not enforced from public.nst_job_control);
  assert (select not enabled from public.nst_goalie_control);
end $$;
