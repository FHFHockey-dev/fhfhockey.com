import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  process.cwd(),
  "../supabase/migrations/20260714223013_create_fhfh_player_identity_registry.sql",
);
const migrationSql = readFileSync(migrationPath, "utf8");
const indexMigrationSql = readFileSync(
  resolve(
    process.cwd(),
    "../supabase/migrations/20260714223217_add_fhfh_identity_foreign_key_indexes.sql",
  ),
  "utf8",
);

const identityTables = [
  "fhfh_player_identities",
  "fhfh_player_external_identities",
  "fhfh_player_identity_aliases",
  "fhfh_player_organization_history",
  "fhfh_player_identity_review_queue",
] as const;

describe("FHFH player identity registry migration", () => {
  it("keeps the existing NHL players table intact and adds every identity surface", () => {
    expect(migrationSql).not.toMatch(/\b(?:alter|drop|truncate)\s+table\s+public\.players\b/i);
    expect(migrationSql).not.toMatch(/\binsert\s+into\s+public\.players\b/i);

    for (const table of identityTables) {
      expect(migrationSql).toContain(
        `create table if not exists public.${table}`,
      );
    }

    expect(migrationSql).toContain(
      "id bigint generated always as identity primary key",
    );
    expect(migrationSql).toContain("references public.players(id)");
    expect(migrationSql).toContain(
      "references public.fhfh_player_identities(id)",
    );
  });

  it("supports verified prospects and provider-context mappings without name uniqueness", () => {
    expect(migrationSql).toContain("nhl_player_id bigint null");
    expect(migrationSql).toContain("'active_prospect'");
    expect(migrationSql).toContain("'unsigned_relevant'");
    expect(migrationSql).toContain(
      "unique (provider, context_key, external_player_id)",
    );
    expect(migrationSql).not.toMatch(/unique\s*\(\s*canonical_name\s*\)/i);
    expect(migrationSql).not.toMatch(/unique\s*\(\s*normalized_alias\s*\)/i);
  });

  it("uses service-only table access with RLS and explicit client-deny policies", () => {
    for (const table of identityTables) {
      expect(migrationSql).toContain(
        `alter table public.${table} enable row level security;`,
      );
      expect(migrationSql).toMatch(
        new RegExp(
          `revoke all on table public\\.${table}\\s+from public, anon, authenticated;`,
          "i",
        ),
      );
      expect(migrationSql).toMatch(
        new RegExp(
          `grant select, insert, update, delete\\s+on table public\\.${table}\\s+to service_role;`,
          "i",
        ),
      );
    }

    expect(migrationSql.match(/as restrictive/g)).toHaveLength(5);
    expect(migrationSql.match(/to anon, authenticated\s+using \(false\)\s+with check \(false\)/g)).toHaveLength(5);
    const grantStatements = migrationSql
      .split(";")
      .map((statement) => statement.trim())
      .filter((statement) => /^grant\s/i.test(statement));
    expect(grantStatements).not.toEqual(
      expect.arrayContaining([
        expect.stringMatching(/\bto\s+(?:anon|authenticated)\b/i),
      ]),
    );
  });

  it("does not introduce a privileged or publicly executable function", () => {
    expect(migrationSql).toContain("security invoker");
    expect(migrationSql).toContain("set search_path = pg_catalog");
    expect(migrationSql).not.toContain("security definer");
    expect(migrationSql).toMatch(
      /revoke execute on function public\.set_fhfh_player_identity_updated_at\(\)\s+from public, anon, authenticated;/i,
    );
    expect(migrationSql).toMatch(
      /grant execute on function public\.set_fhfh_player_identity_updated_at\(\)\s+to service_role;/i,
    );
  });

  it("pins identity quality, merge, provenance, and review invariants", () => {
    expect(migrationSql).toContain(
      "constraint fhfh_player_identities_merge_target_valid",
    );
    expect(migrationSql).toContain(
      "constraint fhfh_player_external_match_confidence_valid",
    );
    expect(migrationSql).toContain(
      "constraint fhfh_player_identity_review_resolution_valid",
    );
    expect(migrationSql.match(/jsonb_typeof\([^)]*\) = 'object'/g)).toHaveLength(6);
    expect(migrationSql).toContain(
      "where dedupe_key is not null\n      and status in ('pending', 'in_review')",
    );
  });

  it("covers each foreign key identified by the post-apply performance advisor", () => {
    for (const column of [
      "verified_by",
      "merged_into_id",
      "resolved_fhfh_player_id",
      "reviewed_by",
      "nhl_team_id",
    ]) {
      expect(indexMigrationSql).toMatch(
        new RegExp(`create index[^;]+\\(${column}\\)`, "i"),
      );
    }

    expect(indexMigrationSql.match(/create index if not exists/g)).toHaveLength(6);
  });
});
