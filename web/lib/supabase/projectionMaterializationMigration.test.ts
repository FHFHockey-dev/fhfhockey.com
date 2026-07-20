import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  process.cwd(),
  "../supabase/migrations/20260720105524_add_projection_materialization_transactions.sql",
);
const migrationSql = readFileSync(migrationPath, "utf8");

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

describe("projection materialization transaction migration", () => {
  it("is additive, bounded, and creates service-only RLS state", () => {
    expect(migrationSql).not.toMatch(/\b(drop table|truncate table)\b/i);
    expect(migrationSql).toMatch(/\nbegin;\n\nset lock_timeout = '5s';/);
    expect(migrationSql).toContain("set lock_timeout = '5s'");
    expect(migrationSql).toContain("set statement_timeout = '120s'");
    expect(migrationSql).toContain("reset lock_timeout;");
    expect(migrationSql).toContain("reset statement_timeout;");
    expect(migrationSql).toMatch(/reset statement_timeout;\n\ncommit;\s*$/);

    const transactionStart = migrationSql.indexOf("\nbegin;\n");
    const rawWriteLock = migrationSql.indexOf(
      "lock table public.nhl_api_game_payloads_raw in share row exclusive mode",
    );
    const transactionCommit = migrationSql.lastIndexOf("\ncommit;");
    expect(transactionStart).toBeGreaterThanOrEqual(0);
    expect(rawWriteLock).toBeGreaterThan(transactionStart);
    expect(transactionCommit).toBeGreaterThan(rawWriteLock);

    for (const tableName of [
      "nhl_api_game_payload_snapshot_heads",
      "projection_game_materialization_status",
      "projection_pipeline_state",
    ]) {
      expect(migrationSql).toContain(`create table public.${tableName}`);
      expect(migrationSql).toContain(
        `alter table public.${tableName}\n  enable row level security;`,
      );
      expect(migrationSql).toContain(
        `alter table public.${tableName}\n  force row level security;`,
      );
      expect(migrationSql).toMatch(
        new RegExp(
          `revoke all on table public\\.${tableName}[\\s\\S]*?from public, anon, authenticated, service_role;[\\s\\S]*?grant select, insert, update on table public\\.${tableName}[\\s\\S]*?to service_role;`,
        ),
      );
      expect(migrationSql).toMatch(
        new RegExp(
          `grant select, insert, update on table public\\.${tableName}[\\s\\S]*?to service_role;`,
        ),
      );
    }

    expect(migrationSql).not.toMatch(/create policy/i);
    expect(migrationSql).not.toMatch(/security definer/i);
    expect(migrationSql).toContain(
      "relationship_input_fingerprint = input_fingerprint",
    );
    expect(migrationSql).toContain(
      "derived_input_fingerprint = input_fingerprint",
    );
    expect(migrationSql).toContain("goalie_justification text");
    expect(migrationSql).toContain(
      "lock table public.nhl_api_game_payloads_raw in share row exclusive mode",
    );
    expect(migrationSql).toContain(
      "revoke update, delete, truncate on table public.nhl_api_game_payloads_raw",
    );
  });

  it("versions immutable raw endpoint heads and captures exact PBP/shift identities", () => {
    const captureSql = functionSql(
      "capture_projection_raw_source_snapshots_v1",
    );
    const lockTriggerSql = functionSql(
      "lock_nhl_api_game_payload_snapshot_insert",
    );

    expect(migrationSql).toContain(
      "create trigger nhl_api_game_payloads_raw_projection_lock",
    );
    expect(migrationSql).toContain(
      "create trigger nhl_api_game_payloads_raw_advance_snapshot_head",
    );
    expect(migrationSql).toContain(
      "create trigger nhl_api_game_payloads_raw_no_delete",
    );
    expect(lockTriggerSql).toContain(
      "'fhfh:projection-game:' || new.game_id::text",
    );
    expect(lockTriggerSql).toContain(
      "v_head.raw_payload_id is distinct from v_existing_raw.id",
    );
    expect(lockTriggerSql).toContain(
      "snapshot_version = head.snapshot_version + 1",
    );
    expect(captureSql).toContain("p_pbp_payload_hash text");
    expect(captureSql).toContain("p_shift_payload_hash text");
    expect(captureSql).toContain('"gameId" bigint');
    expect(
      captureSql.match(
        /on conflict on constraint\s+nhl_api_game_payloads_raw_game_id_endpoint_payload_hash_key\s+do nothing/g,
      ),
    ).toHaveLength(2);
    expect(captureSql).not.toContain(
      "on conflict (game_id, endpoint, payload_hash) do nothing",
    );
    expect(captureSql).toContain("PROJECTION_RAW_PBP_HASH_COLLISION");
    expect(captureSql).toContain("PROJECTION_RAW_SHIFT_HASH_COLLISION");
    expect(captureSql).toContain("PROJECTION_RAW_SNAPSHOT_NOT_CURRENT");
    expect(migrationSql).toMatch(
      /create index nhl_api_game_payload_snapshot_heads_raw_payload_idx\s+on public\.nhl_api_game_payload_snapshot_heads \(\s*raw_payload_id,\s*game_id,\s*endpoint,\s*payload_hash\s*\);/,
    );
    expect(migrationSql).toContain(
      "nhl_api_game_payloads_raw_snapshot_identity_idx",
    );
    expect(migrationSql).toContain("nhl_raw_snapshot_head_exact_payload_fkey");
    expect(migrationSql).toContain(
      "projection_materialization_pbp_raw_payload_idx",
    );
    expect(migrationSql).toContain(
      "projection_materialization_shift_raw_payload_idx",
    );
  });

  it("persists exact PBP and strength input snapshots under one CAS lock", () => {
    const sql = functionSql("persist_projection_game_inputs_v1");
    const gameRecordColumns = sql.match(
      /jsonb_to_record\(p_game_row\) as incoming\(([\s\S]*?)\n  \);/,
    )?.[1];
    const pbpInsertColumns = sql.match(
      /insert into public\.pbp_plays \(([\s\S]*?)\n  \)\n  select/,
    )?.[1];

    expect(sql).toContain("security invoker");
    expect(sql).toContain("set search_path = ''");
    expect(sql).toContain("set lock_timeout = '5s'");
    expect(sql).toContain("set statement_timeout = '60s'");
    expect(sql).toMatch(
      /p_expected_current_input_fingerprint text,\s+p_input_fingerprint text,/,
    );
    expect(sql).toContain("p_expected_play_rows not between 1 and 1000");
    expect(sql).toContain("p_expected_strength_rows not between 1 and 100");
    expect(sql).toContain("v_strength_team_count <> 2");
    expect(sql).toContain("v_terminal_event_count <> 1");
    expect(sql).toContain("PROJECTION_INPUT_CAS_ABSENT");
    expect(sql).toContain("PROJECTION_INPUT_CAS_MISMATCH");
    expect(sql).toContain("PROJECTION_INPUT_FINGERPRINT_COLLISION");
    expect(sql).toContain("p_pbp_raw_payload_id bigint");
    expect(sql).toContain("p_shift_raw_payload_id bigint");
    expect(sql).toContain("PROJECTION_INPUT_RAW_SNAPSHOT_CAS_MISMATCH");
    expect(sql).toContain(
      "v_current.pbp_raw_payload_id is not distinct from p_pbp_raw_payload_id",
    );
    expect(sql).toContain("'fhfh:projection-game:' || p_game_id::text");
    expect(sql).toContain("delete from public.pbp_plays as existing");
    expect(sql).toContain("insert into public.pbp_games");
    expect(sql).toContain("insert into public.pbp_plays");
    expect(sql).toContain("update public.shift_charts as existing");
    expect(sql).toContain("total_es_toi = null");
    expect(sql).toContain("on conflict on constraint unique_shift");
    expect(sql).toContain("on conflict on constraint pbp_games_pkey");
    expect(sql).not.toMatch(/on conflict \([^)]*\)/);
    expect(sql).toContain("delete from public.forge_player_game_strength");
    expect(sql).toContain("delete from public.forge_team_game_strength");
    expect(sql).toContain("delete from public.forge_goalie_game");
    expect(sql).toContain("relationship_status = case");
    expect(sql).toContain("derived_status = case");
    expect(sql).toContain("if not v_idempotent then");
    expect(sql).toMatch(
      /delete from public\.shift_charts as existing[\s\S]*existing\.total_es_toi is null[\s\S]*existing\.shift_numbers is null[\s\S]*existing\.es_shifts is null/,
    );
    expect(sql).toContain("PROJECTION_INPUT_CARDINALITY_MISMATCH");
    expect(gameRecordColumns).toBeDefined();
    expect(gameRecordColumns?.match(/\bawayteamname\b/g)).toHaveLength(1);
    expect(pbpInsertColumns).toBeDefined();
    expect(pbpInsertColumns?.match(/\bycoord\b/g)).toHaveLength(1);
  });

  it("exact-replaces relationship ownership without touching strength totals", () => {
    const sql = functionSql("persist_shift_chart_relationships_v1");

    expect(sql).toContain("security invoker");
    expect(sql).toContain("set search_path = ''");
    expect(sql).toContain("'fhfh:projection-game:' || p_game_id::text");
    expect(sql).toContain("SHIFT_RELATIONSHIP_INPUT_CAS_MISMATCH");
    expect(sql).toContain("SHIFT_RELATIONSHIP_RAW_SNAPSHOT_STALE");
    expect(sql).toContain("p_expected_input_version bigint");
    expect(sql).toContain("status.input_version = p_expected_input_version");
    expect(sql).toContain("SHIFT_RELATIONSHIP_FINGERPRINT_COLLISION");
    expect(sql).toContain("v_distinct_team_count <> 2");
    expect(sql).toContain("shift_numbers = null");
    expect(sql).toContain("time_spent_with = null");
    expect(sql).toContain("shifts = null");
    expect(sql).not.toMatch(/total_(?:es|pp|pk)_toi\s*=/);
    expect(sql).toContain("insert into public.shift_charts");
    expect(sql).toMatch(
      /delete from public\.shift_charts as existing[\s\S]*existing\.total_es_toi is null[\s\S]*existing\.total_pp_toi is null[\s\S]*existing\.total_pk_toi is null[\s\S]*existing\.shifts is null/,
    );
    expect(sql).toContain(
      "relationship_input_fingerprint = status.input_fingerprint",
    );
    expect(sql).toContain("SHIFT_RELATIONSHIP_CARDINALITY_MISMATCH");
    expect(sql).toContain(
      "v_current.observed_relationship_rows = p_expected_rows",
    );
    expect(sql).toContain(
      "and v_existing_relationship_count = p_expected_rows",
    );
    expect(sql).toContain("and v_rows_match");
    expect(sql).toMatch(
      /if v_idempotent then[\s\S]*v_completed_at := v_current\.relationship_completed_at;[\s\S]*true,[\s\S]*v_completed_at;[\s\S]*return;/,
    );
  });

  it("atomically replaces player, team, and justified goalie derived scopes", () => {
    const sql = functionSql("persist_projection_game_derived_v1");

    expect(sql).toContain("security invoker");
    expect(sql).toContain("set search_path = ''");
    expect(sql).toContain("'fhfh:projection-game:' || p_game_id::text");
    expect(sql).toContain("PROJECTION_DERIVED_INPUT_CAS_MISMATCH");
    expect(sql).toContain("PROJECTION_DERIVED_RAW_SNAPSHOT_STALE");
    expect(sql).toContain(
      "v_current.input_version <> p_expected_input_version",
    );
    expect(sql).toContain("v_current.relationship_status <> 'complete'");
    expect(sql).toContain(
      "v_current.relationship_input_fingerprint is distinct from v_current.input_fingerprint",
    );
    expect(sql).toContain("v_current.relationship_version <= 0");
    expect(sql).toContain(
      "pg_catalog.btrim(v_current.relationship_algorithm_version) = ''",
    );
    expect(sql).toContain(
      "v_current.observed_relationship_rows is distinct from v_current.expected_relationship_rows",
    );
    expect(sql).toContain("PROJECTION_DERIVED_RELATIONSHIP_NOT_COMPLETE");
    expect(sql).toContain("PROJECTION_DERIVED_FINGERPRINT_COLLISION");
    expect(sql).toContain("p_expected_player_rows not between 1 and 100");
    expect(sql).toContain("p_expected_team_rows is distinct from 2");
    expect(sql).toContain("p_expected_goalie_rows not between 1 and 4");
    expect(sql).toContain("completed_pbp_contains_no_countable_shot_events");
    expect(sql).toContain("completed_pbp_countable_events_are_all_empty_net");
    expect(sql).toContain("PROJECTION_DERIVED_GOALIE_JUSTIFICATION_MISMATCH");
    expect(sql).toContain("PROJECTION_DERIVED_GOALIE_EVIDENCE_MISMATCH");
    expect(sql).toMatch(
      /select distinct play\.goalieinnetid as goalie_id[\s\S]*where not exists \([\s\S]*incoming\.goalie_id = observed\.goalie_id/,
    );
    expect(sql).toContain(
      "v_current.expected_player_rows = p_expected_player_rows",
    );
    expect(sql).toContain(
      "v_current.observed_player_rows = p_expected_player_rows",
    );
    expect(sql).toContain("v_existing_team_count = p_expected_team_rows");
    expect(sql).toContain("v_existing_goalie_count = p_expected_goalie_rows");
    expect(sql).toContain("and v_player_rows_match");
    expect(sql).toContain("and v_team_rows_match");
    expect(sql).toContain("and v_goalie_rows_match");
    expect(sql).toMatch(
      /if v_idempotent then[\s\S]*v_completed_at := v_current\.derived_completed_at;[\s\S]*true,[\s\S]*v_completed_at;[\s\S]*return;/,
    );
    expect(
      sql.indexOf("v_current.relationship_status <> 'complete'"),
    ).toBeLessThan(
      sql.indexOf("insert into public.forge_player_game_strength"),
    );
    expect(
      sql.indexOf("v_current.relationship_status <> 'complete'"),
    ).toBeLessThan(
      sql.indexOf("delete from public.forge_player_game_strength"),
    );

    for (const tableName of [
      "forge_player_game_strength",
      "forge_team_game_strength",
      "forge_goalie_game",
    ]) {
      expect(sql).toContain(`insert into public.${tableName}`);
      expect(sql).toContain(`delete from public.${tableName} as existing`);
    }

    expect(sql).toContain(
      "derived_input_fingerprint = status.input_fingerprint",
    );
    expect(sql).toContain("PROJECTION_DERIVED_CARDINALITY_MISMATCH");
  });

  it("provides revision-CAS lease acquire, advance, completion, and failure", () => {
    const sql = functionSql("advance_projection_pipeline_state_v1");

    expect(sql).toContain("security invoker");
    expect(sql).toContain("set search_path = ''");
    expect(sql).toContain("set lock_timeout = '5s'");
    expect(sql).toContain("set statement_timeout = '30s'");
    expect(sql).toContain(
      "p_transition not in ('acquire', 'advance', 'complete', 'fail')",
    );
    expect(sql).toContain("p_transition is null");
    expect(sql).toContain("p_next_status is null");
    expect(sql).toContain("p_lease_expires_at > v_now + interval '15 minutes'");
    expect(sql).toContain("PROJECTION_PIPELINE_REVISION_MISMATCH");
    expect(sql).toContain("PROJECTION_PIPELINE_LEASE_HELD");
    expect(sql).toContain("PROJECTION_PIPELINE_LEASE_MISMATCH");
    expect(sql).toContain("PROJECTION_PIPELINE_LEASE_EXPIRED");
    expect(sql).toContain("PROJECTION_PIPELINE_CURSOR_REGRESSION");
    expect(sql).toContain("PROJECTION_PIPELINE_RANGE_CHANGED");
    expect(sql).toContain("and pipeline.revision = p_expected_revision");
    expect(sql).toMatch(
      /if p_transition = 'acquire'\s+and v_current\.status = 'complete'[\s\S]*PROJECTION_PIPELINE_RANGE_CHANGED[\s\S]*return query[\s\S]*v_current\.revision[\s\S]*v_current\.updated_at;[\s\S]*return;/,
    );
    expect(
      sql.indexOf("and v_current.status = 'complete'"),
    ).toBeLessThan(sql.indexOf("PROJECTION_PIPELINE_REVISION_EXHAUSTED"));
  });

  it("revokes public execution and grants only service role for all RPCs", () => {
    for (const functionName of [
      "capture_projection_raw_source_snapshots_v1",
      "persist_projection_game_inputs_v1",
      "persist_shift_chart_relationships_v1",
      "persist_projection_game_derived_v1",
      "advance_projection_pipeline_state_v1",
    ]) {
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
  });

  it("uses named constraints for every conflict target in table-valued RPCs", () => {
    for (const constraintName of [
      "nhl_api_game_payload_snapshot_heads_pkey",
      "nhl_api_game_payloads_raw_game_id_endpoint_payload_hash_key",
      "pbp_games_pkey",
      "unique_shift",
      "player_game_strength_v2_pkey",
      "team_game_strength_v2_pkey",
      "goalie_game_v2_pkey",
    ]) {
      expect(migrationSql).toContain(
        `on conflict on constraint ${constraintName}`,
      );
    }
    expect(migrationSql).not.toMatch(/on\s+conflict\s*\([^)]*\)/i);
  });
});
