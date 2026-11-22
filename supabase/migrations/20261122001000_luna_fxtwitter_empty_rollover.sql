-- Keep the previous policy and its immutable source references when an approved
-- capture expired without a job. A dispatched or unreconciled pilot cannot roll.
begin;
set local lock_timeout = '2s';

create view luna_fxtwitter.empty_retired_workers with (security_invoker=true) as
 select p.id, p.worker_approval_id, r.total_exposure_nano_usd
 from luna_fxtwitter.policy p join luna_fxtwitter.retirements r on r.policy_id=p.id
 where p.stopped and not p.enabled and r.job_id is null and r.request_key is null
   and r.state is null and r.request_id is null and r.charge_nano_usd is null
   and r.reserved_nano_usd=0 and r.prior_exposure_nano_usd=r.total_exposure_nano_usd
   and r.receipt_count=(select count(*) from luna_fxtwitter.source_references s where s.policy_id=p.id);

revoke all on luna_fxtwitter.empty_retired_workers from public,anon,authenticated,service_role;

-- Each successor names its predecessor. One root and one successor per policy
-- also hold across transactions which cannot yet see each other's inserts.
alter table luna_fxtwitter.policy
 add column previous_policy_id uuid references luna_fxtwitter.policy(id),
 add constraint luna_fx_one_successor unique nulls not distinct (previous_policy_id),
 drop constraint policy_singleton_key;

create function luna_fxtwitter.check_previous_capture() returns trigger language plpgsql set search_path=pg_catalog as $$
begin
 if new.stopped or (new.previous_policy_id is not null and not exists(
   select 1 from luna_fxtwitter.empty_retired_workers r
   join luna_hosted.policy w on w.approval_id=r.worker_approval_id
   where r.id=new.previous_policy_id and w.stopped and not w.enabled
     and w.prior_exposure_nano_usd=r.total_exposure_nano_usd
 )) then raise exception 'previous FX capture requires an empty retirement'; end if;
 return new;
end $$;
revoke all on function luna_fxtwitter.check_previous_capture() from public,anon,authenticated,service_role;
create trigger check_previous_capture before insert on luna_fxtwitter.policy
 for each row execute function luna_fxtwitter.check_previous_capture();

create or replace function luna_fxtwitter.worker_update(old_policy luna_hosted.policy,new_policy luna_hosted.policy)
returns boolean language plpgsql set search_path=pg_catalog as $$
declare p luna_fxtwitter.policy; action_name text;
begin
 select * into p from luna_fxtwitter.policy where worker_approval_id=new_policy.approval_id;
 if not found then return false; end if;
 select action into action_name from luna_fxtwitter.operation where transaction_id=txid_current() and policy_id=p.id;
 if old_policy.approval_id<>new_policy.approval_id then
  if action_name is distinct from 'prepare_worker' or new_policy.enabled or new_policy.stopped
   or new_policy.starts_at<>p.starts_at or new_policy.expires_at<>p.expires_at or new_policy.max_calls<>1
   or new_policy.cap_nano_usd<>p.cap_nano_usd or new_policy.prior_exposure_nano_usd<>old_policy.prior_exposure_nano_usd
   or old_policy.enabled or not old_policy.stopped
   or not (exists(select 1 from luna_retention.retirement where p.previous_policy_id is null and worker_approval_id=old_policy.approval_id
             and total_exposure_nano_usd=old_policy.prior_exposure_nano_usd and unresolved_count=0)
        or exists(select 1 from luna_fxtwitter.empty_retired_workers where id=p.previous_policy_id and worker_approval_id=old_policy.approval_id
             and total_exposure_nano_usd=old_policy.prior_exposure_nano_usd))
  then raise exception 'FX rollover requires reconciled retired worker'; end if;
 elsif (to_jsonb(new_policy)-array['enabled','stopped','prior_exposure_nano_usd']) is distinct from
       (to_jsonb(old_policy)-array['enabled','stopped','prior_exposure_nano_usd'])
  or (old_policy.stopped and not new_policy.stopped)
  or (new_policy.enabled and not old_policy.enabled and (new_policy.stopped or not p.enabled or p.stopped or clock_timestamp()>=p.expires_at))
  or (new_policy.prior_exposure_nano_usd<>old_policy.prior_exposure_nano_usd and
   (action_name is distinct from 'purge' or new_policy.enabled or not new_policy.stopped or new_policy.prior_exposure_nano_usd<old_policy.prior_exposure_nano_usd))
 then raise exception 'FX worker policy reset denied'; end if;
 return true;
end $$;
commit;
