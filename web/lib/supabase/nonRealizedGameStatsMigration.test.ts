import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  process.cwd(),
  "../supabase/migrations/20260715155738_add_non_realized_game_stats_and_season_selector.sql",
);
const migrationSql = readFileSync(migrationPath, "utf8");

describe("non-realized game-stat migration", () => {
  it("additively extends the manifest state without destructive table operations", () => {
    expect(migrationSql).not.toMatch(/\b(drop table|truncate table)\b/i);
    expect(migrationSql).toContain("set lock_timeout = '5s'");
    expect(migrationSql).toContain("set statement_timeout = '120s'");
    expect(migrationSql).toContain(
      "add constraint stats_update_status_manifest_state_check_v2",
    );
    expect(migrationSql).toContain(") is true) not valid;");
    expect(migrationSql).toContain(
      "validate constraint stats_update_status_manifest_state_check_v2",
    );
    expect(migrationSql).toContain(
      "reason in ('game_not_finished', 'schedule_not_realized')",
    );
    expect(migrationSql).toContain("reset lock_timeout;");
    expect(migrationSql).toContain("reset statement_timeout;");
  });

  it("terminalizes one pending seven-day-old zero-stat row under the shared lock", () => {
    const terminalFunction = migrationSql.match(
      /create or replace function public\.finalize_non_realized_game_stats_v1\([\s\S]*?\n\$\$;/,
    )?.[0];

    expect(terminalFunction).toBeDefined();
    expect(terminalFunction).toContain("security invoker");
    expect(terminalFunction).toContain("set search_path = ''");
    expect(terminalFunction).toContain("pg_catalog.pg_advisory_xact_lock");
    expect(terminalFunction).toContain("pg_catalog.make_interval(days => 7)");
    expect(terminalFunction).toContain('from public."teamGameStats"');
    expect(terminalFunction).toContain('from public."skatersGameStats"');
    expect(terminalFunction).toContain('from public."goaliesGameStats"');
    expect(terminalFunction).toContain("status.outcome = 'pending'");
    expect(terminalFunction).toContain("status.updated = false");
    expect(terminalFunction).toContain("v_status_count <> 1");
    expect(terminalFunction).toContain("'schedule_not_realized'::text");
  });

  it("adds unique service-role-only RPCs with empty search paths", () => {
    for (const [functionName, signature] of [
      ["finalize_non_realized_game_stats_v1", "bigint"],
      ["get_unupdated_games_for_season", "bigint"],
    ]) {
      expect(migrationSql).toContain(
        `create or replace function public.${functionName}`,
      );
      expect(migrationSql).toMatch(
        new RegExp(
          `revoke all on function public\\.${functionName}\\(${signature}\\)[\\s\\S]*?from public, anon, authenticated;`,
        ),
      );
      expect(migrationSql).toMatch(
        new RegExp(
          `grant execute on function public\\.${functionName}\\(${signature}\\)[\\s\\S]*?to service_role;`,
        ),
      );
    }
  });

  it("bounds routine discovery by season while preserving historical discovery", () => {
    const selector = migrationSql.match(
      /create or replace function public\.get_unupdated_games_for_season\([\s\S]*?\n\$\$;/,
    )?.[0];

    expect(selector).toBeDefined();
    expect(selector).toContain("security invoker");
    expect(selector).toContain("set search_path = ''");
    expect(selector).toContain('games."seasonId" = p_season_id');
    expect(selector).toContain("status.outcome = 'pending'");
    expect(selector).toContain("status.updated = false");
    expect(selector).toContain("status.contract_version = 1");
    expect(migrationSql).not.toContain(
      "create or replace function public.get_unupdated_games()",
    );
  });
});
