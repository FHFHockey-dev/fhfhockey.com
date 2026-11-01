begin;
set lock_timeout = '5s';
set statement_timeout = '60s';

-- Private, additive storage. No v1 tables, schedulers, API exposure or storage buckets change.
create schema forge_v2_private;
revoke all on schema forge_v2_private from public, anon, authenticated;
grant usage on schema forge_v2_private to service_role;

create sequence forge_v2_private.forge_v2_issuance_sequence;
grant usage on sequence forge_v2_private.forge_v2_issuance_sequence to service_role;

create table forge_v2_private.forge_v2_vintages (
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
  check (payload::jsonb ?& array['id','issuanceKey','sequence','playerId','gameId','seasonId','targetVersion','conditioning','teamId','opponentId','home','horizon','episodeId','lockEpochId','scheduleRevision','affiliationRevision','sourceGameDate','scheduledStartAt','inputCutoffAt','generatedAt','means','participation','distribution','calibration','scoring','modelVersion','featureVersion','codeVersion','cohort','qualificationId','sourceManifest','trigger','predecessorId','evidenceClass','limitations']),
  check (payload::jsonb->>'id' = id and payload::jsonb->>'issuanceKey' = issuance_key),
  check ((payload::jsonb->>'playerId')::bigint = player_id and (payload::jsonb->>'gameId')::bigint = game_id),
  check ((payload::jsonb->>'sequence')::bigint = issuance_sequence),
  check ((payload::jsonb->>'horizon')::int between 1 and 10),
  check (payload::jsonb->>'targetVersion' = 'nhl-official-skater-appearance-v1'),
  check (payload::jsonb->>'conditioning' = 'official_appearance_given_game_occurs'),
  check (payload::jsonb->'means' ?& array['G','A','PPP','SOG','HIT','BLK','PIM']),
  check (jsonb_array_length(payload::jsonb->'sourceManifest') > 0),
  check ((payload::jsonb->>'generatedAt')::timestamptz >= (payload::jsonb->>'inputCutoffAt')::timestamptz)
);

create table forge_v2_private.forge_v2_publication_receipts (
  vintage_id text primary key references forge_v2_private.forge_v2_vintages(id),
  output_hash text not null,
  confirmed_at timestamptz not null,
  receipt_transaction xid8 not null,
  witness text not null check (witness = 'committed_readback')
);

create function forge_v2_private.forge_v2_confirm_committed_output() returns trigger
language plpgsql security invoker set search_path = pg_catalog, forge_v2_private as $$
declare issued forge_v2_private.forge_v2_vintages;
begin
  select * into issued from forge_v2_private.forge_v2_vintages v where v.id = new.vintage_id;
  if issued.id is null or issued.output_hash <> new.output_hash then
    raise exception 'FORGE_V2_OUTPUT_HASH_MISMATCH';
  end if;
  -- A transaction cannot manufacture evidence for its own uncommitted output.
  if pg_xact_status(issued.insert_transaction) is distinct from 'committed' then
    raise exception 'FORGE_V2_OUTPUT_NOT_COMMITTED';
  end if;
  new.confirmed_at := date_trunc('milliseconds', clock_timestamp());
  new.receipt_transaction := pg_current_xact_id();
  new.witness := 'committed_readback';
  if new.confirmed_at < (issued.payload::jsonb->>'generatedAt')::timestamptz then
    raise exception 'FORGE_V2_GENERATION_IN_FUTURE';
  end if;
  return new;
end $$;
revoke all on function forge_v2_private.forge_v2_confirm_committed_output() from public, anon, authenticated;
create trigger forge_v2_receipt_barrier before insert on forge_v2_private.forge_v2_publication_receipts
for each row execute function forge_v2_private.forge_v2_confirm_committed_output();

-- Scientific observations, corrections and grades append independently of model success.
create table forge_v2_private.forge_v2_records (
  id text primary key,
  kind text not null check (kind in ('opportunity','schedule','affiliation','horizon_episode','lock_epoch','history_event','qualification','outcome','evaluation','integrity_incident','exposure_receipt','read_context')),
  scope_key text not null,
  predecessor_id text references forge_v2_private.forge_v2_records(id),
  payload text not null check (jsonb_typeof(payload::jsonb) = 'object'),
  content_hash text not null,
  recorded_at timestamptz not null default clock_timestamp(),
  ordinal bigint generated always as identity unique
);
create index forge_v2_records_scope on forge_v2_private.forge_v2_records (scope_key, kind, ordinal);
create index forge_v2_vintages_target on forge_v2_private.forge_v2_vintages (player_id, game_id, issuance_sequence);
create index forge_v2_publication_order on forge_v2_private.forge_v2_publication_receipts (confirmed_at, vintage_id);

-- convert_to is STABLE, not IMMUTABLE, so compute the server-owned hash in an insert trigger.
create function forge_v2_private.forge_v2_hash_payload() returns trigger
language plpgsql security invoker set search_path = pg_catalog as $$
begin
  if tg_table_name = 'forge_v2_vintages' then
    new.output_hash := encode(sha256(convert_to(new.payload, 'UTF8')), 'hex');
    new.insert_transaction := pg_current_xact_id();
  else
    new.content_hash := encode(sha256(convert_to(new.payload, 'UTF8')), 'hex');
  end if;
  return new;
end $$;
revoke all on function forge_v2_private.forge_v2_hash_payload() from public, anon, authenticated;
create trigger forge_v2_hash before insert on forge_v2_private.forge_v2_vintages for each row execute function forge_v2_private.forge_v2_hash_payload();
create trigger forge_v2_hash before insert on forge_v2_private.forge_v2_records for each row execute function forge_v2_private.forge_v2_hash_payload();

create table forge_v2_private.forge_v2_artifacts (
  id text primary key,
  manifest text not null check (jsonb_typeof(manifest::jsonb) = 'object'),
  content_hash text not null check (content_hash ~ '^[a-f0-9]{64}$'),
  recorded_at timestamptz not null default clock_timestamp(),
  check (manifest::jsonb->>'id' = id and manifest::jsonb->>'sha256' = content_hash)
);

-- Operational state is deliberately distinct from immutable scientific history.
create table forge_v2_private.forge_v2_work_queue (
  id text primary key,
  revision bigint not null default 1 check (revision > 0),
  state jsonb not null check (jsonb_typeof(state) = 'object'),
  updated_at timestamptz not null default clock_timestamp()
);

create function forge_v2_private.forge_v2_reject_mutation() returns trigger
language plpgsql security invoker set search_path = pg_catalog as $$
begin raise exception 'FORGE_V2_IMMUTABLE_RECORD'; end $$;
revoke all on function forge_v2_private.forge_v2_reject_mutation() from public, anon, authenticated;

do $$
declare name text;
begin
  foreach name in array array['forge_v2_vintages','forge_v2_publication_receipts','forge_v2_records','forge_v2_artifacts'] loop
    execute format('alter table forge_v2_private.%I enable row level security', name);
    execute format('revoke all on forge_v2_private.%I from public, anon, authenticated, service_role', name);
    execute format('grant select, insert on forge_v2_private.%I to service_role', name);
    execute format('create policy forge_v2_server_only on forge_v2_private.%I to service_role using (true) with check (true)', name);
    execute format('create trigger forge_v2_immutable before update or delete on forge_v2_private.%I for each row execute function forge_v2_private.forge_v2_reject_mutation()', name);
    execute format('create trigger forge_v2_no_truncate before truncate on forge_v2_private.%I for each statement execute function forge_v2_private.forge_v2_reject_mutation()', name);
  end loop;
end $$;
alter table forge_v2_private.forge_v2_work_queue enable row level security;
revoke all on forge_v2_private.forge_v2_work_queue from public, anon, authenticated, service_role;
grant select, insert, update on forge_v2_private.forge_v2_work_queue to service_role;
create policy forge_v2_queue_server_only on forge_v2_private.forge_v2_work_queue to service_role using (true) with check (true);
grant usage on sequence forge_v2_private.forge_v2_records_ordinal_seq to service_role;

comment on schema forge_v2_private is 'FORGE product v2; private append-only history, no automatic retention expiry. Activation requires separate approval.';
commit;
