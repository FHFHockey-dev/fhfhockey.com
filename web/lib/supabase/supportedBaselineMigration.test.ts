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

type MigrationAuthorityRecord = {
  order: number;
  path: string;
  sha256: string;
  sourceStatus: "source-authorized";
  deploymentState: "applied" | "pending" | "unknown";
  migrationClass:
    | "baseline"
    | "ordered"
    | "repair-only"
    | "tracking-only"
    | "postdeploy"
    | "security"
    | "feature";
  rolloutGate: string;
  stateEvidence: string;
};

const migrationAuthorityPath = path.join(
  repoRoot,
  "tasks",
  "TASKS",
  "repository-audit-remediation",
  "migration-authority.json",
);
const migrationAuthority = JSON.parse(
  readFileSync(migrationAuthorityPath, "utf8"),
) as {
  schemaVersion: number;
  policy: Record<string, string>;
  migrations: MigrationAuthorityRecord[];
};
const migrationAuthorityRows = migrationAuthority.migrations;
const activeMigrationNames = migrationAuthorityRows.map((row) =>
  path.basename(row.path),
);

describe("supported Supabase schema-baseline reconciliation", () => {
  it("keeps only the reviewed baseline and supported post-baseline deltas active", () => {
    expect(
      readdirSync(migrationRoot)
        .filter((name) => name.endsWith(".sql"))
        .sort(),
    ).toEqual(activeMigrationNames);

    expect(migrationAuthority.schemaVersion).toBe(1);
    expect(migrationAuthorityRows).toHaveLength(58);
    expect(new Set(activeMigrationNames)).toHaveLength(58);
    expect(
      migrationAuthorityRows.map((row) => row.order),
    ).toEqual(migrationAuthorityRows.map((_row, index) => index + 1));
    expect(activeMigrationNames).toEqual([...activeMigrationNames].sort());
    expect(
      migrationAuthorityRows.filter(
        (row) => row.deploymentState === "applied",
      ),
    ).toHaveLength(43);
    expect(
      migrationAuthorityRows.filter(
        (row) => row.deploymentState === "unknown",
      ),
    ).toHaveLength(15);
    expect(
      migrationAuthorityRows.filter(
        (row) => row.deploymentState === "pending",
      ),
    ).toHaveLength(0);

    for (const row of migrationAuthorityRows) {
      expect(row.path).toBe(
        `supabase/migrations/${path.basename(row.path)}`,
      );
      expect(row.sourceStatus).toBe("source-authorized");
      expect(row.rolloutGate.length).toBeGreaterThan(0);
      expect(row.stateEvidence.length).toBeGreaterThan(0);
      expect(
        createHash("sha256")
          .update(readFileSync(path.join(repoRoot, row.path), "utf8"))
          .digest("hex"),
        row.path,
      ).toBe(row.sha256);
    }

    expect(migrationAuthority.policy.sourceAuthorizedMeaning).toContain(
      "not permission to apply or deploy",
    );

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

  it("requires an editor event for every opening projection release", () => {
    const openingReleaseGuard = readMigration(
      "20260826131500_require_editor_for_player_forecast_opening_release.sql",
    );

    expect(openingReleaseGuard).toContain(
      "new.view_key = 'opening'",
    );
    expect(openingReleaseGuard).toContain(
      "new.actor_kind <> 'editor' or new.action = 'auto_publish'",
    );
    expect(openingReleaseGuard).toContain(
      "PLAYER_FORECAST_SEASON_OPENING_REQUIRES_EDITOR",
    );
    expect(openingReleaseGuard).toContain(
      "before insert or update on public.player_forecast_season_release_events",
    );
  });

  it("inherits long-lived season assumptions without auto-publishing direct stat edits", () => {
    const assumptionInheritance = readMigration(
      "20260826133000_inherit_player_forecast_season_assumptions.sql",
    );

    expect(assumptionInheritance).toContain(
      "when (new.inherited_from_id is null)",
    );
    expect(assumptionInheritance).toContain(
      "p_include_stat_overrides or source_override.field_path not like 'stats.%'",
    );
    expect(assumptionInheritance).toContain(
      "clone_player_forecast_season_run_with_assumptions",
    );
    expect(assumptionInheritance).toContain(
      "create_player_forecast_season_event_run_with_assumptions",
    );
    expect(assumptionInheritance).toContain(
      "to service_role;",
    );
  });

  it("revokes browser execution of the two privileged maintenance RPCs", () => {
    const arbitrarySqlRevocation = readMigration(
      "20260820013120_revoke_execute_sql_browser_roles.sql",
    );
    const truncateRevocation = readMigration(
      "20260820013124_revoke_truncate_rolling_metrics_browser_roles.sql",
    );

    expect(arbitrarySqlRevocation).toContain(
      "revoke execute on function public.execute_sql(text)\nfrom public, anon, authenticated;",
    );
    expect(arbitrarySqlRevocation).toContain(
      "grant execute on function public.execute_sql(text)\nto service_role;",
    );
    expect(arbitrarySqlRevocation).not.toMatch(
      /\b(?:select|call)\s+public\.execute_sql\b/i,
    );

    expect(truncateRevocation).toContain(
      "revoke execute on function public.truncate_rolling_player_game_metrics()\nfrom public, anon, authenticated;",
    );
    expect(truncateRevocation).toContain(
      "grant execute on function public.truncate_rolling_player_game_metrics()\nto service_role;",
    );
    expect(truncateRevocation).not.toMatch(
      /\b(?:select|call)\s+public\.truncate_rolling_player_game_metrics\b/i,
    );
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

  it("keeps the separately authorized legacy-RPC final drop exact and fail-closed", () => {
    const migration = readMigration(
      "20260801195126_drop_legacy_public_rpcs_after_zero_use.sql",
    );

    expect(migration).toContain(
      "to_regprocedure('public.update_all_wgo_skaters()')",
    );
    expect(migration).toContain(
      "to_regprocedure('public.get_skater_game_score_by_limit(bigint,integer)')",
    );
    expect(migration).toContain("errcode = '2BP01'");
    expect(migration).toMatch(
      /drop function if exists public\.update_all_wgo_skaters\(\);/i,
    );
    expect(migration).toMatch(
      /drop function if exists public\.get_skater_game_score_by_limit\(bigint, integer\);/i,
    );
    expect(migration.match(/drop function if exists/gi)).toHaveLength(2);
    expect(migration).not.toMatch(
      /\b(?:create|alter|grant|revoke)\s+(?:function|procedure|table|schema)/i,
    );
    expect(migration).not.toMatch(/authorization|bearer|password|api[_-]?key/i);
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

  it("keeps SKO run control service-only with deterministic lease rejection", () => {
    const migration = readMigration(
      "20260728225806_add_sko_prediction_run_control.sql",
    );

    expect(migration).toContain(
      "alter table public.sko_prediction_run_manifests force row level security;",
    );
    expect(migration).toMatch(
      /revoke all on table public\.sko_prediction_run_manifests\s+from public, anon, authenticated, service_role;/,
    );
    expect(migration).toMatch(
      /grant select, insert, update on table public\.sko_prediction_run_manifests\s+to service_role;/,
    );
    expect(migration).toContain(
      "select coalesce((select true from renewed limit 1), false);",
    );
    expect(migration).toContain(
      "select coalesce((select true from finished limit 1), false);",
    );
    expect(migration).toContain("and p_ttl_seconds between 30 and 86400");
    expect(migration.match(/and lease_expires_at > now\(\)/g)).toHaveLength(2);

    for (const signature of [
      "public.acquire_sko_prediction_run(text, uuid, integer, jsonb)",
      "public.heartbeat_sko_prediction_run(text, uuid, integer)",
      "public.finish_sko_prediction_run(text, uuid, boolean, text, jsonb)",
    ]) {
      expect(migration).toMatch(
        new RegExp(
          `revoke all on function ${signature.replace(/[()[\].]/g, "\\$&")}\\s+from public, anon, authenticated, service_role;`,
        ),
      );
      expect(migration).toMatch(
        new RegExp(
          `grant execute on function ${signature.replace(/[()[\].]/g, "\\$&")}\\s+to service_role;`,
        ),
      );
    }
  });

  it("atomically versions complete Yahoo game metadata/week snapshots", () => {
    const migration = readMigration(
      "20260730195000_replace_yahoo_game_weeks_snapshot.sql",
    );

    expect(migration).toContain(
      "create table if not exists public.yahoo_game_week_snapshots",
    );
    expect(migration).toContain(
      "create or replace function public.replace_yahoo_game_weeks_snapshot(",
    );
    expect(migration).toContain("security invoker");
    expect(migration).toContain("set search_path = ''");
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toContain("YAHOO_GAME_WEEK_SNAPSHOT_CONFLICT");
    expect(migration).toContain("YAHOO_GAME_WEEK_ROWS_INVALID");
    expect(migration).toContain(
      "on conflict (game_key, season, week) do update",
    );
    expect(migration).toContain(
      "delete from public.yahoo_matchup_weeks as existing",
    );
    expect(migration).toContain("to service_role;");
    expect(migration).toMatch(
      /revoke all on function public\.replace_yahoo_game_weeks_snapshot\([\s\S]+from public, anon, authenticated, service_role;/i,
    );
    expect(migration).not.toMatch(
      /grant execute on function public\.replace_yahoo_game_weeks_snapshot\([\s\S]+to (?:anon|authenticated);/i,
    );
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

  it("makes the April 2023 WGO/trend season repair atomic and reversible", () => {
    const migration = readMigration(
      "20260731015416_repair_wgo_player_season_identity.sql",
    );

    expect(migration).toContain(
      "create table if not exists public.wgo_player_season_repair_trend_staging",
    );
    expect(migration).toContain(
      "alter table public.wgo_player_season_repair_trend_staging",
    );
    expect(migration).toContain("enable row level security");
    expect(migration).toContain(
      "create or replace function public.stage_wgo_player_season_repair_trends(",
    );
    expect(migration).toContain(
      "create or replace function public.repair_wgo_player_season_identity(",
    );
    expect(migration).toContain("security definer");
    expect(migration).toContain("security invoker");
    expect(migration).toContain("set search_path = ''");
    expect(migration).toContain(
      "pg_catalog.hashtextextended('fhfh:wgo-player-season-identity:2023-04', 0)",
    );
    expect(migration).toContain(
      "lock table public.wgo_skater_stats in share row exclusive mode",
    );
    expect(migration).toContain(
      "lock table public.player_trend_metrics in share row exclusive mode",
    );
    expect(migration).toContain("v_source_count <> 1905");
    expect(migration).toContain("v_input_trend_count <> 49410");
    expect(migration).toContain("v_input_trend_player_dates <> 1830");
    expect(migration).toContain("v_input_metric_keys <> 27");
    expect(migration).toContain("pg_catalog.jsonb_array_length(p_rows) > 500");
    expect(migration).toContain(
      "refresh materialized view public.player_stats_unified",
    );
    expect(migration).toContain(
      "on conflict (player_id, game_date, metric_key) do update",
    );
    expect(migration).toContain("is distinct from");
    expect(migration).toContain("'forward'");
    expect(migration).toContain("'inverse'");
    expect(migration).toMatch(
      /revoke all on function public\.repair_wgo_player_season_identity\([\s\S]+from public, anon, authenticated, service_role;/i,
    );
    expect(migration).toMatch(
      /revoke all on function public\.stage_wgo_player_season_repair_trends\([\s\S]+from public, anon, authenticated, service_role;/i,
    );
    expect(migration).toMatch(
      /grant execute on function public\.repair_wgo_player_season_identity\([\s\S]+to service_role;/i,
    );
    expect(migration).not.toMatch(
      /grant execute on function public\.repair_wgo_player_season_identity\([\s\S]+to (?:anon|authenticated);/i,
    );
  });

  it("keeps the legacy Yahoo cache revocation postdeploy and fail-closed", () => {
    const migration = readMigration(
      "20260731022805_revoke_legacy_yahoo_read_cache.sql",
    );

    expect(migration).toContain(
      "relation.relname = 'yahoo_nhl_player_map_mat'",
    );
    expect(migration).toContain("relation.relkind = 'm'");
    expect(migration).toContain("'yahoo_nhl_player_map_read'");
    expect(migration).toContain("'yahoo_players_with_normalized_history'");
    expect(migration).toContain(
      "relation.reloptions @> array['security_invoker=true']",
    );
    expect(migration).toContain(
      "revoke all on table public.yahoo_nhl_player_map_mat",
    );
    expect(migration).toContain("from public, anon, authenticated;");
    expect(migration).toContain(
      "grant select on table public.yahoo_nhl_player_map_mat",
    );
    expect(migration).toContain("to service_role;");
    expect(migration).not.toMatch(/\b(?:insert|update|delete|truncate)\b/i);
  });

  it("keeps public view and routine hardening explicit and bounded", () => {
    const migration = readMigration(
      "20260731035012_restrict_admin_metadata_views.sql",
    );

    expect(migration).toContain(
      "'alter view public.%I set (security_invoker = true)'",
    );
    expect(migration).toContain("public.admin__column_catalog");
    expect(migration).toContain("public.player_gamelogs_unified");
    expect(migration).toContain("from public, anon, authenticated;");
    expect(migration).toContain(
      "set search_path = pg_catalog, public, extensions, pg_temp",
    );
    expect(migration).toContain("'upsert_yahoo_players_v3'");
    expect(migration).not.toContain("public.goalie_stats_unified,");
    expect(migration).not.toContain("public.player_stats_unified,");
    expect(migration).not.toContain("public.player_totals_unified,");
  });

  it("keeps canonical aggregate readers public while privatizing materialized storage", () => {
    const migration = readMigration(
      "20260731040341_privatize_unified_materialized_views.sql",
    );

    expect(migration).toContain(
      "create schema internal_stats authorization postgres",
    );
    expect(migration).toContain(
      "alter materialized view public.player_stats_unified",
    );
    expect(migration).toContain("create view public.player_stats_unified");
    expect(migration).toContain("with (security_invoker = true)");
    expect(migration).toContain(
      "refresh materialized view internal_stats.player_stats_unified;",
    );
    expect(migration).toContain("daily-refresh-player-totals-unified-matview");
    expect(migration).toContain("notify pgrst, 'reload schema'");
    expect(migration).not.toContain("grant create on schema internal_stats");
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
        /^\| (Ordered predeploy|Separate repair mutation|Production tracking only after local parity|Postdeploy after reader parity) \| `([^`]+\.sql)` \| `([a-f0-9]{64})` \|$/gm,
      ),
    ].map((match) => ({
      className: match[1],
      fileName: match[2],
      expectedHash: match[3],
    }));
    expect(manifestRows).toHaveLength(19);
    expect(
      manifestRows.filter((row) => row.className === "Ordered predeploy"),
    ).toHaveLength(16);
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
    expect(
      manifestRows.filter(
        (row) => row.className === "Postdeploy after reader parity",
      ),
    ).toHaveLength(1);
    for (const row of manifestRows) {
      const authorityRow = migrationAuthorityRows.find(
        (candidate) => path.basename(candidate.path) === row.fileName,
      );
      expect(authorityRow, row.fileName).toBeDefined();
      expect(authorityRow?.sha256, row.fileName).toBe(row.expectedHash);
      expect(
        createHash("sha256").update(readMigration(row.fileName)).digest("hex"),
        row.fileName,
      ).toBe(row.expectedHash);
    }

    const appliedCount = migrationAuthorityRows.filter(
      (row) => row.deploymentState === "applied",
    ).length;
    const unknownCount = migrationAuthorityRows.filter(
      (row) => row.deploymentState === "unknown",
    ).length;
    expect(summary).toContain(
      `Current canonical migration authority: [\`migration-authority.json\`](../repository-audit-remediation/migration-authority.json) (${migrationAuthorityRows.length} source-authorized records; ${appliedCount} applied by exact Production-ledger receipt; ${unknownCount} deployment state unknown).`,
    );
  });
});
