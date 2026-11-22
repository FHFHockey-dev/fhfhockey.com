import { beforeEach, describe, expect, it, vi } from "vitest";

const { buildSnapshotRowsMock, loadSeasonSourcesMock } = vi.hoisted(() => ({
  buildSnapshotRowsMock: vi.fn(),
  loadSeasonSourcesMock: vi.fn(),
}));

vi.mock("./rankingQueries", () => ({
  buildContextualRankingSnapshotRowsByMetric: buildSnapshotRowsMock,
}));

vi.mock("./skaterCompositeSourceCoverage", () => ({
  loadSkaterCompositeSeasonSources: loadSeasonSourcesMock,
}));

vi.mock("lib/supabase/server", () => ({ default: {} }));

const COMPLETE_SEASON_ROWS = [{ player_id: 1 }, { player_id: 2 }];

import {
  buildEntityMetricRankingRows,
  defaultEntityMetricRankingMetricKeys,
  planEntityMetricRankingPublication,
  publishEntityMetricRankingRows,
  upsertEntityMetricRankingRows,
  type EntityMetricRankingBuildRequest,
  type EntityMetricRankingBuildResult,
  type EntityMetricRankingInsert,
} from "./entityMetricRankingWriter";
import type { ContextualRankingSnapshotMetricRows } from "./rankingQueries";

const request: EntityMetricRankingBuildRequest = {
  season: 20252026,
  asOfDate: "2026-04-16",
  windows: ["last5"],
  position: "all",
  deployment: "all",
  strength: "5v5",
  minGp: 1,
  minToiSeconds: 300,
  teamId: null,
  peerGroupType: "all_skaters",
  metricKeys: ["points_per_60"],
};

function snapshot(
  overrides: Partial<ContextualRankingSnapshotMetricRows> = {},
): ContextualRankingSnapshotMetricRows {
  return {
    request: {
      entity: "skaters",
      season: 20252026,
      asOfDate: "2026-04-16",
      window: "last5",
      position: "all",
      deployment: "all",
      strength: "5v5",
      metric: "points_per_60",
      minGp: 1,
      minToiSeconds: 300,
      teamId: null,
      peerGroupType: "all_skaters",
      sort: "percentile",
      direction: "desc",
      limit: null,
      entityIds: null,
    },
    metricKey: "points_per_60",
    snapshotDate: "2026-04-16",
    snapshotUpdatedAt: "2026-04-16T06:00:00.000Z",
    latestAvailableSnapshotDate: "2026-04-16",
    snapshotSelectionReason: "latest_available",
    unavailable: false,
    message: null,
    rankedRows: [
      {
        entityId: 1,
        teamId: 10,
        metricKey: "points_per_60",
        rawValue: null,
        gamesPlayed: 5,
        toiSeconds: 600,
        positionGroup: "forward",
        deploymentBucket: "L1",
        peerGroupType: "all_skaters",
        peerGroupKey: "all",
        calculatedRawValue: 3.25,
        normalizedValue: 3.25,
        rawRank: 1,
        percentile: 100,
        qualifiedPeerCount: 2,
        minimumSampleMet: true,
        sampleConfidence: "high",
        warnings: [],
      },
      {
        entityId: 2,
        teamId: 11,
        metricKey: "points_per_60",
        rawValue: null,
        gamesPlayed: 1,
        toiSeconds: 120,
        positionGroup: "defense",
        deploymentBucket: "L2",
        peerGroupType: "all_skaters",
        peerGroupKey: "all",
        calculatedRawValue: 1.1,
        normalizedValue: 1.1,
        rawRank: null,
        percentile: null,
        qualifiedPeerCount: 2,
        minimumSampleMet: false,
        sampleConfidence: "low",
        warnings: ["sample_below_minimum"],
      },
    ],
    ...overrides,
  };
}

describe("entityMetricRankingWriter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadSeasonSourcesMock.mockResolvedValue({
      report: { verified: true, blockers: [] },
      rows: COMPLETE_SEASON_ROWS,
    });
  });

  it("defaults to rolling-backed matrix metrics only", () => {
    const metricKeys = defaultEntityMetricRankingMetricKeys({ strength: "5v5" });

    expect(metricKeys).toContain("points_per_60");
    expect(metricKeys).not.toContain("offense_rating");
    expect(metricKeys).not.toContain("defense_rating");
    expect(metricKeys).not.toContain("mcm_score");
    expect(metricKeys).not.toContain("beast_tier");
  });

  it("maps verified ranking snapshot rows to entity_metric_rankings inserts", async () => {
    buildSnapshotRowsMock.mockResolvedValue(
      new Map([["points_per_60", snapshot()]]),
    );

    const result = await buildEntityMetricRankingRows(request);

    expect(loadSeasonSourcesMock).toHaveBeenCalledTimes(1);
    expect(loadSeasonSourcesMock).toHaveBeenCalledWith(expect.anything(), {
      season: 20252026,
      strength: "5v5",
      cutoffDate: "2026-04-16",
    });
    expect(buildSnapshotRowsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        window: "last5",
        metric: "points_per_60",
        limit: null,
      }),
      ["points_per_60"],
      { completeSeasonRows: COMPLETE_SEASON_ROWS },
    );
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toMatchObject({
      entity_type: "skater",
      entity_id: 1,
      team_id: 10,
      season_id: 20252026,
      snapshot_date: "2026-04-16",
      window_type: "last_5",
      window_size: 5,
      window_semantics: "player_last_n_games_played",
      strength_state: "5v5",
      metric_key: "points_per_60",
      peer_group_type: "all_skaters",
      peer_group_key: "all",
      raw_value: 3.25,
      normalized_value: 3.25,
      raw_rank: 1,
      percentile: 100,
      qualified_peer_count: 2,
      minimum_sample_met: true,
      sample_confidence: "high",
      games_played: 5,
      toi_seconds: 600,
      methodology_version: "contextual_rankings_v1",
    });
    expect(result.rows[0]?.tags).toEqual(["L1"]);
    expect(result.rows[0]?.explanation_items).toContain(
      "Rank 1 of 2 in all_skaters:all.",
    );
    expect(result.rows[0]?.explanation_items).toContain(
      "Mid-rank percentile 100.0 among qualified peers after metric directionality is applied (ties share the mid-rank).",
    );
    expect(result.rows[0]?.provenance).toMatchObject({
      sourceTable: "rolling_player_game_metrics",
      writer: "entityMetricRankingWriter",
      snapshotUpdatedAt: "2026-04-16T06:00:00.000Z",
    });
    expect(result.rows[1]).toMatchObject({
      entity_id: 2,
      raw_rank: null,
      percentile: null,
      minimum_sample_met: false,
      sample_confidence: "low",
    });
    expect(result.rows[1]?.tags).toEqual(["low-sample", "L2"]);
    expect(result.contexts).toMatchObject([
      {
        window: "last5",
        snapshotDate: "2026-04-16",
        generatedRows: 2,
      },
    ]);
  });

  it("refuses to build when the complete-population source coverage is unverified", async () => {
    loadSeasonSourcesMock.mockResolvedValue({
      report: { verified: false, blockers: ["2 players lack a verified current rolling row"] },
      rows: [],
    });

    await expect(buildEntityMetricRankingRows(request)).rejects.toThrow(
      "Source coverage is not verified; no entity metric rankings were built. 2 players lack a verified current rolling row",
    );
    expect(buildSnapshotRowsMock).not.toHaveBeenCalled();
  });

  it("reports unavailable snapshot metrics without inventing rows", async () => {
    buildSnapshotRowsMock.mockResolvedValue(
      new Map([
        [
          "points_per_60",
          snapshot({
            snapshotDate: null,
            snapshotUpdatedAt: null,
            latestAvailableSnapshotDate: null,
            unavailable: true,
            message: "Requested metric has no calculable values.",
            rankedRows: [],
          }),
        ],
      ]),
    );

    const result = await buildEntityMetricRankingRows(request);

    expect(result.rows).toEqual([]);
    expect(result.unavailableMetrics).toEqual([
      {
        window: "last5",
        metricKey: "points_per_60",
        reason: "Requested metric has no calculable values.",
      },
    ]);
    expect(result.sourceFreshness[0]).toMatchObject({
      unavailable: true,
      reason: "Requested metric has no calculable values.",
    });
  });

  it("upserts rows in chunks using the table primary key", async () => {
    const upsertMock = vi.fn().mockResolvedValue({ error: null });
    const client = {
      from: vi.fn(() => ({
        upsert: upsertMock,
      })),
    };
    const rows = Array.from({ length: 501 }, (_, index) => ({
      entity_type: "skater",
      entity_id: index + 1,
      season_id: 20252026,
      snapshot_date: "2026-04-16",
      window_type: "last_5",
      window_size: 5,
      window_semantics: "player_last_n_games_played",
      strength_state: "5v5",
      metric_key: "points_per_60",
      peer_group_type: "all_skaters",
      peer_group_key: "all",
    })) as EntityMetricRankingInsert[];

    const rowsUpserted = await upsertEntityMetricRankingRows(client as any, rows, {
      chunkSize: 500,
    });

    expect(rowsUpserted).toBe(501);
    expect(client.from).toHaveBeenCalledWith("entity_metric_rankings");
    expect(upsertMock).toHaveBeenCalledTimes(2);
    expect(upsertMock.mock.calls[0]?.[0]).toHaveLength(500);
    expect(upsertMock.mock.calls[1]?.[0]).toHaveLength(1);
    expect(upsertMock.mock.calls[0]?.[1]).toEqual({
      onConflict:
        "entity_type,entity_id,season_id,snapshot_date,window_type,window_size,strength_state,metric_key,peer_group_type,peer_group_key",
      count: "exact",
    });
  });

  it("splits failed upsert chunks and retries smaller payloads", async () => {
    const upsertMock = vi
      .fn()
      .mockResolvedValueOnce({
        error: { message: "TypeError: fetch failed" },
      })
      .mockResolvedValue({ error: null });
    const client = {
      from: vi.fn(() => ({
        upsert: upsertMock,
      })),
    };
    const rows = Array.from({ length: 4 }, (_, index) => ({
      entity_type: "skater",
      entity_id: index + 1,
      season_id: 20252026,
      snapshot_date: "2026-04-16",
      window_type: "last_5",
      window_size: 5,
      window_semantics: "player_last_n_games_played",
      strength_state: "5v5",
      metric_key: "points_per_60",
      peer_group_type: "all_skaters",
      peer_group_key: "all",
    })) as EntityMetricRankingInsert[];

    const rowsUpserted = await upsertEntityMetricRankingRows(client as any, rows, {
      chunkSize: 4,
    });

    expect(rowsUpserted).toBe(4);
    expect(upsertMock).toHaveBeenCalledTimes(3);
    expect(upsertMock.mock.calls[0]?.[0]).toHaveLength(4);
    expect(upsertMock.mock.calls[1]?.[0]).toHaveLength(2);
    expect(upsertMock.mock.calls[2]?.[0]).toHaveLength(2);
  });
});

describe("Rankings publication completion markers", () => {
  const metricKeys = defaultEntityMetricRankingMetricKeys({ strength: "5v5" });
  const fullRequest: EntityMetricRankingBuildRequest = {
    season: 20262027,
    asOfDate: "2026-11-14",
    windows: ["season", "last10"],
    position: "all",
    deployment: "all",
    strength: "5v5",
    minGp: 1,
    minToiSeconds: 300,
    teamId: null,
    peerGroupType: "all_skaters",
    metricKeys,
  };
  const rowsFor = (window: "season" | "last_10", size: number, date = "2026-11-14", players = [1, 2]) =>
    players.flatMap((entity_id) =>
      metricKeys.map((metric_key) => ({
        entity_type: "skater",
        entity_id,
        season_id: 20262027,
        snapshot_date: date,
        window_type: window,
        window_size: size,
        window_semantics: "season_to_date",
        strength_state: "5v5",
        metric_key,
        peer_group_type: "all_skaters",
        peer_group_key: "all",
      })),
    ) as EntityMetricRankingInsert[];
  const built = (overrides: Partial<EntityMetricRankingBuildResult> = {}): EntityMetricRankingBuildResult => ({
    request: fullRequest,
    rows: [...rowsFor("season", 0), ...rowsFor("last_10", 10)],
    contexts: [],
    sourceFreshness: [],
    unavailableMetrics: [],
    expectedEntities: 2,
    expectedPlayerIds: [1, 2],
    ...overrides,
  });

  // Records every write in order; `failRankingsAfter` makes the Nth rankings
  // upsert fail, `shortCount` makes the database report one row fewer.
  function fakeClient(options: { failRankingsAfter?: number; shortCount?: boolean; noCount?: boolean; markerError?: unknown } = {}) {
    const log: Array<{ table: string; rows: any[]; options: any }> = [];
    let rankingsCalls = 0;
    const client = {
      from: vi.fn((table: string) => ({
        select: () => ({ match: () => ({ in: async () => ({ error: null, count: 2 * metricKeys.length }) }) }),
        upsert: vi.fn(async (rows: any[], upsertOptions: any) => {
          log.push({ table, rows, options: upsertOptions });
          if (table === "ranking_publications") {
            return { error: options.markerError ?? null };
          }
          rankingsCalls += 1;
          if (options.failRankingsAfter != null && rankingsCalls > options.failRankingsAfter) {
            return { error: { message: "fixture chunk failure" }, count: null };
          }
          if (options.noCount) return { error: null, count: null };
          return { error: null, count: options.shortCount ? rows.length - 1 : rows.length };
        }),
      })),
    };
    return { client, log };
  }
  const markers = (log: Array<{ table: string; rows: any[] }>) =>
    log.filter((entry) => entry.table === "ranking_publications").flatMap((entry) => entry.rows);

  it("marks every window writing before the first row, then complete after the database confirms each window", async () => {
    const { client, log } = fakeClient();
    const result = await publishEntityMetricRankingRows(client as any, built(), { chunkSize: 50 });
    expect(log[0]?.table).toBe("ranking_publications");
    expect(log[0]?.rows.map((row) => [row.window_type, row.status])).toEqual([
      ["season", "writing"],
      ["last_10", "writing"],
    ]);
    const finals = markers(log).slice(2);
    expect(finals.map((row) => [row.window_type, row.status, row.db_written_rows, row.written_entities])).toEqual([
      ["season", "complete", metricKeys.length * 2, 2],
      ["last_10", "complete", metricKeys.length * 2, 2],
    ]);
    expect(finals[0]).toMatchObject({
      surface: "entity_metric_rankings", season_id: 20262027, snapshot_date: "2026-11-14",
      strength_state: "5v5", peer_group_type: "all_skaters", peer_group_key: "all",
      min_gp: 1, min_toi_seconds: 300, expected_rows: metricKeys.length * 2, expected_entities: 2,
      metric_set: [...metricKeys].sort(),
    });
    expect(finals[0]?.completed_at).toEqual(expect.any(String));
    expect(result.complete).toBe(true);
  });

  it("leaves the marker at writing when a chunk fails part-way", async () => {
    const { client, log } = fakeClient({ failRankingsAfter: 1 });
    await expect(publishEntityMetricRankingRows(client as any, built(), { chunkSize: 10 })).rejects.toThrow("fixture chunk failure");
    expect(markers(log).every((row) => row.status === "writing")).toBe(true);
  });

  it("does not mark complete when the database reports fewer rows than were built", async () => {
    const { client, log } = fakeClient({ shortCount: true });
    const result = await publishEntityMetricRankingRows(client as any, built());
    expect(result.complete).toBe(false);
    expect(markers(log).every((row) => row.status === "writing")).toBe(true);
    expect(result.windows[0]?.blockers.join(" ")).toContain("The database reported");
  });

  it("does not mark complete when the database reports no count", async () => {
    const { client } = fakeClient({ noCount: true });
    const result = await publishEntityMetricRankingRows(client as any, built());
    expect(result.complete).toBe(false);
    expect(result.windows[0]?.blockers.join(" ")).toContain("did not report");
  });

  it("refuses a full publication before writing when a window is short of the source-coverage population", async () => {
    const { client, log } = fakeClient();
    await expect(publishEntityMetricRankingRows(client as any, built({ expectedEntities: 3 }))).rejects.toThrow("population is 3");
    expect(log).toHaveLength(0);
  });

  it("refuses a same-sized substituted ID in a single metric before any write", async () => {
    const { client, log } = fakeClient();
    const rows = built().rows.map(row => row.window_size === 10 && row.metric_key === metricKeys[0] &&
      row.entity_id === 2 ? { ...row, entity_id: 99 } : row);
    await expect(publishEntityMetricRankingRows(client as any, built({ rows }))).rejects.toThrow(/player IDs differ/);
    expect(log).toHaveLength(0);
  });

  it("refuses windows built at different cutoffs before any write", async () => {
    const { client, log } = fakeClient();
    const rows = [...rowsFor("season", 0), ...rowsFor("last_10", 10, "2026-11-13")];
    await expect(publishEntityMetricRankingRows(client as any, built({ rows }))).rejects.toThrow(/different snapshot dates/);
    expect(log).toHaveLength(0);
  });

  it("refuses a window whose rows span more than one snapshot date", async () => {
    const { client, log } = fakeClient();
    const rows = [...rowsFor("season", 0, "2026-11-14", [1]), ...rowsFor("season", 0, "2026-11-13", [2]), ...rowsFor("last_10", 10)];
    await expect(publishEntityMetricRankingRows(client as any, built({ rows }))).rejects.toThrow("span 2 snapshot dates");
    expect(log).toHaveLength(0);
  });

  it("refuses when a default metric has no rows in a window", async () => {
    const { client } = fakeClient();
    const rows = [...rowsFor("season", 0).filter((row) => row.metric_key !== metricKeys[0]), ...rowsFor("last_10", 10)];
    await expect(publishEntityMetricRankingRows(client as any, built({ rows }))).rejects.toThrow(`no rows for ${metricKeys[0]}`);
  });

  it.each([
    ["one metric", { metricKeys: [metricKeys[0]!] }],
    ["a custom GP floor", { minGp: 10 }],
    ["a team scope", { teamId: 22, peerGroupType: "team" as const }],
  ])("writes %s without any marker", async (_label, overrides) => {
    const { client, log } = fakeClient();
    const result = await publishEntityMetricRankingRows(client as any, built({ request: { ...fullRequest, ...overrides } }));
    expect(result.marked).toBe(false);
    expect(markers(log)).toHaveLength(0);
    expect(result.rowsUpserted).toBe(built().rows.length);
  });

  it("writes no marker when a metric was unavailable", async () => {
    const { client, log } = fakeClient();
    const result = await publishEntityMetricRankingRows(client as any, built({
      unavailableMetrics: [{ window: "season", metricKey: metricKeys[0]!, reason: "fixture" }],
    }));
    expect(result.marked).toBe(false);
    expect(markers(log)).toHaveLength(0);
  });

  it("stops before writing rows when the marker table is not deployed", async () => {
    const { client, log } = fakeClient({ markerError: { code: "PGRST205", message: "Could not find the table 'public.ranking_publications' in the schema cache" } });
    await expect(publishEntityMetricRankingRows(client as any, built())).rejects.toThrow("not deployed");
    expect(log.filter((entry) => entry.table === "entity_metric_rankings")).toHaveLength(0);
  });

  it("plans a dry run without writing", () => {
    const plan = planEntityMetricRankingPublication(built({ expectedEntities: 3 }));
    expect(plan.marked).toBe(true);
    expect(plan.windows.map((window) => [window.windowType, window.expectedRows, window.writtenEntities])).toEqual([
      ["season", metricKeys.length * 2, 2],
      ["last_10", metricKeys.length * 2, 2],
    ]);
    expect(plan.windows[0]?.blockers.join(" ")).toContain("population is 3");
  });
});
