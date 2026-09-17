-- Run against a local database after the mock migration. Everything rolls back.
begin;
do $$
declare
  u uuid; sid uuid; first_user uuid := 'a7c03ee0-0000-4000-8000-000000000001';
  first_session uuid := 'b7c03ee0-0000-4000-8000-000000000001';
  league jsonb := '{"season":"mock-test","teamCount":2,"leagueType":"points","scoring":{"GOALS":1},"goalieScoring":{},"roster":{"C":2},"grouping":"split"}';
  input jsonb; event jsonb; result jsonb; ids bigint[]; i integer; denied boolean;
begin
  if has_table_privilege('anon', 'public.mock_draft_events', 'select') or has_table_privilege('authenticated', 'public.mock_draft_events', 'insert')
    or has_table_privilege('authenticated', 'public.mock_draft_sessions', 'select')
    or has_function_privilege('anon', 'public.mock_draft_adp(text,text,text,boolean,text,text,integer)', 'execute') then raise exception 'raw data grants leaked'; end if;
  select array_agg(nhl_player_id) into ids from (select nhl_player_id from public.fhfh_player_identities where nhl_player_id is not null order by id limit 4) p;
  if array_length(ids,1) <> 4 then raise exception 'Local identity fixtures required'; end if;
  for i in 1..5 loop
    u := ('a7c03ee0-0000-4000-8000-' || lpad(i::text,12,'0'))::uuid;
    sid := ('b7c03ee0-0000-4000-8000-' || lpad(i::text,12,'0'))::uuid;
    insert into auth.users(id) values(u);
    input := jsonb_build_object('id',sid,'league',league,'userSeat',0,'tier','free','engineVersion','mock-1','researchVersion',null);
    perform public.mock_draft_register(u,input,'test-cohort');
    perform public.mock_draft_register(u,input,'test-cohort');
    event := jsonb_build_object('pick',1,'seat',0,'playerId',ids[1]::text,'source','human','contributes',true);
    perform public.mock_draft_ingest(u,sid,jsonb_build_array(event),false);
    perform public.mock_draft_ingest(u,sid,jsonb_build_array(event),false);
    if i = 4 then
      result := public.mock_draft_adp('mock-test','test-cohort','all',false,'','',1);
      if result->'rows'->0->>'adp' is not null then raise exception 'threshold leaked'; end if;
    end if;
  end loop;
  result := public.mock_draft_adp('mock-test','test-cohort','all',false,'','',1);
  if (result->'rows'->0->>'adp')::numeric <> 1 or (result->'rows'->0->>'selections')::int <> 5 then raise exception 'aggregation/retry incorrect'; end if;
  denied := false;
  begin perform public.mock_draft_ingest(u,first_session,jsonb_build_array(event),false); exception when others then denied := sqlerrm = 'not_found'; end;
  if not denied then raise exception 'ownership check failed'; end if;
  denied := false;
  begin perform public.mock_draft_ingest(first_user,first_session,jsonb_build_array(event || jsonb_build_object('playerId', ids[2]::text)),false); exception when others then denied := sqlerrm = 'idempotency_conflict'; end;
  if not denied then raise exception 'conflicting retry accepted'; end if;
  denied := false;
  begin perform public.mock_draft_ingest(first_user,first_session,jsonb_build_array(event || '{"pick":2,"seat":1}'),false); exception when others then denied := sqlerrm = 'invalid_source'; end;
  if not denied then raise exception 'bot impersonation accepted'; end if;
  sid := 'b7c03ee0-0000-4000-8000-000000000099';
  perform public.mock_draft_register(first_user,input || jsonb_build_object('id',sid),'test-cohort');
  perform public.mock_draft_ingest(first_user,sid,jsonb_build_array(
    jsonb_build_object('pick',1,'seat',0,'playerId',ids[2]::text,'source','timeout','contributes',false),
    jsonb_build_object('pick',2,'seat',1,'playerId',ids[3]::text,'source','bot','contributes',false),
    jsonb_build_object('pick',3,'seat',1,'playerId',ids[4]::text,'source','bot','contributes',false),
    jsonb_build_object('pick',4,'seat',0,'playerId',ids[1]::text,'source','human','contributes',true)
  ),true);
  result := public.mock_draft_adp('mock-test','test-cohort','all',false,'','',1);
  if (result->'rows'->0->>'adp')::numeric <> 1.3 or jsonb_array_length(result->'rows') <> 1 then raise exception 'per-user weighting or automatic exclusion failed: %',result; end if;
  result := public.mock_draft_adp('mock-test','test-cohort','all',true,'','',1);
  if (result->'rows'->0->>'contributors')::int <> 1 then raise exception 'completion filter failed'; end if;
  if (public.mock_draft_adp('mock-test','other','all',false,'','',1)->>'total')::int <> 0 then raise exception 'cohorts mixed'; end if;
  for i in 1..18 loop
    perform public.mock_draft_register(first_user,input || jsonb_build_object('id',gen_random_uuid()),'test-cohort');
  end loop;
  denied := false;
  begin perform public.mock_draft_register(first_user,input || jsonb_build_object('id',gen_random_uuid()),'test-cohort'); exception when others then denied := sqlerrm = 'daily_limit'; end;
  if not denied then raise exception 'daily cap failed'; end if;
  perform public.mock_draft_withdraw(first_user,first_session);
  perform public.mock_draft_withdraw(first_user,sid);
  result := public.mock_draft_adp('mock-test','test-cohort','all',false,'','',1);
  if (result->'rows'->0->>'contributors')::int <> 4 or result->'rows'->0->>'adp' is not null then raise exception 'withdrawal failed'; end if;
  denied := false;
  begin perform public.mock_draft_ingest(first_user,first_session,jsonb_build_array(event),false); exception when others then denied := sqlerrm = 'withdrawn'; end;
  if not denied then raise exception 'withdrawal replay resurrected'; end if;
  sid := gen_random_uuid();
  perform public.mock_draft_withdraw(first_user,sid);
  result := public.mock_draft_register(first_user,input || jsonb_build_object('id',sid),'test-cohort');
  if not (result->>'withdrawn')::boolean then raise exception 'withdrawal before registration resurrected'; end if;
  sid := gen_random_uuid();
  denied := false;
  begin perform public.mock_draft_register(u,input || jsonb_build_object('id',sid,'tier','pro'),'test-cohort',false); exception when others then denied := sqlerrm = 'advanced_required'; end;
  if not denied then raise exception 'new Pro registration not gated'; end if;
  perform public.mock_draft_register(u,input || jsonb_build_object('id',sid,'tier','pro'),'test-cohort',true);
  perform public.mock_draft_register(u,input || jsonb_build_object('id',sid,'tier','pro'),'test-cohort',false);
end $$;
rollback;
