import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationSql = readFileSync(
  resolve(
    process.cwd(),
    "../supabase/migrations/20260715032036_add_draft_ranker_assisted_placement.sql",
  ),
  "utf8",
);

describe("Draft Ranker assisted-placement migration", () => {
  it("adds versioned, explainable deterministic completion state", () => {
    expect(migrationSql).toContain("engine_version text not null");
    expect(migrationSql).toContain("confidence text not null");
    expect(migrationSql).toContain("completion_reason text null");
    for (const range of [
      "top_50",
      "51_100",
      "101_150",
      "151_200",
      "201_250",
      "outside_250",
      "unsure",
    ]) {
      expect(migrationSql).toContain(`'${range}'`);
    }
  });

  it("persists starts and answers with compare-and-set concurrency", () => {
    expect(migrationSql).toContain("begin_draft_ranker_placement");
    expect(migrationSql).toContain("advance_draft_ranker_placement");
    expect(migrationSql).toContain("for update");
    expect(migrationSql).toContain("stale_ranking_version");
    expect(migrationSql).toContain("stale_placement_state");
    expect(migrationSql).toContain("p_expected_question_count + 1");
  });

  it("supports explicit cancellation and atomic confirmation", () => {
    expect(migrationSql).toContain("cancel_draft_ranker_placement");
    expect(migrationSql).toContain("confirm_draft_ranker_placement");
    expect(migrationSql).toContain("public.reorder_draft_ranking(");
    expect(migrationSql).toContain("'assisted_placement_confirmed'");
    expect(migrationSql).toContain("'assisted_placement'");
    expect(migrationSql).toContain("wasUnplaced");
  });

  it("preserves watch state while consuming compare intent", () => {
    expect(migrationSql).toContain(
      "delete from public.draft_ranker_player_preferences",
    );
    expect(migrationSql).not.toMatch(/delete from public\.draft_ranking_watchlist/i);
  });

  it("keeps every mutation RPC service-only and invoker secured", () => {
    expect(migrationSql.match(/security invoker/g)).toHaveLength(4);
    expect(migrationSql).not.toContain("security definer");
    expect(migrationSql.match(/from public, anon, authenticated;/g)).toHaveLength(4);
    expect(migrationSql.match(/to service_role;/g)).toHaveLength(4);
  });
});
