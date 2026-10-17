begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- Staged proposal: move to the authoritative migration tree only after review.
-- This registry is private to the service role; it does not publish forecasts.
create table public.tweet_claim_scopes (
  scope_key text primary key,
  version bigint not null default 0,
  reduction jsonb not null default '{}',
  reviewed_state jsonb,
  updated_at timestamptz not null default now()
);
create table public.tweet_claim_observations (
  observation_id text primary key,
  scope_key text not null references public.tweet_claim_scopes(scope_key),
  ordinal bigint generated always as identity unique,
  content_hash text not null,
  lineage_key text not null,
  origin_id text,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  created_at timestamptz not null default now()
);
create index tweet_claim_observations_scope on public.tweet_claim_observations(scope_key, ordinal);
create index tweet_claim_observations_lineage on public.tweet_claim_observations(lineage_key, ordinal);
create index tweet_claim_observations_origin on public.tweet_claim_observations(origin_id) where origin_id is not null;
create table public.tweet_claim_aliases (
  alias_key text not null,
  observation_id text not null references public.tweet_claim_observations(observation_id),
  identity_version integer not null check (identity_version in (1,2)),
  primary key(alias_key, observation_id)
);
create table public.tweet_source_directory_evidence (
  evidence_id text primary key,
  account_key text not null,
  handle text not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);
create index tweet_source_directory_evidence_account on public.tweet_source_directory_evidence(account_key);
-- Verified coverage is separate from automatically observed story context.
-- An observed team mention never upgrades itself to a verified beat assignment.
create table public.tweet_source_coverage (
  entry_id text primary key,
  handle text not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);
create index tweet_source_coverage_handle on public.tweet_source_coverage(handle);
create table public.tweet_claim_outbox (
  action_key text primary key,
  scope_key text not null references public.tweet_claim_scopes(scope_key),
  scenario_key text not null,
  revision_key text not null,
  payload jsonb not null,
  status text not null default 'held' check(status in ('held','pending','delivering','uncertain','delivered','retry','exhausted','blocked')),
  attempts integer not null default 0 check(attempts between 0 and 3),
  reconciliations integer not null default 0 check(reconciliations between 0 and 3),
  owner uuid,
  lease_until timestamptz,
  next_attempt_at timestamptz not null default now(),
  requires_review boolean not null default false,
  last_error text,
  receipt jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index tweet_claim_outbox_due on public.tweet_claim_outbox(next_attempt_at) where status in ('pending','retry','delivering','uncertain');
create table public.tweet_claim_evaluation_cohorts (
  cohort_id text primary key,
  starts_at timestamptz not null,
  extraction_version text not null,
  registered_at timestamptz not null default clock_timestamp(),
  check(starts_at > registered_at)
);
create table public.tweet_claim_evaluation_samples (
  sample_id text primary key,
  cohort_id text not null references public.tweet_claim_evaluation_cohorts(cohort_id),
  lineage_key text not null,
  origin_id text,
  document_hash text not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  unique(cohort_id,lineage_key)
);
create table public.tweet_claim_evaluation_labels (
  label_id text primary key,
  sample_id text not null references public.tweet_claim_evaluation_samples(sample_id),
  supersedes_label_id text references public.tweet_claim_evaluation_labels(label_id),
  payload jsonb not null,
  created_at timestamptz not null default now()
);

do $$ declare table_name text; begin
  foreach table_name in array array['tweet_claim_scopes','tweet_claim_observations','tweet_claim_aliases',
    'tweet_source_directory_evidence','tweet_source_coverage','tweet_claim_outbox','tweet_claim_evaluation_cohorts',
    'tweet_claim_evaluation_samples','tweet_claim_evaluation_labels'] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on public.%I from public,anon,authenticated', table_name);
    execute format('grant select,insert on public.%I to service_role', table_name);
  end loop;
end $$;
grant update on public.tweet_claim_scopes, public.tweet_claim_outbox to service_role;
-- Even the app service role cannot backdate the registration clock.
revoke insert on public.tweet_claim_evaluation_cohorts from service_role;
grant insert(cohort_id,starts_at,extraction_version) on public.tweet_claim_evaluation_cohorts to service_role;
grant usage,select on sequence public.tweet_claim_observations_ordinal_seq to service_role;

create function public.read_tweet_claim_scope(p_scope text)
returns jsonb language sql security invoker set search_path='' as $$
  select jsonb_build_object('version',coalesce((select version from public.tweet_claim_scopes where scope_key=p_scope),0),
    'reviewedState',(select reviewed_state from public.tweet_claim_scopes where scope_key=p_scope),
    'observations',coalesce((select jsonb_agg(payload order by ordinal) from public.tweet_claim_observations where scope_key=p_scope),'[]'::jsonb));
$$;

create function public.register_tweet_claim_evaluation(p_id text,p_start timestamptz,p_version text)
returns void language plpgsql security invoker set search_path='' as $$
declare existing public.tweet_claim_evaluation_cohorts;
begin
  select * into existing from public.tweet_claim_evaluation_cohorts where cohort_id=p_id;
  if found then
    if existing.starts_at<>p_start or existing.extraction_version<>p_version then raise exception 'evaluation cohort is immutable'; end if;
    return;
  end if;
  if p_start<=clock_timestamp() then raise exception 'evaluation must be registered before its future start'; end if;
  insert into public.tweet_claim_evaluation_cohorts(cohort_id,starts_at,extraction_version) values(p_id,p_start,p_version);
end $$;

-- Compare-and-set makes append, alias compatibility, scenario advancement and
-- outbox creation one transaction. A stale planner must reread and reduce again.
create function public.commit_tweet_claim_scope(p_scope text,p_expected bigint,p_observations jsonb,p_reduction jsonb,p_reviewed jsonb)
returns boolean language plpgsql security invoker set search_path='' as $$
declare current_version bigint; item jsonb; existing public.tweet_claim_observations; alias jsonb;
  proposal jsonb; evidence jsonb; sample jsonb; cohort public.tweet_claim_evaluation_cohorts; total integer;
begin
  if jsonb_typeof(p_observations)<>'array' or jsonb_array_length(p_observations)>256 then raise exception 'invalid claim batch'; end if;
  insert into public.tweet_claim_scopes(scope_key) values(p_scope) on conflict do nothing;
  select version into current_version from public.tweet_claim_scopes where scope_key=p_scope for update;
  if current_version<>p_expected then return false; end if;
  select count(*) into total from public.tweet_claim_observations where scope_key=p_scope;
  for item in select value from jsonb_array_elements(p_observations) loop
    select * into existing from public.tweet_claim_observations where observation_id=item->'semantic'->>'id';
    if found then
      if existing.content_hash is distinct from item->>'contentHash' or existing.scope_key<>p_scope
        or (existing.payload #- '{semantic,interpretedAt}') is distinct from (item #- '{semantic,interpretedAt}')
        then raise exception 'immutable claim identity collision'; end if;
    else
      total:=total+1;
      if total>256 then raise exception 'claim scope capacity exceeded: review required'; end if;
      insert into public.tweet_claim_observations(observation_id,scope_key,content_hash,lineage_key,origin_id,payload)
        values(item->'semantic'->>'id',p_scope,item->>'contentHash',item->>'lineageKey',item->'semantic'->'original'->>'tweetId',item);
    end if;
    for alias in select value from jsonb_array_elements(item->'aliases') loop
      insert into public.tweet_claim_aliases(alias_key,observation_id,identity_version)
        values(alias->>'key',item->'semantic'->>'id',(alias->>'version')::integer) on conflict do nothing;
    end loop;
    for evidence in select value from jsonb_array_elements(item->'directoryEvidence') loop
      insert into public.tweet_source_directory_evidence(evidence_id,account_key,handle,payload)
        values(evidence->>'id',evidence->>'accountKey',evidence->>'handle',evidence) on conflict do nothing;
    end loop;
    sample:=item->'evaluation';
    if sample is not null and sample<>'null'::jsonb then
      select * into strict cohort from public.tweet_claim_evaluation_cohorts where cohort_id=sample->>'cohortId';
      if (sample->>'publishedAt') is null or (sample->>'receivedAt') is null or (sample->>'capturedAt') is null
        or (sample->>'publishedAt')::timestamptz<cohort.starts_at or (sample->>'receivedAt')::timestamptz<cohort.starts_at
        or (sample->>'capturedAt')::timestamptz<cohort.starts_at or (sample->>'capturedAt')::timestamptz>clock_timestamp()
        or (sample->>'publishedAt')::timestamptz>(sample->>'receivedAt')::timestamptz
        or (sample->>'receivedAt')::timestamptz>(sample->>'capturedAt')::timestamptz
        or sample->>'extractionVersion'<>cohort.extraction_version then raise exception 'sample outside prospective cohort'; end if;
      insert into public.tweet_claim_evaluation_samples(sample_id,cohort_id,lineage_key,origin_id,document_hash,payload)
        values(sample->>'id',cohort.cohort_id,item->>'lineageKey',item->'semantic'->'original'->>'tweetId',sample->>'documentHash',sample) on conflict do nothing;
    end if;
  end loop;
  for proposal in select value from jsonb_array_elements(p_reduction->'actions') loop
    select payload into strict item from public.tweet_claim_observations
      where observation_id=p_reduction->'observations'->(proposal->>'observationIndex')::integer->>'id' and scope_key=p_scope;
    insert into public.tweet_claim_outbox(action_key,scope_key,scenario_key,revision_key,payload,requires_review,last_error)
      values(proposal->>'key',p_scope,proposal->>'scenarioKey',proposal->>'revisionKey',
        jsonb_build_object('action',proposal,'observation',item,'reviewedCompatibility',p_reviewed-'state'),true,
        'occurrence convergence, dated identity and exact legacy sink coverage require review') on conflict do nothing;
  end loop;
  -- Conflicts and expiry stop queued effects. Delivered/uncertain effects keep
  -- their receipts and become explicit reconciliation exceptions, never erased.
  update public.tweet_claim_outbox set requires_review=true,
    status=case when status in ('held','pending','retry') then 'blocked' else status end,
    last_error='scenario no longer actionable; compensation requires review',updated_at=now()
    where scope_key=p_scope and not exists(select 1 from jsonb_array_elements(p_reduction->'actions') a where a->>'key'=action_key);
  update public.tweet_claim_scopes set version=version+1,reduction=p_reduction,reviewed_state=p_reviewed->'state',updated_at=now() where scope_key=p_scope;
  return true;
end $$;

-- No code in this migration releases held rows. Dispatch activation and each
-- legacy sink's idempotency/reconciliation contract need separate approval.
create function public.claim_tweet_claim_delivery(p_key text,p_owner uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare row public.tweet_claim_outbox; mode text;
begin
  select * into row from public.tweet_claim_outbox where action_key=p_key for update;
  if not found or row.status in ('held','blocked','delivered','exhausted') or row.requires_review or row.next_attempt_at>now() then return null; end if;
  if row.lease_until>now() then return null; end if;
  if not exists(select 1 from public.tweet_claim_scopes s, jsonb_array_elements(s.reduction->'actions') a
    where s.scope_key=row.scope_key and a->>'key'=row.action_key)
    or (row.payload->'observation'->'semantic'->'support'->>'validUntil')::timestamptz<=now() then
    update public.tweet_claim_outbox set requires_review=true,last_error='scope changed or expired' where action_key=p_key;
    return null;
  end if;
  mode:=case when row.status in ('delivering','uncertain') then 'reconcile' else 'send' end;
  if (mode='send' and row.attempts>=3) or (mode='reconcile' and row.reconciliations>=3) then
    update public.tweet_claim_outbox set status='exhausted',requires_review=true where action_key=p_key; return null;
  end if;
  update public.tweet_claim_outbox set owner=p_owner,lease_until=now()+interval '30 seconds',
    status=case when mode='send' then 'delivering' else 'uncertain' end,
    attempts=attempts+case when mode='send' then 1 else 0 end,
    reconciliations=reconciliations+case when mode='reconcile' then 1 else 0 end,updated_at=now() where action_key=p_key;
  return jsonb_build_object('mode',mode,'payload',row.payload);
end $$;

create function public.settle_tweet_claim_delivery(p_key text,p_owner uuid,p_outcome text,p_receipt jsonb,p_error text)
returns boolean language plpgsql security invoker set search_path='' as $$
declare row public.tweet_claim_outbox;
begin
  if p_outcome not in ('applied','not_applied','unknown') then raise exception 'invalid delivery outcome'; end if;
  select * into row from public.tweet_claim_outbox where action_key=p_key for update;
  if not found or row.owner is distinct from p_owner or row.lease_until<=now() or row.status not in ('delivering','uncertain') then return false; end if;
  if p_outcome='applied' and (p_receipt is null or p_receipt='null'::jsonb) then raise exception 'applied outcome needs sink receipt'; end if;
  update public.tweet_claim_outbox set
    status=case when p_outcome='applied' then 'delivered' when p_outcome='unknown' then 'uncertain'
      when attempts>=3 then 'exhausted' else 'retry' end,
    receipt=case when p_outcome='applied' then p_receipt else receipt end,
    requires_review=requires_review or (p_outcome='not_applied' and attempts>=3) or (p_outcome='unknown' and reconciliations>=3),
    owner=null,lease_until=null,next_attempt_at=now()+interval '1 minute',last_error=left(p_error,500),updated_at=now() where action_key=p_key;
  return true;
end $$;

revoke all on function public.read_tweet_claim_scope(text),public.register_tweet_claim_evaluation(text,timestamptz,text),
  public.commit_tweet_claim_scope(text,bigint,jsonb,jsonb,jsonb),public.claim_tweet_claim_delivery(text,uuid),
  public.settle_tweet_claim_delivery(text,uuid,text,jsonb,text) from public,anon,authenticated;
grant execute on function public.read_tweet_claim_scope(text),public.register_tweet_claim_evaluation(text,timestamptz,text),
  public.commit_tweet_claim_scope(text,bigint,jsonb,jsonb,jsonb),public.claim_tweet_claim_delivery(text,uuid),
  public.settle_tweet_claim_delivery(text,uuid,text,jsonb,text) to service_role;
commit;
