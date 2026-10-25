begin;
set local lock_timeout='5s';
set local statement_timeout='30s';

-- Locally staged only. Reuses the existing global context CAS; no dispatch path.
create table public.tweet_claim_occurrence_components(
  namespace text primary key, payload jsonb not null check(octet_length(payload::text)<=131072),
  created_at timestamptz not null default now()
);
create table public.tweet_claim_occurrence_component_links(
  kind text not null check(kind in ('receipt','original')), key text not null,
  namespace text not null references public.tweet_claim_occurrence_components(namespace),
  primary key(kind,key,namespace)
);
create index tweet_claim_occurrence_component_links_namespace on public.tweet_claim_occurrence_component_links(namespace);
alter table public.tweet_claim_occurrence_components enable row level security;
alter table public.tweet_claim_occurrence_component_links enable row level security;
revoke all on public.tweet_claim_occurrence_components,public.tweet_claim_occurrence_component_links from public,anon,authenticated;
grant select,insert,update on public.tweet_claim_occurrence_components to service_role;
grant select,insert on public.tweet_claim_occurrence_component_links to service_role;

create function public.read_tweet_claim_occurrence_context(p_observations jsonb,p_links jsonb,p_clock bigint)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare components text[]; selected_namespace text; state jsonb;
begin
  select array_agg(id order by id) into components from (select distinct l.namespace id
    from public.tweet_claim_occurrence_component_links l
    where (l.kind='receipt' and l.key in (select value->>'lineageKey' from jsonb_array_elements(p_observations)))
      or (l.kind='original' and l.key in (select value->'semantic'->'original'->>'tweetId' from jsonb_array_elements(p_observations)
        union select value->>'originId' from jsonb_array_elements(p_links))) limit 257) bounded;
  components:=coalesce(components,'{}');
  if cardinality(components)>256 then raise exception 'occurrence component inventory exceeds 256; review required'; end if;
  selected_namespace:=case when cardinality(components)=1 then components[1] else 'tweet-occurrence-component-v1:'||p_clock end;
  if cardinality(components)=1 then select payload into state from public.tweet_claim_occurrence_components c where c.namespace=selected_namespace; end if;
  return jsonb_build_object('protocol','durable-tweet-occurrence-v1','namespace',selected_namespace,'componentIds',to_jsonb(components),
    'fingerprint',case when state is null then null else md5(state::text) end,'state',state,
    'hold',case when cardinality(components)>1 then 'multiple_durable_occurrence_components_require_proof' else null end);
end $$;

-- Canonical finite JSON for the exact application input contract, not raw jsonb whitespace.
create function public.tweet_claim_occurrence_json(p_value jsonb)
returns text language sql immutable security invoker set search_path='' as $$
  select case jsonb_typeof(p_value)
    when 'object' then '{'||coalesce((select string_agg(to_jsonb(key)::text||':'||public.tweet_claim_occurrence_json(value),',' order by key collate "C") from jsonb_each(p_value)),'')||'}'
    when 'array' then '['||coalesce((select string_agg(public.tweet_claim_occurrence_json(value),',' order by ordinal) from jsonb_array_elements(p_value) with ordinality a(value,ordinal)),'')||']'
    else p_value::text end
$$;
create function public.tweet_claim_occurrence_input(p_claim jsonb)
returns jsonb language sql immutable security invoker set search_path='' as $$
  select jsonb_build_object('derivationId',p_claim->'semantic'->>'id','receiptId',p_claim->>'lineageKey',
    'sourceText',case when p_claim->'source'->>'primaryTextSource'='quoted_oembed'
      then coalesce(p_claim->'source'->>'quotedEnrichedText',p_claim->'source'->>'quotedRawText','')
      else coalesce(p_claim->'source'->>'enrichedText',p_claim->'source'->>'rawText','') end,
    'subjectSpan',p_claim->'claimAnchor'->'subjectSpan','predicateSpan',p_claim->'claimAnchor'->'predicateSpan',
    'original',case when p_claim->'attribution'->>'status'='resolved' then jsonb_build_object('tweetId',p_claim->'attribution'->>'originalTweetId',
      'author',p_claim->'attribution'->'original'->>'handle','publishedAt',p_claim->'attribution'->>'originalPublishedAt') else null end)
$$;
create function public.tweet_claim_occurrence_anchor(p_input jsonb)
returns jsonb language sql immutable security invoker set search_path='' as $$
  select jsonb_build_object('receiptId',p_input->>'receiptId',
    'textHash',encode(sha256(convert_to(public.tweet_claim_occurrence_json(p_input->'sourceText'),'UTF8')),'hex'),
    'subjectSpan',p_input->'subjectSpan','predicateSpan',p_input->'predicateSpan')
$$;

create function public.validate_tweet_claim_occurrence_transition(p_old jsonb,p_new jsonb,p_namespace text,p_asof timestamptz)
returns void language plpgsql security invoker set search_path='' as $$
declare old jsonb; item jsonb; prior jsonb; next jsonb; binding jsonb; proof jsonb; token bigint; input jsonb; anchor jsonb;
begin
  old:=coalesce(p_old,jsonb_build_object('version','tweet-occurrence-identity-v1','namespace',p_namespace,'nextToken',1,
    'occurrences','[]'::jsonb,'derivations','[]'::jsonb,'bindings','[]'::jsonb));
  if p_asof is null or p_new->>'version' is distinct from 'tweet-occurrence-identity-v1' or p_new->>'namespace' is distinct from p_namespace
    or jsonb_typeof(p_new->'occurrences') is distinct from 'array' or jsonb_typeof(p_new->'derivations') is distinct from 'array'
    or jsonb_typeof(p_new->'bindings') is distinct from 'array' or coalesce(p_new->>'nextToken','')!~'^[1-9][0-9]*$'
    or jsonb_array_length(p_new->'occurrences')>256 or jsonb_array_length(p_new->'derivations')>512
    or (select coalesce(sum(jsonb_array_length(value->'anchors')),0) from jsonb_array_elements(p_new->'occurrences'))>512
    or octet_length(p_new::text)>131072 then raise exception 'invalid bounded occurrence ledger'; end if;
  token:=(p_new->>'nextToken')::bigint;
  if token<(old->>'nextToken')::bigint or token<>jsonb_array_length(p_new->'occurrences')+1
    or (select count(distinct value->>'id') from jsonb_array_elements(p_new->'occurrences'))<>jsonb_array_length(p_new->'occurrences')
    or (select count(distinct value->>'id') from jsonb_array_elements(p_new->'derivations'))<>jsonb_array_length(p_new->'derivations')
    or (select count(distinct value->>'occurrenceId') from jsonb_array_elements(p_new->'bindings'))<>jsonb_array_length(p_new->'bindings')
    then raise exception 'occurrence allocator or immutable identity conflict'; end if;
  for item in select value from jsonb_array_elements(p_new->'occurrences') loop
    if coalesce(item->>'token','')!~'^[1-9][0-9]*$' or (item->>'token')::bigint>=token
      or item->>'id' is distinct from p_namespace||':occurrence:'||(item->>'token')
      or jsonb_typeof(item->'anchors') is distinct from 'array' or jsonb_array_length(item->'anchors') not between 1 and 512
      then raise exception 'invalid occurrence allocation or anchors'; end if;
  end loop;
  for prior in select value from jsonb_array_elements(old->'occurrences') loop
    select value into next from jsonb_array_elements(p_new->'occurrences') where value->>'id'=prior->>'id';
    if next is null or next-'anchors'<>prior-'anchors' or not ((next->'anchors') @> (prior->'anchors'))
      then raise exception 'immutable occurrence allocation or anchor rewrite'; end if;
  end loop;
  if not ((p_new->'derivations') @> (old->'derivations')) or not ((p_new->'bindings') @> (old->'bindings'))
    then raise exception 'immutable occurrence derivation or binding rewrite'; end if;
  for item in select value from jsonb_array_elements(p_new->'derivations') loop
    select public.tweet_claim_occurrence_input(payload) into input from public.tweet_claim_observations where observation_id=item->>'id';
    anchor:=public.tweet_claim_occurrence_anchor(input);
    if coalesce(item->>'id','')='' or coalesce(item->>'payloadHash','')!~'^[0-9a-f]{64}$'
      or not exists(select 1 from jsonb_array_elements(p_new->'occurrences') o where o->>'id'=item->>'occurrenceId')
      or input is null or item->>'payloadHash' is distinct from encode(sha256(convert_to(public.tweet_claim_occurrence_json(input),'UTF8')),'hex')
      or not exists(select 1 from jsonb_array_elements(p_new->'occurrences') o where o->>'id'=item->>'occurrenceId' and o->'anchors' @> jsonb_build_array(anchor))
      then raise exception 'occurrence derivation evidence missing'; end if;
  end loop;
  for item in select value from jsonb_array_elements(p_new->'occurrences') loop
    for anchor in select value from jsonb_array_elements(item->'anchors') loop
      if not exists(select 1 from jsonb_array_elements(p_new->'derivations') d join public.tweet_claim_observations o on o.observation_id=d->>'id'
        where d->>'occurrenceId'=item->>'id' and public.tweet_claim_occurrence_anchor(public.tweet_claim_occurrence_input(o.payload))=anchor)
        then raise exception 'occurrence anchor evidence missing'; end if;
    end loop;
  end loop;
  for binding in select value from jsonb_array_elements(p_new->'bindings') loop
    if not exists(select 1 from jsonb_array_elements(p_new->'occurrences') o where o->>'id'=binding->>'occurrenceId')
      or coalesce(binding->'original'->>'tweetId','')!~'^[0-9]+$'
      or coalesce(binding->'original'->>'author','')!~'^[a-z0-9_]{1,15}$'
      or binding->'original'->>'author' ~ '^(null|undefined|unknown|none)$'
      or (binding->'original'->>'publishedAt')::timestamptz>p_asof
      or binding->'original'->>'publishedAt' is null then raise exception 'invalid occurrence original binding'; end if;
    if not exists(select 1 from jsonb_array_elements(p_new->'derivations') d join public.tweet_claim_observations o on o.observation_id=d->>'id'
      where d->>'occurrenceId'=binding->>'occurrenceId' and
        jsonb_set(public.tweet_claim_occurrence_input(o.payload)->'original','{author}',to_jsonb(lower(o.payload->'attribution'->'original'->>'handle')))=binding->'original')
      then raise exception 'original binding evidence missing'; end if;
    select value into prior from jsonb_array_elements(old->'occurrences') where value->>'id'=binding->>'occurrenceId';
    if prior is not null and not exists(select 1 from jsonb_array_elements(old->'bindings') b where b=binding) then
      proof:=binding->'proof';
      select value into next from jsonb_array_elements(p_new->'occurrences') where value->>'id'=binding->>'occurrenceId';
      if proof->>'kind' is distinct from 'unique_retained_occurrence' or proof->>'occurrenceId' is distinct from binding->>'occurrenceId'
        or proof->'original' is distinct from binding->'original' or coalesce(proof->>'basis','')=''
        or not (prior->'anchors' @> jsonb_build_array(proof->'priorAnchor')) or not (next->'anchors' @> jsonb_build_array(proof->'nextAnchor'))
        or proof->'priorAnchor'->>'textHash' is distinct from proof->'nextAnchor'->>'textHash'
        or proof->'priorAnchor'->'subjectSpan' is distinct from proof->'nextAnchor'->'subjectSpan'
        or proof->'priorAnchor'->'predicateSpan' is distinct from proof->'nextAnchor'->'predicateSpan'
        or proof->>'knownAt' is null or (proof->>'knownAt')::timestamptz>p_asof
        or (proof->>'knownAt')::timestamptz<(binding->'original'->>'publishedAt')::timestamptz
        then raise exception 'retained occurrence upgrade proof invalid'; end if;
    end if;
  end loop;
  if exists(select 1 from jsonb_array_elements(p_new->'bindings') a cross join jsonb_array_elements(p_new->'bindings') b
    where a->'original'->>'tweetId'=b->'original'->>'tweetId' and a->'original'<>b->'original')
    then raise exception 'conflicting original evidence'; end if;
  if exists(with anchors as (
    select o->>'id' id,a payload,b->'original'->>'tweetId' origin
    from jsonb_array_elements(p_new->'occurrences') o cross join lateral jsonb_array_elements(o->'anchors') a
    left join jsonb_array_elements(p_new->'bindings') b on b->>'occurrenceId'=o->>'id')
    select 1 from anchors a join anchors b on a.id<b.id
    where (a.payload->>'receiptId'=b.payload->>'receiptId' or a.origin=b.origin)
    and (a.payload->>'textHash'<>b.payload->>'textHash' or (
      (a.payload->'subjectSpan'->>'start')::integer<(b.payload->'subjectSpan'->>'end')::integer
      and (b.payload->'subjectSpan'->>'start')::integer<(a.payload->'subjectSpan'->>'end')::integer
      and (a.payload->'predicateSpan'->>'start')::integer<(b.payload->'predicateSpan'->>'end')::integer
      and (b.payload->'predicateSpan'->>'start')::integer<(a.payload->'predicateSpan'->>'end')::integer)))
    then raise exception 'unproved distinct occurrence allocation'; end if;
end $$;

create function public.guard_tweet_claim_occurrence_component()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if tg_op='DELETE' or new.namespace<>old.namespace then raise exception 'immutable occurrence component identity'; end if;
  perform public.validate_tweet_claim_occurrence_transition(old.payload,new.payload,old.namespace,'infinity'::timestamptz);
  return new;
end $$;
create trigger tweet_claim_occurrence_component_append before update or delete on public.tweet_claim_occurrence_components
  for each row execute function public.guard_tweet_claim_occurrence_component();

create or replace function public.read_tweet_claim_context(p_scope text,p_incoming jsonb,p_asof timestamptz)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare receipts text[]; origins text[]; players bigint[]; keys text[]; tweets text[]; source_date date; observations jsonb; links jsonb; g bigint; t bigint; evidence jsonb; v bigint; meanings jsonb; identity_context jsonb;
begin
  select version into v from public.tweet_claim_context_clock where singleton for share;
  if jsonb_array_length(p_incoming)>256 then raise exception 'claim context bound exceeded'; end if;
  select array_agg(distinct c->>'lineageKey'),array_agg(distinct c->'semantic'->'original'->>'tweetId'),
    array_agg(distinct (c->'semantic'->'fact'->>'playerId')::bigint),max((c->'semantic'->'scope'->>'gameId')::bigint),max((c->'semantic'->'scope'->>'teamId')::bigint)
    into receipts,origins,players,g,t from jsonb_array_elements(p_incoming)c;
  select coalesce(jsonb_agg(payload),'[]') into links from public.tweet_claim_lineage_links where receipt=any(receipts) or origin_id=any(origins);
  origins:=origins||array(select value->>'originId' from jsonb_array_elements(links));
  select coalesce(jsonb_agg(payload),'[]') into links from public.tweet_claim_lineage_links where receipt=any(receipts) or origin_id=any(origins);
  select coalesce(array_agg(distinct value->>'receipt'),'{}')||receipts into receipts from jsonb_array_elements(links);
  select coalesce(jsonb_agg(payload order by ordinal),'[]') into observations from (select payload,ordinal from public.tweet_claim_observations
    where scope_key=p_scope or lineage_key=any(receipts) or origin_id=any(origins) order by ordinal limit 257) bounded;
  if jsonb_array_length(observations)>256 then raise exception 'global lineage context exceeds 256; review required'; end if;
  identity_context:=public.read_tweet_claim_occurrence_context(observations||p_incoming,links,v);
  if jsonb_array_length(identity_context->'componentIds')=1 then
    receipts:=receipts||array(select key from public.tweet_claim_occurrence_component_links where kind='receipt' and namespace=(identity_context->'componentIds'->>0));
    origins:=origins||array(select key from public.tweet_claim_occurrence_component_links where kind='original' and namespace=(identity_context->'componentIds'->>0));
    select coalesce(jsonb_agg(payload),'[]') into links from public.tweet_claim_lineage_links where receipt=any(receipts) or origin_id=any(origins);
    select coalesce(jsonb_agg(payload order by ordinal),'[]') into observations from (select payload,ordinal from public.tweet_claim_observations
      where scope_key=p_scope or lineage_key=any(receipts) or origin_id=any(origins) order by ordinal limit 257) bounded;
    if jsonb_array_length(observations)>256 then raise exception 'complete occurrence component exceeds 256; review required'; end if;
  end if;

  select array_agg(distinct regexp_replace(a->>'key','^(report|event|capture):','')) into keys
    from jsonb_array_elements(p_incoming||observations)c cross join lateral jsonb_array_elements(c->'aliases')a;
  select array_agg(distinct x) into tweets from unnest(origins||array(select replace(r,'tweet-receipt-v2:','') from unnest(receipts)r))x;
  tweets:=tweets||array(select c->'attribution'->>'originalUrl' from jsonb_array_elements(p_incoming)c);
  select min((c->'semantic'->'original'->>'publishedAt')::timestamptz at time zone 'America/New_York')::date into source_date from jsonb_array_elements(p_incoming)c;
  evidence:=public.read_tweet_claim_evidence(g,t,players,p_asof,keys,tweets,source_date);
  select coalesce(jsonb_agg(payload),'[]') into meanings from (select payload from public.tweet_claim_occurrence_meanings
    where occurrence_id in (select occurrence_id from public.tweet_claim_occurrence_meanings
      where scope_key=p_scope or root_key=any(array(select 'tweet-original-v1:'||o from unnest(origins)o))) limit 257) bounded;
  if jsonb_array_length(meanings)>256 then raise exception 'global meaning capacity exceeded; review required'; end if;
  return jsonb_build_object('meanings',meanings,'qualificationState',(select qualification_state from public.tweet_claim_scopes where scope_key=p_scope),
    'clock',v,'qualificationFingerprint',(select qualification_state->>'fingerprint' from public.tweet_claim_scopes where scope_key=p_scope),
    'occurrenceContext',public.read_tweet_claim_occurrence_context(observations||p_incoming,links,v),'scope',public.read_tweet_claim_scope(p_scope),'observations',observations,'links',links,'evidence',evidence);
end $$;

create or replace function public.commit_qualified_tweet_claim_scope(p_scope text,p_expected bigint,p_clock bigint,p_observations jsonb,p_reduction jsonb,p_reviewed jsonb,p_qualified jsonb)
returns boolean language plpgsql security invoker set search_path='' as $$
declare v bigint; link jsonb; meaning jsonb; disputed text[]; affected text[]; identity_context jsonb; identity_plan jsonb; identity_state jsonb; identity_item jsonb; identity_anchor jsonb; selected_namespace text;
  retained_evidence jsonb; proposed_evidence jsonb; prior_evidence_row jsonb;
begin
  select version into v from public.tweet_claim_context_clock where singleton for update;
  if v<>p_clock then return false; end if;
  identity_plan:=p_qualified->'occurrenceIdentity';
  identity_context:=public.read_tweet_claim_context(p_scope,p_observations,(identity_plan->>'asOf')::timestamptz)->'occurrenceContext';
  -- A service caller cannot reuse a retained r3 evidence-version key with
  -- different bytes, even when bypassing the normal content-derived planner.
  select qualification_state#>'{plan,nextState,registry,evidenceVersions}' into retained_evidence
    from public.tweet_claim_scopes where scope_key=p_scope;
  proposed_evidence:=p_qualified#>'{plan,nextState,registry,evidenceVersions}';
  if jsonb_typeof(proposed_evidence) is distinct from 'array' or jsonb_array_length(proposed_evidence)>512
    or exists(select 1 from jsonb_array_elements(proposed_evidence) e
      where nullif(btrim(e->>'evidenceVersionId'),'') is null)
    or exists(select 1 from jsonb_array_elements(proposed_evidence) e group by e->>'evidenceVersionId' having count(*)<>1)
    then raise exception 'invalid r3 evidence version identity'; end if;
  for prior_evidence_row in select value from jsonb_array_elements(coalesce(retained_evidence,'[]')) loop
    if (select count(*) from jsonb_array_elements(proposed_evidence) e
      where e->>'evidenceVersionId'=prior_evidence_row->>'evidenceVersionId' and e=prior_evidence_row)<>1
      then raise exception 'immutable r3 evidence version collision'; end if;
  end loop;
  if not public.commit_tweet_claim_scope(p_scope,p_expected,p_observations,p_reduction,p_reviewed) then return false; end if;
  if identity_plan->>'protocol' is distinct from 'durable-tweet-occurrence-v1'
    or identity_plan->>'namespace' is distinct from identity_context->>'namespace'
    or identity_plan->'componentIds' is distinct from identity_context->'componentIds'
    or identity_plan->'expectedFingerprint' is distinct from identity_context->'fingerprint'
    then raise exception 'occurrence context mismatch'; end if;
  if identity_plan->>'globalHold' is not null then
    if identity_plan->>'globalHold' not in ('multiple_durable_occurrence_components_require_proof','legacy_canonical_state_requires_occurrence_mapping')
      or identity_plan->'state' is distinct from identity_context->'state' then raise exception 'invalid occurrence hold'; end if;
  else
    if identity_context->>'hold' is not null then raise exception 'ambiguous occurrence context cannot allocate'; end if;
    selected_namespace:=identity_context->>'namespace'; identity_state:=identity_plan->'state';
    perform public.validate_tweet_claim_occurrence_transition(nullif(identity_context->'state','null'),identity_state,selected_namespace,(identity_plan->>'asOf')::timestamptz);
    if jsonb_array_length(identity_state->'occurrences')>0 then
      insert into public.tweet_claim_occurrence_components(namespace,payload) values(selected_namespace,identity_state)
        on conflict on constraint tweet_claim_occurrence_components_pkey do update set payload=excluded.payload;
    end if;
    for identity_item in select value from jsonb_array_elements(identity_state->'occurrences') loop
      for identity_anchor in select value from jsonb_array_elements(identity_item->'anchors') loop
        insert into public.tweet_claim_occurrence_component_links values('receipt',identity_anchor->>'receiptId',selected_namespace) on conflict do nothing;
      end loop;
    end loop;
    for identity_item in select value from jsonb_array_elements(identity_state->'bindings') loop
      insert into public.tweet_claim_occurrence_component_links values('original',identity_item->'original'->>'tweetId',selected_namespace) on conflict do nothing;
    end loop;
  end if;
  for link in select value from jsonb_array_elements(p_qualified->'lineage'->'links') loop
    insert into public.tweet_claim_lineage_links(receipt,origin_id,fingerprint,payload)
      values(link->>'receipt',link->>'originId',md5(link::text),link) on conflict do nothing;
  end loop;
  for meaning in select value from jsonb_array_elements(p_qualified->'meanings') loop
    insert into public.tweet_claim_occurrence_meanings(occurrence_id,fingerprint,root_key,scope_key,payload)
      values(meaning->>'occurrenceId',meaning->>'fingerprint',meaning->>'root',meaning->>'scopeKey',meaning) on conflict do nothing;
  end loop;
  select array_agg(occurrence_id) into disputed from (select occurrence_id from public.tweet_claim_occurrence_meanings
    where occurrence_id=any(array(select value->>'occurrenceId' from jsonb_array_elements(p_qualified->'meanings')))
    group by occurrence_id having count(distinct fingerprint)>1) d;
  select array_agg(distinct scope_key) into affected from public.tweet_claim_occurrence_meanings where occurrence_id=any(disputed);
  insert into public.tweet_claim_qualification_versions(scope_key,version,fingerprint,payload)
    values(p_scope,p_expected+1,p_qualified->>'fingerprint',p_qualified);
  update public.tweet_claim_scopes set qualification_state=p_qualified where scope_key=p_scope;
  -- Every output remains held. Legacy writers do not share this lock, so this
  -- retained read snapshot cannot authorize a later production sink dispatch.
  update public.tweet_claim_outbox set payload=payload||jsonb_build_object('qualification',p_qualified-'plan'),requires_review=true
    where scope_key=p_scope;
  if (p_qualified->'plan'->>'accepted')::boolean is not true then
    update public.tweet_claim_outbox set status=case when status in ('held','pending','retry') then 'blocked' else status end,
      requires_review=true,last_error='canonical adapter exception requires review' where scope_key=p_scope;
  end if;
  -- A global material rebind invalidates BOTH scope outputs atomically. Prior
  -- immutable qualification versions remain evidence of what was known then.
  update public.tweet_claim_scopes set qualification_state=jsonb_set(jsonb_set(qualification_state,
      '{plan,reviewableEffects}','[]'),'{globalHolds}',jsonb_build_array('global_material_occurrence_reinterpretation_requires_resolution'))
    where scope_key=any(affected) and qualification_state is not null;
  update public.tweet_claim_outbox set requires_review=true,status=case when status in ('held','pending','retry') then 'blocked' else status end,
    last_error='global material occurrence rebind; compensation requires review' where scope_key=any(affected);
  if identity_plan->>'globalHold' is not null then
    select array[p_scope]||coalesce(array_agg(distinct o.scope_key),'{}') into affected
      from public.tweet_claim_observations o join public.tweet_claim_occurrence_component_links l
        on (l.kind='receipt' and l.key=o.lineage_key) or (l.kind='original' and l.key=o.origin_id)
      where l.namespace in (select jsonb_array_elements_text(identity_context->'componentIds'));
    update public.tweet_claim_scopes set qualification_state=jsonb_set(jsonb_set(qualification_state,
      '{plan,reviewableEffects}','[]'),'{globalHolds}',jsonb_build_array(identity_plan->>'globalHold'))
      where scope_key=any(affected) and qualification_state is not null;
    update public.tweet_claim_outbox set requires_review=true,status=case when status in ('held','pending','retry') then 'blocked' else status end,
      last_error=identity_plan->>'globalHold' where scope_key=p_scope or scope_key in (
        select distinct o.scope_key from public.tweet_claim_observations o join public.tweet_claim_occurrence_component_links l
          on (l.kind='receipt' and l.key=o.lineage_key) or (l.kind='original' and l.key=o.origin_id)
        where l.namespace in (select jsonb_array_elements_text(identity_context->'componentIds')));
  end if;
  update public.tweet_claim_context_clock set version=version+1 where singleton;
  return true;
end $$;

revoke all on function public.read_tweet_claim_occurrence_context(jsonb,jsonb,bigint),public.tweet_claim_occurrence_json(jsonb),
  public.tweet_claim_occurrence_input(jsonb),public.tweet_claim_occurrence_anchor(jsonb),public.validate_tweet_claim_occurrence_transition(jsonb,jsonb,text,timestamptz),public.guard_tweet_claim_occurrence_component() from public,anon,authenticated;
grant execute on function public.read_tweet_claim_occurrence_context(jsonb,jsonb,bigint),public.tweet_claim_occurrence_json(jsonb),
  public.tweet_claim_occurrence_input(jsonb),public.tweet_claim_occurrence_anchor(jsonb),public.validate_tweet_claim_occurrence_transition(jsonb,jsonb,text,timestamptz),public.guard_tweet_claim_occurrence_component() to service_role;
commit;
