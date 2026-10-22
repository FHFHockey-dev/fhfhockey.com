-- UNAPPLIED REVIEW DRAFT, isolated sandbox only; not a production migration.
-- Requires the existing sandbox billing ledger. Does not grant table access.
begin;
create function public.list_in_season_sandbox_subscriptions(p_user_id uuid)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public as $$
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Service role required'; end if;
  if p_user_id is null then raise exception 'Owner required'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
    'userId',m.user_id,'subscriptionId',m.subscription_id,
    'cancelledAt',m.state->>'cancelledAt','billingStoppedAt',m.state->>'billingStoppedAt',
    'stopComplete',exists(select 1 from public.in_season_sandbox_monthly_jobs j
      where j.subscription_id=m.subscription_id and j.user_id=m.user_id and j.kind in ('stop','cutoff') and j.status='done')
  ) order by m.created_at desc,m.id) from (
    select id,user_id,subscription_id,state,created_at from public.in_season_sandbox_monthly
    where user_id=p_user_id and subscription_id is not null
    order by created_at desc,id limit 20
  ) m),'[]'::jsonb);
end $$;
revoke all on function public.list_in_season_sandbox_subscriptions(uuid) from public,anon,authenticated;
grant execute on function public.list_in_season_sandbox_subscriptions(uuid) to service_role;
commit;
