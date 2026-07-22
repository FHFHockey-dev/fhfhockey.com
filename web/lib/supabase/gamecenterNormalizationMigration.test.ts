import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migrationSql = readFileSync(
  resolve(
    process.cwd(),
    "../supabase/migrations/20260722010355_add_transactional_gamecenter_normalization.sql",
  ),
  "utf8",
);

function functionSql(name: string): string {
  const match = migrationSql.match(
    new RegExp(
      `create or replace function public\\.${name}\\([\\s\\S]*?\\n\\$\\$;`,
      "i",
    ),
  );
  expect(match, `missing ${name}`).toBeDefined();
  return match?.[0] ?? "";
}

describe("transactional Gamecenter normalization migration", () => {
  it("is one bounded additive transaction with service-only forced-RLS state", () => {
    expect(migrationSql.match(/^begin;$/gim)).toHaveLength(1);
    expect(migrationSql.match(/^commit;$/gim)).toHaveLength(1);
    expect(migrationSql).toMatch(/set lock_timeout = '5s';/);
    expect(migrationSql).toMatch(/set statement_timeout = '120s';/);
    expect(migrationSql).toMatch(/reset statement_timeout;\n\ncommit;\s*$/);
    expect(migrationSql).not.toMatch(/\b(?:drop|truncate) table\b/i);
    expect(migrationSql).toContain(
      "create table public.nhl_api_game_normalization_status",
    );
    expect(migrationSql).toContain(
      "alter table public.nhl_api_game_normalization_status force row level security;",
    );
    expect(migrationSql).not.toMatch(
      /create policy[\s\S]*nhl_api_game_normalization_status/i,
    );
    expect(migrationSql).toMatch(
      /revoke all on table public\.nhl_api_game_normalization_status[\s\S]*from public, anon, authenticated, service_role;[\s\S]*grant select, insert, update on table public\.nhl_api_game_normalization_status[\s\S]*to service_role;/,
    );
    expect(migrationSql).toMatch(
      /create index nhl_api_game_normalization_status_coverage_idx[\s\S]*season_id,[\s\S]*status,[\s\S]*parser_fingerprint,[\s\S]*game_id/,
    );
  });

  it("serializes every normalized writer and stales all affected scopes", () => {
    const serializerSql = functionSql(
      "serialize_nhl_api_game_normalization_writes",
    );
    const lockSql = functionSql("lock_nhl_api_game_normalization_scope_write");
    const insertSql = functionSql(
      "invalidate_nhl_api_game_normalization_on_insert",
    );
    const updateSql = functionSql(
      "invalidate_nhl_api_game_normalization_on_update",
    );
    const deleteSql = functionSql(
      "invalidate_nhl_api_game_normalization_on_delete",
    );

    expect(serializerSql).toContain("security invoker");
    expect(serializerSql).toContain("set search_path = ''");
    expect(serializerSql).toContain("'fhfh:normalization-direct-writer'");
    expect(serializerSql).toContain("pg_try_advisory_xact_lock");
    expect(serializerSql).toContain("NHL_NORMALIZATION_WRITER_BUSY");
    expect(serializerSql).not.toMatch(/(?<!try_)pg_advisory_xact_lock/);
    expect(migrationSql.match(/normalization_serialize\n/g)).toHaveLength(4);
    expect(lockSql).toContain("security invoker");
    expect(lockSql).toContain("set search_path = ''");
    expect(lockSql).toContain("'fhfh:projection-game:'");
    expect(lockSql.match(/pg_try_advisory_xact_lock/g)).toHaveLength(3);
    expect(lockSql.match(/NHL_NORMALIZATION_SCOPE_BUSY/g)).toHaveLength(3);
    expect(lockSql).toContain("least(v_old_game_id, v_new_game_id)");
    expect(lockSql).toContain("greatest(v_old_game_id, v_new_game_id)");
    expect(lockSql).toContain("coalesce(v_old_game_id, v_new_game_id)");
    expect(lockSql).not.toMatch(/pg_catalog\.(?:least|greatest|coalesce)/i);
    expect(
      migrationSql.match(
        /normalization_lock\nbefore insert or update or delete on public\.nhl_api_/g,
      ),
    ).toHaveLength(3);
    expect(migrationSql.match(/new table as new_rows/g)).toHaveLength(6);
    expect(migrationSql.match(/old table as old_rows/g)).toHaveLength(6);
    for (const sql of [insertSql, updateSql, deleteSql]) {
      expect(sql).toContain("status = 'stale'");
      expect(sql).toContain("status.status = 'complete'");
    }
    expect(updateSql).toContain("from old_rows as old_scope");
    expect(updateSql).toContain("from new_rows as new_scope");
    expect(
      migrationSql.match(/revoke truncate on table public\.nhl_api_/g),
    ).toHaveLength(3);
  });

  it("locks raw-head changes and rejects identity rekeys", () => {
    const sql = functionSql("invalidate_nhl_api_game_normalization_status");

    expect(sql).toContain("old.game_id is distinct from new.game_id");
    expect(sql).toContain("old.endpoint is distinct from new.endpoint");
    expect(sql).toContain("NHL_RAW_SNAPSHOT_HEAD_IDENTITY_IMMUTABLE");
    expect(sql).toContain("new.endpoint in ('play-by-play', 'shiftcharts')");
    expect(sql).toContain("'fhfh:projection-game:' || new.game_id::text");
    expect(sql.indexOf("pg_try_advisory_xact_lock")).toBeLessThan(
      sql.indexOf("update public.nhl_api_game_normalization_status"),
    );
  });

  it("validates payload shapes before bounded array and byte checks", () => {
    const sql = functionSql("persist_nhl_api_gamecenter_normalized_v1");
    const shapeError = sql.indexOf("INVALID_NHL_NORMALIZATION_PAYLOAD_SHAPE");
    const firstArrayLength = sql.indexOf("jsonb_array_length(p_roster_rows)");
    const rawRosterShape = sql.indexOf(
      "jsonb_typeof(v_pbp_payload->'rosterSpots')",
    );
    const rawRosterLength = sql.indexOf(
      "jsonb_array_length(v_pbp_payload->'rosterSpots')",
    );
    const rawPlayShape = sql.indexOf("jsonb_typeof(v_pbp_payload->'plays')");
    const rawPlayLength = sql.indexOf(
      "jsonb_array_length(v_pbp_payload->'plays')",
    );
    const rawShiftShape = sql.indexOf("jsonb_typeof(v_shift_payload->'data')");
    const rawShiftLength = sql.indexOf(
      "jsonb_array_length(v_shift_payload->'data')",
    );

    expect(sql).toContain("security invoker");
    expect(sql).toContain("set search_path = ''");
    expect(sql).toContain("p_expected_roster_rows not between 0 and 100");
    expect(sql).toContain("p_expected_event_rows not between 0 and 2000");
    expect(sql).toContain("p_expected_shift_rows not between 0 and 20000");
    expect(sql).toContain("pg_catalog.pg_column_size(p_roster_rows)");
    expect(shapeError).toBeGreaterThanOrEqual(0);
    expect(firstArrayLength).toBeGreaterThan(shapeError);
    expect(rawRosterShape).toBeLessThan(rawRosterLength);
    expect(rawPlayShape).toBeLessThan(rawPlayLength);
    expect(rawShiftShape).toBeLessThan(rawShiftLength);
    expect(sql.slice(rawPlayShape, rawRosterLength)).toContain(
      "NHL_NORMALIZATION_PBP_HEAD_MISMATCH",
    );
    expect(sql.slice(rawShiftShape, rawShiftLength)).toContain(
      "NHL_NORMALIZATION_SHIFT_HEAD_MISMATCH",
    );
  });

  it("binds exact rows to the current immutable raw heads and stable fingerprints", () => {
    const sql = functionSql("persist_nhl_api_gamecenter_normalized_v1");

    expect(sql).toContain("for update of head");
    expect(sql).toContain("NHL_NORMALIZATION_PBP_HEAD_MISMATCH");
    expect(sql).toContain("NHL_NORMALIZATION_SHIFT_HEAD_MISMATCH");
    expect(sql).toContain("NHL_NORMALIZATION_CAS_MISMATCH");
    expect(sql).toContain("v_pbp_raw_payload_id::text");
    expect(sql).toContain("v_pbp_raw_snapshot_version::text");
    expect(sql).toContain("v_shift_raw_payload_id::text");
    expect(sql).toContain("v_shift_raw_snapshot_version::text");
    expect(sql.match(/- 'created_at' - 'updated_at'/g)).toHaveLength(6);
    expect(sql).toContain("order by incoming.player_id");
    expect(sql).toContain("order by incoming.event_id");
    expect(sql).toContain("order by incoming.shift_id");
  });

  it("requires exact manifest and physical state before no-DML replay", () => {
    const sql = functionSql("persist_nhl_api_gamecenter_normalized_v1");

    for (const condition of [
      "v_current.season_id = p_season_id",
      "v_current.game_date = p_game_date",
      "v_current.parser_version = p_parser_version",
      "v_current.strength_version = p_strength_version",
      "v_current.materializer_version = p_materializer_version",
      "v_current.expected_roster_rows = p_expected_roster_rows",
      "v_current.observed_roster_rows = v_observed_roster_count",
      "v_current.expected_event_rows = p_expected_event_rows",
      "v_current.observed_event_rows = v_observed_event_count",
      "v_current.expected_shift_rows = p_expected_shift_rows",
      "v_current.observed_shift_rows = v_observed_shift_count",
      "v_existing_roster_fingerprint = v_roster_fingerprint",
      "v_existing_event_fingerprint = v_event_fingerprint",
      "v_existing_shift_fingerprint = v_shift_fingerprint",
    ]) {
      expect(sql).toContain(condition);
    }
    expect(sql.indexOf("NHL_NORMALIZATION_VERSION_EXHAUSTED")).toBeLessThan(
      sql.indexOf("into v_pruned_roster_count"),
    );
  });

  it("exact-replaces all three scopes with qualified targets and writes status last", () => {
    const sql = functionSql("persist_nhl_api_gamecenter_normalized_v1");
    const pbpInsertColumns = sql.match(
      /insert into public\.nhl_api_pbp_events \(([\s\S]*?)\n  \)\n  select/,
    )?.[1];

    expect(
      sql.match(/delete from public\.nhl_api_[^\n]+ as existing/g),
    ).toHaveLength(3);
    expect(
      sql.match(
        /delete from public\.nhl_api_(?:game_roster_spots|pbp_events|shift_rows) as existing\n  where existing\.game_id = p_game_id;/g,
      ),
    ).toHaveLength(3);
    expect(sql).not.toMatch(
      /delete from public\.nhl_api_(?:game_roster_spots|pbp_events|shift_rows)\s+where game_id = p_game_id;/,
    );
    expect(pbpInsertColumns).toBeDefined();
    expect(pbpInsertColumns?.match(/\braw_event\b/g)).toHaveLength(1);
    expect(
      sql.indexOf("insert into public.nhl_api_game_normalization_status"),
    ).toBeGreaterThan(sql.indexOf("insert into public.nhl_api_shift_rows"));
    expect(sql).toContain(
      "on conflict on constraint nhl_api_game_normalization_status_pkey",
    );
    expect(sql).not.toMatch(/on conflict \([^)]*\)/);
  });

  it("exposes only the validated writer to service_role", () => {
    expect(migrationSql).toMatch(
      /revoke all on function public\.persist_nhl_api_gamecenter_normalized_v1\([\s\S]*?from public, anon, authenticated;[\s\S]*?grant execute on function public\.persist_nhl_api_gamecenter_normalized_v1\([\s\S]*?to service_role;/,
    );
    expect(migrationSql).not.toMatch(/security definer/i);
  });
});
