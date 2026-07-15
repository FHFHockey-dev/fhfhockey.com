SET lock_timeout = '5s';
SET statement_timeout = '30s';

-- CREATE OR REPLACE keeps identity, ownership, grants, and dependencies, but
-- PostgreSQL assigns every other omitted property its default. Snapshot those
-- invariants before replacement so chronological replay and already-hardened
-- production convergence both fail closed on any unexpected catalog state.
create temporary table immutable_unaccent_function_snapshot (
  function_oid pg_catalog.oid primary key,
  owner_oid pg_catalog.oid not null,
  function_acl pg_catalog.aclitem[]
) on commit preserve rows;

create temporary table immutable_unaccent_index_snapshot (
  index_oid pg_catalog.oid primary key,
  index_namespace_oid pg_catalog.oid not null,
  index_name pg_catalog.name not null,
  table_oid pg_catalog.oid not null,
  index_definition pg_catalog.text not null,
  is_valid pg_catalog.bool not null,
  is_ready pg_catalog.bool not null,
  is_live pg_catalog.bool not null
) on commit preserve rows;

create temporary table immutable_unaccent_post_index_snapshot (
  like immutable_unaccent_index_snapshot including all
) on commit preserve rows;

do $catalog_precondition$
declare
  target_oid pg_catalog.oid := pg_catalog.to_regprocedure(
    'public.immutable_unaccent(text)'
  );
  target_proc pg_catalog.pg_proc%rowtype;
  public_namespace_oid pg_catalog.oid := pg_catalog.to_regnamespace('public');
  sql_language_oid pg_catalog.oid;
  text_type_oid pg_catalog.oid := pg_catalog.to_regtype('pg_catalog.text');
  legacy_body pg_catalog.bool;
  hardened_body pg_catalog.bool;
  legacy_config pg_catalog.bool;
  hardened_config pg_catalog.bool;
  baseline_index_name pg_catalog.text;
begin
  if target_oid is null then
    raise exception 'immutable_unaccent catalog precondition failed: function is missing';
  end if;

  select language.oid
  into sql_language_oid
  from pg_catalog.pg_language as language
  where language.lanname = 'sql';

  if public_namespace_oid is null
    or sql_language_oid is null
    or text_type_oid is null
  then
    raise exception 'immutable_unaccent catalog precondition failed: required catalog identity is missing';
  end if;

  select p.*
  into target_proc
  from pg_catalog.pg_proc as p
  where p.oid = target_oid;

  if target_proc.pronamespace is distinct from public_namespace_oid
    or target_proc.proname is distinct from 'immutable_unaccent'::pg_catalog.name
    or target_proc.prokind is distinct from 'f'::"char"
    or target_proc.pronargs is distinct from 1::pg_catalog.int2
    or target_proc.pronargdefaults is distinct from 0::pg_catalog.int2
    or target_proc.proargtypes[0] is distinct from text_type_oid
    or target_proc.proallargtypes is not null
    or target_proc.proargmodes is not null
    or target_proc.proargnames is not null
    or target_proc.proargdefaults is not null
    or target_proc.provariadic is distinct from 0::pg_catalog.oid
    or target_proc.prorettype is distinct from text_type_oid
    or target_proc.proretset is distinct from false
    or target_proc.prolang is distinct from sql_language_oid
    or target_proc.provolatile is distinct from 'i'::"char"
    or target_proc.proparallel is distinct from 's'::"char"
    or target_proc.proisstrict is distinct from true
    or target_proc.prosecdef is distinct from false
    or target_proc.procost is distinct from 100::pg_catalog.float4
    or target_proc.prorows is distinct from 0::pg_catalog.float4
    or target_proc.proleakproof is distinct from false
    or target_proc.prosupport is distinct from 0::pg_catalog.regproc
    or target_proc.protrftypes is not null
    or target_proc.probin is not null
    or target_proc.prosqlbody is not null
  then
    raise exception 'immutable_unaccent catalog precondition failed: function contract drifted';
  end if;

  -- Match only the two known SQL token streams. Whitespace is permitted only
  -- between tokens, never inside the dictionary literal or identifiers.
  legacy_body := coalesce(
    target_proc.prosrc ~*
      $legacy_body$^[[:space:]]*select[[:space:]]+unaccent[[:space:]]*[(][[:space:]]*'public[.]unaccent'[[:space:]]*,[[:space:]]*[$]1[[:space:]]*[)][[:space:]]*;?[[:space:]]*$$legacy_body$,
    false
  );
  hardened_body := coalesce(
    target_proc.prosrc ~*
      $hardened_body$^[[:space:]]*select[[:space:]]+public[.]unaccent[[:space:]]*[(][[:space:]]*'public[.]unaccent'[[:space:]]*::[[:space:]]*pg_catalog[.]regdictionary[[:space:]]*,[[:space:]]*[$]1[[:space:]]*[)][[:space:]]*;?[[:space:]]*$$hardened_body$,
    false
  );
  legacy_config := target_proc.proconfig is null;
  hardened_config := target_proc.proconfig is not distinct from
    array['search_path=""']::pg_catalog.text[];

  if not (
    (legacy_body and legacy_config)
    or (hardened_body and hardened_config)
  ) then
    raise exception 'immutable_unaccent catalog precondition failed: body/configuration state is not recognized';
  end if;

  insert into pg_temp.immutable_unaccent_function_snapshot (
    function_oid,
    owner_oid,
    function_acl
  )
  values (
    target_proc.oid,
    target_proc.proowner,
    target_proc.proacl
  );

  insert into pg_temp.immutable_unaccent_index_snapshot (
    index_oid,
    index_namespace_oid,
    index_name,
    table_oid,
    index_definition,
    is_valid,
    is_ready,
    is_live
  )
  select distinct
    index_class.oid,
    index_class.relnamespace,
    index_class.relname,
    index_catalog.indrelid,
    pg_catalog.pg_get_indexdef(index_class.oid),
    index_catalog.indisvalid,
    index_catalog.indisready,
    index_catalog.indislive
  from pg_catalog.pg_depend as dependency
  join pg_catalog.pg_class as index_class
    on index_class.oid = dependency.objid
   and dependency.classid =
     'pg_catalog.pg_class'::pg_catalog.regclass
   and index_class.relkind in ('i'::"char", 'I'::"char")
  join pg_catalog.pg_index as index_catalog
    on index_catalog.indexrelid = index_class.oid
  where dependency.refclassid =
      'pg_catalog.pg_proc'::pg_catalog.regclass
    and dependency.refobjid = target_oid;

  if exists (
    select 1
    from pg_temp.immutable_unaccent_index_snapshot as snapshot
    where not (snapshot.is_valid and snapshot.is_ready and snapshot.is_live)
  ) then
    raise exception 'immutable_unaccent catalog precondition failed: a dependent index is unhealthy';
  end if;

  foreach baseline_index_name in array array[
    'goalie_name_norm_btree',
    'skater_name_norm_btree',
    'yplayers_name_norm_btree',
    'yplayers_name_norm_trgm'
  ]::pg_catalog.text[]
  loop
    if not exists (
      select 1
      from pg_temp.immutable_unaccent_index_snapshot as snapshot
      where snapshot.index_namespace_oid = public_namespace_oid
        and snapshot.index_name = baseline_index_name::pg_catalog.name
    ) then
      raise exception 'immutable_unaccent catalog precondition failed: a baseline dependent index is missing';
    end if;
  end loop;

  if (
    select pg_catalog.count(*)
    from pg_temp.immutable_unaccent_index_snapshot
  ) < 4 then
    raise exception 'immutable_unaccent catalog precondition failed: dependent index set is incomplete';
  end if;
end;
$catalog_precondition$;

-- Keep expression-index normalization deterministic even when callers use an
-- empty search_path. CREATE OR REPLACE preserves the existing function owner,
-- signature, and grants while the explicit attributes and guards preserve its
-- catalog contract for every current dependent expression index.
create or replace function public.immutable_unaccent(text)
returns text
language sql
immutable
parallel safe
strict
security invoker
cost 100
set search_path = ''
as $function$
  select public.unaccent(
    'public.unaccent'::pg_catalog.regdictionary,
    $1
  )
$function$;

-- Keep the migration transactional and fail closed if PostgreSQL does not
-- materialize the intended post-replacement auxiliary properties exactly.
do $catalog_postcondition$
declare
  target_oid pg_catalog.oid := pg_catalog.to_regprocedure(
    'public.immutable_unaccent(text)'
  );
  target_proc pg_catalog.pg_proc%rowtype;
  snapshot_oid pg_catalog.oid;
  snapshot_owner_oid pg_catalog.oid;
  snapshot_acl pg_catalog.aclitem[];
  public_namespace_oid pg_catalog.oid := pg_catalog.to_regnamespace('public');
  sql_language_oid pg_catalog.oid;
  text_type_oid pg_catalog.oid := pg_catalog.to_regtype('pg_catalog.text');
  hardened_body pg_catalog.bool;
  index_difference_count pg_catalog.int8;
begin
  if target_oid is null then
    raise exception 'immutable_unaccent catalog postcondition failed: function is missing';
  end if;

  select language.oid
  into sql_language_oid
  from pg_catalog.pg_language as language
  where language.lanname = 'sql';

  select
    snapshot.function_oid,
    snapshot.owner_oid,
    snapshot.function_acl
  into
    snapshot_oid,
    snapshot_owner_oid,
    snapshot_acl
  from pg_temp.immutable_unaccent_function_snapshot as snapshot;

  if snapshot_oid is null
    or public_namespace_oid is null
    or sql_language_oid is null
    or text_type_oid is null
  then
    raise exception 'immutable_unaccent catalog postcondition failed: required snapshot identity is missing';
  end if;

  select p.*
  into target_proc
  from pg_catalog.pg_proc as p
  where p.oid = target_oid;

  hardened_body := coalesce(
    target_proc.prosrc ~*
      $hardened_body$^[[:space:]]*select[[:space:]]+public[.]unaccent[[:space:]]*[(][[:space:]]*'public[.]unaccent'[[:space:]]*::[[:space:]]*pg_catalog[.]regdictionary[[:space:]]*,[[:space:]]*[$]1[[:space:]]*[)][[:space:]]*;?[[:space:]]*$$hardened_body$,
    false
  );

  if target_proc.oid is distinct from snapshot_oid
    or target_proc.proowner is distinct from snapshot_owner_oid
    or target_proc.proacl is distinct from snapshot_acl
    or target_proc.pronamespace is distinct from public_namespace_oid
    or target_proc.proname is distinct from 'immutable_unaccent'::pg_catalog.name
    or target_proc.prokind is distinct from 'f'::"char"
    or target_proc.pronargs is distinct from 1::pg_catalog.int2
    or target_proc.pronargdefaults is distinct from 0::pg_catalog.int2
    or target_proc.proargtypes[0] is distinct from text_type_oid
    or target_proc.proallargtypes is not null
    or target_proc.proargmodes is not null
    or target_proc.proargnames is not null
    or target_proc.proargdefaults is not null
    or target_proc.provariadic is distinct from 0::pg_catalog.oid
    or target_proc.prorettype is distinct from text_type_oid
    or target_proc.proretset is distinct from false
    or target_proc.prolang is distinct from sql_language_oid
    or target_proc.provolatile is distinct from 'i'::"char"
    or target_proc.proparallel is distinct from 's'::"char"
    or target_proc.proisstrict is distinct from true
    or target_proc.prosecdef is distinct from false
    or target_proc.procost is distinct from 100::pg_catalog.float4
    or target_proc.prorows is distinct from 0::pg_catalog.float4
    or target_proc.proleakproof is distinct from false
    or target_proc.prosupport is distinct from 0::pg_catalog.regproc
    or target_proc.protrftypes is not null
    or target_proc.probin is not null
    or target_proc.prosqlbody is not null
    or target_proc.proconfig is distinct from
      array['search_path=""']::pg_catalog.text[]
    or hardened_body is distinct from true
  then
    raise exception 'immutable_unaccent catalog postcondition failed: function contract drifted';
  end if;

  insert into pg_temp.immutable_unaccent_post_index_snapshot (
    index_oid,
    index_namespace_oid,
    index_name,
    table_oid,
    index_definition,
    is_valid,
    is_ready,
    is_live
  )
  select distinct
    index_class.oid,
    index_class.relnamespace,
    index_class.relname,
    index_catalog.indrelid,
    pg_catalog.pg_get_indexdef(index_class.oid),
    index_catalog.indisvalid,
    index_catalog.indisready,
    index_catalog.indislive
  from pg_catalog.pg_depend as dependency
  join pg_catalog.pg_class as index_class
    on index_class.oid = dependency.objid
   and dependency.classid =
     'pg_catalog.pg_class'::pg_catalog.regclass
   and index_class.relkind in ('i'::"char", 'I'::"char")
  join pg_catalog.pg_index as index_catalog
    on index_catalog.indexrelid = index_class.oid
  where dependency.refclassid =
      'pg_catalog.pg_proc'::pg_catalog.regclass
    and dependency.refobjid = target_oid;

  select pg_catalog.count(*)
  into index_difference_count
  from (
    (
      select *
      from pg_temp.immutable_unaccent_index_snapshot
      except
      select *
      from pg_temp.immutable_unaccent_post_index_snapshot
    )
    union all
    (
      select *
      from pg_temp.immutable_unaccent_post_index_snapshot
      except
      select *
      from pg_temp.immutable_unaccent_index_snapshot
    )
  ) as index_differences;

  if index_difference_count <> 0 then
    raise exception 'immutable_unaccent catalog postcondition failed: dependent index identity or health changed';
  end if;
end;
$catalog_postcondition$;

drop table pg_temp.immutable_unaccent_post_index_snapshot;
drop table pg_temp.immutable_unaccent_index_snapshot;
drop table pg_temp.immutable_unaccent_function_snapshot;
