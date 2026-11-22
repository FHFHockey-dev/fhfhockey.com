-- PROPOSAL ONLY (managed-signer lane, 2026-11-22). Operator artifact for the Nov 22 slate as Y is dated; a new slate re-dates every literal.
-- Replaces the in-window, hand-run SCHEDULE-ONCE.sql. Run ONCE, after INSTALL and before ARM, under TJ's arm approval line,
-- with -v signer_url=<the Lambda function URL, no trailing slash>. It registers five one-shot pg_cron jobs and nothing else:
--   12:35 rc_sign         POST the DB-built evidence to the signer's /request-context route
--   12:36 rc_post         take the signer's envelope from net._http_response and POST it to fhfhockey request-context
--   12:41 official_sign   POST the DB-built evidence to the signer's /official route
--   12:42 official_store  put the signer's grantBase64 into Vault as blsh_official_grant_20261122
--   12:45 official dispatch: the reviewed SCHEDULE-ONCE command, byte-identical, recorded in the same dispatch table, so the
--         reviewed CANCEL-OFFICIAL-ONCE.sql still cancels it.
-- Each job removes its own registration on first firing, acts only inside its own minute, never retries, and records a
-- disposition. A missing or refused upstream step makes every later step a no-op. No step prints or keeps an envelope:
-- the signer's response row is deleted from net._http_response as soon as it is read.
\set ON_ERROR_STOP on
begin;
set local lock_timeout = '5s';
set local statement_timeout = '15s';

do $preflight$
begin
  if pg_catalog.clock_timestamp() >= timestamptz '2026-11-23 12:05Z'
     or pg_catalog.to_regclass('public.blsh_pilot_20261123') is null
     or exists (select 1 from cron.job where jobname like 'blsh-signer-%-20261122' or jobname = 'blsh-official-once-20261122')
     or pg_catalog.to_regclass('fhfh_internal.blsh_official_dispatch_20261122') is not null
     or exists (select 1 from public.blsh_official_runs where source_date = date '2026-11-22')
     or exists (select 1 from public.blsh_context_runs where source_date = date '2026-11-22')
     or exists (select 1 from vault.decrypted_secrets where name = 'blsh_official_grant_20261122')
     or (select count(*) from vault.decrypted_secrets where name = 'blsh_signer_trigger_secret' and length(decrypted_secret) >= 32) <> 1 then
    raise exception 'signer_automation_preflight_refused';
  end if;
end $preflight$;

create table fhfh_internal.blsh_signer_config_20261122 (
  singleton boolean primary key default true check (singleton),
  signer_url text not null check (signer_url ~ '^https://[a-z0-9]{32}\.lambda-url\.us-east-1\.on\.aws$')
);
-- psql does not expand variables inside dollar quotes, so the URL is checked by this table's constraint.
insert into fhfh_internal.blsh_signer_config_20261122 (signer_url) values (:'signer_url');

create table fhfh_internal.blsh_signer_steps_20261122 (
  step text primary key check (step in ('rc_sign','rc_post','official_sign','official_store')),
  job_id bigint not null unique,
  disposition text not null default 'registered' check (disposition in
    ('registered','expired','skipped_upstream','queued','no_response','refused','stored','enqueue_failed')),
  observed_at timestamptz,
  request_id bigint unique,
  http_status integer,
  reason text check (reason is null or reason ~ '^[a-z][a-z0-9_:]{2,100}$')
);
revoke all on fhfh_internal.blsh_signer_config_20261122, fhfh_internal.blsh_signer_steps_20261122
  from public, anon, authenticated, service_role;

-- Evidence is assembled inside Postgres from the tables the custody functions already enforce. It names nothing to sign:
-- the signer derives every signed field from its own mandate and checks these rows against it.
create function fhfh_internal.blsh_signer_evidence_20261122(p_kind text) returns jsonb
language plpgsql volatile set search_path = '' as $$
declare pin jsonb; runs jsonb; src jsonb; ctx jsonb; official integer; out jsonb;
begin
  if p_kind not in ('request-context','official') then raise exception 'signer_evidence_kind'; end if;
  select pg_catalog.jsonb_build_object('releaseSha', p.release_sha, 'deploymentId', p.deployment_id) into pin
    from public.blsh_pilot_20261123 p where p.singleton;
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('runId', c.run_id, 'sourceDate', c.source_date, 'state', c.state,
      'reason', c.reason, 'manifestSHA256', c.manifest_sha256, 'claimedAtUTC', c.claimed_at, 'closedAtUTC', c.closed_at,
      'prunedAtUTC', c.pruned_at, 'deployment', c.deployment) order by c.run_id), '[]'::jsonb) into runs
    from public.blsh_capture_runs c where c.pipeline = 'native-v6' and c.source_date = date '2026-11-22';
  begin
    select public.blsh_context_source_v1(c.source_date, c.run_id, c.manifest_sha256) into src
      from public.blsh_capture_runs c where c.pipeline = 'native-v6' and c.source_date = date '2026-11-22'
        and c.state = 'packet_complete_pending_review';
  exception when others then src := null;
  end;
  out := pg_catalog.jsonb_build_object('version', 'fhfh.blsh.signer-evidence.v1', 'kind', p_kind,
    'dbClockUTC', pg_catalog.to_char(pg_catalog.clock_timestamp() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'pilotPin', pin, 'nativeRuns', runs, 'nativeSource', src);
  if p_kind = 'official' then
    select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('sourceDate', r.source_date, 'nativeRunId', r.native_run_id,
        'nativeManifestSHA256', r.native_manifest_sha256, 'state', r.state) order by r.run_id), '[]'::jsonb) into ctx
      from public.blsh_context_runs r where r.source_date = date '2026-11-22';
    select count(*) into official from public.blsh_official_runs where source_date = date '2026-11-22';
    out := out || pg_catalog.jsonb_build_object('contextRuns', ctx, 'officialRunCount', official);
  end if;
  return out;
end $$;

-- One function runs every signer step; each pg_cron job calls it once with its own step name.
create function fhfh_internal.blsh_signer_step_20261122(p_step text) returns void
language plpgsql volatile set search_path = '' as $$
declare
  s fhfh_internal.blsh_signer_steps_20261122%rowtype; up fhfh_internal.blsh_signer_steps_20261122%rowtype;
  resp record; body jsonb; env jsonb; grant_b64 text; secret text; url text; http_id bigint; now_utc timestamptz;
  opens timestamptz; why text;
begin
  select * into strict s from fhfh_internal.blsh_signer_steps_20261122 where step = p_step for update;
  if s.disposition <> 'registered' then return; end if;
  if not cron.unschedule(s.job_id) then raise exception 'signer_step_job_missing'; end if;
  now_utc := pg_catalog.clock_timestamp();
  opens := case p_step when 'rc_sign' then timestamptz '2026-11-23 12:35Z' when 'rc_post' then timestamptz '2026-11-23 12:36Z'
    when 'official_sign' then timestamptz '2026-11-23 12:41Z' else timestamptz '2026-11-23 12:42Z' end;
  if now_utc < opens or now_utc >= opens + interval '1 minute' then
    update fhfh_internal.blsh_signer_steps_20261122 set disposition = 'expired', observed_at = now_utc where step = p_step;
    return;
  end if;
  if p_step <> 'rc_sign' then
    select * into strict up from fhfh_internal.blsh_signer_steps_20261122
      where step = case p_step when 'rc_post' then 'rc_sign' when 'official_sign' then 'rc_post' else 'official_sign' end;
    if up.disposition <> 'queued' then
      update fhfh_internal.blsh_signer_steps_20261122 set disposition = 'skipped_upstream', observed_at = now_utc where step = p_step;
      return;
    end if;
  end if;
  begin
    if p_step in ('rc_sign', 'official_sign') then
      select case when count(*) = 1 then min(decrypted_secret) end into secret
        from vault.decrypted_secrets where name = 'blsh_signer_trigger_secret';
      select signer_url into strict url from fhfh_internal.blsh_signer_config_20261122 where singleton;
      if secret is null or length(secret) < 32 then
        update fhfh_internal.blsh_signer_steps_20261122 set disposition = 'refused', reason = 'trigger_secret_missing', observed_at = now_utc
          where step = p_step;
        return;
      end if;
      select net.http_post(url := url || case p_step when 'rc_sign' then '/request-context' else '/official' end,
          body := fhfh_internal.blsh_signer_evidence_20261122(case p_step when 'rc_sign' then 'request-context' else 'official' end),
          headers := pg_catalog.jsonb_build_object('Authorization', 'Bearer ' || secret, 'Content-Type', 'application/json'),
          timeout_milliseconds := 15000) into strict http_id;
      update fhfh_internal.blsh_signer_steps_20261122 set disposition = 'queued', observed_at = now_utc, request_id = http_id where step = p_step;
      return;
    end if;
    -- rc_post / official_store: read and immediately delete the signer's response row.
    select r.status_code, r.content, r.timed_out into resp from net._http_response r where r.id = up.request_id;
    if not found then
      update fhfh_internal.blsh_signer_steps_20261122 set disposition = 'no_response', observed_at = now_utc where step = p_step;
      return;
    end if;
    delete from net._http_response where id = up.request_id;
    begin body := resp.content::jsonb; exception when others then body := null; end;
    why := case when body ? 'reason' and body->>'reason' ~ '^[a-z][a-z0-9_:]{2,100}$' then body->>'reason' end;
    update fhfh_internal.blsh_signer_steps_20261122 set http_status = resp.status_code, reason = why where step = up.step;
    if resp.status_code is distinct from 200 or coalesce(resp.timed_out, false) or body is null or body->>'state' is distinct from 'issued' then
      update fhfh_internal.blsh_signer_steps_20261122 set disposition = 'refused', reason = coalesce(why, 'signer_not_issued'), observed_at = now_utc
        where step = p_step;
      return;
    end if;
    if p_step = 'rc_post' then
      env := body->'envelope';
      if body->>'kind' is distinct from 'request-context' or pg_catalog.jsonb_typeof(env) is distinct from 'object'
         or (select pg_catalog.array_agg(k order by k) from pg_catalog.jsonb_object_keys(env) k) is distinct from array['approval','signature']
         or pg_catalog.octet_length(env::text) > 1024 then
        update fhfh_internal.blsh_signer_steps_20261122 set disposition = 'refused', reason = 'envelope_shape', observed_at = now_utc where step = p_step;
        return;
      end if;
      select net.http_post(url := 'https://fhfhockey.com/api/v1/db/blsh-request-context', body := env,
          headers := fhfh_internal.require_cron_request_headers() || pg_catalog.jsonb_build_object('Content-Type', 'application/json'),
          timeout_milliseconds := 240000) into strict http_id;
      update fhfh_internal.blsh_signer_steps_20261122 set disposition = 'queued', observed_at = now_utc, request_id = http_id where step = p_step;
    else
      grant_b64 := body->>'grantBase64';
      if body->>'kind' is distinct from 'official' or grant_b64 is null or length(grant_b64) not between 1 and 4096
         or grant_b64 !~ '^[A-Za-z0-9+/]+={0,2}$' or length(grant_b64) % 4 <> 0
         or exists (select 1 from vault.decrypted_secrets where name = 'blsh_official_grant_20261122') then
        update fhfh_internal.blsh_signer_steps_20261122 set disposition = 'refused', reason = 'grant_shape_or_duplicate', observed_at = now_utc
          where step = p_step;
        return;
      end if;
      perform vault.create_secret(grant_b64, 'blsh_official_grant_20261122');
      update fhfh_internal.blsh_signer_steps_20261122 set disposition = 'stored', observed_at = now_utc where step = p_step;
    end if;
  exception when others then
    update fhfh_internal.blsh_signer_steps_20261122 set disposition = 'enqueue_failed', observed_at = now_utc where step = p_step;
  end;
end $$;
revoke all on function fhfh_internal.blsh_signer_evidence_20261122(text), fhfh_internal.blsh_signer_step_20261122(text)
  from public, anon, authenticated, service_role;

insert into fhfh_internal.blsh_signer_steps_20261122 (step, job_id) values
  ('rc_sign',        cron.schedule('blsh-signer-rc-sign-20261122',        '35 12 23 11 *', $$select fhfh_internal.blsh_signer_step_20261122('rc_sign')$$)),
  ('rc_post',        cron.schedule('blsh-signer-rc-post-20261122',        '36 12 23 11 *', $$select fhfh_internal.blsh_signer_step_20261122('rc_post')$$)),
  ('official_sign',  cron.schedule('blsh-signer-official-sign-20261122',  '41 12 23 11 *', $$select fhfh_internal.blsh_signer_step_20261122('official_sign')$$)),
  ('official_store', cron.schedule('blsh-signer-official-store-20261122', '42 12 23 11 *', $$select fhfh_internal.blsh_signer_step_20261122('official_store')$$));

-- The 12:45 dispatch: the reviewed SCHEDULE-ONCE table and command, unchanged.
create table fhfh_internal.blsh_official_dispatch_20261122 (
  singleton boolean primary key default true check (singleton),
  job_id bigint not null unique,
  disposition text not null default 'registered' check
    (disposition in ('registered','expired','refused','enqueue_failed','queued')),
  observed_at timestamptz,
  request_id bigint unique,
  check ((disposition = 'queued') = (request_id is not null))
);
revoke all on fhfh_internal.blsh_official_dispatch_20261122 from public, anon, authenticated, service_role;

insert into fhfh_internal.blsh_official_dispatch_20261122 (job_id)
select cron.schedule('blsh-official-once-20261122','45 12 23 11 *', $command$
do $fire$
declare
  dispatch fhfh_internal.blsh_official_dispatch_20261122%rowtype;
  grant_header text;
  http_id bigint;
  now_utc timestamptz;
begin
  select * into strict dispatch from fhfh_internal.blsh_official_dispatch_20261122 where singleton for update;
  if dispatch.disposition <> 'registered' then return; end if;
  -- pg_cron has no year field. Remove this exact registration on its first firing, even after a missed year.
  if not cron.unschedule(dispatch.job_id) then raise exception 'official_pilot_job_missing'; end if;
  now_utc := pg_catalog.clock_timestamp();
  if now_utc < timestamptz '2026-11-23 12:45Z' or now_utc >= timestamptz '2026-11-23 12:46Z' then
    update fhfh_internal.blsh_official_dispatch_20261122 set disposition = 'expired', observed_at = now_utc where singleton;
    return;
  end if;
  begin
    select case when count(*) = 1 then min(decrypted_secret) end into grant_header
      from vault.decrypted_secrets where name = 'blsh_official_grant_20261122';
    if grant_header is null or length(grant_header) not between 1 and 4096 then
      update fhfh_internal.blsh_official_dispatch_20261122 set disposition = 'refused', observed_at = now_utc where singleton;
      return;
    end if;
    select net.http_get(url := 'https://fhfhockey.com/api/v1/db/blsh-official-boxscores',
      headers := fhfh_internal.require_cron_request_headers() || jsonb_build_object('x-blsh-official-grant', grant_header),
      timeout_milliseconds := 240000) into strict http_id;
    if http_id is null then raise exception 'official_pilot_enqueue_missing'; end if;
    update fhfh_internal.blsh_official_dispatch_20261122
      set disposition = 'queued', observed_at = now_utc, request_id = http_id where singleton;
  exception when others then
    -- Enqueue and its correlation row are in the same local subtransaction. Never queue a replacement.
    update fhfh_internal.blsh_official_dispatch_20261122 set disposition = 'enqueue_failed', observed_at = now_utc where singleton;
  end;
end $fire$;
$command$);
commit;
