-- NOT APPLIED. Proposed for the FORGE Full-NHL H1–H10 shadow (TJ Q2 decision, 2026-11-23). Applies after
-- 20261029235656 and 20261123200000, while every history table is still empty (it refuses otherwise).
--
-- 1. Monthly partitions by issuance time. The five bulk history tables (skater and goalie vintages, both receipt
--    tables, records) are rebuilt as range partitions on their insert clock, the server time the edition was issued.
--    Columns, CHECKs, hashing, the committed-readback barrier, immutability and grants are unchanged; writers are
--    unchanged. Receipts gain an `inserted_at` column (default clock), because the barrier rewrites `confirmed_at`.
--    PostgreSQL requires unique keys to include the partition key, so a guard trigger keeps `id`, `issuance_key`,
--    `issuance_sequence` and receipt `vintage_id` unique across partitions: a duplicate in another month is skipped,
--    exactly like the writers' ON CONFLICT DO NOTHING, and their readback compares bytes as before. Foreign keys become
--    triggers with the same rule (a receipt's vintage, a record's predecessor must exist when written).
-- 2. `forge_h10_evidence`: a small, unpartitioned, immutable table for the H1–H10 news snapshots, official roster
--    observations, official moves and availability overlays. Long injuries and move chains outlive any archive window,
--    so this table is never archived (about 0.2 MB a day).
-- 3. Archive manifest (`forge_v2_archives`) and a searchable (player, game) index of archived forecasts
--    (`forge_v2_archive_index`). Both are insert-only. Archival itself (export, verify, detach, drop) is an operator
--    procedure with separate approval; nothing here exports, detaches or drops a partition.
begin;
set lock_timeout = '5s';
set statement_timeout = '120s';

do $$
declare t text; n bigint;
begin
  if to_regclass('forge_v2_private.forge_v2_vintages') is null or to_regclass('forge_v2_private.forge_v2_goalie_vintages') is null then
    raise exception 'apply 20261029235656 and 20261123200000 first';
  end if;
  foreach t in array array['forge_v2_vintages','forge_v2_publication_receipts','forge_v2_records','forge_v2_goalie_vintages','forge_v2_goalie_publication_receipts'] loop
    execute format('select count(*) from forge_v2_private.%I', t) into n;
    if n > 0 then raise exception 'forge_v2_partitions_require_empty_tables: % has % rows', t, n; end if;
  end loop;
end $$;

-- Rebuild each table partitioned on its insert clock; the old empty table and its FKs are dropped.
alter table forge_v2_private.forge_v2_publication_receipts add column inserted_at timestamptz not null default clock_timestamp();
alter table forge_v2_private.forge_v2_goalie_publication_receipts add column inserted_at timestamptz not null default clock_timestamp();
do $$
declare spec text[]; specs text[][] := array[
  array['forge_v2_publication_receipts', 'inserted_at'], array['forge_v2_goalie_publication_receipts', 'inserted_at'],
  array['forge_v2_vintages', 'inserted_at'], array['forge_v2_goalie_vintages', 'inserted_at'], array['forge_v2_records', 'recorded_at']];
begin
  foreach spec slice 1 in array specs loop
    execute format('alter table forge_v2_private.%I rename to %I', spec[1], spec[1] || '_unpartitioned');
    execute format('create table forge_v2_private.%I (like forge_v2_private.%I including defaults including constraints including identity) partition by range (%I)',
      spec[1], spec[1] || '_unpartitioned', spec[2]);
  end loop;
  foreach spec slice 1 in array specs loop
    execute format('drop table forge_v2_private.%I', spec[1] || '_unpartitioned');
  end loop;
end $$;

alter table forge_v2_private.forge_v2_vintages add primary key (id, inserted_at);
create unique index forge_v2_vintages_issuance_key on forge_v2_private.forge_v2_vintages (issuance_key, inserted_at);
create unique index forge_v2_vintages_issuance_sequence on forge_v2_private.forge_v2_vintages (issuance_sequence, inserted_at);
create index forge_v2_vintages_target on forge_v2_private.forge_v2_vintages (player_id, game_id, issuance_sequence);
alter table forge_v2_private.forge_v2_goalie_vintages add primary key (id, inserted_at);
create unique index forge_v2_goalie_vintages_issuance_key on forge_v2_private.forge_v2_goalie_vintages (issuance_key, inserted_at);
create unique index forge_v2_goalie_vintages_issuance_sequence on forge_v2_private.forge_v2_goalie_vintages (issuance_sequence, inserted_at);
create index forge_v2_goalie_vintages_target on forge_v2_private.forge_v2_goalie_vintages (player_id, game_id, issuance_sequence);
alter table forge_v2_private.forge_v2_publication_receipts add primary key (vintage_id, inserted_at);
create index forge_v2_publication_order on forge_v2_private.forge_v2_publication_receipts (confirmed_at, vintage_id);
alter table forge_v2_private.forge_v2_goalie_publication_receipts add primary key (vintage_id, inserted_at);
alter table forge_v2_private.forge_v2_records add primary key (id, recorded_at);
create unique index forge_v2_records_ordinal on forge_v2_private.forge_v2_records (ordinal, recorded_at);
create index forge_v2_records_scope on forge_v2_private.forge_v2_records (scope_key, kind, ordinal);

-- Cross-partition uniqueness: first write wins, a later duplicate is skipped (ON CONFLICT DO NOTHING semantics).
create function forge_v2_private.forge_v2_unique_vintage() returns trigger
language plpgsql security invoker set search_path = pg_catalog, forge_v2_private as $$
declare hit integer;
begin
  -- Row triggers fire on the partition; the check spans the parent (every month).
  execute format('select 1 from forge_v2_private.%I where id = $1 or issuance_key = $2 or issuance_sequence = $3 limit 1', regexp_replace(tg_table_name, '_[0-9]{4}_[0-9]{2}$', ''))
    into hit using new.id, new.issuance_key, new.issuance_sequence;
  -- EXECUTE does not set FOUND; test the selected value.
  if hit is not null then return null; end if;
  return new;
end $$;
create function forge_v2_private.forge_v2_unique_receipt() returns trigger
language plpgsql security invoker set search_path = pg_catalog, forge_v2_private as $$
declare parent text := case when tg_table_name like 'forge_v2_goalie%' then 'forge_v2_goalie_publication_receipts' else 'forge_v2_publication_receipts' end; hit integer;
begin
  execute format('select 1 from forge_v2_private.%I where vintage_id = $1 limit 1', parent) into hit using new.vintage_id;
  if hit is not null then return null; end if;
  return new;
end $$;
create function forge_v2_private.forge_v2_unique_record() returns trigger
language plpgsql security invoker set search_path = pg_catalog, forge_v2_private as $$
begin
  if exists (select 1 from forge_v2_private.forge_v2_records r where r.id = new.id) then return null; end if;
  return new;
end $$;
-- A record's predecessor must exist when the record is written (the former foreign key), checked after the statement
-- so a multi-row insert may carry its own predecessors.
create function forge_v2_private.forge_v2_record_predecessor() returns trigger
language plpgsql security invoker set search_path = pg_catalog, forge_v2_private as $$
begin
  if new.predecessor_id is not null and not exists (select 1 from forge_v2_private.forge_v2_records r where r.id = new.predecessor_id) then
    raise exception 'FORGE_V2_PREDECESSOR_MISSING' using errcode = 'foreign_key_violation';
  end if;
  return null;
end $$;
revoke all on function forge_v2_private.forge_v2_unique_vintage(), forge_v2_private.forge_v2_unique_receipt(), forge_v2_private.forge_v2_unique_record(),
  forge_v2_private.forge_v2_record_predecessor() from public, anon, authenticated;

-- Triggers (row triggers on a partitioned table apply to every partition). Names sort so the uniqueness guard runs
-- before hashing and the receipt barrier ("a_unique" < "forge_v2_...").
create trigger a_unique before insert on forge_v2_private.forge_v2_vintages for each row execute function forge_v2_private.forge_v2_unique_vintage();
create trigger a_unique before insert on forge_v2_private.forge_v2_goalie_vintages for each row execute function forge_v2_private.forge_v2_unique_vintage();
create trigger a_unique before insert on forge_v2_private.forge_v2_publication_receipts for each row execute function forge_v2_private.forge_v2_unique_receipt();
create trigger a_unique before insert on forge_v2_private.forge_v2_goalie_publication_receipts for each row execute function forge_v2_private.forge_v2_unique_receipt();
create trigger a_unique before insert on forge_v2_private.forge_v2_records for each row execute function forge_v2_private.forge_v2_unique_record();
create trigger forge_v2_predecessor after insert on forge_v2_private.forge_v2_records for each row execute function forge_v2_private.forge_v2_record_predecessor();
-- forge_v2_hash_payload() branches on tg_table_name, which on a partition is the partition's name, so each table gets
-- its own hashing function with the same body.
create function forge_v2_private.forge_v2_hash_vintage() returns trigger
language plpgsql security invoker set search_path = pg_catalog as $$
begin
  new.output_hash := encode(sha256(convert_to(new.payload, 'UTF8')), 'hex');
  new.insert_transaction := pg_current_xact_id();
  return new;
end $$;
create function forge_v2_private.forge_v2_hash_record() returns trigger
language plpgsql security invoker set search_path = pg_catalog as $$
begin new.content_hash := encode(sha256(convert_to(new.payload, 'UTF8')), 'hex'); return new; end $$;
revoke all on function forge_v2_private.forge_v2_hash_vintage(), forge_v2_private.forge_v2_hash_record() from public, anon, authenticated;
create trigger forge_v2_hash before insert on forge_v2_private.forge_v2_vintages for each row execute function forge_v2_private.forge_v2_hash_vintage();
create trigger forge_v2_hash before insert on forge_v2_private.forge_v2_records for each row execute function forge_v2_private.forge_v2_hash_record();
create trigger forge_v2_goalie_hash before insert on forge_v2_private.forge_v2_goalie_vintages for each row execute function forge_v2_private.forge_v2_goalie_hash_payload();
create trigger forge_v2_receipt_barrier before insert on forge_v2_private.forge_v2_publication_receipts for each row execute function forge_v2_private.forge_v2_confirm_committed_output();
create trigger forge_v2_goalie_receipt_barrier before insert on forge_v2_private.forge_v2_goalie_publication_receipts
  for each row execute function forge_v2_private.forge_v2_confirm_committed_goalie_output();

-- H1–H10 evidence: unpartitioned, immutable, never archived.
create table forge_v2_private.forge_h10_evidence (
  id text primary key,
  scope_key text not null,
  predecessor_id text references forge_v2_private.forge_h10_evidence(id),
  payload text not null check (jsonb_typeof(payload::jsonb) = 'object'),
  content_hash text not null,
  recorded_at timestamptz not null default clock_timestamp(),
  ordinal bigint generated always as identity unique
);
create index forge_h10_evidence_scope on forge_v2_private.forge_h10_evidence (scope_key, ordinal);
create function forge_v2_private.forge_h10_evidence_hash() returns trigger
language plpgsql security invoker set search_path = pg_catalog as $$
begin new.content_hash := encode(sha256(convert_to(new.payload, 'UTF8')), 'hex'); return new; end $$;
revoke all on function forge_v2_private.forge_h10_evidence_hash() from public, anon, authenticated;
create trigger forge_h10_evidence_hash before insert on forge_v2_private.forge_h10_evidence for each row execute function forge_v2_private.forge_h10_evidence_hash();

-- Archive manifest: one row per archived (table, month), written only after the export was checksummed, restored into
-- an isolated database and reconciled. `storage_path` is the private Storage object; `sha256` covers its bytes.
create table forge_v2_private.forge_v2_archives (
  id text primary key check (id = 'forge-v2-archive:' || table_name || ':' || to_char(month, 'YYYY-MM')),
  table_name text not null check (table_name in ('forge_v2_vintages','forge_v2_publication_receipts','forge_v2_records','forge_v2_goalie_vintages','forge_v2_goalie_publication_receipts')),
  month date not null check (month = date_trunc('month', month)::date),
  row_count bigint not null check (row_count >= 0),
  content_sha256 text not null check (content_sha256 ~ '^[a-f0-9]{64}$'),
  sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  bytes bigint not null check (bytes > 0),
  storage_path text not null,
  first_inserted_at timestamptz, last_inserted_at timestamptz,
  verified jsonb not null check (jsonb_typeof(verified) = 'object' and verified ?& array['restoredRows','reconciled','asOfLookupSha256','backtestSha256']),
  recorded_at timestamptz not null default clock_timestamp(),
  unique (table_name, month)
);
-- Searchable: which archive holds a player's forecasts for a game, and over which issuance window.
create table forge_v2_private.forge_v2_archive_index (
  archive_id text not null references forge_v2_private.forge_v2_archives(id),
  player_id bigint not null, game_id bigint not null, vintages integer not null check (vintages > 0),
  first_issued_at timestamptz not null, last_issued_at timestamptz not null,
  primary key (archive_id, player_id, game_id)
);
create index forge_v2_archive_index_target on forge_v2_private.forge_v2_archive_index (player_id, game_id);

do $$
declare name text;
begin
  foreach name in array array['forge_v2_vintages','forge_v2_publication_receipts','forge_v2_records','forge_v2_goalie_vintages','forge_v2_goalie_publication_receipts',
    'forge_h10_evidence','forge_v2_archives','forge_v2_archive_index'] loop
    execute format('alter table forge_v2_private.%I enable row level security', name);
    execute format('revoke all on forge_v2_private.%I from public, anon, authenticated, service_role', name);
    execute format('grant select, insert on forge_v2_private.%I to service_role', name);
    execute format('create policy forge_v2_server_only on forge_v2_private.%I to service_role using (true) with check (true)', name);
    execute format('create trigger forge_v2_immutable before update or delete on forge_v2_private.%I for each row execute function forge_v2_private.forge_v2_reject_mutation()', name);
    execute format('create trigger forge_v2_no_truncate before truncate on forge_v2_private.%I for each statement execute function forge_v2_private.forge_v2_reject_mutation()', name);
  end loop;
end $$;
do $$
declare seq text;
begin
  foreach seq in array array[pg_get_serial_sequence('forge_v2_private.forge_v2_records', 'ordinal'), pg_get_serial_sequence('forge_v2_private.forge_h10_evidence', 'ordinal')] loop
    execute format('grant usage on sequence %s to service_role', seq);
  end loop;
end $$;

-- Month partitions. The function creates any missing month from the current one through `p_through` for all five
-- tables; the nightly route calls it (service_role may execute it, nothing else). No default partition: a row with no
-- partition fails closed rather than landing somewhere unarchivable.
create function forge_v2_private.forge_v2_ensure_month_partitions(p_through date) returns integer
language plpgsql security definer set search_path = pg_catalog, forge_v2_private as $$
declare
  m date := date_trunc('month', clock_timestamp() at time zone 'UTC')::date; created integer := 0; t text; name text;
begin
  if p_through > m + interval '13 months' then raise exception 'forge_v2_partition_horizon_too_far'; end if;
  while m <= p_through loop
    foreach t in array array['forge_v2_vintages','forge_v2_publication_receipts','forge_v2_records','forge_v2_goalie_vintages','forge_v2_goalie_publication_receipts'] loop
      name := t || '_' || to_char(m, 'YYYY_MM');
      if to_regclass('forge_v2_private.' || name) is null then
        execute format('create table forge_v2_private.%I partition of forge_v2_private.%I for values from (%L) to (%L)', name, t,
          (m::timestamp at time zone 'UTC'), ((m + interval '1 month')::timestamp at time zone 'UTC'));
        execute format('alter table forge_v2_private.%I enable row level security', name);
        execute format('revoke all on forge_v2_private.%I from public, anon, authenticated, service_role', name);
        -- Row triggers are inherited from the parent; statement-level TRUNCATE triggers are not, so each month gets one.
        execute format('create trigger forge_v2_no_truncate before truncate on forge_v2_private.%I for each statement execute function forge_v2_private.forge_v2_reject_mutation()', name);
        created := created + 1;
      end if;
    end loop;
    m := (m + interval '1 month')::date;
  end loop;
  return created;
end $$;
revoke all on function forge_v2_private.forge_v2_ensure_month_partitions(date) from public, anon, authenticated;
grant execute on function forge_v2_private.forge_v2_ensure_month_partitions(date) to service_role;
-- Through the end of the 2026-27 season; the nightly route keeps two months ahead after that.
select forge_v2_private.forge_v2_ensure_month_partitions(date '2027-08-01');

comment on schema forge_v2_private is 'FORGE product v2; private append-only history. Monthly partitions by issuance time; a month leaves Postgres only through the verified archive procedure (forge_v2_archives), with separate approval.';
commit;

-- Readback (read-only):
--   select c.relname, c.relkind from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'forge_v2_private' and c.relkind = 'p' order by 1;
--     expect 5 partitioned tables; and 9 month partitions each (2026_11 .. 2027_08) via pg_inherits.
--   select to_regclass('forge_v2_private.forge_h10_evidence') is not null, to_regclass('forge_v2_private.forge_v2_archives') is not null;
-- Rollback (only while every table is empty): drop the five partitioned tables, forge_h10_evidence, forge_v2_archive_index,
--   forge_v2_archives and the five functions above, then re-apply the table blocks of 20261029235656 and 20261123200000.
