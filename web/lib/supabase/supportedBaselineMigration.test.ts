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
  it("keeps only the reviewed baseline and supported post-baseline deltas active", () => {
    expect(
      readdirSync(migrationRoot)
        .filter((name) => name.endsWith(".sql"))
        .sort(),
    ).toEqual([
      "20260716112908_production_schema_baseline.sql",
      "20260716112909_add_line_combinations_source_provenance.sql",
      "20260716112910_harden_line_combination_trigger_auth.sql",
      "20260720105524_add_projection_materialization_transactions.sql",
      "20260721013821_enforce_shift_relationship_positions.sql",
      "20260722010355_add_transactional_gamecenter_normalization.sql",
      "20260723040553_restrict_legacy_yahoo_player_writers.sql",
      "20260723113533_make_yahoo_player_writer_atomic.sql",
      "20260723121407_replace_forge_projection_results_atomic.sql",
      "20260725200808_fix_yahoo_player_writer_captured_at.sql",
      "20260725220704_reconcile_yahoo_player_key_snapshots.sql",
      "20260725223034_add_sustainability_version_provenance.sql",
      "20260725235646_add_normalized_yahoo_ownership_reader.sql",
      "20260726000603_harden_yahoo_read_surfaces.sql",
      "20260728225806_add_sko_prediction_run_control.sql",
      "20260728235000_make_game_prediction_promotion_atomic.sql",
      "20260729205048_preserve_sko_model_history.sql",
      "20260730091500_consolidate_scheduler_ownership.sql",
      "20260730190000_tombstone_legacy_public_rpcs.sql",
      "20260730193000_repair_compile_invalid_legacy_routines.sql",
      "20260730200000_repair_utah_wgo_team_identity.sql",
      "20260730233451_reconstruct_hosted_analytics_schema.sql",
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
      "27067d2221516be147d5cf71492b1fee3f0fd377d0ccd14e49557931ad1b791d",
    );
    expect(baseline).toContain("CREATE SCHEMA IF NOT EXISTS public;");
    expect(baseline).toContain("ALTER SCHEMA public OWNER TO postgres;");
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
    expect(baseline).not.toMatch(/^CREATE EXTENSION .* VERSION /gm);
    expect(baseline).toContain("SELECT j.jobname::name AS jobname,");
    expect(baseline.match(/CREATE SEQUENCE IF NOT EXISTS/g)).toHaveLength(16);
    expect(baseline.match(/CREATE SEQUENCE public\./g)).toHaveLength(41);
    expect(baseline.match(/^GRANT /gm)).toHaveLength(1401);
    expect(baseline.match(/^REVOKE /gm)).toHaveLength(37);
    expect(baseline.match(/^ALTER DEFAULT PRIVILEGES /gm)).toHaveLength(12);
    expect(baseline).toContain(
      "REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM anon, authenticated, service_role;",
    );
    expect(baseline).toContain(
      "REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated, service_role;",
    );
    expect(baseline).toContain("DO $acl_reset$");
    expect(baseline).not.toMatch(/^\\(?:restrict|unrestrict)/m);
    expect(baseline).not.toContain("SET transaction_timeout");
    expect(baseline).not.toMatch(/authorization/i);
    expect(baseline).not.toMatch(/bearer/i);
    expect(baseline).not.toMatch(
      /CREATE FUNCTION public\.(?:on_new_line_combo|on_new_player_underlying_stats|update_power_play_combinations|update_all_wgo_skaters|get_skater_game_score_by_limit)\b/i,
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
    expect(migration).toContain('where g.id = new."gameId";');
    expect(migration).not.toContain('where g."gameId" = new."gameId";');
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

  it("keeps legacy RPC tombstones credential-free and browser-denied", () => {
    const migration = readMigration(
      "20260730190000_tombstone_legacy_public_rpcs.sql",
    );

    expect(migration).toContain(
      "to_regprocedure('public.update_all_wgo_skaters()')",
    );
    expect(migration).toContain(
      "'public.get_skater_game_score_by_limit(bigint,integer)'",
    );
    expect(migration.match(/security invoker/g)).toHaveLength(2);
    expect(migration.match(/set search_path = ''/g)).toHaveLength(2);
    expect(migration.match(/message = 'Legacy RPC retired\.'/g)).toHaveLength(
      2,
    );
    expect(
      migration.match(/from public, anon, authenticated, service_role/g),
    ).toHaveLength(2);
    expect(migration.match(/to service_role;/g)).toHaveLength(2);
    expect(migration).not.toMatch(/authorization|bearer/i);
  });

  it("repairs compile-invalid legacy routines without restoring duplicate writers", () => {
    const migration = readMigration(
      "20260730193000_repair_compile_invalid_legacy_routines.sql",
    );

    for (const signature of [
      "public.calculate_goalie_start_projections(date)",
      "public.upsert_players_batch(jsonb)",
    ]) {
      expect(migration).toContain(`alter function ${signature}`);
      expect(migration).toMatch(
        new RegExp(
          `revoke all on function ${signature.replace(/[()[\].]/g, "\\$&")}[\\s\\S]+from public, anon, authenticated, service_role;`,
        ),
      );
    }
    expect(migration.match(/message = 'Legacy RPC retired\.'/g)).toHaveLength(
      2,
    );
    expect(migration).toContain(
      "create or replace function public.get_aggregated_player_stats(",
    );
    expect(migration).toContain("language sql");
    expect(migration).toContain("stable");
    expect(migration).toContain("sum(stats.goals)::double precision");
    expect(migration).toContain("avg(stats.zone_start_pct)::double precision");
    expect(migration.match(/set search_path = ''/g)).toHaveLength(3);
    expect(migration).not.toContain("percent_owned_value");
    expect(migration).not.toContain("process_team_goalie_projections");
  });

  it("bounds the Utah WGO identity repair to the frozen replay-safe manifest", () => {
    const migration = readMigration(
      "20260730200000_repair_utah_wgo_team_identity.sql",
    );

    expect(migration).toContain(
      "lock table public.wgo_team_stats in share row exclusive mode",
    );
    expect(migration).toMatch(/\bbegin;\s+lock table/i);
    expect(migration).toMatch(/\$repair\$;\s+commit;/i);
    expect(migration).toContain("w.season_id = 20252026");
    expect(migration).toContain("w.franchise_name = 'Utah Mammoth'");
    expect(migration).toContain(
      "manifest_digest <> 'dd27185df94d9f7e9816eb3a9a8a8b66'",
    );
    expect(migration).toContain("(pre_count = 88 and post_count = 0)");
    expect(migration).toContain("(pre_count = 0 and post_count = 88)");
    expect(migration).toContain("if pre_count = 88 then");
    expect(migration).toContain("if updated_count <> 88 then");
    expect(migration).toContain(
      "if not exists (select 1 from public.wgo_team_stats)",
    );
    expect(migration.match(/update public\.wgo_team_stats/g)).toHaveLength(1);
    expect(migration).not.toMatch(/\b(?:insert|delete|truncate)\b/i);
  });

  it("reconstructs the exact credential-free hosted analytics contract", () => {
    const migration = readMigration(
      "20260730233451_reconstruct_hosted_analytics_schema.sql",
    );
    const config = readFileSync(
      path.join(repoRoot, "supabase", "config.toml"),
      "utf8",
    );
    expect(migration).toContain("with no data;");
    const relationHashes = {
      mv_sko_skater_moments:
        "0282d6e1151ab637c90fda516fcc327b99e78e863ca800cb59e8275f18b2dcaf",
      vw_entity_ratings_daily:
        "f5672a8f1eb48999cd7275aa44392f73c23d38f6d98ec2cce03e269618917271",
      vw_entity_sustainability_scores:
        "8aff6119d5cea52bbc13bfe636b9ebcacae183aa98d49e5d0da79ead3ee1e894",
      vw_nhl_edge_latest_goalie_metrics:
        "dcdbf6b9a23a37a20ad7c0e69903e57c9645074f5955acf5bc8e5e5970a149b2",
      vw_nhl_edge_latest_skater_metrics:
        "f6446ce21377e7a90d6d890d91bf1275fdaea1a187aef59afb451d5f22b313a5",
      vw_nhl_edge_latest_skater_skating_distance_games:
        "d8713402a9b20b8904d7f9f9a0cf72539ffaa76039725018578d34d7cf97b022",
      vw_nhl_edge_latest_team_metrics:
        "07da52645031f345a44d1920d79eb2402afc6f16fe5c95b4222d75d82ccfb609",
      vw_nhl_edge_latest_team_skating_distance_games:
        "1eab15666b7da5d403b2b026466c2bc4620673d7970a395f0afe40fddf3685df",
      vw_player_status_current:
        "555a7f13e33a313e264478fa2e6bd33135312efea097f95b647837b201531805",
      vw_sko_skater_base:
        "4358bde8afba264a7286dd4e87b0106d4163acced964c504f09509176cc5f03f",
      vw_sko_skater_scores:
        "b7b11b4a3b5d8bafb9fff587774d38b051906d4589097215be3bce97b27049d7",
      vw_sko_skater_zscores:
        "310c31e9f94137ea475696c71487d9394a00d77a2d286bfe00f87887bdc241f7",
      vw_team_ratings_daily:
        "29bb1af632e96796e60a58883e2b77b69c348365a4749c8653693854fdc0c3ca",
    };

    for (const [name, expectedHash] of Object.entries(relationHashes)) {
      const pattern =
        name === "mv_sko_skater_moments"
          ? new RegExp(
              `create materialized view analytics\\.${name} as\\n([\\s\\S]*?)\\n-- The supported baseline[\\s\\S]*?\\nwith no data;`,
            )
          : new RegExp(
              `create view analytics\\.${name} as\\n([\\s\\S]*?);\\n\\n`,
            );
      const definition = migration.match(pattern)?.[1];

      expect(definition, name).toBeDefined();
      expect(
        createHash("sha256")
          .update(
            name === "mv_sko_skater_moments"
              ? `${definition ?? ""};`
              : (definition ?? ""),
          )
          .digest("hex"),
        name,
      ).toBe(expectedHash);
    }

    const routine = migration.match(
      /(CREATE OR REPLACE FUNCTION analytics\.rpc_sko_player_series[\s\S]*?\$function\$);/,
    )?.[1];
    expect(routine).toBeDefined();
    expect(
      createHash("sha256")
        .update(`${routine ?? ""}\n`)
        .digest("hex"),
    ).toBe("1badf135a7bd94bfd3bc7d7f7e99f2a73883780ef3814b51245ec1c868c1671c");
    expect(migration).toContain(
      "grant usage on schema analytics to anon, authenticated, service_role;",
    );
    expect(migration).toContain(
      "grant select on analytics.vw_player_status_current to service_role;",
    );
    expect(migration).not.toMatch(/\b(?:bearer|password|api[_-]?key)\b/i);
    expect(config).toContain(
      'schemas = ["public", "graphql_public", "analytics"]',
    );
  });

  it("keeps the frozen Production application classes and migration hashes exact", () => {
    const summary = readFileSync(
      path.join(
        repoRoot,
        "tasks",
        "TASKS",
        "super-goal",
        "super-goal-final-summary.md",
      ),
      "utf8",
    );
    const manifestRows = [
      ...summary.matchAll(
        /^\| (Ordered predeploy|Separate repair mutation|Production tracking only after local parity) \| `([^`]+\.sql)` \| `([a-f0-9]{64})` \|$/gm,
      ),
    ].map((match) => ({
      className: match[1],
      fileName: match[2],
      expectedHash: match[3],
    }));
    const appliedProductionMigrations = new Set([
      "20260716112908_production_schema_baseline.sql",
      "20260716112909_add_line_combinations_source_provenance.sql",
      "20260716112910_harden_line_combination_trigger_auth.sql",
      "20260720105524_add_projection_materialization_transactions.sql",
      "20260721013821_enforce_shift_relationship_positions.sql",
      "20260723040553_restrict_legacy_yahoo_player_writers.sql",
      "20260723113533_make_yahoo_player_writer_atomic.sql",
      "20260725200808_fix_yahoo_player_writer_captured_at.sql",
    ]);

    expect(manifestRows).toHaveLength(14);
    expect(
      manifestRows.filter((row) => row.className === "Ordered predeploy"),
    ).toHaveLength(12);
    expect(
      manifestRows.filter(
        (row) => row.className === "Separate repair mutation",
      ),
    ).toHaveLength(1);
    expect(
      manifestRows.filter(
        (row) =>
          row.className === "Production tracking only after local parity",
      ),
    ).toHaveLength(1);
    expect(manifestRows.map((row) => row.fileName)).toEqual(
      readdirSync(migrationRoot)
        .filter((name) => name.endsWith(".sql"))
        .sort()
        .filter((name) => !appliedProductionMigrations.has(name)),
    );

    for (const row of manifestRows) {
      expect(
        createHash("sha256").update(readMigration(row.fileName)).digest("hex"),
        row.fileName,
      ).toBe(row.expectedHash);
    }
  });
});
