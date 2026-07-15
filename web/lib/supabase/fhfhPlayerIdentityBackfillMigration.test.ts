import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationSql = readFileSync(
  resolve(
    process.cwd(),
    "../supabase/migrations/20260714224230_backfill_fhfh_nhl_player_identities.sql",
  ),
  "utf8",
);

describe("FHFH NHL identity backfill migration", () => {
  it("uses the existing NHL primary key and never treats names as identity keys", () => {
    expect(migrationSql).toContain("p.id,");
    expect(migrationSql).toContain(
      "on conflict (nhl_player_id) where nhl_player_id is not null",
    );
    expect(migrationSql).not.toMatch(/join\s+public\.players[^;]+canonical_name/i);
    expect(migrationSql).not.toMatch(/on conflict\s*\(\s*canonical_name\s*\)/i);
  });

  it("is rerunnable for identities, NHL mappings, aliases, and roster history", () => {
    expect(migrationSql.match(/on conflict/g)).toHaveLength(3);
    expect(migrationSql).toContain("where not exists (");
    expect(migrationSql).toContain(
      "on conflict (provider, context_key, external_player_id)",
    );
    expect(migrationSql).toContain(
      "on conflict (fhfh_player_id, normalized_alias, source)",
    );
  });

  it("only verifies deterministic NHL-ID mappings", () => {
    expect(migrationSql).toContain("'canonical_players_primary_key'");
    expect(migrationSql).toContain("identity.nhl_player_id::text");
    expect(migrationSql).not.toMatch(/yahoo_nhl_player_map|yahoo_players/i);
    expect(migrationSql).not.toMatch(/fuzzy|similarity|trigram/i);
  });

  it("derives active status and current organization from the latest roster season", () => {
    expect(migrationSql).toContain('select max("seasonId") as season_id');
    expect(migrationSql).toContain("where r.is_current");
    expect(migrationSql).toContain(
      "case when roster.\"teamId\" is not null then 'active_nhl' else 'inactive' end",
    );
    expect(migrationSql).toContain(
      "r.is_current and r.\"seasonId\" = latest.season_id as is_current",
    );
  });
});
