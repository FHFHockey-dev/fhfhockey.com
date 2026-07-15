import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  process.cwd(),
  "../supabase/migrations/20260715015300_add_transactional_game_stats_manifest.sql",
);
const migrationSql = readFileSync(migrationPath, "utf8");

describe("transactional game-stat manifest migration", () => {
  it("adds a fail-closed versioned status state machine without destructive table operations", () => {
    expect(migrationSql).not.toMatch(/\b(drop table|truncate table)\b/i);
    expect(migrationSql).toContain("set lock_timeout = '5s'");
    expect(migrationSql).toContain("set statement_timeout = '120s'");
    expect(migrationSql).toContain("reset lock_timeout;");
    expect(migrationSql).toContain("reset statement_timeout;");
    expect(migrationSql).toContain('alter table public."statsUpdateStatus"');
    expect(migrationSql).toContain(
      "outcome = case when updated then 'legacy_unverified' else 'pending' end",
    );
    expect(migrationSql).toContain(
      "contract_version = case when updated then 0 else 1 end",
    );
    expect(migrationSql).toContain(
      "alter column outcome set default 'pending'",
    );
    expect(migrationSql).toContain(
      "add constraint stats_update_status_manifest_state_check check",
    );
    expect(migrationSql).toContain(") is true);");
    expect(migrationSql).toMatch(
      /outcome = 'complete'[\s\S]*expected_team_rows = 2[\s\S]*expected_skater_rows between 1 and 100[\s\S]*expected_goalie_rows between 1 and 100/,
    );
    expect(migrationSql).toMatch(
      /outcome = 'quarantined'[\s\S]*reason = 'game_not_finished'[\s\S]*expected_team_rows = 0[\s\S]*expected_skater_rows = 0[\s\S]*expected_goalie_rows = 0/,
    );
  });

  it("makes complete persistence one locked all-table transaction with exact recounts", () => {
    const persistenceFunction = migrationSql.match(
      /create or replace function public\.persist_complete_game_stats_v1\([\s\S]*?\n\$\$;/,
    )?.[0];

    expect(persistenceFunction).toBeDefined();
    expect(persistenceFunction).toContain("security invoker");
    expect(persistenceFunction).toContain("set search_path = ''");
    expect(persistenceFunction).toContain("pg_catalog.pg_advisory_xact_lock");
    expect(persistenceFunction).not.toContain("pg_catalog.coalesce");
    expect(
      persistenceFunction?.match(/pg_catalog\.bool_and\(\s*coalesce\(/g),
    ).toHaveLength(3);
    expect(persistenceFunction?.match(/\bcoalesce\(/g)).toHaveLength(6);
    expect(persistenceFunction).toContain('insert into public."teamGameStats"');
    expect(persistenceFunction).toContain(
      'insert into public."skatersGameStats"',
    );
    expect(persistenceFunction).toContain(
      'insert into public."goaliesGameStats"',
    );
    expect(persistenceFunction).toContain(
      'delete from public."teamGameStats" as existing',
    );
    expect(persistenceFunction).toContain(
      'delete from public."skatersGameStats" as existing',
    );
    expect(persistenceFunction).toContain(
      'delete from public."goaliesGameStats" as existing',
    );
    expect(persistenceFunction).toContain("GAME_STATS_CARDINALITY_MISMATCH");
    expect(persistenceFunction).toContain(
      'insert into public."statsUpdateStatus"',
    );
    expect(
      persistenceFunction?.indexOf("GAME_STATS_CARDINALITY_MISMATCH"),
    ).toBeLessThan(
      persistenceFunction?.indexOf('insert into public."statsUpdateStatus"') ??
        -1,
    );
  });

  it("refuses partial-data quarantine and bounds it to exact stale games", () => {
    const quarantineFunction = migrationSql.match(
      /create or replace function public\.quarantine_game_stats_v1\([\s\S]*?\n\$\$;/,
    )?.[0];

    expect(quarantineFunction).toBeDefined();
    expect(quarantineFunction).toContain("security invoker");
    expect(quarantineFunction).toContain("set search_path = ''");
    expect(quarantineFunction).toContain(
      "pg_catalog.cardinality(p_game_ids) not between 1 and 10",
    );
    expect(quarantineFunction).toContain(
      "GAME_STATS_QUARANTINE_PARTIAL_DATA_PRESENT",
    );
    expect(quarantineFunction).toContain('from public."teamGameStats"');
    expect(quarantineFunction).toContain('from public."skatersGameStats"');
    expect(quarantineFunction).toContain('from public."goaliesGameStats"');
    expect(quarantineFunction).toContain(
      'update public."statsUpdateStatus" as status',
    );
    expect(quarantineFunction).toContain(
      "GAME_STATS_QUARANTINE_STATUS_NOT_PENDING",
    );
    expect(quarantineFunction?.indexOf("PARTIAL_DATA_PRESENT")).toBeLessThan(
      quarantineFunction?.indexOf('update public."statsUpdateStatus"') ?? -1,
    );
  });

  it("uses service-role-only empty-search-path RPCs and hardens legacy discovery", () => {
    for (const functionName of [
      "persist_complete_game_stats_v1",
      "quarantine_game_stats_v1",
      "get_unupdated_games",
    ]) {
      expect(migrationSql).toContain(
        `create or replace function public.${functionName}`,
      );
      expect(migrationSql).toMatch(
        new RegExp(
          `revoke all on function public\\.${functionName}\\([\\s\\S]*?from public, anon, authenticated;`,
        ),
      );
      expect(migrationSql).toMatch(
        new RegExp(
          `grant execute on function public\\.${functionName}\\([\\s\\S]*?to service_role;`,
        ),
      );
    }

    const discoveryFunction = migrationSql.match(
      /create or replace function public\.get_unupdated_games\(\)[\s\S]*?\n\$\$;/,
    )?.[0];
    expect(discoveryFunction).toContain("security invoker");
    expect(discoveryFunction).toContain("set search_path = ''");
    expect(discoveryFunction).toContain('join public."statsUpdateStatus"');
    expect(discoveryFunction).toContain("status.outcome = 'pending'");
  });

  it("adds the missing goalie game access path", () => {
    expect(migrationSql).toContain(
      "create index if not exists idx_goaliesgamestats_gameid",
    );
    expect(migrationSql).toContain('on public."goaliesGameStats" ("gameId")');
  });
});
