-- Operator artifact only. Register after independent native/context readback, signed grant and TJ approval.
-- One queue insertion at most, with the pg_net request ID retained for the operator.
\set ON_ERROR_STOP on
begin;
set local lock_timeout = '5s';
set local statement_timeout = '15s';

do $preflight$
begin
  if pg_catalog.clock_timestamp() not between timestamptz '2026-11-21 12:35Z' and timestamptz '2026-11-21 12:44:59Z'
     or exists (select 1 from cron.job where jobname = 'blsh-official-once-20261120')
     or exists (select 1 from public.blsh_official_runs where source_date = date '2026-11-20')
     or not exists (select 1 from public.blsh_context_runs c join public.blsh_capture_runs n
                    on n.run_id = c.native_run_id and n.source_date = c.source_date
                    and n.manifest_sha256 = c.native_manifest_sha256
                    where c.source_date = date '2026-11-20' and n.pruned_at is null
                    and c.state = 'packet_complete_pending_review' and n.state = c.state)
     or (select count(*) from vault.decrypted_secrets where name = 'blsh_official_grant_20261120') <> 1 then
    raise exception 'official_pilot_preflight_refused';
  end if;
end $preflight$;

create table fhfh_internal.blsh_official_dispatch_20261120 (
  singleton boolean primary key default true check (singleton),
  job_id bigint not null unique,
  disposition text not null default 'registered' check
    (disposition in ('registered','expired','refused','enqueue_failed','queued')),
  observed_at timestamptz,
  request_id bigint unique,
  check ((disposition = 'queued') = (request_id is not null))
);
revoke all on fhfh_internal.blsh_official_dispatch_20261120 from public, anon, authenticated, service_role;

insert into fhfh_internal.blsh_official_dispatch_20261120 (job_id)
select cron.schedule('blsh-official-once-20261120','45 12 21 11 *', $command$
do $fire$
declare
  dispatch fhfh_internal.blsh_official_dispatch_20261120%rowtype;
  grant_header text;
  http_id bigint;
  now_utc timestamptz;
begin
  select * into strict dispatch from fhfh_internal.blsh_official_dispatch_20261120 where singleton for update;
  if dispatch.disposition <> 'registered' then return; end if;
  -- pg_cron has no year field. Remove this exact registration on its first firing, even after a missed year.
  if not cron.unschedule(dispatch.job_id) then raise exception 'official_pilot_job_missing'; end if;
  now_utc := pg_catalog.clock_timestamp();
  if now_utc < timestamptz '2026-11-21 12:45Z' or now_utc >= timestamptz '2026-11-21 12:46Z' then
    update fhfh_internal.blsh_official_dispatch_20261120 set disposition = 'expired', observed_at = now_utc where singleton;
    return;
  end if;
  begin
    select case when count(*) = 1 then min(decrypted_secret) end into grant_header
      from vault.decrypted_secrets where name = 'blsh_official_grant_20261120';
    if grant_header is null or length(grant_header) not between 1 and 4096 then
      update fhfh_internal.blsh_official_dispatch_20261120 set disposition = 'refused', observed_at = now_utc where singleton;
      return;
    end if;
    select net.http_get(url := 'https://fhfhockey.com/api/v1/db/blsh-official-boxscores',
      headers := fhfh_internal.require_cron_request_headers() || jsonb_build_object('x-blsh-official-grant', grant_header),
      timeout_milliseconds := 240000) into strict http_id;
    if http_id is null then raise exception 'official_pilot_enqueue_missing'; end if;
    update fhfh_internal.blsh_official_dispatch_20261120
      set disposition = 'queued', observed_at = now_utc, request_id = http_id where singleton;
  exception when others then
    -- Enqueue and its correlation row are in the same local subtransaction. Never queue a replacement.
    update fhfh_internal.blsh_official_dispatch_20261120 set disposition = 'enqueue_failed', observed_at = now_utc where singleton;
  end;
end $fire$;
$command$);
commit;
