begin;
insert into auth.users (id,aud,role,email,raw_app_meta_data,raw_user_meta_data) values
('00000000-0000-4000-8000-000000000021','authenticated','authenticated','stripe-a@example.invalid','{}','{}'),
('00000000-0000-4000-8000-000000000022','authenticated','authenticated','stripe-b@example.invalid','{}','{}');
do $$
declare a uuid; b uuid; first_id uuid; second_id uuid;
begin
  select purchase_id into first_id from public.begin_draft_pro_stripe_checkout_attempt('00000000-0000-4000-8000-000000000021');
  select purchase_id into second_id from public.begin_draft_pro_stripe_checkout_attempt('00000000-0000-4000-8000-000000000021');
  if first_id <> second_id then raise exception 'sequential pending checkout did not reuse attempt'; end if;
  a := first_id;
  perform public.attach_draft_pro_stripe_checkout_session(a,'cs_a',now()+interval '1 hour');
  perform public.record_draft_pro_stripe_event('evt_a_paid','paid',now()-interval '1 hour','cs_a','pi_a','00000000-0000-4000-8000-000000000021',a,'paid',false,null,null,'{}');
  perform public.record_draft_pro_stripe_event('evt_a_partial','refund',now(),'cs_a','pi_a','00000000-0000-4000-8000-000000000021',a,'refunded',false,null,null,'{}');
  if not exists(select 1 from public.draft_pro_purchases where id=a and status='active') then raise exception 'partial refund revoked'; end if;
  perform public.record_draft_pro_stripe_event('evt_a_open','dispute',now(),'cs_a','pi_a','00000000-0000-4000-8000-000000000021',a,'disputed',false,'dp_a','open','{}');
  perform public.record_draft_pro_stripe_event('evt_a_won','dispute',now(),'cs_a','pi_a','00000000-0000-4000-8000-000000000021',a,'dispute_won',false,'dp_a','won','{}');
  perform public.record_draft_pro_stripe_event('evt_a_lateopen','dispute',now(),'cs_a','pi_a','00000000-0000-4000-8000-000000000021',a,'disputed',false,'dp_a','open','{}');
  if not exists(select 1 from public.draft_pro_purchases where id=a and status='active' and dispute_status='won') then raise exception 'won dispute reopened'; end if;
  select purchase_id into b from public.begin_draft_pro_stripe_checkout_attempt('00000000-0000-4000-8000-000000000022');
  if b=a then raise exception 'independent users shared purchase'; end if;
  begin perform public.record_draft_pro_stripe_event('evt_wrong','paid',now(),'bad',null,'00000000-0000-4000-8000-000000000022',a,'paid',false,null,null,'{}'); raise exception 'wrong user accepted'; exception when raise_exception then if sqlerrm like 'wrong user accepted%' then raise; end if; end;
end $$;
select 'stripe_expanded=passed';
rollback;
