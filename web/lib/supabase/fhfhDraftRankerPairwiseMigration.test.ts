import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationSql = readFileSync(
  resolve(
    process.cwd(),
    "../supabase/migrations/20260715042519_add_draft_ranker_pairwise_evidence.sql",
  ),
  "utf8",
);

describe("Draft Ranker pairwise-evidence migration", () => {
  it("adds immutable, owner-readable consent audit history", () => {
    expect(migrationSql).toContain("draft_ranker_contribution_events");
    expect(migrationSql).toContain("draft_contribution_events_operation_unique");
    expect(migrationSql).toContain("enable row level security");
    expect(migrationSql).toContain("draft_contribution_events_owner_select");
    expect(migrationSql).toContain("on delete cascade");
  });

  it("versions explicit opt-in and makes retries payload-safe", () => {
    expect(migrationSql).toContain(
      "set_draft_ranker_contribution_preference",
    );
    expect(migrationSql).toContain("privacy policy version is required when opting in");
    expect(migrationSql).toContain("idempotency_conflict");
    expect(migrationSql).toContain("operation_payload_hash");
  });

  it("issues only canonical, placed, owner-scoped prompts", () => {
    expect(migrationSql).toContain("issue_draft_ranker_pair_prompt");
    expect(migrationSql).toContain("least(p_player_a_id, p_player_b_id)");
    expect(migrationSql).toContain("greatest(p_player_a_id, p_player_b_id)");
    expect(migrationSql).toContain("players_not_placed");
    expect(migrationSql).toContain("ranking.user_id = p_user_id");
    expect(migrationSql).toContain("interval '15 minutes'");
  });

  it("keeps submissions immutable while superseding latest preference", () => {
    expect(migrationSql).toContain("submit_draft_ranker_pair_comparison");
    expect(migrationSql).toContain("v_existing_prompt_comparison");
    expect(migrationSql).toContain("supersedesComparisonId");
    expect(migrationSql).toContain(
      "on conflict (user_id, ranking_id, season_id, low_player_id, high_player_id)",
    );
    expect(migrationSql).not.toMatch(
      /delete\s+from\s+public\.draft_ranker_pair_comparisons/i,
    );
  });

  it("records skip and too-close without a preference or community win", () => {
    expect(migrationSql).toContain("when p_outcome = 'skip' then 'skip'");
    expect(migrationSql).toContain("when p_outcome = 'too_close' then 'too_close'");
    expect(migrationSql).toContain(
      "v_consent_enabled and p_outcome in ('low', 'high')",
    );
    expect(migrationSql).toContain("when p_outcome = 'low'");
    expect(migrationSql).toContain("when p_outcome = 'high'");
  });

  it("atomically aligns contradictory personal order without synthetic wins", () => {
    expect(migrationSql).toContain("public.reorder_draft_ranking(");
    expect(migrationSql).toContain("'insert_above'");
    expect(migrationSql).toContain("'pairwise_order_aligned'");
    expect(migrationSql).toContain("'pairwise_response_recorded'");
    expect(migrationSql).toContain("'pairwise'");
  });

  it("keeps all mutation functions invoker-secured and service-only", () => {
    expect(migrationSql.match(/security invoker/g)).toHaveLength(3);
    expect(migrationSql).not.toContain("security definer");
    expect(migrationSql.match(/from public, anon, authenticated;/g)).toHaveLength(3);
    expect(
      migrationSql.match(/grant execute on function[\s\S]*?to service_role;/g),
    ).toHaveLength(3);
  });
});
