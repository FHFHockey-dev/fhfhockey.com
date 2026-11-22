-- BLSH v6 hosted replay sandbox: RESET. Remove blsh_replay_api from Exposed schemas FIRST, then run this as postgres.
\set ON_ERROR_STOP on
begin;
set local lock_timeout = '5s';
drop schema if exists blsh_replay_api cascade;
drop schema if exists blsh_replay cascade;
do $$ begin
  if exists (select from pg_roles where rolname = 'blsh_replay_api') then execute 'revoke blsh_replay_api from authenticator'; end if;
  if exists (select from pg_roles where rolname = 'blsh_replay_owner') then execute 'revoke blsh_replay_owner from postgres'; end if;
end $$;
drop role if exists blsh_replay_api;
drop role if exists blsh_replay_owner;
commit;
notify pgrst, 'reload schema';
