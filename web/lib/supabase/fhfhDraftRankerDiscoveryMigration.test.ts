import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const migrationPath = path.resolve(
  process.cwd(),
  "../supabase/migrations/20260715055259_create_draft_ranker_discovery_materialization.sql",
);
const migrationSql = fs.readFileSync(migrationPath, "utf8");

describe("DR-051 discovery materialization migration", () => {
  it("creates only rebuildable discovery-owned tables", () => {
    for (const table of [
      "draft_ranker_discovery_refresh_runs",
      "draft_ranker_discovery_source_health",
      "draft_ranker_discovery_projection_consensus",
      "draft_ranker_discovery_signals",
    ]) {
      expect(migrationSql).toContain(`create table public.${table}`);
      expect(migrationSql).toContain(`alter table public.${table} enable row level security`);
      expect(migrationSql).toContain(
        `revoke all on public.${table} from public, anon, authenticated`,
      );
      expect(migrationSql).toContain(`grant all on public.${table} to service_role`);
    }
  });

  it("keeps the atomic replace RPC service-only and payload-idempotent", () => {
    expect(migrationSql).toContain(
      "create or replace function public.replace_draft_ranker_discovery_snapshot",
    );
    expect(migrationSql).toContain("security invoker");
    expect(migrationSql).toContain("set search_path = pg_catalog, public");
    expect(migrationSql).toContain("operation_payload_hash");
    expect(migrationSql).toContain("idempotency_conflict");
    expect(migrationSql).toContain("pg_advisory_xact_lock");
    expect(migrationSql).toContain("to service_role");
    expect(migrationSql).toContain("from public, anon, authenticated");
  });

  it("stores freshness, reasons, thresholds, and source evidence", () => {
    expect(migrationSql).toContain("source_observed_at timestamptz");
    expect(migrationSql).toContain("expires_at timestamptz");
    expect(migrationSql).toContain("reason_code text not null");
    expect(migrationSql).toContain("source_keys text[] not null");
    expect(migrationSql).toContain("algorithm_version text not null");
    expect(migrationSql).toContain("jsonb_typeof(evidence) = 'object'");
    expect(migrationSql).toContain("status = 'completed'");
  });

  it("does not mutate any upstream source table", () => {
    for (const table of [
      "yahoo_players",
      "nhl_api_game_roster_spots",
      "nhl_player_contracts",
      "player_lineup_deployment_tallies",
      "forge_roster_events",
    ]) {
      expect(migrationSql).not.toMatch(
        new RegExp(`(?:update|delete\\s+from|alter\\s+table)\\s+public\\.${table}`, "i"),
      );
    }
    expect(migrationSql).not.toMatch(
      /(?:update|delete\s+from|alter\s+table)\s+public\."PROJECTIONS_/iu,
    );
  });
});
