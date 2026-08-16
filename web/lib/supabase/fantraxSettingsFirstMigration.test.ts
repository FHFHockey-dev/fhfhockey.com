import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationSql = readFileSync(
  resolve(
    process.cwd(),
    "../supabase/migrations/20260814192101_fantrax_settings_first.sql",
  ),
  "utf8",
);

const serviceRpcs = [
  "commit_fantrax_connection_secure",
  "apply_fantrax_settings_secure",
  "disconnect_fantrax_account_secure",
] as const;

describe("Fantrax settings-first migration", () => {
  it("splits goalie scoring without removing shared workload values", () => {
    expect(migrationSql).toContain(
      "add column if not exists goalie_scoring_categories jsonb not null",
    );
    expect(migrationSql).toContain(
      "add column if not exists team_count integer not null default 12",
    );
    expect(migrationSql).toContain(
      "add column if not exists draft_order_type text not null default 'snake'",
    );
    expect(migrationSql).toContain("'GAMES_PLAYED', scoring_categories -> 'GAMES_PLAYED'");
    expect(migrationSql).toContain("'TOTAL_TOI', scoring_categories -> 'TOTAL_TOI'");

    const removedKeys = migrationSql.match(
      /scoring_categories = scoring_categories - array\[([\s\S]*?)\]::text\[\]/,
    )?.[1];
    expect(removedKeys).toBeTruthy();
    expect(removedKeys).not.toContain("GAMES_PLAYED");
    expect(removedKeys).not.toContain("TOTAL_TOI");
    expect(removedKeys).toContain("WINS_GOALIE");
  });

  it("keeps credentials in the existing private token mechanism", () => {
    expect(migrationSql).toContain(
      "from public.get_connected_account_tokens_secure(v_candidate.id, p_user_id)",
    );
    expect(migrationSql).toContain(
      "perform public.upsert_connected_account_tokens_secure(",
    );
    expect(migrationSql).toContain("'fantrax_user_secret_id'");
    expect(migrationSql).not.toMatch(
      /alter table public\.connected_accounts[\s\S]*?add column[^;]*(?:secret|token)/i,
    );
  });

  it("serializes identity changes and preserves manual provenance", () => {
    expect(migrationSql).toContain("pg_catalog.pg_advisory_xact_lock(");
    expect(migrationSql).toContain("'fantrax-link:' || p_user_id::text");
    expect(migrationSql).toContain("'manual_snapshot'");
    expect(migrationSql).toContain("'[\"manual_import\", \"api\"]'::jsonb");
    expect(migrationSql).toContain("'[\"manual_import\"]'::jsonb");
    expect(migrationSql).toContain("delete from public.provider_sync_runs");
  });

  it("applies only current, acknowledged, owner-scoped settings", () => {
    for (const errorCode of [
      "FANTRAX_SETTINGS_STALE",
      "FANTRAX_SETTINGS_UNSUPPORTED",
      "FANTRAX_WARNINGS_UNACKNOWLEDGED",
      "FANTRAX_TEAM_NOT_FOUND",
    ]) {
      expect(migrationSql).toContain(errorCode);
    }
    expect(migrationSql).toContain("and league.user_id = p_user_id");
    expect(migrationSql).toContain("and team.user_id = p_user_id");
    expect(migrationSql).toContain("'connected_account_id', v_league.connected_account_id");
    expect(migrationSql).toContain("'applied_settings_hash', p_settings_hash");
    expect(migrationSql).toContain("'applied_at', statement_timestamp()");
    expect(migrationSql).toContain(
      "roster_config = coalesce(v_roster_config, public.user_settings.roster_config)",
    );
    expect(migrationSql).toContain(
      `'{"C":0,"LW":0,"RW":0,"D":0,"G":0,"bench":0,"utility":0}'::jsonb`,
    );
  });

  it("exposes the transactional RPCs only to the service role", () => {
    for (const rpc of serviceRpcs) {
      expect(migrationSql).toContain(`create or replace function public.${rpc}(`);
      expect(migrationSql).toMatch(
        new RegExp(
          `create or replace function public\\.${rpc}\\([\\s\\S]*?security definer[\\s\\S]*?set search_path = ''`,
        ),
      );
      expect(migrationSql).toMatch(
        new RegExp(
          `revoke all on function public\\.${rpc}\\([^;]+from public, anon, authenticated;`,
        ),
      );
      expect(migrationSql).toMatch(
        new RegExp(
          `grant execute on function public\\.${rpc}\\([^;]+to service_role;`,
        ),
      );
    }
  });
});
