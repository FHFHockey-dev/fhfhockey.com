import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const repoRoot =
  path.basename(process.cwd()) === "web"
    ? path.resolve(process.cwd(), "..")
    : process.cwd();
const migrationRoot = path.join(repoRoot, "supabase", "migrations");
const archiveRoot = path.join(
  repoRoot,
  "supabase",
  "migration-archive",
  "pre-baseline-20260716",
);

const readMigration = (name: string) =>
  readFileSync(path.join(migrationRoot, name), "utf8");

describe("supported Supabase schema-baseline reconciliation", () => {
  it("keeps only the reviewed baseline and two post-baseline deltas active", () => {
    expect(
      readdirSync(migrationRoot)
        .filter((name) => name.endsWith(".sql"))
        .sort(),
    ).toEqual([
      "20260716112908_production_schema_baseline.sql",
      "20260716112909_add_line_combinations_source_provenance.sql",
      "20260716112910_harden_line_combination_trigger_auth.sql",
    ]);

    expect(
      readdirSync(path.join(archiveRoot, "authoritative-root")).filter((name) =>
        name.endsWith(".sql"),
      ),
    ).toHaveLength(34);
    expect(
      readdirSync(path.join(archiveRoot, "production-ledger")).filter((name) =>
        name.endsWith(".sql"),
      ),
    ).toHaveLength(42);
    expect(
      readFileSync(path.join(archiveRoot, "SHA256SUMS"), "utf8")
        .trim()
        .split("\n"),
    ).toHaveLength(76);
  });

  it("keeps credential-bearing routines out of the current-schema baseline", () => {
    const baseline = readMigration(
      "20260716112908_production_schema_baseline.sql",
    );
    const baselineHash = createHash("sha256").update(baseline).digest("hex");

    expect(baselineHash).toBe(
      "0d65d71dfe988c95b7e4f321b68f4989e703b51ace22894692af05d403d77780",
    );
    expect(baseline).toContain("CREATE SCHEMA IF NOT EXISTS public;");
    expect(baseline.match(/CREATE EXTENSION IF NOT EXISTS/g)).toHaveLength(12);
    for (const extensionName of [
      "http",
      "moddatetime",
      "pg_cron",
      "pg_net",
      "pg_stat_statements",
      "pg_trgm",
      "pgcrypto",
      "pgjwt",
      "pgsodium",
      "supabase_vault",
      "unaccent",
    ]) {
      expect(baseline).toContain(
        `CREATE EXTENSION IF NOT EXISTS ${extensionName}`,
      );
    }
    expect(baseline).toContain(
      'CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;',
    );
    expect(baseline).not.toMatch(/^\\(?:restrict|unrestrict)/m);
    expect(baseline).not.toContain("SET transaction_timeout");
    expect(baseline).not.toMatch(/authorization/i);
    expect(baseline).not.toMatch(/bearer/i);
    expect(baseline).not.toMatch(
      /CREATE FUNCTION public\.(?:on_new_line_combo|on_new_player_underlying_stats|update_power_play_combinations|update_all_wgo_skaters)\b/i,
    );
    expect(baseline).not.toMatch(
      /CREATE TRIGGER (?:after_line_combo_insert|after_player_underlying_stats_insert|update_power_play_combinations_after_line_combo_insert)\b/i,
    );
  });

  it("makes the authoritative-root provenance RPC match the reviewed A-GDL source", () => {
    const rootMigration = readMigration(
      "20260716112909_add_line_combinations_source_provenance.sql",
    );
    const reviewedMigration = readFileSync(
      path.join(
        repoRoot,
        "web",
        "supabase",
        "migrations",
        "20260711214500_add_line_combinations_source_provenance.sql",
      ),
      "utf8",
    );

    expect(rootMigration).toBe(reviewedMigration);
    expect(rootMigration).toMatch(/security definer\s+set search_path = ''/i);
    expect(rootMigration).toMatch(
      /revoke all on function public\.upsert_line_combinations_from_source[\s\S]+from public, anon, authenticated;/i,
    );
    expect(rootMigration).toMatch(
      /grant execute on function public\.upsert_line_combinations_from_source[\s\S]+to service_role;/i,
    );
  });

  it("preserves all three trigger semantics through one fail-closed Vault helper", () => {
    const migration = readMigration(
      "20260716112910_harden_line_combination_trigger_auth.sql",
    );

    expect(
      migration.match(/create or replace function public\./gi),
    ).toHaveLength(3);
    expect(
      migration.match(/security definer\s+set search_path = ''/gi),
    ).toHaveLength(4);
    expect(migration).toContain("from vault.decrypted_secrets as ds");
    expect(migration).toContain("where ds.name = 'cron_secret'");
    expect(migration).toContain("secret_count <> 1");
    expect(migration).toContain("pg_catalog.btrim(secret_value) = ''");
    expect(migration).not.toMatch(/Bearer\s+[A-Za-z0-9_-]{8,}/);

    expect(migration).toContain(
      "https://fhfhockey.com/api/v1/webhooks/on-new-line-combo?gameId=",
    );
    expect(migration).toContain("'&teamId='");
    expect(migration).toContain(
      "https://fhfhockey.com/api/v1/db/update-player-underlying-stats?gameId=",
    );
    expect(migration).toContain("'&warmLandingCache=true'");
    expect(migration).toContain(
      "https://fhfhockey.com/api/v1/db/update-power-play-combinations/",
    );
    expect(migration.match(/timeout_milliseconds := 60000/g)).toHaveLength(2);
    expect(migration).toContain("timeout_milliseconds := 270000");
    expect(migration).toMatch(
      /if home_team_id = new\."teamId" then[\s\S]+update-player-underlying-stats/i,
    );
    expect(migration.match(/create trigger /gi)).toHaveLength(3);

    for (const functionName of [
      "on_new_line_combo",
      "on_new_player_underlying_stats",
      "update_power_play_combinations",
    ]) {
      expect(migration).toMatch(
        new RegExp(
          `revoke all on function public\\.${functionName}\\(\\)[\\s\\S]+from public, anon, authenticated, service_role;`,
          "i",
        ),
      );
    }
  });
});
