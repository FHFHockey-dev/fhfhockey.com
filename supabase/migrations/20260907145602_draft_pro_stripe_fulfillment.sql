-- Stripe facts are stored independently from the derived entitlement state so
-- delayed/replayed provider events cannot reopen a resolved purchase.
alter table public.draft_pro_purchases
  add column stripe_idempotency_key uuid not null default gen_random_uuid(),
  add column checkout_session_status text not null default 'open' check (checkout_session_status in ('open', 'complete', 'expired')),
  add column checkout_expires_at timestamptz not null default (now() + interval '24 hours'),
  add column payment_state text not null default 'pending' check (payment_state in ('pending', 'paid', 'refunded', 'disputed', 'ignored')),
  add column payment_state_occurred_at timestamptz,
  add column payment_confirmed_at timestamptz,
  add column full_refunded_at timestamptz,
  add column refund_occurred_at timestamptz,
  add column dispute_id text,
  add column dispute_status text check (dispute_status in ('open', 'won', 'lost')),
  add column dispute_occurred_at timestamptz;

alter table public.draft_pro_provider_events
  add column provider_occurred_at timestamptz;

create unique index draft_pro_purchases_stripe_idempotency_key_unique
  on public.draft_pro_purchases(stripe_idempotency_key);
create index draft_pro_purchases_checkout_attempt_idx
  on public.draft_pro_purchases(user_id, season, status, checkout_expires_at desc);

create or replace function public.begin_draft_pro_stripe_checkout_attempt(p_user_id uuid)
returns table(purchase_id uuid, stripe_idempotency_key uuid, checkout_session_id text, purchase_status text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  purchase public.draft_pro_purchases%rowtype;
begin
  if p_user_id is null then
    raise exception 'Draft Pro checkout requires a user';
  end if;
  if now() >= '2027-07-01T04:00:00Z'::timestamptz then
    raise exception 'Draft Pro 2026-27 sales have ended';
  end if;
  perform pg_advisory_xact_lock(hashtext('draft-pro-checkout:' || p_user_id::text || ':draft_pro_2026_27'));

  select * into purchase
  from public.draft_pro_purchases
  where user_id = p_user_id
    and season = 'draft_pro_2026_27'
    and status = 'active'
    and full_refunded_at is null
    and expires_at > now()
  order by activated_at desc nulls last
  limit 1
  for update;
  if found then
    return query select purchase.id, purchase.stripe_idempotency_key, purchase.provider_checkout_session_id, purchase.status;
    return;
  end if;

  select * into purchase
  from public.draft_pro_purchases
  where user_id = p_user_id
    and season = 'draft_pro_2026_27'
    and status = 'pending'
    and checkout_session_status = 'open'
    and checkout_expires_at > now()
  order by created_at desc
  limit 1
  for update;
  if not found then
    insert into public.draft_pro_purchases (user_id)
    values (p_user_id)
    returning * into purchase;
  end if;
  return query select purchase.id, purchase.stripe_idempotency_key, purchase.provider_checkout_session_id, purchase.status;
end;
$$;

create or replace function public.attach_draft_pro_stripe_checkout_session(
  p_purchase_id uuid,
  p_checkout_session_id text,
  p_checkout_expires_at timestamptz
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  purchase public.draft_pro_purchases%rowtype;
begin
  if p_checkout_session_id is null or btrim(p_checkout_session_id) = '' or p_checkout_expires_at <= now() then
    raise exception 'A non-expired Stripe Checkout session is required';
  end if;
  select * into purchase from public.draft_pro_purchases where id = p_purchase_id for update;
  if not found then
    raise exception 'Draft Pro checkout attempt was not found';
  end if;
  if purchase.provider_checkout_session_id = p_checkout_session_id then
    return;
  end if;
  if purchase.provider_checkout_session_id is not null then
    raise exception 'Draft Pro checkout attempt is already attached to another session';
  end if;
  if purchase.status <> 'pending' then
    raise exception 'Draft Pro checkout attempt is not pending';
  end if;
  update public.draft_pro_purchases
  set provider_checkout_session_id = p_checkout_session_id,
      checkout_session_status = 'open',
      checkout_expires_at = p_checkout_expires_at
  where id = p_purchase_id;
end;
$$;

create or replace function public.record_draft_pro_stripe_event(
  p_event_id text,
  p_event_type text,
  p_occurred_at timestamptz,
  p_checkout_session_id text,
  p_payment_intent_id text,
  p_user_id uuid,
  p_purchase_id uuid,
  p_payment_state text,
  p_full_refund boolean,
  p_dispute_id text,
  p_dispute_status text,
  p_payload jsonb
) returns table(purchase_id uuid, processed boolean)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  purchase public.draft_pro_purchases%rowtype;
  event_row_id uuid;
  effective_status text;
begin
  if p_event_id is null or btrim(p_event_id) = '' or p_event_type is null or btrim(p_event_type) = '' or p_occurred_at is null
    or p_user_id is null or p_purchase_id is null
    or p_payment_state is null or p_payment_state not in ('paid', 'refunded', 'disputed', 'dispute_won', 'ignored')
    or p_full_refund is null
    or p_dispute_status is not null and p_dispute_status not in ('open', 'won', 'lost') then
    raise exception 'Invalid normalized Stripe event facts';
  end if;

  insert into public.draft_pro_provider_events (provider, provider_event_id, event_type, user_id, purchase_id, payload, provider_occurred_at)
  values ('stripe', p_event_id, p_event_type, p_user_id, p_purchase_id, coalesce(p_payload, '{}'::jsonb), p_occurred_at)
  on conflict (provider, provider_event_id) do nothing
  returning id into event_row_id;
  if event_row_id is null then
    return query select p_purchase_id, false;
    return;
  end if;

  select * into purchase from public.draft_pro_purchases where id = p_purchase_id for update;
  if not found or purchase.user_id <> p_user_id then
    raise exception 'Stripe event does not match the checkout attempt';
  end if;
  if p_checkout_session_id is not null and purchase.provider_checkout_session_id is not null and purchase.provider_checkout_session_id <> p_checkout_session_id then
    raise exception 'Stripe event checkout session does not match the checkout attempt';
  end if;
  if p_payment_intent_id is not null and purchase.provider_payment_intent_id is not null and purchase.provider_payment_intent_id <> p_payment_intent_id then
    raise exception 'Stripe event payment intent does not match the checkout attempt';
  end if;

  update public.draft_pro_purchases
  set provider_checkout_session_id = coalesce(provider_checkout_session_id, p_checkout_session_id),
      provider_payment_intent_id = coalesce(provider_payment_intent_id, p_payment_intent_id),
      checkout_session_status = case when p_payment_state = 'paid' then 'complete' else checkout_session_status end
  where id = purchase.id;

  if p_full_refund then
    update public.draft_pro_purchases
    set full_refunded_at = coalesce(full_refunded_at, p_occurred_at),
        refund_occurred_at = greatest(coalesce(refund_occurred_at, '-infinity'::timestamptz), p_occurred_at),
        payment_state = 'refunded',
        payment_state_occurred_at = greatest(coalesce(payment_state_occurred_at, '-infinity'::timestamptz), p_occurred_at)
    where id = purchase.id;
  elsif p_payment_state = 'paid' then
    update public.draft_pro_purchases
    set payment_confirmed_at = coalesce(payment_confirmed_at, p_occurred_at),
        payment_state = case when payment_state_occurred_at is null or p_occurred_at >= payment_state_occurred_at then 'paid' else payment_state end,
        payment_state_occurred_at = greatest(coalesce(payment_state_occurred_at, '-infinity'::timestamptz), p_occurred_at),
        activated_at = coalesce(activated_at, now())
    where id = purchase.id and full_refunded_at is null;
  end if;

  if p_dispute_id is not null and p_dispute_status is not null then
    select * into purchase from public.draft_pro_purchases where id = purchase.id for update;
    if purchase.dispute_id is null then
      update public.draft_pro_purchases set dispute_id = p_dispute_id, dispute_status = p_dispute_status, dispute_occurred_at = p_occurred_at where id = purchase.id;
    elsif purchase.dispute_id = p_dispute_id
      and purchase.dispute_status = 'open'
      and p_dispute_status = 'open'
      and p_occurred_at > purchase.dispute_occurred_at then
      update public.draft_pro_purchases set dispute_occurred_at = p_occurred_at where id = purchase.id;
    elsif purchase.dispute_id = p_dispute_id
      and purchase.dispute_status = 'open'
      and p_dispute_status in ('won', 'lost')
      and p_occurred_at >= purchase.dispute_occurred_at then
      update public.draft_pro_purchases set dispute_status = p_dispute_status, dispute_occurred_at = p_occurred_at where id = purchase.id;
    elsif purchase.dispute_id <> p_dispute_id
      and p_occurred_at > coalesce(purchase.dispute_occurred_at, '-infinity'::timestamptz) then
      update public.draft_pro_purchases set dispute_id = p_dispute_id, dispute_status = p_dispute_status, dispute_occurred_at = p_occurred_at where id = purchase.id;
    end if;
  end if;

  select * into purchase from public.draft_pro_purchases where id = purchase.id for update;
  effective_status := case
    when purchase.full_refunded_at is not null then 'refunded'
    when purchase.dispute_status in ('open', 'lost') then 'disputed'
    when purchase.payment_confirmed_at is not null and purchase.expires_at > now() then 'active'
    when purchase.payment_confirmed_at is not null then 'expired'
    else 'pending'
  end;
  update public.draft_pro_purchases set status = effective_status where id = purchase.id;

  insert into public.user_entitlements (user_id, source_provider, entitlement_key, entitlement_status, source_reference, effective_from, effective_to, metadata)
  values (purchase.user_id, 'stripe', 'draft_pro', case when effective_status = 'active' then 'active' else 'inactive' end, 'draft_pro_purchase:' || purchase.id::text, purchase.activated_at, purchase.expires_at, jsonb_build_object('purchase_id', purchase.id, 'payment_state', effective_status))
  on conflict (source_provider, source_reference) where source_reference is not null do update
  set entitlement_status = excluded.entitlement_status,
      effective_from = coalesce(public.user_entitlements.effective_from, excluded.effective_from),
      effective_to = excluded.effective_to,
      metadata = public.user_entitlements.metadata || excluded.metadata;

  update public.draft_pro_provider_events set processed_at = now() where id = event_row_id;
  return query select purchase.id, true;
end;
$$;

revoke all on function public.begin_draft_pro_stripe_checkout_attempt(uuid) from public, anon, authenticated;
revoke all on function public.attach_draft_pro_stripe_checkout_session(uuid, text, timestamptz) from public, anon, authenticated;
revoke all on function public.record_draft_pro_stripe_event(text, text, timestamptz, text, text, uuid, uuid, text, boolean, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.begin_draft_pro_stripe_checkout_attempt(uuid) to service_role;
grant execute on function public.attach_draft_pro_stripe_checkout_session(uuid, text, timestamptz) to service_role;
grant execute on function public.record_draft_pro_stripe_event(text, text, timestamptz, text, text, uuid, uuid, text, boolean, text, text, jsonb) to service_role;
