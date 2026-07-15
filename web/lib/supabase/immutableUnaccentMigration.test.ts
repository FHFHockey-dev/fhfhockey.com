import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  process.cwd(),
  "../supabase/migrations/20260714211247_fix_immutable_unaccent_search_path.sql",
);
const migrationSql = readFileSync(migrationPath, "utf8");

const collapseWhitespace = (value: string) => value.replace(/\s+/g, " ").trim();

describe("immutable_unaccent migration", () => {
  const precondition = migrationSql.match(
    /do \$catalog_precondition\$([\s\S]*?)\$catalog_precondition\$;/,
  )?.[1];
  const postcondition = migrationSql.match(
    /do \$catalog_postcondition\$([\s\S]*?)\$catalog_postcondition\$;/,
  )?.[1];

  it("accepts only the exact legacy/null and hardened/empty-path state pairs", () => {
    expect(precondition).toBeDefined();

    const normalizedPrecondition = collapseWhitespace(precondition ?? "");
    expect(precondition).not.toContain("regexp_replace");
    expect(normalizedPrecondition).toContain(
      "legacy_body := coalesce( target_proc.prosrc ~* $legacy_body$^",
    );
    expect(normalizedPrecondition).toContain(
      "hardened_body := coalesce( target_proc.prosrc ~* $hardened_body$^",
    );
    expect(normalizedPrecondition).toContain(
      "'public[.]unaccent'[[:space:]]*,",
    );
    expect(normalizedPrecondition).toContain(
      "'public[.]unaccent'[[:space:]]*::[[:space:]]*pg_catalog[.]regdictionary",
    );
    expect(normalizedPrecondition).toContain(
      "legacy_config := target_proc.proconfig is null",
    );
    expect(normalizedPrecondition).toContain(
      "hardened_config := target_proc.proconfig is not distinct from array['search_path=\"\"']::pg_catalog.text[]",
    );
    expect(normalizedPrecondition).toContain(
      "if not ( (legacy_body and legacy_config) or (hardened_body and hardened_config) ) then",
    );

    const isAcceptedState = (
      body: "legacy" | "hardened" | "unknown",
      configuration: null | 'search_path=""' | "other",
    ) =>
      (body === "legacy" && configuration === null) ||
      (body === "hardened" && configuration === 'search_path=""');

    expect([
      isAcceptedState("legacy", null),
      isAcceptedState("hardened", 'search_path=""'),
      isAcceptedState("legacy", 'search_path=""'),
      isAcceptedState("hardened", null),
      isAcceptedState("unknown", null),
      isAcceptedState("unknown", 'search_path=""'),
      isAcceptedState("legacy", "other"),
      isAcceptedState("hardened", "other"),
    ]).toEqual([true, true, false, false, false, false, false, false]);
  });

  it("guards the complete scalar SQL function contract before replacement", () => {
    expect(precondition).toBeDefined();

    expect(migrationSql).toContain("SET lock_timeout = '5s';");
    expect(migrationSql).toContain("SET statement_timeout = '30s';");
    expect(precondition).toContain(
      "pg_catalog.to_regprocedure(\n    'public.immutable_unaccent(text)'",
    );

    for (const contractFragment of [
      "target_proc.pronamespace is distinct from public_namespace_oid",
      "target_proc.proname is distinct from 'immutable_unaccent'::pg_catalog.name",
      "target_proc.prokind is distinct from 'f'::\"char\"",
      "target_proc.pronargs is distinct from 1::pg_catalog.int2",
      "target_proc.pronargdefaults is distinct from 0::pg_catalog.int2",
      "target_proc.proargtypes[0] is distinct from text_type_oid",
      "target_proc.proallargtypes is not null",
      "target_proc.proargmodes is not null",
      "target_proc.proargnames is not null",
      "target_proc.proargdefaults is not null",
      "target_proc.provariadic is distinct from 0::pg_catalog.oid",
      "target_proc.prorettype is distinct from text_type_oid",
      "target_proc.proretset is distinct from false",
      "target_proc.prolang is distinct from sql_language_oid",
      "target_proc.provolatile is distinct from 'i'::\"char\"",
      "target_proc.proparallel is distinct from 's'::\"char\"",
      "target_proc.proisstrict is distinct from true",
      "target_proc.prosecdef is distinct from false",
      "target_proc.procost is distinct from 100::pg_catalog.float4",
      "target_proc.prorows is distinct from 0::pg_catalog.float4",
      "target_proc.proleakproof is distinct from false",
      "target_proc.prosupport is distinct from 0::pg_catalog.regproc",
      "target_proc.protrftypes is not null",
      "target_proc.probin is not null",
      "target_proc.prosqlbody is not null",
    ]) {
      expect(precondition).toContain(contractFragment);
    }
  });

  it("snapshots identity, ACL, and the dynamic healthy dependent-index set", () => {
    expect(precondition).toBeDefined();
    expect(postcondition).toBeDefined();

    expect(migrationSql).toContain(
      "create temporary table immutable_unaccent_function_snapshot",
    );
    expect(migrationSql).toContain(
      "create temporary table immutable_unaccent_index_snapshot",
    );
    expect(precondition).toContain("target_proc.oid");
    expect(precondition).toContain("target_proc.proowner");
    expect(precondition).toContain("target_proc.proacl");
    expect(precondition).toContain("from pg_catalog.pg_depend as dependency");
    expect(precondition).toContain("index_catalog.indisvalid");
    expect(precondition).toContain("index_catalog.indisready");
    expect(precondition).toContain("index_catalog.indislive");
    expect(precondition).toContain(
      "index_class.relkind in ('i'::\"char\", 'I'::\"char\")",
    );

    for (const baselineIndex of [
      "goalie_name_norm_btree",
      "skater_name_norm_btree",
      "yplayers_name_norm_btree",
      "yplayers_name_norm_trgm",
    ]) {
      expect(precondition).toContain(`'${baselineIndex}'`);
    }

    expect(postcondition).toContain(
      "target_proc.oid is distinct from snapshot_oid",
    );
    expect(postcondition).toContain(
      "target_proc.proowner is distinct from snapshot_owner_oid",
    );
    expect(postcondition).toContain(
      "target_proc.proacl is distinct from snapshot_acl",
    );
    expect(postcondition).toContain(
      "from pg_temp.immutable_unaccent_index_snapshot",
    );
    expect(postcondition).toContain(
      "from pg_temp.immutable_unaccent_post_index_snapshot",
    );
    expect(collapseWhitespace(postcondition ?? "")).toContain(
      "except select * from pg_temp.immutable_unaccent_post_index_snapshot",
    );
    expect(collapseWhitespace(postcondition ?? "")).toContain(
      "except select * from pg_temp.immutable_unaccent_index_snapshot",
    );
  });

  it("materializes and verifies the exact hardened definition", () => {
    expect(migrationSql).toContain(
      "create or replace function public.immutable_unaccent(text)",
    );
    expect(migrationSql).toMatch(/\blanguage sql\b/);
    expect(migrationSql).toMatch(/\bimmutable\b/);
    expect(migrationSql).toMatch(/\bparallel safe\b/);
    expect(migrationSql).toMatch(/\bstrict\b/);
    expect(migrationSql).toMatch(/\bsecurity invoker\b/);
    expect(migrationSql).toMatch(/\bcost 100\b/);
    expect(migrationSql).toContain("set search_path = ''");
    expect(migrationSql).toContain("select public.unaccent(");
    expect(migrationSql).toContain(
      "'public.unaccent'::pg_catalog.regdictionary",
    );
    expect(postcondition).toBeDefined();
    expect(postcondition).toMatch(
      /target_proc\.proconfig is distinct from\s+array\['search_path=""'\]::pg_catalog\.text\[\]/,
    );
    expect(postcondition).toContain("hardened_body is distinct from true");
    expect(migrationSql).toContain(
      "drop table pg_temp.immutable_unaccent_function_snapshot;",
    );
  });
});
