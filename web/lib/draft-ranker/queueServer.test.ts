import { beforeEach, describe, expect, it, vi } from "vitest";

const { fromMock, rpcMock, maybeQueues, awaitedQueues } = vi.hoisted(() => {
  const maybe = new Map<string, Array<{ data: any; error: any }>>();
  const awaited = new Map<string, Array<{ data: any; error: any }>>();
  return {
    maybeQueues: maybe,
    awaitedQueues: awaited,
    rpcMock: vi.fn(),
    fromMock: vi.fn((table: string) => {
      const builder: any = {
        select: () => builder,
        eq: () => builder,
        order: () => builder,
        limit: () => builder,
        gte: () => builder,
        maybeSingle: () =>
          Promise.resolve(
            maybe.get(table)?.shift() ?? { data: null, error: null },
          ),
        then: (resolve: (value: any) => any, reject: (error: any) => any) =>
          Promise.resolve(
            awaited.get(table)?.shift() ?? { data: [], error: null },
          ).then(resolve, reject),
      };
      return builder;
    }),
  };
});

vi.mock("lib/supabase/server", () => ({
  default: { from: fromMock, rpc: rpcMock },
}));

import { issueNextDraftPairPrompt } from "./server";

const rankingId = "11111111-1111-4111-8111-111111111111";
const operationId = "22222222-2222-4222-8222-222222222222";

function entries(count = 255) {
  return Array.from({ length: count }, (_, index) => ({
    fhfh_player_id: 20_000 + index + 1,
    order_key: (index + 1) * 1024,
    seed_source: "yahoo_adp",
    seed_adp: index + 1.2,
    seed_rank: index + 1,
    tier: null,
    notes: null,
    updated_at: "2026-07-15T00:00:00Z",
    player: {
      canonical_name: `Player ${index + 1}`,
      canonical_position:
        (index + 1) % 11 === 0 ? "G" : (index + 1) % 4 === 0 ? "D" : "C",
      current_organization_name: "NHL",
      headshot_url: null,
      lifecycle_status: "active_nhl",
    },
  }));
}

function baseQueues(lockVersion = 4) {
  maybeQueues.set("draft_rankings", [
    {
      data: {
        id: rankingId,
        user_id: "owner-1",
        target_season_id: 20262027,
        lock_version: lockVersion,
        status: "active",
      },
      error: null,
    },
  ]);
  awaitedQueues.set("draft_ranking_entries", [
    { data: entries(), error: null },
  ]);
  awaitedQueues.set("draft_ranking_watchlist", [{ data: [], error: null }]);
}

describe("Draft Ranker queue server", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    maybeQueues.clear();
    awaitedQueues.clear();
  });

  it("replays an already issued prompt without selecting or writing again", async () => {
    baseQueues();
    maybeQueues.set("draft_ranker_pair_prompts", [
      {
        data: {
          id: "33333333-3333-4333-8333-333333333333",
          ranking_id: rankingId,
          low_player_id: 20249,
          high_player_id: 20250,
          queue_mode: "quick_five",
          queue_reason: "Previously issued reason.",
          algorithm_version: "deterministic_v1",
          ranking_version: 4,
          expires_at: "2026-07-15T01:00:00Z",
          status: "issued",
        },
        error: null,
      },
    ]);

    const result = await issueNextDraftPairPrompt("owner-1", {
      rankingId,
      mode: "quick_five",
      expectedVersion: 4,
      operationId,
    });
    expect(result.prompt).toMatchObject({
      idempotentReplay: true,
      reason: "Previously issued reason.",
    });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("rejects operation reuse with a different queue request", async () => {
    baseQueues();
    maybeQueues.set("draft_ranker_pair_prompts", [
      {
        data: {
          id: "33333333-3333-4333-8333-333333333333",
          ranking_id: rankingId,
          queue_mode: "find_sleepers",
          ranking_version: 4,
        },
        error: null,
      },
    ]);
    await expect(
      issueNextDraftPairPrompt("owner-1", {
        rankingId,
        mode: "quick_five",
        expectedVersion: 4,
        operationId,
      }),
    ).rejects.toMatchObject({ code: "idempotency_conflict" });
  });

  it("selects players server-side and emits a versioned explanation", async () => {
    baseQueues();
    maybeQueues.set("draft_ranker_pair_prompts", [{ data: null, error: null }]);
    awaitedQueues.set("draft_ranker_pair_preferences", [
      { data: [], error: null },
    ]);
    awaitedQueues.set("draft_ranker_pair_prompts", [
      { data: [], error: null },
      { data: [], error: null },
    ]);
    rpcMock.mockResolvedValue({
      data: {
        status: "completed",
        promptId: "33333333-3333-4333-8333-333333333333",
        lowPlayerId: 20249,
        highPlayerId: 20250,
        expiresAt: "2026-07-15T01:00:00Z",
        idempotentReplay: false,
      },
      error: null,
    });

    const result = await issueNextDraftPairPrompt("owner-1", {
      rankingId,
      mode: "improve_ranking",
      expectedVersion: 4,
      operationId,
    });
    expect(result).toMatchObject({
      algorithmVersion: "deterministic_v1",
      plannedSlots: 20,
      prompt: {
        category: "personal",
        reasonCode: "adjacent_unresolved",
        players: [{ playerId: 20249 }, { playerId: 20250 }],
      },
    });
    expect(rpcMock).toHaveBeenCalledWith(
      "issue_draft_ranker_pair_prompt_guarded",
      expect.objectContaining({
        p_user_id: "owner-1",
        p_player_a_id: 20249,
        p_player_b_id: 20250,
        p_algorithm_version: "deterministic_v1",
        p_rate_operation_payload_hash: expect.stringMatching(/^[0-9a-f]{64}$/),
      }),
    );
  });
});
