-- NOT APPLIED. Proposed for the FORGE Full-NHL H1–H10 shadow, and applies only after TJ approves it.
-- It requires 20261029235656_forge_v2_immutable_history.sql to be applied first; neither is in production as of
-- 2026-11-23.
-- Additive only: two new private tables for goalie if-starts vintages and their receipts, with the same server-owned
-- hashing, committed-readback barrier and immutability rules as forge_v2_vintages. No existing table, function,
-- grant or schedule changes.
begin;
set lock_timeout = '5s';
set statement_timeout = '60s';

do $$ begin
  if to_regclass('forge_v2_private.forge_v2_vintages') is null then raise exception 'forge_v2_private_missing: apply 20261029235656 first'; end if;
end $$;

create table forge_v2_private.forge_v2_goalie_vintages (
  id text primary key,
  issuance_key text not null unique,
  issuance_sequence bigint not null unique check (issuance_sequence > 0),
  player_id bigint not null check (player_id > 0),
  game_id bigint not null check (game_id > 0),
  payload text not null,
  output_hash text not null,
  insert_transaction xid8 not null,
  inserted_at timestamptz not null default clock_timestamp(),
  check (jsonb_typeof(payload::jsonb) = 'object'),
  check (payload::jsonb ?& array['id','issuanceKey','sequence','playerId','gameId','seasonId','targetVersion','conditioning','teamId','opponentId','home','horizon',
    'scheduleRevision','affiliationRevision','sourceGameDate','scheduledStartAt','inputCutoffAt','generatedAt','means','startProbability','modelVersion','featureVersion',
    'codeVersion','cohort','sourceManifest','trigger','predecessorId','evidenceClass','limitations']),
  check (payload::jsonb->>'id' = id and payload::jsonb->>'issuanceKey' = issuance_key),
  check ((payload::jsonb->>'playerId')::bigint = player_id and (payload::jsonb->>'gameId')::bigint = game_id),
  check ((payload::jsonb->>'sequence')::bigint = issuance_sequence),
  check ((payload::jsonb->>'horizon')::int between 1 and 10),
  check (payload::jsonb->>'targetVersion' = 'nhl-official-goalie-start-v1'),
  check (payload::jsonb->>'conditioning' = 'official_start_given_game_occurs'),
  check (payload::jsonb->'means' ?& array['SAVES','SHOTS_AGAINST','GOALS_ALLOWED','WIN','SHUTOUT']),
  check (payload::jsonb->>'evidenceClass' in ('fixture','prospective_shadow')),
  check (jsonb_array_length(payload::jsonb->'sourceManifest') > 0),
  check ((payload::jsonb->>'generatedAt')::timestamptz >= (payload::jsonb->>'inputCutoffAt')::timestamptz)
);
create index forge_v2_goalie_vintages_target on forge_v2_private.forge_v2_goalie_vintages (player_id, game_id, issuance_sequence);

create table forge_v2_private.forge_v2_goalie_publication_receipts (
  vintage_id text primary key references forge_v2_private.forge_v2_goalie_vintages(id),
  output_hash text not null,
  confirmed_at timestamptz not null,
  receipt_transaction xid8 not null,
  witness text not null check (witness = 'committed_readback')
);

create function forge_v2_private.forge_v2_goalie_hash_payload() returns trigger
language plpgsql security invoker set search_path = pg_catalog as $$
begin
  new.output_hash := encode(sha256(convert_to(new.payload, 'UTF8')), 'hex');
  new.insert_transaction := pg_current_xact_id();
  return new;
end $$;
revoke all on function forge_v2_private.forge_v2_goalie_hash_payload() from public, anon, authenticated;
create trigger forge_v2_goalie_hash before insert on forge_v2_private.forge_v2_goalie_vintages for each row execute function forge_v2_private.forge_v2_goalie_hash_payload();

create function forge_v2_private.forge_v2_confirm_committed_goalie_output() returns trigger
language plpgsql security invoker set search_path = pg_catalog, forge_v2_private as $$
declare issued forge_v2_private.forge_v2_goalie_vintages;
begin
  select * into issued from forge_v2_private.forge_v2_goalie_vintages v where v.id = new.vintage_id;
  if issued.id is null or issued.output_hash <> new.output_hash then raise exception 'FORGE_V2_OUTPUT_HASH_MISMATCH'; end if;
  if pg_xact_status(issued.insert_transaction) is distinct from 'committed' then raise exception 'FORGE_V2_OUTPUT_NOT_COMMITTED'; end if;
  new.confirmed_at := date_trunc('milliseconds', clock_timestamp());
  new.receipt_transaction := pg_current_xact_id();
  new.witness := 'committed_readback';
  if new.confirmed_at < (issued.payload::jsonb->>'generatedAt')::timestamptz then raise exception 'FORGE_V2_GENERATION_IN_FUTURE'; end if;
  return new;
end $$;
revoke all on function forge_v2_private.forge_v2_confirm_committed_goalie_output() from public, anon, authenticated;
create trigger forge_v2_goalie_receipt_barrier before insert on forge_v2_private.forge_v2_goalie_publication_receipts
for each row execute function forge_v2_private.forge_v2_confirm_committed_goalie_output();

do $$
declare name text;
begin
  foreach name in array array['forge_v2_goalie_vintages','forge_v2_goalie_publication_receipts'] loop
    execute format('alter table forge_v2_private.%I enable row level security', name);
    execute format('revoke all on forge_v2_private.%I from public, anon, authenticated, service_role', name);
    execute format('grant select, insert on forge_v2_private.%I to service_role', name);
    execute format('create policy forge_v2_server_only on forge_v2_private.%I to service_role using (true) with check (true)', name);
    execute format('create trigger forge_v2_immutable before update or delete on forge_v2_private.%I for each row execute function forge_v2_private.forge_v2_reject_mutation()', name);
    execute format('create trigger forge_v2_no_truncate before truncate on forge_v2_private.%I for each statement execute function forge_v2_private.forge_v2_reject_mutation()', name);
  end loop;
end $$;
commit;

-- Readback after applying (read-only):
--   select to_regclass('forge_v2_private.forge_v2_goalie_vintages') is not null, to_regclass('forge_v2_private.forge_v2_goalie_publication_receipts') is not null;
--   select tgname from pg_trigger where tgrelid in ('forge_v2_private.forge_v2_goalie_vintages'::regclass, 'forge_v2_private.forge_v2_goalie_publication_receipts'::regclass) and not tgisinternal order by 1;
-- Rollback (only while both tables are empty; rows are otherwise immutable by design):
--   begin; drop table forge_v2_private.forge_v2_goalie_publication_receipts; drop table forge_v2_private.forge_v2_goalie_vintages;
--   drop function forge_v2_private.forge_v2_confirm_committed_goalie_output(); drop function forge_v2_private.forge_v2_goalie_hash_payload(); commit;
