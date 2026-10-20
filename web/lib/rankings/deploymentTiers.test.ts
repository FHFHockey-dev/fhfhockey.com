import { beforeEach, describe, expect, it, vi } from "vitest";

const { buildContextualRankingsSurfacesMock, rangeCalls, supabaseFromMock, pagingFixture } = vi.hoisted(() => {
  type QueryState = {
    table: string;
    from?: number;
    to?: number;
    selectFields: string | null;
    filters: Record<string, unknown>;
    orders: Array<{ key: string; ascending: boolean }>;
  };
  const rangeCalls: QueryState[] = [];
  const pagingFixture = { enabled: false, omitPlayerOrder: false };


  function rollingSpecialRows(strength: unknown) {
    const base = {
      season: 20252026,
      game_date: "2026-04-16",
      team_id: 1,
      games_played: 12,
      season_participation_games: 12,
      toi_seconds_avg_season: 600,
      points_avg_season: 1,
      goals_per_60_season: 1.2,
      goals_per_60_goals_season: 12,
      goals_per_60_toi_seconds_season: 7200,
      assists_per_60_season: 1,
      assists_per_60_assists_season: 10,
      assists_per_60_toi_seconds_season: 7200,
      ixg_per_60_season: 1,
      ixg_per_60_ixg_season: 10,
      ixg_per_60_toi_seconds_season: 7200,
      sog_per_60_season: 8,
      sog_per_60_shots_season: 80,
      sog_per_60_toi_seconds_season: 7200,
      oi_xgf_avg_season: 4,
      oi_xga_avg_season: 3,
    };
    if (strength === "pp") {
      return [
        { ...base, player_id: 101, strength_state: "pp", pp_unit: 1 },
        { ...base, player_id: 102, strength_state: "pp", pp_unit: 2 },
      ];
    }
    return [
      { ...base, player_id: 201, strength_state: "pk", toi_seconds_avg_season: 120 },
      { ...base, player_id: 202, strength_state: "pk", toi_seconds_avg_season: 60 },
    ];
  }

  function resolveQuery(state: QueryState) {
    if (pagingFixture.enabled && state.table === "rolling_player_game_metrics" && state.selectFields !== "game_date") {
      const rows = state.filters.strength_state === "pp"
        ? Array.from({ length: 1001 }, (_, index) => ({
          ...rollingSpecialRows("pp")[0], player_id: index + 1,
          team_id: state.filters.team_id ?? 1,
        }))
        : [];
      const uniquelyOrdered = !pagingFixture.omitPlayerOrder && state.orders.some((order) => order.key === "player_id");
      if (!uniquelyOrdered && state.from) rows.reverse();
      return { data: rows.slice(state.from ?? 0, (state.to ?? rows.length - 1) + 1), error: null };
    }
    if (pagingFixture.enabled && state.table === "players") {
      const ids = state.filters.id as number[];
      return { data: ids.slice(state.from ?? 0, (state.to ?? ids.length - 1) + 1).map((id) => ({ id, fullName: `Special ${id}`, position: "C", team_id: 1, image_url: null })), error: null };
    }
    if (state.table === "games" && pagingFixture.enabled) {
      return { data: [{ date: "2026-04-16" }], error: null };
    }
    if (state.table === "games") {
      return { data: [{ date: "2026-04-16" }, { date: "2026-04-15" }], error: null };
    }
    if (
      state.table === "rolling_player_game_metrics" &&
      state.selectFields === "game_date"
    ) {
      return { data: [{ game_date: "2026-04-16" }], error: null };
    }
    if (state.table === "rolling_player_game_metrics") {
      return {
        data: rollingSpecialRows(state.filters.strength_state),
        error: null,
      };
    }
    if (state.table === "players") {
      return {
        data: [101, 102, 201, 202].map((id) => ({
          id,
          fullName: `Special ${id}`,
          position: "C",
          team_id: 1,
          image_url: null,
        })),
        error: null,
      };
    }
    if (state.table === "teams") {
      return { data: [{ id: 1, abbreviation: "TST", name: "Test Team" }], error: null };
    }
    return { data: [], error: null };
  }

  function createQuery(table: string) {
    const state: QueryState = {
      table,
      selectFields: null,
      filters: {},
      orders: [],
    };
    const query = {
      select(fields: string) {
        state.selectFields = fields;
        return query;
      },
      eq(key: string, value: unknown) {
        state.filters[key] = value;
        return query;
      },
      lte(key: string, value: unknown) {
        state.filters[key] = value;
        return query;
      },
      order(key: string, options?: { ascending?: boolean }) {
        state.orders.push({ key, ascending: options?.ascending ?? true });
        return query;
      },
      in(key: string, value: unknown) {
        state.filters[key] = value;
        return query;
      },
      limit() {
        return Promise.resolve(resolveQuery(state));
      },
      range(from: number, to: number) {
        state.from = from;
        state.to = to;
        rangeCalls.push(state);
        return query;
      },
      then(
        resolve: (value: ReturnType<typeof resolveQuery>) => unknown,
        reject?: (reason: unknown) => unknown,
      ) {
        return Promise.resolve(resolveQuery(state)).then(resolve, reject);
      },
    };
    return query;
  }

  return {
    buildContextualRankingsSurfacesMock: vi.fn(),
    rangeCalls,
    pagingFixture,
    supabaseFromMock: vi.fn((table: string) => createQuery(table)),
  };
});

vi.mock("./rankingQueries", () => ({
  buildContextualRankingsSurfaces: buildContextualRankingsSurfacesMock,
}));

vi.mock("./rollingRankingSelectFields", () => ({
  ROLLING_RANKING_SELECT_FIELDS: ["player_id", "game_date", "updated_at"],
}));

vi.mock("lib/supabase/server", () => ({
  default: {
    from: supabaseFromMock,
  },
}));

import {
  buildDeploymentTiersSurface,
  parseDeploymentTiersRequest,
} from "./deploymentTiers";
import type {
  ContextualRankingApiRow,
  ContextualRankingsRequest,
} from "./rankingTypes";

function rankingRow(args: {
  id: number;
  metric: ContextualRankingsRequest["metric"];
  percentile: number;
  request: ContextualRankingsRequest;
  bucket: string;
}): ContextualRankingApiRow {
  return {
    entity: {
      id: args.id,
      name: `Player ${args.id}`,
      position: args.request.position === "D" ? "D" : "C",
      positionGroup: args.request.position === "D" ? "defense" : "forward",
      imageUrl: null,
    },
    team: {
      id: 1,
      abbreviation: "TST",
      name: "Test Team",
    },
    deployment: {
      ev: args.bucket.startsWith("L") || args.bucket.startsWith("P")
        ? (args.bucket as any)
        : null,
      pp: args.bucket.startsWith("PP") ? (args.bucket as any) : null,
      pk: args.bucket.startsWith("PK") ? (args.bucket as any) : null,
      confidence: "high",
    },
    sample: {
      gamesPlayed: 12,
      toiSeconds: 7200,
      toiPerGameSeconds: 600,
      confidence: "high",
      minimumSampleMet: true,
    },
    metric: {
      key: args.metric,
      value: args.percentile,
      formattedValue: args.percentile.toFixed(1),
      rawRank: 1,
      percentile: args.percentile,
      qualifiedPeerCount: 2,
    },
    peerGroup: {
      type: "deployment",
      key: args.bucket,
    },
    tags: [args.bucket],
    warnings: [],
    explanationItems: [],
  };
}

describe("deploymentTiers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rangeCalls.length = 0;
    pagingFixture.enabled = false;
    pagingFixture.omitPlayerOrder = false;
    buildContextualRankingsSurfacesMock.mockImplementation(
      async (request: ContextualRankingsRequest, metricKeys: string[]) => {
        const surfaces = new Map();
        const buckets =
          request.strength === "pp"
            ? ["PP1", "PP2"]
            : request.strength === "pk"
              ? ["PK1", "PK2"]
              : request.position === "D"
                ? ["P1", "P2"]
                : ["L1", "L2"];
        for (const metricKey of metricKeys) {
          const metricRequest = { ...request, metric: metricKey as any };
          surfaces.set(metricKey, {
            success: true,
            request: metricRequest,
            rankings: buckets.flatMap((bucket, bucketIndex) => [
              rankingRow({
                id: bucketIndex * 10 + 1,
                metric: metricRequest.metric,
                percentile: bucket === "L1" ? 90 : 70,
                request: metricRequest,
                bucket,
              }),
              rankingRow({
                id: bucketIndex * 10 + 2,
                metric: metricRequest.metric,
                percentile: bucket === "L1" ? 80 : 60,
                request: metricRequest,
                bucket,
              }),
            ]),
            meta: {
              generatedAt: "2026-06-08T00:00:00.000Z",
              snapshotDate: "2026-04-16",
              snapshotUpdatedAt: "2026-06-08T00:00:00.000Z",
              latestAvailableSnapshotDate: "2026-04-16",
              snapshotSelectionReason: "latest_available",
              sourceTable: "rolling_player_game_metrics",
              metric: {
                key: metricKey,
                displayName: metricKey,
                availabilityStatus: "available",
                higherIsBetter: true,
                description: null,
                formulaDescription: null,
                applicableStrengthStates: [request.strength],
                denominatorKey: null,
                denominatorDescription: null,
                sampleRequirements: null,
                methodologyVersion: null,
                methodologyUpdatedAt: null,
                sourceQualityFlags: [],
              },
              unavailable: false,
              rowCount: 2,
              limit: request.limit,
              message: null,
            },
          });
        }
        return surfaces;
      },
    );
  });

  it("parses filters and metric lists for the deployment tiers endpoint", () => {
    const request = parseDeploymentTiersRequest({
      entity: "skaters",
      season: "20252026",
      window: "last20",
      position: "F",
      strength: "5v5",
      min_gp: "10",
      min_toi: "600",
      team: "12",
      metrics: "points_per_60,goals_per_60",
    });

    expect(request).toMatchObject({
      season: 20252026,
      window: "last20",
      position: "F",
      strength: "5v5",
      minGp: 10,
      minToiSeconds: 600,
      teamId: 12,
      metricKeys: ["points_per_60", "goals_per_60"],
    });
  });

  it("builds percentile summaries across verified EV, PP, and PK buckets", async () => {
    const response = await buildDeploymentTiersSurface(
      parseDeploymentTiersRequest({
        entity: "skaters",
        season: "20252026",
        window: "season",
        position: "all",
        strength: "5v5",
        min_gp: "1",
        min_toi: "300",
        metrics: "points_per_60,goals_per_60",
      }),
    );

    expect(response.sections.map((section) => section.key)).toEqual([
      "ev_forwards",
      "ev_defense",
      "power_play",
      "penalty_kill",
    ]);
    expect(
      buildContextualRankingsSurfacesMock.mock.calls.map(
        ([request]) => ({
          deployment: (request as ContextualRankingsRequest).deployment,
          position: (request as ContextualRankingsRequest).position,
          strength: (request as ContextualRankingsRequest).strength,
        }),
      ),
    ).toEqual([
      { deployment: "all", position: "all", strength: "5v5" },
    ]);
    const l1 = response.sections[0]?.buckets[0];
    expect(l1).toMatchObject({
      key: "L1",
      playerCount: 2,
      averagePercentile: 85,
      topMetricKey: "points_per_60",
      sourceState: "available",
    });
    expect(l1?.topPlayer).toMatchObject({
      id: 1,
      name: "Player 1",
      percentile: 90,
    });
  });

  it("retains every special-team player across tied snapshot pages", async () => {
    pagingFixture.enabled = true;
    const request = (team: string) => parseDeploymentTiersRequest({
      entity: "skaters", season: "20252026", window: "season", position: "all",
      strength: "5v5", min_gp: "1", min_toi: "300", metrics: "goals_per_60", team,
    });
    // Distinct team keys isolate both runs from the snapshot cache.
    const response = await buildDeploymentTiersSurface(request("901"));
    const pp1 = response.sections.find((section) => section.key === "power_play")?.buckets.find((bucket) => bucket.key === "PP1");
    expect(pp1?.playerCount).toBe(1001);
    expect(pp1?.sourceState).toBe("available");
    const ppPages = rangeCalls.filter((call) => call.table === "rolling_player_game_metrics" && call.selectFields !== "game_date" && call.filters.strength_state === "pp");
    expect(ppPages.map((call) => [call.from, call.to])).toEqual([[0, 999], [1000, 1999]]);

    pagingFixture.omitPlayerOrder = true;
    const unstable = await buildDeploymentTiersSurface(request("902"));
    expect(unstable.sections.find((section) => section.key === "power_play")?.buckets.find((bucket) => bucket.key === "PP1")?.playerCount).toBe(1000);
  });

  it("pages exact-snapshot rolling rows by the unique player key", async () => {
    await buildDeploymentTiersSurface(
      parseDeploymentTiersRequest({
        entity: "skaters",
        season: "20252026",
        window: "season",
        position: "all",
        strength: "5v5",
        min_gp: "1",
        min_toi: "300",
        // A distinct team keeps this request out of the module's snapshot cache.
        team: "7",
        metrics: "points_per_60",
      }),
    );

    const snapshotPages = rangeCalls.filter(
      (call) =>
        call.table === "rolling_player_game_metrics" &&
        call.selectFields !== "game_date" &&
        call.filters.game_date != null,
    );
    expect(snapshotPages.length).toBeGreaterThan(0);
    for (const page of snapshotPages) {
      expect(page.orders).toContainEqual({ key: "player_id", ascending: true });
    }
  });
});
