import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationSql = readFileSync(
  resolve(
    process.cwd(),
    "../supabase/migrations/20260715024101_add_draft_ranker_player_search.sql",
  ),
  "utf8",
);

describe("Draft Ranker player search migration", () => {
  it("reasserts search-path-safe accent normalization for hardened callers", () => {
    expect(migrationSql).toContain(
      "create or replace function public.immutable_unaccent(text)",
    );
    expect(migrationSql).toContain("set search_path = ''");
    expect(migrationSql).toContain("public.unaccent(");
    expect(migrationSql).toContain("::pg_catalog.regdictionary");
  });

  it("indexes normalized canonical names and verified aliases", () => {
    expect(migrationSql).toContain("idx_fhfh_player_identities_name_trgm");
    expect(migrationSql).toContain("idx_fhfh_player_aliases_name_trgm");
    expect(migrationSql).toContain("public.immutable_unaccent(lower(canonical_name))");
    expect(migrationSql).toContain("public.gin_trgm_ops");
    expect(migrationSql).toContain("where verification_status = 'verified'");
  });

  it("searches only verified launch identities by default", () => {
    expect(migrationSql).toContain("identity.verification_status = 'verified'");
    for (const status of ["active_nhl", "active_prospect", "unsigned_relevant"]) {
      expect(migrationSql).toContain(`'${status}'`);
    }
    expect(migrationSql).toContain("p_include_archived");
    expect(migrationSql).not.toMatch(/insert into public\.fhfh_player_identities/i);
  });

  it("provides deterministic identity disambiguation and bounded relevance", () => {
    for (const field of [
      "birth_year",
      "canonical_position",
      "current_organization_name",
      "lifecycle_status",
      "nhl_player_id",
      "yahoo_player_id",
    ]) {
      expect(migrationSql).toContain(field);
    }
    expect(migrationSql).toContain("least(greatest(coalesce(p_limit, 20), 1), 25)");
    expect(migrationSql).toContain("matched.canonical_name");
    expect(migrationSql).toContain("matched.player_id");
  });

  it("deduplicates and transactionally rate-limits addition requests", () => {
    expect(migrationSql).toContain("pg_advisory_xact_lock");
    expect(migrationSql).toContain("v_recent_count >= 5");
    expect(migrationSql).toContain("interval '24 hours'");
    expect(migrationSql).toContain("'status', 'duplicate'");
    expect(migrationSql).toContain("'status', 'rate_limited'");
    expect(migrationSql).toContain("'player_addition'");
  });

  it("keeps both functions service-only and invoker-secured", () => {
    expect(migrationSql.match(/security invoker/g)).toHaveLength(3);
    expect(migrationSql).not.toContain("security definer");
    expect(migrationSql).toMatch(
      /revoke all on function public\.search_fhfh_draft_players\([\s\S]+?from public, anon, authenticated;/i,
    );
    expect(migrationSql).toMatch(
      /grant execute on function public\.request_fhfh_player_addition\([\s\S]+?to service_role;/i,
    );
  });
});
