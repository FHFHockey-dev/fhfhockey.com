create table public.draft_pro_access_codes (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null unique check (code_hash ~ '^[a-f0-9]{64}$'),
  target_user_id uuid not null references auth.users(id) on delete cascade,
  issued_by_user_id uuid not null references auth.users(id) on delete restrict,
  reason text not null check (char_length(reason) between 1 and 500),
  expires_at timestamptz not null check (expires_at <= '2027-07-01T04:00:00Z'),
  redeemed_at timestamptz,
  redeemed_by_user_id uuid references auth.users(id) on delete restrict,
  revoked_at timestamptz,
  revoked_by_user_id uuid references auth.users(id) on delete restrict,
  revoked_reason text check (revoked_reason is null or char_length(revoked_reason) between 1 and 500),
  created_at timestamptz not null default now()
);
create table public.draft_pro_access_code_attempts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  window_started_at timestamptz not null default now(),
  attempt_count integer not null default 0 check (attempt_count between 0 and 100)
);
alter table public.draft_pro_access_codes enable row level security;
alter table public.draft_pro_access_code_attempts enable row level security;
revoke all on table public.draft_pro_access_codes from public, anon, authenticated;
revoke all on table public.draft_pro_access_code_attempts from public, anon, authenticated;
grant select, insert, update, delete on table public.draft_pro_access_codes, public.draft_pro_access_code_attempts to service_role;

-- The baseline permits users to manage their own generic entitlement rows. A
-- restrictive policy keeps every Draft Pro-authorizing shape service-authored
-- and hidden without changing behavior for unrelated entitlement keys.
create policy user_entitlements_draft_pro_service_only
  on public.user_entitlements as restrictive for all to anon, authenticated
  using (source_provider <> 'complimentary' and entitlement_key not in ('draft_pro', 'patreon_supporter'))
  with check (source_provider <> 'complimentary' and entitlement_key not in ('draft_pro', 'patreon_supporter'));

create or replace function public.redeem_draft_pro_access_code(p_user_id uuid,p_code text)
returns text language plpgsql security definer set search_path=public,pg_temp as $$
declare access_code public.draft_pro_access_codes%rowtype; code_found boolean;
begin
  if p_user_id is null or p_code is null or char_length(p_code) not between 20 and 200 then return 'invalid'; end if;
  perform pg_advisory_xact_lock(hashtext('draft-pro-access-code:' || p_user_id::text));
  select c.* into access_code from public.draft_pro_access_codes as c
  where c.code_hash=encode(extensions.digest(p_code,'sha256'),'hex') for update;
  code_found := found;
  if code_found and access_code.target_user_id=p_user_id and access_code.redeemed_by_user_id=p_user_id and access_code.revoked_at is null and access_code.expires_at>now() then return 'redeemed'; end if;
  insert into public.draft_pro_access_code_attempts(user_id,window_started_at,attempt_count) values(p_user_id,now(),1)
  on conflict(user_id) do update set window_started_at=case when public.draft_pro_access_code_attempts.window_started_at <= now()-interval '1 minute' then now() else public.draft_pro_access_code_attempts.window_started_at end,
    attempt_count=case when public.draft_pro_access_code_attempts.window_started_at <= now()-interval '1 minute' then 1 else least(public.draft_pro_access_code_attempts.attempt_count+1,9) end;
  if (select a.attempt_count from public.draft_pro_access_code_attempts as a where a.user_id=p_user_id)>8 then return 'rate_limited'; end if;
  if not code_found or access_code.target_user_id<>p_user_id or access_code.redeemed_at is not null or access_code.revoked_at is not null or access_code.expires_at<=now() then return 'invalid'; end if;
  if access_code.redeemed_at is null then
    update public.draft_pro_access_codes as c set redeemed_at=now(),redeemed_by_user_id=p_user_id where c.id=access_code.id;
    insert into public.user_entitlements(user_id,source_provider,entitlement_key,entitlement_status,source_reference,effective_from,effective_to,metadata)
    values(p_user_id,'complimentary','draft_pro','active','draft_pro_access_code:' || access_code.id::text,now(),access_code.expires_at,jsonb_build_object('access_code_id',access_code.id,'reason',access_code.reason))
    on conflict (source_provider,source_reference) where source_reference is not null do update set entitlement_status='active',effective_to=excluded.effective_to;
  end if;
  return 'redeemed';
end;
$$;
create or replace function public.issue_draft_pro_access_code(p_issued_by_user_id uuid,p_target_user_id uuid,p_code_hash text,p_reason text,p_expires_at timestamptz)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare code_id uuid;
begin
  if not exists(select 1 from public.users as u where u.user_id=p_issued_by_user_id and u.role='admin') then raise exception 'Draft Pro access-code administrator is required'; end if;
  if p_code_hash !~ '^[a-f0-9]{64}$' or p_reason is null or char_length(btrim(p_reason)) not between 1 and 500 or p_expires_at is null or p_expires_at<=now() or p_expires_at>'2027-07-01T04:00:00Z' then raise exception 'Invalid Draft Pro access code'; end if;
  insert into public.draft_pro_access_codes(code_hash,target_user_id,issued_by_user_id,reason,expires_at) values(p_code_hash,p_target_user_id,p_issued_by_user_id,btrim(p_reason),p_expires_at) returning id into code_id;
  return code_id;
end;
$$;
create or replace function public.revoke_draft_pro_access_code(p_issued_by_user_id uuid,p_code_id uuid,p_reason text)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare access_code public.draft_pro_access_codes%rowtype;
begin
  if not exists(select 1 from public.users as u where u.user_id=p_issued_by_user_id and u.role='admin') then raise exception 'Draft Pro access-code administrator is required'; end if;
  if p_reason is null or char_length(btrim(p_reason)) not between 1 and 500 then raise exception 'A revocation reason is required'; end if;
  select c.* into access_code from public.draft_pro_access_codes as c where c.id=p_code_id and c.issued_by_user_id=p_issued_by_user_id for update;
  if not found then return false; end if;
  if access_code.revoked_at is null then
    update public.draft_pro_access_codes as c set revoked_at=now(),revoked_by_user_id=p_issued_by_user_id,revoked_reason=btrim(p_reason) where c.id=access_code.id;
    update public.user_entitlements as e set entitlement_status='inactive',metadata=e.metadata || jsonb_build_object('revoked_at',now(),'revoked_reason',btrim(p_reason)) where e.user_id=access_code.target_user_id and e.source_provider='complimentary' and e.source_reference='draft_pro_access_code:' || access_code.id::text and e.entitlement_status='active';
  end if;
  return true;
end;
$$;
revoke all on function public.redeem_draft_pro_access_code(uuid,text),public.revoke_draft_pro_access_code(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.issue_draft_pro_access_code(uuid,uuid,text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.redeem_draft_pro_access_code(uuid,text),public.revoke_draft_pro_access_code(uuid,uuid,text),public.issue_draft_pro_access_code(uuid,uuid,text,text,timestamptz) to service_role;
