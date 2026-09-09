-- Run after the Draft Pro foundation, Stripe, saved-drafts, and complimentary
-- access-code migrations in verify-local-migration's disposable database.
begin;

insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data)
values
  ('00000000-0000-4000-8000-000000000051', 'authenticated', 'authenticated', 'access-admin@example.invalid', '{}', '{}'),
  ('00000000-0000-4000-8000-000000000052', 'authenticated', 'authenticated', 'access-basic@example.invalid', '{"role":"admin"}', '{}'),
  ('00000000-0000-4000-8000-000000000053', 'authenticated', 'authenticated', 'access-owner@example.invalid', '{}', '{}'),
  ('00000000-0000-4000-8000-000000000054', 'authenticated', 'authenticated', 'access-foreign@example.invalid', '{}', '{}'),
  ('00000000-0000-4000-8000-000000000055', 'authenticated', 'authenticated', 'access-rate@example.invalid', '{}', '{}');

insert into public.users (user_id, role)
values
  ('00000000-0000-4000-8000-000000000051', 'admin'),
  ('00000000-0000-4000-8000-000000000052', 'basic'),
  ('00000000-0000-4000-8000-000000000053', 'basic'),
  ('00000000-0000-4000-8000-000000000054', 'basic'),
  ('00000000-0000-4000-8000-000000000055', 'basic');

do $$
begin
  begin
    perform public.issue_draft_pro_access_code(
      '00000000-0000-4000-8000-000000000052',
      '00000000-0000-4000-8000-000000000053',
      encode(extensions.digest('metadata-admin-must-fail-0001', 'sha256'), 'hex'),
      'untrusted metadata admin',
      '2027-07-01T04:00:00Z'
    );
    raise exception 'editable JWT metadata unexpectedly authorized issuance';
  exception when others then
    if sqlerrm = 'editable JWT metadata unexpectedly authorized issuance' then raise; end if;
  end;

  begin
    perform public.issue_draft_pro_access_code(
      '00000000-0000-4000-8000-000000000051',
      '00000000-0000-4000-8000-000000000053',
      encode(extensions.digest('past-code-must-fail-000000001', 'sha256'), 'hex'),
      'past expiry',
      now() - interval '1 second'
    );
    raise exception 'past expiry unexpectedly authorized issuance';
  exception when others then
    if sqlerrm = 'past expiry unexpectedly authorized issuance' then raise; end if;
  end;
end $$;

create temporary table access_probe_ids (name text primary key, id uuid not null);

insert into access_probe_ids
select 'owner', public.issue_draft_pro_access_code(
  '00000000-0000-4000-8000-000000000051',
  '00000000-0000-4000-8000-000000000053',
  encode(extensions.digest('complimentary-owner-code-000001', 'sha256'), 'hex'),
  'support grant',
  '2027-07-01T04:00:00Z'
);

do $$
declare code_id uuid := (select id from access_probe_ids where name = 'owner');
begin
  if public.redeem_draft_pro_access_code('00000000-0000-4000-8000-000000000054', 'complimentary-owner-code-000001') <> 'invalid' then
    raise exception 'foreign account unexpectedly redeemed targeted code';
  end if;
  if public.redeem_draft_pro_access_code('00000000-0000-4000-8000-000000000053', 'complimentary-owner-code-000001') <> 'redeemed'
    or public.redeem_draft_pro_access_code('00000000-0000-4000-8000-000000000053', 'complimentary-owner-code-000001') <> 'redeemed' then
    raise exception 'owner redemption or idempotent retry failed';
  end if;
  if (select count(*) from public.user_entitlements where source_provider = 'complimentary' and source_reference = 'draft_pro_access_code:' || code_id) <> 1 then
    raise exception 'redemption replay created duplicate entitlement';
  end if;
  if not exists (
    select 1 from public.draft_pro_access_codes
    where id = code_id
      and code_hash = encode(extensions.digest('complimentary-owner-code-000001', 'sha256'), 'hex')
      and code_hash <> 'complimentary-owner-code-000001'
      and expires_at = '2027-07-01T04:00:00Z'
  ) then
    raise exception 'hash-only storage or exact season-end issuance assertion failed';
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'draft_pro_access_codes' and column_name in ('code', 'raw_code', 'plaintext_code')
  ) then
    raise exception 'access-code schema unexpectedly contains a plaintext column';
  end if;
end $$;

insert into public.draft_pro_access_codes (code_hash, target_user_id, issued_by_user_id, reason, expires_at)
values (
  encode(extensions.digest('complimentary-expired-code-0001', 'sha256'), 'hex'),
  '00000000-0000-4000-8000-000000000053',
  '00000000-0000-4000-8000-000000000051',
  'expired fixture',
  now() - interval '1 second'
);

do $$
begin
  if public.redeem_draft_pro_access_code('00000000-0000-4000-8000-000000000053', 'complimentary-expired-code-0001') <> 'invalid' then
    raise exception 'expired code unexpectedly redeemed';
  end if;
end $$;

insert into access_probe_ids
select 'revoked-before-use', public.issue_draft_pro_access_code(
  '00000000-0000-4000-8000-000000000051',
  '00000000-0000-4000-8000-000000000053',
  encode(extensions.digest('complimentary-revoked-code-0001', 'sha256'), 'hex'),
  'revoked fixture',
  '2027-07-01T04:00:00Z'
);

do $$
begin
  if not public.revoke_draft_pro_access_code(
    '00000000-0000-4000-8000-000000000051',
    (select id from access_probe_ids where name = 'revoked-before-use'),
    'issued in error'
  ) then raise exception 'pre-use revocation failed'; end if;
  if public.redeem_draft_pro_access_code('00000000-0000-4000-8000-000000000053', 'complimentary-revoked-code-0001') <> 'invalid' then
    raise exception 'revoked code unexpectedly redeemed';
  end if;
end $$;

do $$
declare attempt integer; result text;
begin
  for attempt in 1..10 loop
    result := public.redeem_draft_pro_access_code('00000000-0000-4000-8000-000000000055', 'invalid-rate-limit-code-0000001');
    if (attempt <= 8 and result <> 'invalid') or (attempt > 8 and result <> 'rate_limited') then
      raise exception 'rate-limit result % on attempt %', result, attempt;
    end if;
  end loop;
  if (select attempt_count from public.draft_pro_access_code_attempts where user_id = '00000000-0000-4000-8000-000000000055') <> 9 then
    raise exception 'rate-limit counter did not remain bounded';
  end if;
end $$;

insert into access_probe_ids
select 'revoke-after-use', public.issue_draft_pro_access_code(
  '00000000-0000-4000-8000-000000000051',
  '00000000-0000-4000-8000-000000000053',
  encode(extensions.digest('complimentary-revoke-audit-0001', 'sha256'), 'hex'),
  'audited grant',
  '2027-07-01T04:00:00Z'
);

do $$
declare
  code_id uuid := (select id from access_probe_ids where name = 'revoke-after-use');
  first_revoked_at timestamptz;
begin
  if public.redeem_draft_pro_access_code('00000000-0000-4000-8000-000000000053', 'complimentary-revoke-audit-0001') <> 'redeemed' then
    raise exception 'audit fixture redemption failed';
  end if;
  insert into public.user_entitlements (
    user_id, source_provider, entitlement_key, entitlement_status, source_reference, effective_from, effective_to, metadata
  ) values (
    '00000000-0000-4000-8000-000000000053', 'stripe', 'draft_pro', 'active', 'access-probe-stripe', now(), '2027-07-01T04:00:00Z', '{}'
  );
  if not public.revoke_draft_pro_access_code('00000000-0000-4000-8000-000000000051', code_id, 'customer request') then
    raise exception 'audited revocation failed';
  end if;
  select revoked_at into first_revoked_at from public.draft_pro_access_codes where id = code_id;
  if not exists (
    select 1 from public.draft_pro_access_codes
    where id = code_id and revoked_by_user_id = '00000000-0000-4000-8000-000000000051'
      and revoked_reason = 'customer request'
  ) or not exists (
    select 1 from public.user_entitlements
    where source_provider = 'complimentary' and source_reference = 'draft_pro_access_code:' || code_id
      and entitlement_status = 'inactive' and effective_to = '2027-07-01T04:00:00Z'
      and metadata->>'revoked_reason' = 'customer request'
  ) then
    raise exception 'revocation audit or original expiration was not preserved';
  end if;
  if not exists (
    select 1 from public.user_entitlements
    where source_provider = 'stripe' and source_reference = 'access-probe-stripe' and entitlement_status = 'active'
  ) then
    raise exception 'complimentary revocation disabled an independent Stripe grant';
  end if;
  perform public.revoke_draft_pro_access_code('00000000-0000-4000-8000-000000000051', code_id, 'different retry reason');
  if not exists (
    select 1 from public.draft_pro_access_codes
    where id = code_id and revoked_at = first_revoked_at and revoked_reason = 'customer request'
  ) then
    raise exception 'revocation retry changed the durable audit record';
  end if;
end $$;

insert into public.user_entitlements (
  user_id, source_provider, entitlement_key, entitlement_status, source_reference, effective_from, metadata
) values (
  '00000000-0000-4000-8000-000000000053', 'other-provider', 'unrelated-benefit', 'active', 'access-probe-benign', now(), '{}'
);

do $$
declare visible_rows integer;
begin
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000053', true);
  select count(*) into visible_rows from public.user_entitlements where source_provider = 'complimentary';
  if visible_rows <> 0 then raise exception 'browser unexpectedly read complimentary grants'; end if;
  begin
    insert into public.user_entitlements (user_id, source_provider, entitlement_key, entitlement_status, effective_from, effective_to)
    values ('00000000-0000-4000-8000-000000000053', 'complimentary', 'draft_pro', 'active', now(), '2027-07-01T04:00:00Z');
    raise exception 'browser unexpectedly forged complimentary grant';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.user_entitlements (user_id, source_provider, entitlement_key, entitlement_status, effective_from, effective_to)
    values ('00000000-0000-4000-8000-000000000053', 'stripe', 'draft_pro', 'active', now(), '2027-07-01T04:00:00Z');
    raise exception 'browser unexpectedly forged Stripe grant';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.user_entitlements (user_id, source_provider, entitlement_key, entitlement_status, effective_from, metadata)
    values ('00000000-0000-4000-8000-000000000053', 'patreon', 'patreon_supporter', 'active', now(), '{"draft_pro_eligible":true}');
    raise exception 'browser unexpectedly forged Patreon grant';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.user_entitlements set entitlement_key = 'draft_pro', source_provider = 'stripe'
    where source_reference = 'access-probe-benign';
    raise exception 'browser unexpectedly converted an unrelated entitlement into a Draft Pro grant';
  exception when insufficient_privilege then null;
  end;
  update public.user_entitlements
  set entitlement_status = 'active', effective_to = '2027-07-01T04:00:00Z', metadata = '{"draft_pro_eligible":true}'
  where source_reference = 'draft_pro_access_code:' || (select id from access_probe_ids where name = 'revoke-after-use');
  delete from public.user_entitlements
  where source_reference = 'draft_pro_access_code:' || (select id from access_probe_ids where name = 'revoke-after-use');
  begin
    perform 1 from public.draft_pro_access_codes;
    raise exception 'browser unexpectedly read access-code table';
  exception when insufficient_privilege then null;
  end;
  update public.users set role = 'admin' where user_id = '00000000-0000-4000-8000-000000000053';
  execute 'reset role';
  if (select role from public.users where user_id = '00000000-0000-4000-8000-000000000053') <> 'basic' then
    raise exception 'browser unexpectedly promoted canonical admin role';
  end if;
  if not exists (
    select 1 from public.user_entitlements
    where source_reference = 'draft_pro_access_code:' || (select id from access_probe_ids where name = 'revoke-after-use')
      and entitlement_status = 'inactive' and metadata->>'revoked_reason' = 'customer request'
  ) then
    raise exception 'browser unexpectedly updated or deleted a protected grant';
  end if;
  if not exists (
    select 1 from public.user_entitlements
    where source_reference = 'access-probe-benign' and source_provider = 'other-provider' and entitlement_key = 'unrelated-benefit'
  ) then
    raise exception 'browser unexpectedly converted an unrelated entitlement';
  end if;
end $$;

do $$
begin
  if has_function_privilege('authenticated', 'public.issue_draft_pro_access_code(uuid,uuid,text,text,timestamptz)', 'execute')
    or has_function_privilege('authenticated', 'public.redeem_draft_pro_access_code(uuid,text)', 'execute')
    or has_function_privilege('authenticated', 'public.revoke_draft_pro_access_code(uuid,uuid,text)', 'execute') then
    raise exception 'browser role unexpectedly holds direct access-code RPC execution';
  end if;
end $$;

select 'access_codes=ownership-expiry-replay-rate-admin-revoke-dual-source-rls-passed';
rollback;
