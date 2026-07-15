import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationSql = readFileSync(
  resolve(
    process.cwd(),
    "../supabase/migrations/20260715040050_add_verified_2026_prospect.sql",
  ),
  "utf8",
);

describe("Draft Ranker verified-prospect migration", () => {
  it("uses official editorial evidence for a real non-ADP prospect", () => {
    expect(migrationSql).toContain("Caleb Malhotra");
    expect(migrationSql).toContain(
      "https://www.nhl.com/news/2026-nhl-draft-1st-round-pick-signings-tracker",
    );
    expect(migrationSql).toContain("'active_prospect'");
    expect(migrationSql).toContain("'verified'");
    expect(migrationSql).toContain("'Boston University'");
  });

  it("resolves repository identities instead of hardcoding generated IDs", () => {
    expect(migrationSql).toContain("where team.abbreviation = 'VAN'");
    expect(migrationSql).toContain("returning id into v_player_id");
    expect(migrationSql).not.toMatch(/values\s*\(\s*10654\b/i);
  });

  it("records organization history and a resolved editorial review", () => {
    expect(migrationSql).toContain("fhfh_player_organization_history");
    expect(migrationSql).toContain("fhfh_player_identity_review_queue");
    expect(migrationSql).toContain("'created_verified_identity'");
    expect(migrationSql).toContain("'system:fhfh_editorial_review_v1'");
  });

  it("is idempotent and documents a reference-safe rollback", () => {
    expect(migrationSql.match(/where not exists/gi)).toHaveLength(2);
    expect(migrationSql).toContain("source_provenance ->> 'editorial_key'");
    expect(migrationSql).toContain("only when no user ranking data references it");
  });
});
