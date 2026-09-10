-- Run after the Draft Pro foundation and Stripe fulfillment migrations in the
-- disposable W12 database. This transaction leaves no durable fixture data.
begin;

insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data)
values ('00000000-0000-4000-8000-000000000011', 'authenticated', 'authenticated', 'draft-pro-stripe@example.invalid', '{}'::jsonb, '{}'::jsonb);

select * from public.begin_draft_pro_stripe_checkout_attempt('00000000-0000-4000-8000-000000000011');

do $$
declare
  purchase_id uuid;
  initial_activation timestamptz;
begin
  select id into purchase_id from public.draft_pro_purchases where user_id = '00000000-0000-4000-8000-000000000011';
  perform public.record_draft_pro_stripe_event('evt_paid', 'checkout.session.completed', '2026-09-07T00:00:00Z', 'cs_probe', 'pi_probe', '00000000-0000-4000-8000-000000000011', purchase_id, 'paid', false, null, null, '{}'::jsonb);
  select activated_at into initial_activation from public.draft_pro_purchases where id = purchase_id;
  if initial_activation <= '2026-09-07T00:00:00Z'::timestamptz then
    raise exception 'activation must use server fulfillment time, not delayed provider time';
  end if;
  perform public.record_draft_pro_stripe_event('evt_refund', 'charge.refunded', '2026-09-07T00:01:00Z', 'cs_probe', 'pi_probe', '00000000-0000-4000-8000-000000000011', purchase_id, 'refunded', true, null, null, '{}'::jsonb);
  perform public.record_draft_pro_stripe_event('evt_late_paid', 'checkout.session.completed', '2026-09-07T00:02:00Z', 'cs_probe', 'pi_probe', '00000000-0000-4000-8000-000000000011', purchase_id, 'paid', false, null, null, '{}'::jsonb);
  if not exists (select 1 from public.draft_pro_purchases where id = purchase_id and status = 'refunded' and activated_at = initial_activation and full_refunded_at is not null) then
    raise exception 'full refund did not remain terminal';
  end if;
end $$;

rollback;
