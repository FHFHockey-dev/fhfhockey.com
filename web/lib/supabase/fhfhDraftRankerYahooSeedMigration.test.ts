import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationSql = readFileSync(
  resolve(
    process.cwd(),
    "../supabase/migration-archive/pre-baseline-20260716/production-ledger/20260715012955_initialize_draft_ranker_from_yahoo_adp.sql",
  ),
  "utf8",
);

describe("Draft Ranker Yahoo initialization migration", () => {
  it("is service-only, invoker-rights, and fixed-search-path", () => {
    expect(migrationSql).toContain("security invoker");
    expect(migrationSql).toContain("set search_path = pg_catalog, public");
    expect(migrationSql).not.toContain("security definer");
    expect(migrationSql).toMatch(
      /revoke all on function public\.initialize_draft_ranking_from_yahoo\([\s\S]+?\) from public, anon, authenticated;/i,
    );
    expect(migrationSql).toMatch(
      /grant execute on function public\.initialize_draft_ranking_from_yahoo\([\s\S]+?\) to service_role;/i,
    );
  });

  it("uses only verified, rankable 2025 Yahoo identities", () => {
    expect(migrationSql).toContain("where yahoo.season = p_source_yahoo_season");
    expect(migrationSql).toContain("mapping.verification_status = 'verified'");
    expect(migrationSql).toContain("mapped.merged_into_id is null");
    expect(migrationSql).toContain("'active_nhl', 'active_prospect', 'unsigned_relevant'");
    expect(migrationSql).toContain("p_target_season_id <> 20262027");
    expect(migrationSql).toContain("p_source_yahoo_season <> 2025");
  });

  it("parses positive preseason ADP and uses the approved scalar fallback", () => {
    expect(migrationSql).toContain("draft_analysis->'preseason_average_pick'");
    expect(migrationSql).toContain("source.preseason_adp > 0");
    expect(migrationSql).toContain("source.average_draft_pick > 0");
    expect(migrationSql).toContain("yahoo_prior_preseason_adp");
    expect(migrationSql).toContain("yahoo_prior_average_pick_fallback");
    expect(migrationSql).toContain("if v_seeded_count < 250 then");
  });

  it("persists every valid candidate in deterministic sparse order", () => {
    expect(migrationSql).toContain("ranked.seed_rank * 1048576");
    expect(migrationSql).toContain("ranked.seed_value");
    expect(migrationSql).toContain(
      "(choices.seed_source = 'yahoo_prior_preseason_adp') desc",
    );
    expect(migrationSql).toContain("choices.fhfh_player_id");
    expect(migrationSql).not.toMatch(/limit\s+250/i);
  });

  it("serializes initialization and records retries, failures, and evidence", () => {
    expect(migrationSql).toContain("pg_advisory_xact_lock");
    expect(migrationSql).toContain("idempotency_conflict");
    expect(migrationSql).toContain("idempotentReplay");
    expect(migrationSql).toContain("seed_integrity_mismatch");
    expect(migrationSql).toContain("seed_transaction_failed");
    expect(migrationSql).toContain("'ranking_initialized'");
    expect(migrationSql).toContain("operation_payload_hash");
  });
});
