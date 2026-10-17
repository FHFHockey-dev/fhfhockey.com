begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
-- Staged local proposal only. Existing consumers retain all native identities.
create table public.tweet_claim_forecast_bindings (
 action_key text primary key references public.tweet_claim_outbox(action_key),
 effect_id text not null unique check(btrim(effect_id)<>''),
 transition_id text not null unique,
 parent_key text not null unique references public.line_source_snapshots(capture_key),
 plan_hash text not null check(plan_hash ~ '^[a-f0-9]{64}$'),
 plan jsonb not null,
 action_payload jsonb not null,
 proof jsonb not null,
 created_at timestamptz not null default clock_timestamp()
);
create table public.tweet_claim_forecast_receipts (
 action_key text primary key references public.tweet_claim_forecast_bindings(action_key),
 plan_hash text not null,
 payload jsonb not null,
 created_at timestamptz not null default clock_timestamp()
);
alter table public.tweet_claim_forecast_bindings enable row level security;
alter table public.tweet_claim_forecast_receipts enable row level security;
revoke all on public.tweet_claim_forecast_bindings,public.tweet_claim_forecast_receipts from public,anon,authenticated;
grant select,insert on public.tweet_claim_forecast_bindings,public.tweet_claim_forecast_receipts to service_role;
create function public.guard_tweet_claim_forecast_evidence() returns trigger language plpgsql security invoker set search_path='' as $$
begin raise exception 'immutable forecast action evidence';end$$;
create trigger immutable_binding before update or delete on public.tweet_claim_forecast_bindings for each row execute function public.guard_tweet_claim_forecast_evidence();
create trigger immutable_receipt before update or delete on public.tweet_claim_forecast_receipts for each row execute function public.guard_tweet_claim_forecast_evidence();

-- Verify actual existing consumer rows without invoking or repairing consumers.
create function public.tweet_claim_forecast_native_receipt(p_key text,p_hash text,p_plan jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare incoming public.player_forecast_lineup_snapshots; stored public.player_forecast_lineup_snapshots;
 fields text[]:=array['game_id','team_id','source_group','source_key','source_account','source_capture_key','source_url','classification','observed_at','available_at','expires_at','completeness','accepted','parser_version','metadata'];
 q jsonb; queued public.player_forecast_inference_queue; queues jsonb:='[]'; ids jsonb; effect text;
begin
 select effect_id into effect from public.tweet_claim_forecast_bindings where action_key=p_key;
 if not found then return null;end if;
 incoming:=jsonb_populate_record(null::public.player_forecast_lineup_snapshots,p_plan->'snapshot');
 select * into stored from public.player_forecast_lineup_snapshots where source_capture_key=incoming.source_capture_key and team_id=incoming.team_id;
 if not found or exists(select 1 from unnest(fields) k where to_jsonb(stored)->k is distinct from to_jsonb(incoming)->k) then return null;end if;
 if exists(
  (select a.player_id,a.raw_player_name,a.unit_type,a.unit_number,a.slot_number,a.assignment_status from public.player_forecast_lineup_assignments a where a.snapshot_id=stored.id
   except select a.player_id,a.raw_player_name,a.unit_type,a.unit_number,a.slot_number,a.assignment_status from jsonb_populate_recordset(null::public.player_forecast_lineup_assignments,p_plan->'assignments') a)
  union all
  (select a.player_id,a.raw_player_name,a.unit_type,a.unit_number,a.slot_number,a.assignment_status from jsonb_populate_recordset(null::public.player_forecast_lineup_assignments,p_plan->'assignments') a
   except select a.player_id,a.raw_player_name,a.unit_type,a.unit_number,a.slot_number,a.assignment_status from public.player_forecast_lineup_assignments a where a.snapshot_id=stored.id)
 ) then return null;end if;
 for q in select value from jsonb_array_elements(p_plan->'queues') loop
  select * into queued from public.player_forecast_inference_queue where scope_key=q->>'p_scope_key';
  if not found or queued.game_id is distinct from (q->>'p_game_id')::bigint or queued.team_id is distinct from (q->>'p_team_id')::bigint
   or queued.team_game_horizon is distinct from (q->>'p_team_game_horizon')::smallint
   or queued.source_high_watermark<(q->>'p_observed_at')::timestamptz
   or not (queued.metadata @> (q->'p_metadata')) then return null;end if;
  queues:=queues||jsonb_build_array(jsonb_build_object('id',queued.id,'scopeKey',queued.scope_key,'sourceHighWatermark',queued.source_high_watermark));
 end loop;
 select coalesce(jsonb_agg(id order by id),'[]') into ids from public.player_forecast_lineup_assignments where snapshot_id=stored.id;
 return jsonb_build_object('version','tweet-forecast-receipt-v1','actionKey',p_key,'effectId',effect,'planHash',p_hash,'snapshotId',stored.id,'assignmentIds',ids,'queues',queues);
end$$;

create function public.guard_tweet_claim_forecast_receipt_insert() returns trigger language plpgsql security invoker set search_path='' as $$
declare binding public.tweet_claim_forecast_bindings; expected jsonb;
begin
 select * into strict binding from public.tweet_claim_forecast_bindings where action_key=new.action_key;
 expected:=public.tweet_claim_forecast_native_receipt(new.action_key,binding.plan_hash,binding.plan);
 if new.plan_hash is distinct from binding.plan_hash or expected is null or new.payload is distinct from expected then raise exception 'receipt lacks exact native consumer evidence';end if;
 return new;
end$$;
create trigger verify_native_receipt before insert on public.tweet_claim_forecast_receipts for each row execute function public.guard_tweet_claim_forecast_receipt_insert();

create function public.bind_tweet_claim_forecast_delivery(p_key text,p_transition text,p_plan jsonb,p_hash text,p_proof jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare action public.tweet_claim_outbox; old public.tweet_claim_forecast_bindings; parent jsonb; q jsonb; receipt jsonb; effect text;
begin
 select * into strict action from public.tweet_claim_outbox where action_key=p_key for update;
 if nullif(btrim(p_transition),'') is null or action.payload->'action'->>'key' is distinct from p_key then raise exception 'retained action transition binding missing';end if;
 if action.payload->'action'->>'transitionId'=p_transition and p_proof->>'effectId'=p_key then effect:=p_key;
 else
  select e->>'effectKey' into effect from public.tweet_claim_scopes s,
   jsonb_array_elements(s.qualification_state->'plan'->'reviewableEffects') e
   where s.scope_key=action.scope_key and s.qualification_state->'plan'->>'accepted'='true'
    and e->>'scenarioKey'=action.scenario_key and e->>'transitionId'=p_transition and e->>'effectKey'=p_proof->>'effectId'
    and exists(select 1 from jsonb_array_elements(s.qualification_state->'plan'->'nextState'->'registry'->'effects') n
     where n->>'effectKey'=e->>'effectKey' and n->>'transitionId'=p_transition and n->>'disputeStatus'='clear');
 end if;
 if effect is null then raise exception 'retained canonical effect mapping missing';end if;
 if p_plan->>'version' is distinct from 'tweet-forecast-consumer-v1'
  or pg_column_size(p_plan)>262144 or p_hash is distinct from encode(sha256(convert_to(public.tweet_claim_occurrence_json(p_plan),'UTF8')),'hex')
  or jsonb_typeof(p_plan->'assignments') is distinct from 'array' or jsonb_array_length(p_plan->'assignments') not between 1 and 30
  or jsonb_typeof(p_plan->'queues') is distinct from 'array' or jsonb_array_length(p_plan->'queues') not between 1 and 10
  or (select count(*)<>count(distinct value) from jsonb_array_elements(p_plan->'assignments'))
  or (select count(*)<>count(distinct value->>'p_scope_key') from jsonb_array_elements(p_plan->'queues')) then raise exception 'invalid bounded forecast plan';end if;
 select to_jsonb(s) into parent from public.line_source_snapshots s where capture_key=p_plan->'parent'->>'capture_key' for share;
 if parent is null or parent is distinct from p_plan->'parent'
  or parent->>'capture_key' is distinct from p_plan->'snapshot'->>'source_capture_key'
  or parent->>'game_id' is distinct from p_plan->'snapshot'->>'game_id'
  or parent->>'team_id' is distinct from p_plan->'snapshot'->>'team_id'
  or parent->>'classification' is distinct from 'injury'
  or p_plan->'snapshot'->>'classification' is distinct from 'injury'
  or p_plan->'snapshot'->>'accepted' is distinct from 'true'
  or p_plan->'snapshot'->'metadata'->'interpretation' is distinct from parent->'metadata'->'interpretation'
  or (parent->>'observed_at')::timestamptz is distinct from (p_plan->'snapshot'->>'available_at')::timestamptz
  or (parent->>'tweet_posted_at')::timestamptz is distinct from (p_plan->'snapshot'->>'observed_at')::timestamptz then raise exception 'exact retained forecast parent required';end if;
 if action.payload->'observation'->'semantic'->'scope'->>'gameId' is distinct from parent->>'game_id'
  or action.payload->'observation'->'semantic'->'scope'->>'teamId' is distinct from parent->>'team_id'
  or action.payload->'observation'->'semantic'->'fact'->>'kind' is distinct from 'availability'
  or action.payload->'observation'->'semantic'->'fact'->>'status' is distinct from 'out'
  or action.payload->'observation'->'semantic'->>'modality' is distinct from 'asserted'
  or action.payload->'observation'->'semantic'->'support'->>'status' is distinct from 'supported'
  or action.payload->'observation'->'semantic'->'original'->>'tweetId' is distinct from parent->'raw_payload'->'reports'->0->'provenance'->>'originalTweetId'
  or coalesce(action.payload->'observation'->'semantic'->'original'->>'tweetId','') !~ '^[0-9]+$'
  or coalesce(action.payload->'observation'->'semantic'->'original'->>'author','') !~ '^[A-Za-z0-9_]{1,15}$'
  or lower(action.payload->'observation'->'semantic'->'original'->>'author') in ('null','undefined','unknown','none')
  or lower(action.payload->'observation'->'semantic'->'original'->>'author') is distinct from lower(ltrim(coalesce(parent->'raw_payload'->'sources'->0->'snapshot'->>'quoted_author_handle',parent->'raw_payload'->'sources'->0->'snapshot'->>'source_handle'),'@'))
  or (action.payload->'observation'->'semantic'->'original'->>'publishedAt')::timestamptz is distinct from (parent->>'tweet_posted_at')::timestamptz
  or (action.payload->'observation'->'semantic'->>'receivedAt')::timestamptz is distinct from (parent->>'observed_at')::timestamptz
  or jsonb_array_length(p_plan->'assignments')<>1
  or p_plan->'assignments'->0->>'player_id' is distinct from action.payload->'observation'->'semantic'->'fact'->>'playerId'
  or p_plan->'assignments'->0->>'unit_type' is distinct from 'injury'
  or p_plan->'assignments'->0->>'assignment_status' is distinct from 'ruled_out' then raise exception 'retained semantic action mismatch';end if;
 for q in select value from jsonb_array_elements(p_plan->'queues') loop
  if q->>'p_team_id' is distinct from parent->>'team_id' or q->'p_metadata'->>'sourceCaptureKey' is distinct from parent->>'capture_key'
   or (q->>'p_observed_at')::timestamptz is distinct from (parent->>'observed_at')::timestamptz
   or q->>'p_reason' is distinct from 'source:'||(p_plan->'snapshot'->>'source_key')||':injury'
   or (q->>'p_not_before')::timestamptz<(q->>'p_observed_at')::timestamptz
   or not exists(select 1 from public.games g where g.id=(q->>'p_game_id')::bigint
     and (q->>'p_team_id')::bigint in (g."homeTeamId",g."awayTeamId"))
   or q->>'p_scope_key' is distinct from 'game:'||(q->>'p_game_id')||':team:'||(q->>'p_team_id') then raise exception 'queue source binding mismatch';end if;
 end loop;
 if p_proof->>'status' not in ('verified_not_dispatched','unknown','verified_delivered') or p_proof->>'status' is null
  or p_proof->>'effectId' is distinct from effect or p_proof->>'transitionId' is distinct from p_transition or p_proof->>'planHash' is distinct from p_hash
  or coalesce(p_proof->>'basis','')='' or coalesce(p_proof->>'retentionEvidence','')='' or coalesce(p_proof->>'writerFenceEvidence','')=''
  or coalesce(p_proof->>'knownAt','') !~ '(Z|[+-][0-9]{2}:[0-9]{2})$'
  or (p_proof->>'knownAt')::timestamptz>clock_timestamp() then raise exception 'exact durable history proof required';end if;
 select * into old from public.tweet_claim_forecast_bindings where action_key=p_key;
 if found then
  if old.effect_id is distinct from effect or old.transition_id is distinct from p_transition or old.plan is distinct from p_plan or old.plan_hash is distinct from p_hash
   or old.action_payload is distinct from action.payload or old.proof is distinct from p_proof then raise exception 'immutable forecast binding conflict';end if;
 else
  insert into public.tweet_claim_forecast_bindings(action_key,effect_id,transition_id,parent_key,plan_hash,plan,action_payload,proof)
   values(p_key,effect,p_transition,parent->>'capture_key',p_hash,p_plan,action.payload,p_proof);
 end if;
 if p_proof->>'status'='verified_delivered' then
  if exists(select 1 from public.tweet_claim_forecast_receipts where action_key=p_key and plan_hash=p_hash) then
   return jsonb_build_object('effectId',effect,'transitionId',p_transition,'planHash',p_hash);end if;
  receipt:=public.tweet_claim_forecast_native_receipt(p_key,p_hash,p_plan);
  if receipt is null then raise exception 'complete native consumer delivery receipt missing';end if;
  insert into public.tweet_claim_forecast_receipts(action_key,plan_hash,payload) values(p_key,p_hash,receipt) on conflict do nothing;
  if not exists(select 1 from public.tweet_claim_forecast_receipts where action_key=p_key and plan_hash=p_hash and payload=receipt) then raise exception 'immutable receipt conflict';end if;
 end if;
 return jsonb_build_object('effectId',effect,'transitionId',p_transition,'planHash',p_hash);
end$$;

create function public.read_tweet_claim_forecast_delivery(p_key text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare binding public.tweet_claim_forecast_bindings; action public.tweet_claim_outbox; receipt public.tweet_claim_forecast_receipts; parent jsonb; status text:='unknown';
begin
 select * into binding from public.tweet_claim_forecast_bindings where action_key=p_key;
 if not found then return null;end if;
 select * into strict action from public.tweet_claim_outbox where action_key=p_key;
 select to_jsonb(s) into parent from public.line_source_snapshots s where capture_key=binding.parent_key;
 if parent is distinct from binding.plan->'parent' or action.payload is distinct from binding.action_payload then
  return jsonb_build_object('effectId',binding.effect_id,'transitionId',binding.transition_id,'status','unknown');end if;
 select * into receipt from public.tweet_claim_forecast_receipts where action_key=p_key;
 if found then
  if receipt.plan_hash is distinct from binding.plan_hash or receipt.payload->>'actionKey' is distinct from p_key or receipt.payload->>'effectId' is distinct from binding.effect_id
    or receipt.payload->>'planHash' is distinct from binding.plan_hash then raise exception 'retained native receipt identity mismatch';end if;
  return jsonb_build_object('effectId',binding.effect_id,'transitionId',binding.transition_id,'status','applied','receipt',receipt.payload);
 end if;
 if binding.proof->>'status'='verified_not_dispatched'
  and not exists(select 1 from public.player_forecast_lineup_snapshots where source_capture_key=binding.parent_key)
  and not exists(select 1 from public.player_forecast_inference_queue where metadata->>'sourceCaptureKey'=binding.parent_key) then status:='not_applied';end if;
 return jsonb_build_object('effectId',binding.effect_id,'transitionId',binding.transition_id,'status',status);
end$$;

create function public.apply_tweet_claim_forecast_delivery(p_key text,p_owner uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare action public.tweet_claim_outbox; binding public.tweet_claim_forecast_bindings; prior jsonb; q jsonb; receipt jsonb;
begin
 select * into strict action from public.tweet_claim_outbox where action_key=p_key for update;
 select * into strict binding from public.tweet_claim_forecast_bindings where action_key=p_key;
 perform 1 from public.line_source_snapshots where capture_key=binding.parent_key for share;
 prior:=public.read_tweet_claim_forecast_delivery(p_key);
 if prior->>'status'='applied' then return prior->'receipt';end if;
 if prior->>'status' is distinct from 'not_applied' or action.owner is distinct from p_owner or action.status<>'delivering'
  or action.lease_until<=clock_timestamp() or action.requires_review
  or action.payload->'observation'->'semantic'->'support'->>'validUntil' is null
  or (action.payload->'observation'->'semantic'->'support'->>'validUntil')::timestamptz<=clock_timestamp()
  or not exists(select 1 from public.tweet_claim_scopes s,jsonb_array_elements(s.reduction->'actions') a where s.scope_key=action.scope_key and a->>'key'=p_key)
  then raise exception 'forecast action is not safely dispatchable';end if;
 -- Actual existing consumer operations and authoritative receipt commit together.
 perform public.capture_starter_board_lineup(binding.plan->'snapshot',binding.plan->'assignments');
 for q in select value from jsonb_array_elements(binding.plan->'queues') loop
  perform public.enqueue_player_forecast_job(q->>'p_scope_key',(q->>'p_game_id')::bigint,(q->>'p_team_id')::bigint,
   (q->>'p_team_game_horizon')::smallint,q->>'p_reason',(q->>'p_observed_at')::timestamptz,(q->>'p_not_before')::timestamptz,q->'p_metadata');
 end loop;
 receipt:=public.tweet_claim_forecast_native_receipt(p_key,binding.plan_hash,binding.plan);
 if receipt is null then raise exception 'exact native consumer readback missing';end if;
 insert into public.tweet_claim_forecast_receipts(action_key,plan_hash,payload) values(p_key,binding.plan_hash,receipt);
 return receipt;
end$$;
-- Receipt-backed settlement records a known historical fact, including after
-- a worker lease or response is lost. No native consumer is invoked here.
create function public.acknowledge_tweet_claim_forecast_delivery(p_key text)
returns boolean language plpgsql security invoker set search_path='' as $$
declare prior jsonb;
begin
 perform 1 from public.tweet_claim_outbox where action_key=p_key for update;
 prior:=public.read_tweet_claim_forecast_delivery(p_key);
 if prior->>'status' is distinct from 'applied' then raise exception 'exact committed native receipt required';end if;
 update public.tweet_claim_outbox set status='delivered',receipt=prior->'receipt',owner=null,lease_until=null,
  last_error=case when requires_review then last_error else null end,updated_at=clock_timestamp() where action_key=p_key;
 return true;
end$$;
revoke all on function public.guard_tweet_claim_forecast_evidence(),public.guard_tweet_claim_forecast_receipt_insert(),public.tweet_claim_forecast_native_receipt(text,text,jsonb),
 public.bind_tweet_claim_forecast_delivery(text,text,jsonb,text,jsonb),public.read_tweet_claim_forecast_delivery(text),public.apply_tweet_claim_forecast_delivery(text,uuid),public.acknowledge_tweet_claim_forecast_delivery(text) from public,anon,authenticated;
grant execute on function public.guard_tweet_claim_forecast_evidence(),public.guard_tweet_claim_forecast_receipt_insert(),public.tweet_claim_forecast_native_receipt(text,text,jsonb),
 public.bind_tweet_claim_forecast_delivery(text,text,jsonb,text,jsonb),public.read_tweet_claim_forecast_delivery(text),public.apply_tweet_claim_forecast_delivery(text,uuid),public.acknowledge_tweet_claim_forecast_delivery(text) to service_role;
commit;
