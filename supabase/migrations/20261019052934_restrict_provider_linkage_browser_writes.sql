-- Provider-linkage rows are written only by server code through the service
-- role: OAuth callbacks, provider sync jobs and the *_secure RPCs. The
-- baseline still granted anon and authenticated every table privilege, and
-- the owner insert/update/delete policies let a signed-in browser insert a
-- connected_accounts row for someone else's (provider, provider_user_id),
-- which the partial unique index then holds against that person's real link.
-- The browser only reads these four tables, so keep owner-scoped SELECT for
-- authenticated and remove every other browser privilege and write policy.
-- user_provider_preferences is unchanged: the account page still upserts it,
-- and its composite foreign keys keep each row on the owner's own accounts.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

revoke all on table
  public.connected_accounts,
  public.external_leagues,
  public.external_teams,
  public.provider_sync_runs
from public, anon, authenticated;

grant select on table
  public.connected_accounts,
  public.external_leagues,
  public.external_teams,
  public.provider_sync_runs
to authenticated;

drop policy if exists connected_accounts_insert_own on public.connected_accounts;
drop policy if exists connected_accounts_update_own on public.connected_accounts;
drop policy if exists connected_accounts_delete_own on public.connected_accounts;
drop policy if exists external_leagues_insert_own on public.external_leagues;
drop policy if exists external_leagues_update_own on public.external_leagues;
drop policy if exists external_leagues_delete_own on public.external_leagues;
drop policy if exists external_teams_insert_own on public.external_teams;
drop policy if exists external_teams_update_own on public.external_teams;
drop policy if exists external_teams_delete_own on public.external_teams;
drop policy if exists provider_sync_runs_insert_own on public.provider_sync_runs;
drop policy if exists provider_sync_runs_update_own on public.provider_sync_runs;
drop policy if exists provider_sync_runs_delete_own on public.provider_sync_runs;

commit;
