import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationSql = readFileSync(
  resolve(
    process.cwd(),
    "../supabase/migrations/20260715013836_reorder_draft_ranking_sparse.sql",
  ),
  "utf8",
);

describe("Draft Ranker sparse reorder migration", () => {
  it("locks owner state and rejects stale versions before mutation", () => {
    expect(migrationSql).toContain("and ranking.user_id = p_user_id");
    expect(migrationSql).toContain("for update");
    expect(migrationSql).toContain("v_original_version <> p_expected_version");
    expect(migrationSql).toContain("'stale_ranking_version'");
    expect(migrationSql).toContain("'currentVersion', v_original_version");
  });

  it("supports every approved direct movement without a stored cutoff flag", () => {
    for (const action of [
      "move_to_rank",
      "insert_above",
      "insert_below",
      "remove_to_bench",
    ]) {
      expect(migrationSql).toContain(`'${action}'`);
    }
    expect(migrationSql).toContain("v_destination_rank := least(251, v_entry_count)");
    expect(migrationSql).not.toMatch(/\b(?:is_top_250|candidate_rank)\b/i);
  });

  it("uses midpoint keys and automatically normalizes exhausted gaps", () => {
    expect(migrationSql).toContain("floor((v_next_key::numeric - v_prev_key::numeric) / 2)");
    expect(migrationSql).toContain("set constraints draft_entries_order_unique deferred");
    expect(migrationSql).toContain("ordered.position * 1048576");
    expect(migrationSql).toContain("'order_normalized'");
    expect(migrationSql).toContain("'midpoint_exhausted'");
    expect(migrationSql).toContain("'order_key_overflow'");
  });

  it("records immutable idempotent events and cutoff transitions", () => {
    expect(migrationSql).toContain("'operation_payload_hash'");
    expect(migrationSql).toContain("'idempotency_conflict'");
    expect(migrationSql).toContain("'player_reordered'");
    expect(migrationSql).toContain("'rank250PlayerId'");
    expect(migrationSql).toContain("'rank251PlayerId'");
    expect(migrationSql).toContain("'comparisonConflictCount'");
  });

  it("exposes only service-role invoker functions", () => {
    expect(migrationSql.match(/security invoker/g)).toHaveLength(2);
    expect(migrationSql).not.toContain("security definer");
    expect(migrationSql).toMatch(
      /revoke all on function public\.reorder_draft_ranking\([\s\S]+?\) from public, anon, authenticated;/i,
    );
    expect(migrationSql).toMatch(
      /grant execute on function public\.validate_draft_ranking_order\(uuid, uuid\)\s+to service_role;/i,
    );
  });
});
