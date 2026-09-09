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
  created_at timestamptz not null default now()
);
alter table public.draft_pro_access_codes enable row level security;
revoke all on table public.draft_pro_access_codes from public, anon, authenticated;
grant select, insert, update, delete on table public.draft_pro_access_codes to service_role;

create or replace function public.redeem_draft_pro_access_code(p_user_id uuid,p_code text)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare access_code public.draft_pro_access_codes%rowtype;
begin
  if p_user_id is null or p_code is null or char_length(p_code) not between 20 and 200 then return false; end if;
  perform pg_advisory_xact_lock(hashtext('draft-pro-access-code:' || p_user_id::text));
  select c.* into access_code from public.draft_pro_access_codes as c
  where c.code_hash=encode(digest(p_code,'sha256'),'hex') for update;
  if not found or access_code.target_user_id<>p_user_id or access_code.revoked_at is not null or access_code.expires_at<=now() then return false; end if;
  if access_code.redeemed_at is null then
    update public.draft_pro_access_codes as c set redeemed_at=now(),redeemed_by_user_id=p_user_id where c.id=access_code.id;
    insert into public.user_entitlements(user_id,source_provider,entitlement_key,entitlement_status,source_reference,effective_from,effective_to,metadata)
    values(p_user_id,'complimentary','draft_pro','active','draft_pro_access_code:' || access_code.id::text,now(),access_code.expires_at,jsonb_build_object('access_code_id',access_code.id,'reason',access_code.reason))
    on conflict (source_provider,source_reference) where source_reference is not null do update set entitlement_status='active',effective_to=excluded.effective_to;
  end if;
  return true;
end;
$$;
create or replace function public.revoke_draft_pro_access_code(p_issued_by_user_id uuid,p_code_id uuid)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare access_code public.draft_pro_access_codes%rowtype;
begin
  select c.* into access_code from public.draft_pro_access_codes as c where c.id=p_code_id and c.issued_by_user_id=p_issued_by_user_id for update;
  if not found then return false; end if;
  update public.draft_pro_access_codes as c set revoked_at=now(),revoked_by_user_id=p_issued_by_user_id where c.id=access_code.id and c.revoked_at is null;
  update public.user_entitlements as e set entitlement_status='inactive',effective_to=now() where e.user_id=access_code.target_user_id and e.source_provider='complimentary' and e.source_reference='draft_pro_access_code:' || access_code.id::text;
  return true;
end;
$$;
revoke all on function public.redeem_draft_pro_access_code(uuid,text),public.revoke_draft_pro_access_code(uuid,uuid) from public,anon,authenticated;
grant execute on function public.redeem_draft_pro_access_code(uuid,text),public.revoke_draft_pro_access_code(uuid,uuid) to service_role;
