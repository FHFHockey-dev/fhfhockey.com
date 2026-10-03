-- Scratch harness: minimal teams(id)/games(id) FK stubs, then the additive migration.
-- Not a full application-schema fixture. Runs only in a disposable database and rolls back rows.
begin;
insert into public.teams(id) values (914001),(914002);
insert into public.games(id) values (914000001);
do $$ declare t text; begin
  foreach t in array array['line_source_captures','line_claim_revisions','line_claim_relations','line_game_state_observations','line_entry_revisions','line_pp_decisions'] loop
    if not (select relrowsecurity from pg_class where oid=('public.'||t)::regclass) then raise exception 'RLS missing: %',t; end if;
    if has_table_privilege('anon','public.'||t,'SELECT,INSERT,UPDATE,DELETE') or has_table_privilege('authenticated','public.'||t,'SELECT,INSERT,UPDATE,DELETE') then raise exception 'Public grants on %',t; end if;
    if has_table_privilege('service_role','public.'||t,'UPDATE,DELETE') then raise exception 'Mutable service grants on %',t; end if;
  end loop;
  if has_function_privilege('anon','public.append_line_decisions(bigint,bigint,text,jsonb,jsonb)','EXECUTE') then raise exception 'Public reconciliation execute'; end if;
end $$;
set local role service_role;
insert into public.line_source_captures values ('capture-test',914001,'original-test',now(),'{"text":"raw source"}');
insert into public.line_claim_revisions values ('claim-test','capture-test',914001,914000001,'test',now(),'{"reviewReasons":[]}');
-- Consumer regression uses the FK-enforcing storage fixture; this scratch check
-- verifies the real FK remains intact and attempted/delayed links stay append-only.
insert into public.line_claim_revisions values ('attempt-test','capture-test',914001,914000001,'test',now(),
  '{"supersedes":["delayed-target"],"relationAuthority":"none","reviewReasons":["relation_target_unresolved:delayed-target"]}');
do $$ begin
  begin
    insert into public.line_claim_relations values ('attempt-test','delayed-target','supersedes','none');
    raise exception 'Missing relation target accepted';
  exception when foreign_key_violation then null;
  end;
  if (select payload->'supersedes' from public.line_claim_revisions where claim_id='attempt-test') <> '["delayed-target"]'::jsonb then raise exception 'Attempted link lost'; end if;
  if exists(select 1 from public.line_claim_relations where claim_id='attempt-test') then raise exception 'Unresolved relation indexed'; end if;
end $$;
insert into public.line_game_state_observations values ('state-after-attempt',914000001,now(),'test','{"phase":"live"}');
insert into public.line_claim_revisions values ('delayed-target','capture-test',914001,914000001,'test',now(),'{"reviewReasons":[]}');
do $$ begin
  if exists(select 1 from public.line_claim_relations where claim_id='attempt-test') then raise exception 'Delayed target manufactured authority'; end if;
  if (select payload->>'relationAuthority' from public.line_claim_revisions where claim_id='attempt-test') <> 'none' then raise exception 'Attempt authority changed'; end if;
end $$;
insert into public.line_claim_revisions values ('reviewed-attempt','capture-test',914001,914000001,'test:reviewed:2',now(),
  '{"supersedes":["delayed-target"],"relationAuthority":"original_author","reviewReasons":[]}');
insert into public.line_claim_relations values ('reviewed-attempt','delayed-target','supersedes','original_author') on conflict do nothing;
insert into public.line_claim_relations values ('reviewed-attempt','delayed-target','supersedes','original_author') on conflict do nothing;
do $$ begin
  if (select count(*) from public.line_claim_relations where claim_id='reviewed-attempt') <> 1 then raise exception 'Resolved relation retry duplicated history'; end if;
  if not exists(select 1 from public.line_game_state_observations where state_id='state-after-attempt') then raise exception 'State capture lost'; end if;
  if (select payload->'reviewReasons' from public.line_claim_revisions where claim_id='attempt-test') <> '["relation_target_unresolved:delayed-target"]'::jsonb then raise exception 'Attempt review erased'; end if;
end $$;
do $$
declare entry1 jsonb := '{"id":"entry-test-1","gameId":914000001,"teamId":914001,"revision":1,"previousId":null,"createdAt":"2026-10-01T23:00:00Z","status":"frozen"}';
entry2 jsonb := '{"id":"entry-test-2","gameId":914000001,"teamId":914001,"revision":2,"previousId":"entry-test-1","createdAt":"2026-10-02T00:00:00Z","status":"corrected"}';
pp1 jsonb := '[{"id":"pp-test-1","gameId":914000001,"teamId":914001,"unitNumber":1,"revision":1,"replacesId":null,"decidedAt":"2026-10-01T23:00:00Z"}]';
begin
  if not public.append_line_decisions(914000001,914001,null,entry1,pp1) then raise exception 'Initial append failed'; end if;
  if public.append_line_decisions(914000001,914001,null,entry2,'[]') then raise exception 'Stale writer accepted'; end if;
  if not public.append_line_decisions(914000001,914001,'entry-test-1',entry1,pp1) then raise exception 'Idempotent append failed'; end if;
  if not public.append_line_decisions(914000001,914001,'entry-test-1',entry2,'[]') then raise exception 'Correction append failed'; end if;
  if (select count(*) from public.line_entry_revisions where game_id=914000001) <> 2 then raise exception 'Revision history lost'; end if;
  if not public.append_line_decisions(914000001,914001,'entry-test-2',entry2,'[{"id":"pp-test-2","gameId":914000001,"teamId":914001,"unitNumber":1,"revision":2,"replacesId":"pp-test-1","decidedAt":"2026-10-01T23:00:00Z"}]') then raise exception 'PP replacement failed'; end if;
  if public.append_line_decisions(914000001,914001,'entry-test-2',entry2,'[{"id":"pp-stale","gameId":914000001,"teamId":914001,"unitNumber":1,"revision":2,"replacesId":"pp-test-1","decidedAt":"2026-10-02T00:00:00Z"}]') then raise exception 'Stale PP writer accepted'; end if;
  if (select count(*) from public.line_pp_decisions where game_id=914000001) <> 2 then raise exception 'PP history changed on stale append'; end if;
  begin
    perform public.append_line_decisions(914000001,914002,null,entry1,'[]');
    raise exception 'Scope mismatch accepted';
  exception when raise_exception then
    if sqlerrm <> 'Entry scope mismatch' then raise; end if;
  end;
  begin
    update public.line_source_captures set payload='{}' where capture_id='capture-test';
    raise exception 'Mutation accepted';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.line_claim_revisions where claim_id='claim-test';
    raise exception 'Deletion accepted';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
do $$ begin
  begin
    update public.line_source_captures set payload='{}' where capture_id='capture-test';
    raise exception 'Owner mutation accepted';
  exception when object_not_in_prerequisite_state then null;
  end;
end $$;
rollback;
