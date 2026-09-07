begin;
insert into auth.users (id,aud,role,email,raw_app_meta_data,raw_user_meta_data) values
('00000000-0000-4000-8000-000000000021','authenticated','authenticated','stripe-a@example.invalid','{}','{}'),
('00000000-0000-4000-8000-000000000022','authenticated','authenticated','stripe-b@example.invalid','{}','{}');
do $$
declare a uuid; b uuid; first_id uuid; second_id uuid; initial_activation timestamptz; event_time timestamptz := now();
begin
  select purchase_id into first_id from public.begin_draft_pro_stripe_checkout_attempt('00000000-0000-4000-8000-000000000021');
  select purchase_id into second_id from public.begin_draft_pro_stripe_checkout_attempt('00000000-0000-4000-8000-000000000021');
  if first_id <> second_id then raise exception 'sequential pending checkout did not reuse attempt'; end if;
  a := first_id;
  perform public.attach_draft_pro_stripe_checkout_session(a,'cs_a',now()+interval '1 hour');
  perform public.record_draft_pro_stripe_event('evt_a_paid','paid',now()-interval '1 hour','cs_a','pi_a','00000000-0000-4000-8000-000000000021',a,'paid',false,null,null,'{}');
  select activated_at into initial_activation from public.draft_pro_purchases where id = a;
  perform public.record_draft_pro_stripe_event('evt_a_later_paid','paid',now(),'cs_a','pi_a','00000000-0000-4000-8000-000000000021',a,'paid',false,null,null,'{}');
  if (select activated_at from public.draft_pro_purchases where id = a) <> initial_activation then raise exception 'later paid changed activation'; end if;
  begin perform public.record_draft_pro_stripe_event('evt_bad_session','paid',now(),'cs_other','pi_a','00000000-0000-4000-8000-000000000021',a,'paid',false,null,null,'{}'); raise exception 'mismatched session accepted'; exception when raise_exception then if sqlerrm like 'mismatched session accepted%' then raise; end if; end;
  begin perform public.record_draft_pro_stripe_event('evt_bad_intent','paid',now(),'cs_a','pi_other','00000000-0000-4000-8000-000000000021',a,'paid',false,null,null,'{}'); raise exception 'mismatched intent accepted'; exception when raise_exception then if sqlerrm like 'mismatched intent accepted%' then raise; end if; end;
  perform public.record_draft_pro_stripe_event('evt_a_partial','refund',now(),'cs_a','pi_a','00000000-0000-4000-8000-000000000021',a,'refunded',false,null,null,'{}');
  if not exists(select 1 from public.draft_pro_purchases where id=a and status='active') then raise exception 'partial refund revoked'; end if;
  perform public.record_draft_pro_stripe_event('evt_a_open','dispute',now(),'cs_a','pi_a','00000000-0000-4000-8000-000000000021',a,'disputed',false,'dp_a','open','{}');
  perform public.record_draft_pro_stripe_event('evt_a_won','dispute',now(),'cs_a','pi_a','00000000-0000-4000-8000-000000000021',a,'dispute_won',false,'dp_a','won','{}');
  perform public.record_draft_pro_stripe_event('evt_a_lateopen','dispute',now(),'cs_a','pi_a','00000000-0000-4000-8000-000000000021',a,'disputed',false,'dp_a','open','{}');
  if not exists(select 1 from public.draft_pro_purchases where id=a and status='active' and dispute_status='won') then raise exception 'won dispute reopened'; end if;
  perform public.record_draft_pro_stripe_event('evt_a_won_first','dispute',event_time,'cs_a','pi_a','00000000-0000-4000-8000-000000000021',a,'dispute_won',false,'dp_early','won','{}');
  perform public.record_draft_pro_stripe_event('evt_a_open_late','dispute',event_time,'cs_a','pi_a','00000000-0000-4000-8000-000000000021',a,'disputed',false,'dp_early','open','{}');
  if not exists(select 1 from public.draft_pro_purchases where id=a and dispute_id='dp_early' and dispute_status='won') then raise exception 'won-before-created reopened'; end if;
  select purchase_id into b from public.begin_draft_pro_stripe_checkout_attempt('00000000-0000-4000-8000-000000000022');
  if b=a then raise exception 'independent users shared purchase'; end if;
  insert into public.user_entitlements (user_id,source_provider,entitlement_key,entitlement_status,source_reference) values ('00000000-0000-4000-8000-000000000021','patreon','draft_pro','active','patreon-probe');
  perform public.record_draft_pro_stripe_event('evt_a_refund','refund',now(),'cs_a','pi_a','00000000-0000-4000-8000-000000000021',a,'refunded',true,null,null,'{}');
  if not exists(select 1 from public.user_entitlements where user_id='00000000-0000-4000-8000-000000000021' and source_provider='patreon' and entitlement_status='active') then raise exception 'Stripe refund revoked Patreon grant'; end if;
  select purchase_id into b from public.begin_draft_pro_stripe_checkout_attempt('00000000-0000-4000-8000-000000000021');
  if b=a then raise exception 'refunded user did not receive independent repurchase attempt'; end if;
  begin perform public.record_draft_pro_stripe_event('evt_wrong','paid',now(),'bad',null,'00000000-0000-4000-8000-000000000022',a,'paid',false,null,null,'{}'); raise exception 'wrong user accepted'; exception when raise_exception then if sqlerrm like 'wrong user accepted%' then raise; end if; end;
end $$;
do $$ begin
  if has_function_privilege('anon','public.begin_draft_pro_stripe_checkout_attempt(uuid)','execute') or has_function_privilege('authenticated','public.begin_draft_pro_stripe_checkout_attempt(uuid)','execute')
    or has_function_privilege('anon','public.attach_draft_pro_stripe_checkout_session(uuid,text,timestamptz)','execute') or has_function_privilege('authenticated','public.attach_draft_pro_stripe_checkout_session(uuid,text,timestamptz)','execute')
    or has_function_privilege('anon','public.record_draft_pro_stripe_event(text,text,timestamptz,text,text,uuid,uuid,text,boolean,text,text,jsonb)','execute') or has_function_privilege('authenticated','public.record_draft_pro_stripe_event(text,text,timestamptz,text,text,uuid,uuid,text,boolean,text,text,jsonb)','execute') then raise exception 'browser Stripe RPC grant exists'; end if;
end $$;
select 'stripe_expanded=passed';
rollback;
