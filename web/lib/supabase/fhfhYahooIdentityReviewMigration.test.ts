import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationSql = readFileSync(
  resolve(
    process.cwd(),
    "../supabase/migration-archive/pre-baseline-20260716/production-ledger/20260714224513_stage_yahoo_identity_mapping_review.sql",
  ),
  "utf8",
);

describe("FHFH Yahoo identity review staging migration", () => {
  it("never promotes legacy fuzzy evidence to verified", () => {
    expect(migrationSql).toContain("'review_required'");
    expect(migrationSql).not.toMatch(/verification_status[^;]+['"]verified['"]/i);
    expect(migrationSql).toContain("'requires_explicit_review', true");
  });

  it("does not assign an ambiguous Yahoo identity to multiple FHFH players", () => {
    expect(migrationSql).toContain("where quality.yahoo_candidate_count = 1");
    expect(migrationSql).toContain(
      "partition by raw.yahoo_player_id",
    );
    expect(migrationSql).toContain("array_agg(identity.id order by identity.id)");
  });

  it("stores Yahoo keys with game and season context", () => {
    expect(migrationSql).toContain("yahoo.player_key");
    expect(migrationSql).toContain("'yahoo:game:'");
    expect(migrationSql).toContain("':season:'");
    expect(migrationSql).toContain(
      "on conflict (provider, context_key, external_player_id)",
    );
  });

  it("is rerunnable without duplicating open review work", () => {
    expect(migrationSql).toContain("on conflict (dedupe_key)");
    expect(migrationSql).toContain(
      "and status in ('pending', 'in_review')",
    );
    expect(migrationSql).toContain("do update set");
  });
});
