begin;
set local lock_timeout='5s';
set local statement_timeout='30s';

-- Route the owner's existing atomic publisher through the consumed delivery for this scope.
create function public.forge_hosted_publish_v2(p_dispatch_id uuid,p_claim_id uuid,p_code_version text,p_raw_sha256 text,
  p_canonical_sha256 text,p_snapshot jsonb,p_metrics jsonb,p_players jsonb,p_teams jsonb,p_goalies jsonb,p_reserves jsonb)
returns jsonb language plpgsql security definer set search_path='' set lock_timeout='2s' as $$
begin
  if not exists(select from forge_pregame_capture.hosted_steps s join forge_pregame_capture.hosted_runs r using(game_id)
    where s.id=p_dispatch_id and s.stage='publish' and s.consumed_at is not null and r.phase='publish'
      and r.claim_id=p_claim_id and r.expected_code_version=p_code_version) then raise exception 'hosted_publication_refused'; end if;
  perform set_config('forge_pregame.publisher',p_dispatch_id::text,true);
  return public.forge_pregame_publish_v1(p_claim_id,p_code_version,p_raw_sha256,p_canonical_sha256,p_snapshot,
    p_metrics,p_players,p_teams,p_goalies,p_reserves);
end $$;

-- Applies only to enrolled games. Even an otherwise valid call to the owner's publication RPC
-- must roll back all forecast writes unless this exact claim has been independently accepted.
create function forge_pregame_capture.require_hosted_witness_v2() returns trigger
language plpgsql security definer set search_path='' as $$
declare r forge_pregame_capture.hosted_runs;
begin
  select h.* into r from forge_pregame_capture.hosted_runs h join forge_pregame_capture.claims c
    on c.game_id=h.game_id where c.id=new.claim_id and h.armed_at is not null for share of h;
  if not found then return new; end if;
  if r.phase <> 'publish' or r.claim_id is distinct from new.claim_id or r.expected_code_version<>new.code_version or
    not exists(select from forge_pregame_capture.hosted_steps s where s.game_id=r.game_id and s.stage='publish'
      and s.id::text=current_setting('forge_pregame.publisher',true) and s.consumed_at is not null and clock_timestamp()<s.queued_at+interval '240 seconds') or
    exists(select from forge_pregame_capture.hosted_slates where slate_date=r.slate_date and stop_reason is not null) or
    not exists(select from forge_pregame_capture.independent_verdicts v where v.claim_id=new.claim_id
      and v.game_id=r.game_id and v.verdict='accepted' and v.verifier_role=r.witness_principal
      and v.verified_at<=r.scheduled_start-interval '60 minutes' and v.raw_sha256=new.raw_sha256
      and v.canonical_sha256=new.canonical_sha256)
  then raise exception 'independent_publication_gate' using errcode='22023'; end if;
  return new;
end $$;
create trigger require_hosted_witness before insert on forge_pregame_capture.publications
  for each row execute function forge_pregame_capture.require_hosted_witness_v2();

create function public.forge_hosted_stage_begin_v2(p_dispatch_id uuid,p_code_version text)
returns jsonb language plpgsql security definer set search_path='' set lock_timeout='2s' as $$
declare r forge_pregame_capture.hosted_runs; s forge_pregame_capture.hosted_steps; game_season integer;
begin
  select * into s from forge_pregame_capture.hosted_steps where id=p_dispatch_id;
  select * into r from forge_pregame_capture.hosted_runs where game_id=s.game_id for update;
  if r.game_id is null or s.stage='capture' or r.expected_code_version is distinct from p_code_version then return null; end if;
  if r.phase<>s.stage or clock_timestamp()>=least(r.scheduled_start,s.queued_at+interval '30 seconds')
    then return null; end if;
  select g."seasonId" into game_season from public.games g join forge_pregame_capture.hosted_schedule(r.game_id) h
    on h.slate_date=r.slate_date and h.safe_start=r.scheduled_start and h.scheduled_start=r.scheduled_start and h.schedule_state='ready'
    where g.id=r.game_id;
  if not found then perform forge_pregame_capture.hosted_end_v2(r.game_id,'skipped','schedule_changed'); return null; end if;
  update forge_pregame_capture.hosted_steps set consumed_at=clock_timestamp() where id=s.id and consumed_at is null;
  if not found then return null; end if;
  return jsonb_build_object('stage',s.stage,'gameId',r.game_id,'claimId',r.claim_id,'codeVersion',r.expected_code_version,
    'seasonId',game_season,'slateDate',r.slate_date,'scheduledStart',r.scheduled_start,'revisionId',r.publication->>'revisionId',
    'observedAt',r.publication->>'observedAt','playerNhlId',r.player_id,'contextId',r.context_id,'queuedAt',s.queued_at);
end $$;

create function public.forge_hosted_stage_finish_v2(p_dispatch_id uuid,p_code_version text,p_reason text,p_readers jsonb)
returns text language plpgsql security definer set search_path='' set lock_timeout='2s' as $$
declare r forge_pregame_capture.hosted_runs; s forge_pregame_capture.hosted_steps; observation jsonb;
begin
  select * into s from forge_pregame_capture.hosted_steps where id=p_dispatch_id;
  select * into r from forge_pregame_capture.hosted_runs where game_id=s.game_id for update;
  if r.game_id is null or r.expected_code_version is distinct from p_code_version or s.consumed_at is null or r.phase<>s.stage
    then return 'fenced'; end if;
  if s.stage='publish' then
    -- The next DB tick alone decides from a separate committed receipt, including after transport loss.
    if p_reason not in ('capture_disabled','compute_off','wrong_game_scope','publication_refused','publication_unconfirmed') then
      raise exception 'invalid_publication_reason'; end if;
    update forge_pregame_capture.hosted_steps set reported_reason=p_reason where id=s.id;
    return 'awaiting_receipt';
  end if;
  if clock_timestamp()>=least(r.scheduled_start,s.queued_at+interval '240 seconds') then return 'fenced'; end if;
  if p_reason is not null then
    if p_reason not in ('capture_disabled','compute_off','wrong_game_scope','reader_unavailable','reader_lineage_mismatch','reader_context_unavailable')
      then raise exception 'invalid_stage_outcome'; end if;
    return forge_pregame_capture.hosted_end_v2(r.game_id,
      case when s.stage='preflight' then 'skipped' else 'failed' end,p_reason);
  elsif s.stage='preflight' and p_readers is null then
    update forge_pregame_capture.hosted_runs set phase='ready' where game_id=r.game_id;
    return 'ready';
  elsif s.stage='readers' then
    if not exists(select from forge_pregame_capture.hosted_schedule(r.game_id) h where h.schedule_state='ready'
      and h.slate_date=r.slate_date and h.scheduled_start=r.scheduled_start and h.safe_start=r.scheduled_start)
      then return forge_pregame_capture.hosted_end_v2(r.game_id,'failed','schedule_changed'); end if;
    if p_readers is null or jsonb_typeof(p_readers) is distinct from 'object' or octet_length(p_readers::text)>4000
      or p_readers->>'contextId' is distinct from r.context_id or p_readers->'playerNhlId' is distinct from to_jsonb(r.player_id)
      then raise exception 'invalid_reader_receipt'; end if;
    foreach observation in array array[p_readers->'daily',p_readers->'detailed'] loop
      if jsonb_typeof(observation) is distinct from 'object' or
        not (observation ?& array['selectedRun','revisionId','playerId','points','legalSlot','reason']) or
        jsonb_typeof(observation->'playerId') not in ('string','null') or
        (observation->>'points' is not null and (observation->>'selectedRun' is distinct from r.claim_id::text
          or jsonb_typeof(observation->'points')<>'number' or observation->>'legalSlot' is null)) or
        (observation->>'points' is null and observation->>'reason' is null) then raise exception 'invalid_reader_result'; end if;
    end loop;
    update forge_pregame_capture.hosted_runs set reader_results=p_readers where game_id=r.game_id;
    -- A reader may legitimately exclude the player. A different selected run cannot qualify this publication.
    if p_readers->'daily'->>'playerId' is null or
      p_readers->'daily'->>'playerId' is distinct from p_readers->'detailed'->>'playerId' or
      p_readers->'daily'->>'revisionId' is distinct from 'forge-daily-bridge-v1:'||r.claim_id::text or
      exists(select from jsonb_array_elements(jsonb_build_array(p_readers->'daily',p_readers->'detailed')) o
      where o->>'selectedRun' is distinct from r.claim_id::text or o->>'revisionId' is null or
        (o->>'reason' is null and o->>'legalSlot' is distinct from 'C#1') or
        (o->>'reason' is not null and (o->>'points' is not null or o->>'legalSlot' is not null)) or
        (o->>'reason' is not null and o->>'reason' not in ('missing_participation','use_not_approved'))) or
      p_readers->'detailed'->>'revisionId' is distinct from r.publication->>'revisionId' then
      return forge_pregame_capture.hosted_end_v2(r.game_id,'failed','reader_lineage_mismatch');
    end if;
    return forge_pregame_capture.hosted_end_v2(r.game_id,'succeeded','readers_recorded');
  end if;
  raise exception 'invalid_stage_outcome';
end $$;

-- One owner-only tick, no sleeps and at most one pg_net call per transaction. An unanswered
-- command never returns to the queue. The packet and publication each have their own receipt.
create function forge_pregame_capture.hosted_tick_v2() returns text
language plpgsql set search_path='' set lock_timeout='2s' as $$
declare r forge_pregame_capture.hosted_runs; s record; g forge_pregame_capture.hosted_games;
  step forge_pregame_capture.hosted_steps; custody text; v forge_pregame_capture.independent_verdicts;
  artifact forge_pregame_capture.artifacts; confirmed jsonb; next_stage text; stamp timestamptz;
begin
  if not pg_try_advisory_xact_lock(hashtext('forge_pregame_hosted_dispatch'),1) then return 'locked'; end if;
  select * into r from forge_pregame_capture.hosted_runs where armed_at is not null and terminal_at is null for update;
  if not found then return 'idle'; end if;
  stamp:=clock_timestamp();
  if stamp < r.open_at then return 'waiting_window'; end if;
  select * into step from forge_pregame_capture.hosted_steps where game_id=r.game_id and stage=r.phase;
  if r.phase='publish' then
    -- This function records an observation only if the prior publishing transaction committed pregame.
    select raw_sha256,canonical_sha256 into artifact.raw_sha256,artifact.canonical_sha256
      from forge_pregame_capture.artifacts where claim_id=r.claim_id;
    confirmed:=public.forge_pregame_publication_receipt_v1(r.claim_id,r.expected_code_version,artifact.raw_sha256,artifact.canonical_sha256);
    if confirmed is not null then
      update forge_pregame_capture.hosted_runs set publication=confirmed where game_id=r.game_id;
      if confirmed->>'observedAt' is null then return forge_pregame_capture.hosted_end_v2(r.game_id,'failed','publication_observed_late'); end if;
      next_stage:='readers';
    elsif step.reported_reason in ('capture_disabled','compute_off','wrong_game_scope','publication_refused') then
      return forge_pregame_capture.hosted_end_v2(r.game_id,'failed',step.reported_reason);
    elsif stamp >= least(r.scheduled_start,step.queued_at+interval '240 seconds') then
      return forge_pregame_capture.hosted_end_v2(r.game_id,'unresolved','publication_ack_unknown');
    else return 'awaiting_publication'; end if;
  elsif r.phase='capture' then
    select * into g from forge_pregame_capture.hosted_games where game_id=r.game_id;
    select o.outcome into custody from forge_pregame_capture.outcomes o where o.game_id=r.game_id and o.policy_id=r.policy_id
      and o.claim_id is not distinct from r.claim_id;
    if custody is not null then
      -- Includes the qualified capture whose final HTTP response or finish RPC was lost.
      if g.state in ('started','ambiguous') then
        update forge_pregame_capture.hosted_games set state='finished',outcome=custody,reason='committed_custody',
          stale_at=null,ended_at=stamp where game_id=r.game_id;
      end if;
      if custody='qualified' and r.claim_id is not null then
        update forge_pregame_capture.hosted_runs set phase='verify' where game_id=r.game_id;
        return 'verify';
      end if;
      return forge_pregame_capture.hosted_end_v2(r.game_id,case when custody='save_unknown' then 'unresolved'
        when custody='never_dispatched' then 'skipped' else 'failed' end,custody);
    elsif g.state='finished' and g.outcome='never_dispatched' then
      return forge_pregame_capture.hosted_end_v2(r.game_id,'skipped',g.reason);
    elsif g.state='ambiguous' or stamp>=least(g.stale_at,r.scheduled_start-interval '60 minutes') then
      if g.state<>'ambiguous' then perform forge_pregame_capture.hosted_mark_ambiguous(g.game_id,'unresolved','capture_ack_unknown'); end if;
      return forge_pregame_capture.hosted_end_v2(r.game_id,'unresolved','capture_ack_unknown');
    else return 'awaiting_capture'; end if;
  elsif r.phase='verify' then
    select * into v from forge_pregame_capture.independent_verdicts where claim_id=r.claim_id;
    if found then
      if v.verdict<>'accepted' then return forge_pregame_capture.hosted_end_v2(r.game_id,'failed',coalesce(v.reason,'witness_rejected')); end if;
      next_stage:='publish';
    elsif stamp>=r.scheduled_start-interval '60 minutes' then
      return forge_pregame_capture.hosted_end_v2(r.game_id,'failed','independent_deadline_missed');
    else return 'awaiting_witness'; end if;
  elsif r.phase='readers' then
    if stamp>=least(r.scheduled_start,step.queued_at+interval '240 seconds') then
      return forge_pregame_capture.hosted_end_v2(r.game_id,'unresolved','reader_ack_unknown');
    end if;
    return 'awaiting_readers';
  elsif stamp>=r.close_at then return forge_pregame_capture.hosted_end_v2(r.game_id,'skipped','dispatch_window_missed');
  elsif r.phase='approved' then next_stage:='preflight';
  elsif r.phase='preflight' then
    if stamp>=step.queued_at+interval '1 minute' then
      return forge_pregame_capture.hosted_end_v2(r.game_id,'unresolved','preflight_ack_unknown');
    end if;
    return 'awaiting_preflight';
  elsif r.phase='ready' then next_stage:='capture';
  end if;
  if stamp>=r.scheduled_start then return forge_pregame_capture.hosted_end_v2(r.game_id,'failed','pregame_window_closed'); end if;
  select * into s from forge_pregame_capture.hosted_schedule(r.game_id);
  if s.schedule_state is distinct from 'ready' or s.scheduled_start is distinct from r.scheduled_start or
    s.safe_start is distinct from r.scheduled_start or s.slate_date is distinct from r.slate_date
    then return forge_pregame_capture.hosted_end_v2(r.game_id,'skipped','schedule_changed'); end if;
  if exists(select from forge_pregame_capture.hosted_slates where slate_date=r.slate_date and stop_reason is not null) then
    return forge_pregame_capture.hosted_end_v2(r.game_id,'failed','slate_stopped');
  end if;
  if next_stage='capture' then
    if exists(select from forge_pregame_capture.hosted_slates where enabled) or exists(select from forge_pregame_capture.hosted_games
       where state in ('queued','started','ambiguous')) then return forge_pregame_capture.hosted_end_v2(r.game_id,'skipped','capture_slot_busy'); end if;
    if not forge_pregame_capture.hosted_load_open() then return 'load_gate_closed'; end if;
  end if;
  begin
    perform forge_pregame_capture.hosted_queue_v2(r,next_stage);
  exception when others then
    -- pg_net enqueues in this subtransaction; rollback removes the request as well as its fence.
    return forge_pregame_capture.hosted_end_v2(r.game_id,'failed','dispatch_transport_unavailable');
  end;
  return next_stage;
end $$;

-- Independent of HTTP responses and of the dispatch job. A separate bounded monitoring
-- schedule may call this privately for the one approved game. It can only withhold and alert.
create function forge_pregame_capture.hosted_watch_v2(p_game bigint) returns text
language plpgsql set search_path='' set lock_timeout='2s' as $$
declare r forge_pregame_capture.hosted_runs; g forge_pregame_capture.hosted_games; at_time timestamptz;
begin
  perform pg_advisory_xact_lock(hashtext('forge_pregame_hosted_dispatch'),1);
  select * into r from forge_pregame_capture.hosted_runs where game_id=p_game for update;
  if not found or r.armed_at is null then return 'unarmed'; end if;
  if r.terminal_at is not null then return r.phase; end if;
  at_time:=clock_timestamp();
  if r.phase in ('approved','ready','preflight') and at_time>=r.close_at then
    return forge_pregame_capture.hosted_end_v2(p_game,'skipped','dispatch_window_missed');
  elsif r.phase='capture' then
    select * into g from forge_pregame_capture.hosted_games where game_id=p_game;
    if at_time>=g.stale_at and not exists(select from forge_pregame_capture.outcomes o where o.game_id=r.game_id
        and o.policy_id=r.policy_id and o.claim_id is not distinct from r.claim_id) then
      perform forge_pregame_capture.hosted_mark_ambiguous(p_game,'unresolved','capture_ack_unknown');
      return forge_pregame_capture.hosted_end_v2(p_game,'unresolved','capture_ack_unknown');
    end if;
  end if;
  if r.phase in ('publish','readers') and exists(select from forge_pregame_capture.hosted_steps s
    where s.game_id=r.game_id and s.stage=r.phase and at_time>=s.queued_at+interval '240 seconds') then
    if r.phase='readers' or not exists(select from forge_pregame_capture.publications where claim_id=r.claim_id) then
      return forge_pregame_capture.hosted_end_v2(p_game,'unresolved',
        case when r.phase='readers' then 'reader_ack_unknown' else 'publication_ack_unknown' end);
    end if;
  end if;
  if at_time>=r.scheduled_start-interval '60 minutes' and not exists(select from forge_pregame_capture.independent_verdicts
      where claim_id=r.claim_id and verdict='accepted') then
    return forge_pregame_capture.hosted_end_v2(p_game,'failed','independent_deadline_missed');
  elsif at_time>=r.scheduled_start then
    return forge_pregame_capture.hosted_end_v2(p_game,
      case when r.phase in ('publish','readers') then 'unresolved' else 'failed' end,'pregame_progress_missing');
  end if;
  return r.phase;
end $$;

-- Owner-only postgame reconciliation preserves the original failure and never emits another request.
-- Leave an orphaned claim quarantined until ordinary custody settlement establishes its terminal outcome.
create function forge_pregame_capture.hosted_release_fence_v2(p_game bigint) returns text
language plpgsql set search_path='' set lock_timeout='2s' as $$
declare r forge_pregame_capture.hosted_runs; g forge_pregame_capture.hosted_games;
begin
  perform pg_advisory_xact_lock(hashtext('forge_pregame_hosted_dispatch'),1);
  select * into r from forge_pregame_capture.hosted_runs where game_id=p_game and phase='unresolved' for update;
  if not found then return 'not_unresolved'; end if;
  if r.reconciled_at is not null then return 'already_reconciled'; end if;
  if clock_timestamp()<=greatest(r.scheduled_start,(select "startTime" from public.games where id=p_game))+interval '4 minutes'
    then return 'awaiting_postgame'; end if;
  select * into g from forge_pregame_capture.hosted_games where game_id=p_game;
  if g.state in ('queued','started','ambiguous') then
    perform forge_pregame_capture.hosted_reconcile_v1(p_game);
    select * into g from forge_pregame_capture.hosted_games where game_id=p_game;
    if g.state<>'finished' then return 'custody_unresolved'; end if;
  end if;
  if r.claim_id is not null and not exists(select from forge_pregame_capture.outcomes where claim_id=r.claim_id)
    then return 'custody_unresolved'; end if;
  update forge_pregame_capture.hosted_runs set reconciled_at=clock_timestamp() where game_id=p_game;
  return 'fence_released';
end $$;

create function forge_pregame_capture.hosted_receipt_v2(p_game bigint) returns jsonb
language sql stable set search_path='' as $$
  select jsonb_build_object('gameId',r.game_id,'slateDate',r.slate_date,'approvedStart',r.scheduled_start,
    'policy',r.policy_id,'release',r.expected_code_version,'opened',r.open_at,'latestDispatch',r.close_at,
    'witnessDeadline',r.scheduled_start-interval '60 minutes','armedAt',r.armed_at,'phase',r.phase,'reason',r.reason,'terminalAt',r.terminal_at,'fenceReleasedAt',r.reconciled_at,
    'dispatch',jsonb_build_object('id',g.dispatch_id,'queuedAt',g.queued_at,'startedAt',g.started_at,'state',g.state,'reason',g.reason),
    'steps',(select jsonb_agg(jsonb_build_object('stage',s.stage,'requestId',s.request_id,'queuedAt',s.queued_at,'beganAt',s.consumed_at)
        order by s.queued_at) from forge_pregame_capture.hosted_steps s where s.game_id=r.game_id),
    'claim',r.claim_id,'inputCutoff',c.input_cutoff,'packetSha256',a.raw_sha256,'canonicalSha256',a.canonical_sha256,
    'tokenSha256',w.tsa_token_sha256,'tokenUpperBound',w.ack_upper,'custody',o.outcome,'witnessAuthority',r.witness_authority,
    'independent',to_jsonb(v),'publication',r.publication,'committedRevision',p.revision_id,
    'playerId',r.player_id,'readerContext',r.context_id,'readers',r.reader_results)
  from forge_pregame_capture.hosted_runs r left join forge_pregame_capture.hosted_games g using(game_id)
  left join forge_pregame_capture.claims c on c.id=r.claim_id
  left join forge_pregame_capture.artifacts a on a.claim_id=c.id
  left join forge_pregame_capture.witnesses w on w.claim_id=c.id
  left join forge_pregame_capture.outcomes o on o.game_id=r.game_id and o.policy_id=r.policy_id
  left join forge_pregame_capture.independent_verdicts v on v.claim_id=c.id
  left join forge_pregame_capture.publications p on p.claim_id=c.id where r.game_id=p_game
$$;
revoke all on function forge_pregame_capture.require_hosted_witness_v2(),forge_pregame_capture.hosted_tick_v2(),
  forge_pregame_capture.hosted_watch_v2(bigint),forge_pregame_capture.hosted_release_fence_v2(bigint),
  forge_pregame_capture.hosted_receipt_v2(bigint) from public,anon,authenticated,service_role;
revoke all on function public.forge_hosted_publish_v2(uuid,uuid,text,text,text,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb),
  public.forge_hosted_stage_begin_v2(uuid,text),public.forge_hosted_stage_finish_v2(uuid,text,text,jsonb)
  from public,anon,authenticated;
grant execute on function public.forge_hosted_publish_v2(uuid,uuid,text,text,text,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb),
  public.forge_hosted_stage_begin_v2(uuid,text),public.forge_hosted_stage_finish_v2(uuid,text,text,jsonb)
  to service_role;
commit;
