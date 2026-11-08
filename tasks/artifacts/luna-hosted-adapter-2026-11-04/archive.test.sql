-- Disposable-cluster assertions only. Test fixtures are synthetic and rolled back.
begin;
create function pg_temp.test_envelope(body text, received text default '2026-11-05T00:00:00Z') returns text language sql as $$
 select jsonb_build_object('version','luna-isolated-capture-v1','scope',jsonb_build_object(
 'policyId','00000000-0000-4000-8000-000000000001','appletId','synthetic','sourceAccount','Reporter'),
 'rawBody',body,'payloadSha256',encode(sha256(convert_to(body,'UTF8')),'hex'),'byteLength',octet_length(body),
 'receivedAt',received,'sourceAuthenticated',false,
 'deliveryKey',encode(sha256(convert_to('["00000000-0000-4000-8000-000000000001","synthetic","reporter","1"]','UTF8')),'hex'),
 'submitted',jsonb_build_object('text',body::jsonb->>'Text','username',body::jsonb->>'UserName','link',body::jsonb->>'LinkToTweet',
 'postId','1','createdAtLabel',body::jsonb->>'CreatedAt','embed',null))::text
$$;
insert into luna_capture.policy(singleton,id,applet_id,source_account,starts_at,expires_at,max_attempts,max_receipts,max_bytes)
 values(true,'00000000-0000-4000-8000-000000000001','synthetic','Reporter',clock_timestamp()-interval '1 minute',clock_timestamp()+interval '1 hour',200,3,10000);
do $$
declare e text := pg_temp.test_envelope('{"Text":"Synthetic report","UserName":"Reporter","LinkToTweet":"https://x.com/Reporter/status/1","CreatedAt":"unverified label"}');
 r jsonb; saved_id uuid; hash text; bad_clock text; cp integer; field_name text; blank text; body jsonb; expected_attempts integer := 9;
begin
 r:=public.luna_capture_archive_rpc('retain','00000000-0000-4000-8000-000000000001',jsonb_build_object('envelopeJson',e));
 if r->>'reason' is distinct from 'stopped' then raise exception 'default-off failed: %',r; end if;
 update luna_capture.policy set enabled=true;
 r:=public.luna_capture_archive_rpc('retain','00000000-0000-4000-8000-000000000001',jsonb_build_object('envelopeJson',e));
 if r->>'status' is distinct from 'retained' then raise exception 'baseline failed: %',r; end if;
 saved_id:=(r#>>'{receipt,id}')::uuid; hash:=r#>>'{receipt,payloadSha256}';
 r:=public.luna_capture_archive_rpc('retain','00000000-0000-4000-8000-000000000001',jsonb_build_object('envelopeJson',e));
 if r->>'status' is distinct from 'duplicate' or r#>>'{receipt,id}' is distinct from saved_id::text then raise exception 'dedupe failed'; end if;
 if (select attempts from luna_capture.policy) is distinct from 2 or (select receipts from luna_capture.policy) is distinct from 1 then raise exception 'counters failed'; end if;
 r:=public.luna_capture_archive_rpc('retain','00000000-0000-4000-8000-000000000001',jsonb_build_object('envelopeJson',pg_temp.test_envelope(replace(e::jsonb->>'rawBody','Synthetic report','Changed report'))));
 if r->>'status' is distinct from 'variant' or r#>>'{receipt,classification}' is distinct from 'variant' then raise exception 'variant failed: %',r; end if;
 if (select baseline_id from luna_capture.receipts where classification='variant') is distinct from saved_id then raise exception 'variant lineage failed'; end if;
 -- Repeated names, including an escaped equivalent, must not be collapsed by jsonb.
 r:=public.luna_capture_archive_rpc('retain','00000000-0000-4000-8000-000000000001',jsonb_build_object('envelopeJson',pg_temp.test_envelope('{"\u0054ext":"ambiguous","Text":"Synthetic report","UserName":"Reporter","LinkToTweet":"https://x.com/Reporter/status/1","CreatedAt":"unverified label"}')));
 if r->>'status' is distinct from 'invalid' then raise exception 'duplicate key accepted'; end if;
 r:=public.luna_capture_archive_rpc('retain','00000000-0000-4000-8000-000000000001',jsonb_build_object('envelopeJson',jsonb_set(e::jsonb,'{submitted,text}','"forged"')::text));
 if r->>'status' is distinct from 'invalid' then raise exception 'projection forgery accepted'; end if;
 if (select attempts from luna_capture.policy) is distinct from 5 then raise exception 'invalid attempts not counted'; end if;
 -- Match the loader's UTC-only datetime and case-sensitive status path.
 foreach bad_clock in array array['now','2026-11-05T00:00:00+00:00','2026-11-05T24:00:00Z'] loop
   r:=public.luna_capture_archive_rpc('retain','00000000-0000-4000-8000-000000000001',jsonb_build_object('envelopeJson',jsonb_set(e::jsonb,'{receivedAt}',to_jsonb(bad_clock))::text));
   if r->>'status' is distinct from 'invalid' then raise exception 'invalid clock accepted: %',bad_clock; end if;
 end loop;
 r:=public.luna_capture_archive_rpc('retain','00000000-0000-4000-8000-000000000001',jsonb_build_object('envelopeJson',pg_temp.test_envelope(replace(e::jsonb->>'rawBody','/status/','/STATUS/'))));
 if r->>'status' is distinct from 'invalid' then raise exception 'uppercase status accepted'; end if;
 -- Every ECMAScript trim codepoint, across all required fields and optional
 -- account binding. Exact projections/hashes prevent unrelated rejection.
 foreach cp in array array[9,10,11,12,13,32,160,5760,8192,8193,8194,8195,8196,8197,8198,8199,8200,8201,8202,8232,8233,8239,8287,12288,65279] loop
   blank:=chr(cp);
   foreach field_name in array array['Text','CreatedAt','UserName','LinkToTweet','sourceAccount'] loop
     body:=jsonb_set((e::jsonb->>'rawBody')::jsonb,array[field_name],to_jsonb(blank));
     r:=public.luna_capture_archive_rpc('retain','00000000-0000-4000-8000-000000000001',jsonb_build_object('envelopeJson',pg_temp.test_envelope(body::text)));
     if r->>'status' is distinct from 'invalid' then raise exception 'blank field accepted: % codepoint %: %',field_name,cp,r; end if;
     expected_attempts:=expected_attempts+1;
   end loop;
 end loop;
 -- Padding that JS trims must remain acceptable; retain exact original bytes.
 blank:=chr(9)||chr(10)||chr(160)||chr(65279);
 body:=(e::jsonb->>'rawBody')::jsonb;
 foreach field_name in array array['Text','CreatedAt','UserName','LinkToTweet'] loop
   body:=jsonb_set(body,array[field_name],to_jsonb(blank||(body->>field_name)||blank));
 end loop;
 body:=body||jsonb_build_object('sourceAccount',blank||'Reporter'||blank);
 r:=public.luna_capture_archive_rpc('retain','00000000-0000-4000-8000-000000000001',jsonb_build_object('envelopeJson',pg_temp.test_envelope(body::text)));
 if r->>'status' is distinct from 'variant' then raise exception 'valid padded fields rejected: %',r; end if;
 if (select envelope_json::jsonb->>'rawBody' from luna_capture.receipts where id=(r#>>'{receipt,id}')::uuid) is distinct from body::text then raise exception 'padding bytes changed'; end if;
 expected_attempts:=expected_attempts+1;
 -- These visually similar characters are not ECMAScript trim whitespace.
 foreach cp in array array[133,6158,8203] loop
   if luna_capture.trim_wire(chr(cp)) is distinct from chr(cp) then raise exception 'overbroad trim: %',cp; end if;
 end loop;
 if (select receipts from luna_capture.policy) is distinct from 3 then raise exception 'blank attempts retained receipts'; end if;
 raise notice '125 whitespace-only RPC rejections and one padded valid RPC passed';
 update luna_capture.policy set stopped=true;
 r:=public.luna_capture_archive_rpc('lookup','00000000-0000-4000-8000-000000000001',jsonb_build_object('appletId','synthetic','deliveryKey',e::jsonb->>'deliveryKey','payloadSha256',hash));
 if r#>>'{receipt,id}' is distinct from saved_id::text then raise exception 'stop prevented exact reconciliation'; end if;
 if (select attempts from luna_capture.policy) is distinct from expected_attempts then raise exception 'lookup changed counter'; end if;
 begin update luna_capture.policy set stopped=false; raise exception 'stop reset permitted'; exception when insufficient_privilege then null; end;
 begin update luna_capture.receipts set envelope_json='{}' where id=saved_id; raise exception 'receipt update permitted'; exception when insufficient_privilege then null; end;
 begin delete from luna_capture.receipts; raise exception 'receipt delete permitted'; exception when insufficient_privilege then null; end;
end $$;
rollback;
