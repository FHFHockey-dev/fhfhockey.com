-- Auth for the x-timeline-poll edge function. The shared secret lives only in Vault ('x_timeline_poll_secret',
-- generated inside Postgres, so nobody handles the value): pg_cron reads it to call the function, and the
-- function asks this RPC whether the header matches. Service role only.
-- Applied to production 2026-11-05 with TJ's approval, version 20261106012951.
set local lock_timeout = '5s';
set local statement_timeout = '30s';

create or replace function public.x_timeline_poll_secret_matches(p_secret text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_secret is not null and exists (
    select 1 from vault.decrypted_secrets
    where name = 'x_timeline_poll_secret' and decrypted_secret = p_secret
  );
$$;

revoke all on function public.x_timeline_poll_secret_matches(text) from public, anon, authenticated;
grant execute on function public.x_timeline_poll_secret_matches(text) to service_role;
