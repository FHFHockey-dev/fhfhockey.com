import { beforeEach, describe, expect, it, vi } from "vitest";

const { fromMock, rpcMock, responses, queryLog } = vi.hoisted(() => {
  type QueryRecord = {
    table: string;
    select?: string;
    filters: Array<[string, unknown]>;
  };
  const responseState = {
    maybeSingle: new Map<string, Array<{ data: unknown; error: unknown }>>(),
    awaited: new Map<
      string,
      { count?: number | null; data?: unknown; error: unknown }
    >(),
  };
  const records: QueryRecord[] = [];

  return {
    responses: responseState,
    queryLog: records,
    fromMock: vi.fn((table: string) => {
      const record: QueryRecord = { table, filters: [] };
      records.push(record);
      const builder: any = {
        select(columns: string) {
          record.select = columns;
          return builder;
        },
        eq(column: string, value: unknown) {
          record.filters.push([column, value]);
          return builder;
        },
        order() {
          return builder;
        },
        limit() {
          return builder;
        },
        maybeSingle() {
          const queue = responseState.maybeSingle.get(table) ?? [];
          return Promise.resolve(queue.shift() ?? { data: null, error: null });
        },
        then(
          resolve: (value: unknown) => unknown,
          reject: (error: unknown) => unknown,
        ) {
          return Promise.resolve(
            responseState.awaited.get(table) ?? { count: 0, error: null },
          ).then(resolve, reject);
        },
      };
      return builder;
    }),
    rpcMock: vi.fn(),
  };
});

vi.mock("lib/supabase/server", () => ({
  default: { from: fromMock, rpc: rpcMock },
}));

import {
  applyDraftPlayerAction,
  initializeDraftRanking,
  loadDraftPlacement,
  loadDraftPlayerActions,
  loadDraftRankingEntries,
  loadDraftRankerBootstrap,
  mutateDraftPlacement,
  requestDraftPlayerAddition,
  reorderDraftRanking,
  requireOwnedDraftRanking,
  searchDraftPlayers,
} from "./server";

describe("Draft Ranker server ownership queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryLog.length = 0;
    responses.maybeSingle.clear();
    responses.awaited.clear();
    rpcMock.mockReset();
  });

  it("returns an uninitialized bootstrap without creating data", async () => {
    responses.maybeSingle.set("draft_rankings", [{ data: null, error: null }]);

    await expect(loadDraftRankerBootstrap("user-1")).resolves.toEqual({
      initialized: false,
      targetSeasonId: 20262027,
      ranking: null,
      counts: { entries: 0, watchlist: 0 },
      latestSeedRun: null,
    });
    expect(fromMock).toHaveBeenCalledTimes(1);
    expect(queryLog[0].filters).toEqual(
      expect.arrayContaining([
        ["user_id", "user-1"],
        ["target_season_id", 20262027],
        ["status", "active"],
        ["is_default", true],
      ]),
    );
  });

  it("owner-scopes ranking, entry, watchlist, and seed reads", async () => {
    const ranking = {
      id: "ranking-1",
      target_season_id: 20262027,
      lock_version: 4,
    };
    responses.maybeSingle.set("draft_rankings", [
      { data: ranking, error: null },
    ]);
    responses.maybeSingle.set("draft_ranking_seed_runs", [
      { data: { id: "seed-1", status: "completed" }, error: null },
    ]);
    responses.awaited.set("draft_ranking_entries", {
      count: 313,
      error: null,
    });
    responses.awaited.set("draft_ranking_watchlist", {
      count: 2,
      error: null,
    });

    const result = await loadDraftRankerBootstrap("user-1");

    expect(result).toEqual(
      expect.objectContaining({
        initialized: true,
        ranking,
        counts: { entries: 313, watchlist: 2 },
        latestSeedRun: { id: "seed-1", status: "completed" },
      }),
    );
    for (const record of queryLog) {
      expect(record.filters).toContainEqual(["user_id", "user-1"]);
    }
  });

  it("returns the same owner-scoped 404 for absent or foreign rankings", async () => {
    responses.maybeSingle.set("draft_rankings", [{ data: null, error: null }]);

    await expect(
      requireOwnedDraftRanking("user-1", "ranking-owned-by-someone-else"),
    ).rejects.toMatchObject({
      statusCode: 404,
      code: "not_found",
    });
    expect(queryLog[0].filters).toContainEqual([
      "id",
      "ranking-owned-by-someone-else",
    ]);
    expect(queryLog[0].filters).toContainEqual(["user_id", "user-1"]);
  });

  it("loads one owner-scoped continuous order and derives contiguous visible ranks", async () => {
    responses.maybeSingle.set("draft_rankings", [
      {
        data: {
          id: "ranking-1",
          user_id: "user-1",
          target_season_id: 20262027,
          lock_version: 7,
          status: "active",
        },
        error: null,
      },
    ]);
    responses.awaited.set("draft_ranking_entries", {
      data: [
        {
          fhfh_player_id: 10,
          order_key: 1048576,
          seed_source: "yahoo_adp",
          seed_adp: 1.3,
          seed_rank: 1,
          tier: null,
          notes: null,
          updated_at: "2026-07-15T00:00:00Z",
          player: { canonical_name: "Connor McDavid" },
        },
        {
          fhfh_player_id: 11,
          order_key: 2097152,
          seed_source: "yahoo_adp",
          seed_adp: 2.6,
          seed_rank: 2,
          tier: null,
          notes: null,
          updated_at: "2026-07-15T00:00:00Z",
          player: { canonical_name: "Nathan MacKinnon" },
        },
      ],
      error: null,
    });

    const result = await loadDraftRankingEntries("user-1", "ranking-1");

    expect(result.ranking.lockVersion).toBe(7);
    expect(
      result.entries.map(({ playerId, rank }) => ({ playerId, rank })),
    ).toEqual([
      { playerId: 10, rank: 1 },
      { playerId: 11, rank: 2 },
    ]);
    const entryQuery = queryLog.find(
      (record) => record.table === "draft_ranking_entries",
    );
    expect(entryQuery?.filters).toEqual(
      expect.arrayContaining([
        ["ranking_id", "ranking-1"],
        ["user_id", "user-1"],
      ]),
    );
  });

  it("passes only the authenticated owner to the service-only seed RPC", async () => {
    rpcMock.mockResolvedValue({
      data: {
        status: "completed",
        rankingId: "ranking-1",
        seededCount: 313,
        idempotentReplay: false,
      },
      error: null,
    });

    await expect(
      initializeDraftRanking("authenticated-user", {
        operationId: "019f5a20-0000-7000-8000-000000000001",
        scoringProfile: { goals: 3 },
      }),
    ).resolves.toMatchObject({ seededCount: 313 });

    expect(rpcMock).toHaveBeenCalledWith(
      "initialize_draft_ranking_from_yahoo",
      expect.objectContaining({
        p_user_id: "authenticated-user",
        p_operation_id: "019f5a20-0000-7000-8000-000000000001",
        p_operation_payload_hash: expect.stringMatching(/^[0-9a-f]{64}$/u),
        p_scoring_profile: { goals: 3 },
      }),
    );
  });

  it("maps seed conflicts and data-quality failures to stable API errors", async () => {
    rpcMock.mockResolvedValueOnce({
      data: {
        status: "conflict",
        code: "idempotency_conflict",
        message: "Operation payload changed.",
        rankingId: "ranking-1",
      },
      error: null,
    });
    await expect(
      initializeDraftRanking("user-1", {
        operationId: "019f5a20-0000-7000-8000-000000000001",
        scoringProfile: {},
      }),
    ).rejects.toMatchObject({ statusCode: 409, code: "idempotency_conflict" });

    rpcMock.mockResolvedValueOnce({
      data: {
        status: "failed",
        code: "insufficient_seed_candidates",
        message: "Not enough verified candidates.",
        rankingId: "ranking-1",
      },
      error: null,
    });
    await expect(
      initializeDraftRanking("user-1", {
        operationId: "019f5a20-0000-7000-8000-000000000002",
        scoringProfile: {},
      }),
    ).rejects.toMatchObject({
      statusCode: 422,
      code: "unprocessable",
      details: {
        reason: "insufficient_seed_candidates",
        rankingId: "ranking-1",
      },
    });
  });

  it("passes owner-scoped reorder arguments and maps stale versions", async () => {
    const input = {
      operationId: "019f5a30-0000-7000-8000-000000000001",
      expectedVersion: 4,
      rankingId: "019f5a30-0000-7000-8000-000000000002",
      playerId: 101,
      action: "insert_below" as const,
      anchorPlayerId: 202,
    };
    rpcMock.mockResolvedValueOnce({
      data: {
        status: "completed",
        rankingId: input.rankingId,
        resultingRank: 12,
        resultingVersion: 5,
      },
      error: null,
    });

    await expect(reorderDraftRanking("user-1", input)).resolves.toMatchObject({
      resultingVersion: 5,
    });
    expect(rpcMock).toHaveBeenCalledWith(
      "reorder_draft_ranking",
      expect.objectContaining({
        p_user_id: "user-1",
        p_ranking_id: input.rankingId,
        p_player_id: 101,
        p_action: "insert_below",
        p_target_rank: null,
        p_anchor_player_id: 202,
        p_expected_version: 4,
      }),
    );

    rpcMock.mockResolvedValueOnce({
      data: {
        status: "conflict",
        code: "stale_ranking_version",
        rankingId: input.rankingId,
        expectedVersion: 4,
        currentVersion: 5,
        message: "Reload first.",
      },
      error: null,
    });
    await expect(reorderDraftRanking("user-1", input)).rejects.toMatchObject({
      statusCode: 409,
      code: "stale_ranking_version",
      details: expect.objectContaining({ currentVersion: 5 }),
    });
  });

  it("searches through the bounded service-only canonical RPC", async () => {
    rpcMock.mockResolvedValueOnce({
      data: [
        {
          player_id: 101,
          canonical_name: "Elias Pettersson",
          birth_year: 1998,
          canonical_position: "C",
          current_organization_name: "Vancouver Canucks",
          current_organization_type: "nhl",
          lifecycle_status: "active_nhl",
          headshot_url: null,
          nhl_player_id: 8480012,
          yahoo_player_id: "6789",
          external_providers: ["nhl", "yahoo"],
          is_rankable: true,
          match_kind: "canonical_exact",
          similarity_score: 1,
        },
      ],
      error: null,
    });

    await expect(
      searchDraftPlayers({
        query: "Elias Pettersson",
        includeArchived: false,
        limit: 20,
      }),
    ).resolves.toMatchObject({
      results: [
        expect.objectContaining({
          playerId: 101,
          canonicalName: "Elias Pettersson",
          yahooPlayerId: "6789",
          isRankable: true,
        }),
      ],
    });
    expect(rpcMock).toHaveBeenCalledWith("search_fhfh_draft_players", {
      p_query: "Elias Pettersson",
      p_include_archived: false,
      p_limit: 20,
    });
  });

  it("derives addition-request ownership and maps database rate limits", async () => {
    rpcMock.mockResolvedValueOnce({
      data: {
        status: "completed",
        requestId: "request-1",
        requestStatus: "pending",
        created: true,
      },
      error: null,
    });
    const input = {
      rawName: "Real Prospect",
      organization: "Boston College",
      position: "C",
      notes: "Drafted prospect",
      candidatePlayerIds: [10],
    };
    await expect(
      requestDraftPlayerAddition("authenticated-owner", input),
    ).resolves.toMatchObject({ created: true });
    expect(rpcMock).toHaveBeenCalledWith(
      "request_fhfh_player_addition",
      expect.objectContaining({
        p_user_id: "authenticated-owner",
        p_raw_name: "Real Prospect",
        p_candidate_fhfh_player_ids: [10],
      }),
    );

    rpcMock.mockResolvedValueOnce({
      data: {
        status: "rate_limited",
        message: "Five per day.",
        retryAfterSeconds: 600,
      },
      error: null,
    });
    await expect(
      requestDraftPlayerAddition("authenticated-owner", input),
    ).rejects.toMatchObject({
      statusCode: 429,
      code: "rate_limited",
      details: { retryAfterSeconds: 600 },
    });
  });

  it("loads watchlist and discovery state only after owner validation", async () => {
    responses.maybeSingle.set("draft_rankings", [
      {
        data: {
          id: "ranking-1",
          user_id: "user-1",
          target_season_id: 20262027,
          lock_version: 2,
          status: "active",
        },
        error: null,
      },
    ]);
    responses.awaited.set("draft_ranking_watchlist", {
      data: [{ fhfh_player_id: 10, priority: 2, player: null }],
      error: null,
    });
    responses.awaited.set("draft_ranker_player_preferences", {
      data: [
        {
          fhfh_player_id: 11,
          disposition: "dismissed",
          comparison_requested_at: null,
        },
      ],
      error: null,
    });

    const result = await loadDraftPlayerActions("user-1", "ranking-1");
    expect(result.watchlist[0]).toMatchObject({ playerId: 10, priority: 2 });
    expect(result.preferences[0]).toMatchObject({
      playerId: 11,
      disposition: "dismissed",
    });
    for (const record of queryLog.filter(
      (entry) => entry.table !== "draft_rankings",
    )) {
      expect(record.filters).toEqual(
        expect.arrayContaining([
          ["ranking_id", "ranking-1"],
          ["user_id", "user-1"],
        ]),
      );
    }
  });

  it("derives ownership for transactional player actions", async () => {
    rpcMock.mockResolvedValueOnce({
      data: {
        status: "completed",
        rankingId: "ranking-1",
        playerId: 10,
        action: "watch",
        isWatched: true,
      },
      error: null,
    });
    await expect(
      applyDraftPlayerAction("authenticated-owner", {
        rankingId: "ranking-1",
        playerId: 10,
        action: "watch",
        operationId: "11111111-1111-4111-8111-111111111111",
      }),
    ).resolves.toMatchObject({ isWatched: true });
    expect(rpcMock).toHaveBeenCalledWith(
      "apply_draft_ranker_player_action",
      expect.objectContaining({
        p_user_id: "authenticated-owner",
        p_ranking_id: "ranking-1",
        p_fhfh_player_id: 10,
        p_action: "watch",
        p_source: "draft_ranker_search",
      }),
    );

    rpcMock.mockResolvedValueOnce({
      data: { status: "completed", action: "dismiss", playerId: 10 },
      error: null,
    });
    await applyDraftPlayerAction("authenticated-owner", {
      rankingId: "ranking-1",
      playerId: 10,
      action: "dismiss",
      operationId: "22222222-2222-4222-8222-222222222222",
      sourceContext: "discovery",
    });
    expect(rpcMock).toHaveBeenLastCalledWith(
      "apply_draft_ranker_player_action",
      expect.objectContaining({ p_source: "draft_ranker_discovery" }),
    );
  });

  it("loads an active placement only for its authenticated owner", async () => {
    responses.maybeSingle.set("draft_rankings", [
      {
        data: {
          id: "ranking-1",
          user_id: "owner-1",
          target_season_id: 20262027,
          lock_version: 4,
          status: "active",
        },
        error: null,
      },
    ]);
    responses.maybeSingle.set("draft_ranker_placement_sessions", [
      {
        data: {
          id: "session-1",
          user_id: "owner-1",
          ranking_id: "ranking-1",
          fhfh_player_id: 99,
          status: "active",
          rough_range: "top_50",
          interval_low: 1,
          interval_high: 50,
          plausible_low: null,
          plausible_high: null,
          question_count: 1,
          contradiction_count: 0,
          ranking_version: 4,
          issued_anchors: [
            { playerId: 25, rank: 25, mode: "midpoint", sequence: 1 },
          ],
          answers: [],
          suggested_rank: null,
          expires_at: "2026-07-16T00:00:00Z",
          engine_version: "deterministic_v1",
          confidence: "pending",
          completion_reason: null,
          created_at: "2026-07-15T00:00:00Z",
          updated_at: "2026-07-15T00:01:00Z",
          completed_at: null,
          player: { canonical_name: "Prospect Player" },
        },
        error: null,
      },
    ]);
    responses.maybeSingle.set("fhfh_player_identities", [
      {
        data: { id: 25, canonical_name: "Anchor Player" },
        error: null,
      },
    ]);

    const result = await loadDraftPlacement("owner-1", {
      rankingId: "ranking-1",
    });
    expect(result.session).toMatchObject({
      id: "session-1",
      playerId: 99,
      anchorPlayer: { id: 25, canonical_name: "Anchor Player" },
    });
    expect(
      queryLog.find(
        (record) => record.table === "draft_ranker_placement_sessions",
      )?.filters,
    ).toEqual(
      expect.arrayContaining([
        ["user_id", "owner-1"],
        ["ranking_id", "ranking-1"],
        ["status", "active"],
      ]),
    );
  });

  it("computes placement state on the server before starting the service-only RPC", async () => {
    responses.maybeSingle.set("draft_rankings", [
      {
        data: {
          id: "ranking-1",
          user_id: "owner-1",
          target_season_id: 20262027,
          lock_version: 4,
          status: "active",
        },
        error: null,
      },
    ]);
    responses.awaited.set("draft_ranking_entries", {
      data: [
        { fhfh_player_id: 10, order_key: 1048576 },
        { fhfh_player_id: 11, order_key: 2097152 },
      ],
      error: null,
    });
    rpcMock.mockResolvedValueOnce({
      data: { status: "completed", sessionId: "session-1" },
      error: null,
    });
    responses.maybeSingle.set("draft_ranker_placement_sessions", [
      { data: null, error: null },
    ]);

    await mutateDraftPlacement("owner-1", {
      action: "start",
      rankingId: "ranking-1",
      playerId: 99,
      expectedVersion: 4,
      roughRange: "top_50",
      operationId: "11111111-1111-4111-8111-111111111111",
    });

    expect(rpcMock).toHaveBeenCalledWith(
      "begin_draft_ranker_placement",
      expect.objectContaining({
        p_user_id: "owner-1",
        p_ranking_id: "ranking-1",
        p_fhfh_player_id: 99,
        p_operation_payload_hash: expect.stringMatching(/^[0-9a-f]{64}$/u),
        p_state: expect.objectContaining({
          roughRange: "top_50",
          questionCount: 0,
          issuedAnchors: [
            expect.objectContaining({ playerId: 10, mode: "narrow" }),
          ],
        }),
      }),
    );
  });

  it("maps a stale placement confirmation to a stable conflict", async () => {
    responses.maybeSingle.set("draft_ranker_placement_sessions", [
      {
        data: {
          id: "session-1",
          user_id: "owner-1",
          ranking_id: "ranking-1",
          fhfh_player_id: 99,
          status: "active",
          rough_range: "top_50",
          interval_low: 2,
          interval_high: 2,
          plausible_low: 2,
          plausible_high: 2,
          question_count: 2,
          contradiction_count: 0,
          ranking_version: 4,
          issued_anchors: [],
          answers: [],
          suggested_rank: 2,
          expires_at: "2026-07-16T00:00:00Z",
          engine_version: "deterministic_v1",
          confidence: "high",
          completion_reason: "interval_resolved",
          created_at: "2026-07-15T00:00:00Z",
          updated_at: "2026-07-15T00:01:00Z",
          completed_at: null,
        },
        error: null,
      },
    ]);
    responses.maybeSingle.set("draft_rankings", [
      {
        data: {
          id: "ranking-1",
          user_id: "owner-1",
          target_season_id: 20262027,
          lock_version: 4,
          status: "active",
        },
        error: null,
      },
    ]);
    responses.awaited.set("draft_ranking_entries", { data: [], error: null });
    rpcMock.mockResolvedValueOnce({
      data: {
        status: "conflict",
        code: "stale_ranking_version",
        currentVersion: 5,
        sessionId: "session-1",
      },
      error: null,
    });

    await expect(
      mutateDraftPlacement("owner-1", {
        action: "confirm",
        sessionId: "session-1",
        operationId: "11111111-1111-4111-8111-111111111111",
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: "stale_ranking_version",
      details: expect.objectContaining({ currentVersion: 5 }),
    });
  });

  it("returns the resumable session when another placement is already active", async () => {
    responses.maybeSingle.set("draft_rankings", [
      {
        data: {
          id: "ranking-1",
          user_id: "owner-1",
          target_season_id: 20262027,
          lock_version: 4,
          status: "active",
        },
        error: null,
      },
    ]);
    responses.awaited.set("draft_ranking_entries", {
      data: [
        { fhfh_player_id: 10, order_key: 1048576 },
        { fhfh_player_id: 11, order_key: 2097152 },
      ],
      error: null,
    });
    rpcMock.mockResolvedValueOnce({
      data: {
        status: "conflict",
        code: "active_placement_exists",
        sessionId: "existing-session",
        playerId: 88,
      },
      error: null,
    });

    await expect(
      mutateDraftPlacement("owner-1", {
        action: "start",
        rankingId: "ranking-1",
        playerId: 99,
        expectedVersion: 4,
        roughRange: "top_50",
        operationId: "11111111-1111-4111-8111-111111111111",
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: "idempotency_conflict",
      message:
        "Another placement is already active. Resume or cancel it first.",
      details: {
        reason: "active_placement_exists",
        sessionId: "existing-session",
        playerId: 88,
        currentVersion: null,
      },
    });
  });
});
