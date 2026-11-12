import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ContextualRankingApiRow } from "./rankingTypes";
import {
  buildSkaterCompositeRatingRow,
  buildSkaterCompositeRatingRows,
  upsertSkaterCompositeRatingRows,
  calculateArchetypeScores,
  calculateDefenseRating,
  calculateMcmScore,
  calculateOffenseRating,
  resolveBeastTier,
  SKATER_COMPOSITE_SOURCE_METRICS,
  type SkaterCompositeBuildRequest,
} from "./skaterCompositeWriter";
import { MCM_COMPONENTS, getMcmComponentGroups } from "./skaterCompositeMethodology";
import type { ContextualRankingsResponse } from "./rankingTypes";

const { surfacesMock, coverageMock } = vi.hoisted(() => ({ surfacesMock: vi.fn(), coverageMock: vi.fn() }));
vi.mock("./skaterCompositeSourceCoverage", () => ({
  loadSkaterCompositeSeasonSources: async (...args: unknown[]) => ({ report: await coverageMock(...args), rows: [] }),
}));
vi.mock("./rankingQueries", () => ({ buildContextualRankingsSurfaces: surfacesMock }));
vi.mock("./resultsLuckSources", () => ({ fetchResultsLuckRollingSources: vi.fn(async () => new Map()) }));

const request: SkaterCompositeBuildRequest = {
  season: 20252026,
  asOfDate: null,
  window: "season",
  position: "all",
  deployment: "all",
  strength: "5v5",
  minGp: 1,
  minToiSeconds: 300,
  teamId: null,
  peerGroupType: "all_skaters",
  limit: 25,
};

const baseRow: ContextualRankingApiRow = {
  entity: {
    id: 8478402,
    name: "Test Skater",
    position: "C",
    positionGroup: "forward",
    imageUrl: null,
  },
  team: {
    id: 14,
    abbreviation: "TBL",
    name: "Tampa Bay Lightning",
  },
  deployment: {
    ev: "L1",
    pp: "PP1",
    pk: null,
    confidence: "high",
  },
  sample: {
    gamesPlayed: 20,
    toiSeconds: 24000,
    toiPerGameSeconds: 1200,
    confidence: "high",
    minimumSampleMet: true,
  },
  metric: {
    key: "points_per_60",
    value: 3.2,
    formattedValue: "3.20",
    rawRank: 1,
    percentile: 95,
    qualifiedPeerCount: 100,
  },
  peerGroup: {
    type: "all_skaters",
    key: "all_skaters",
  },
  tags: [],
  warnings: [],
  explanationItems: [],
};

const strongPercentiles = {
  goals_per_60: 90,
  points_per_60: 95,
  pp_points_per_60: 92,
  ixg_per_60: 88,
  shot_attempts_per_60: 84,
  sog_per_60: 82,
  primary_assists_per_60: 76,
  assists_per_60: 80,
  expected_shooting_percentage: 70,
  sax_percentage: 68,
  goals_above_expected: 72,
  xga_per_60: 85,
  on_ice_xgf_percentage: 82,
  on_ice_gf_percentage: 78,
  blocks_per_60: 65,
  hits_per_60: 81,
};

const sourceFreshness = [
  {
    metricKey: "points_per_60" as const,
    snapshotDate: "2026-03-01",
    snapshotUpdatedAt: "2026-03-01T12:00:00.000Z",
    unavailable: false,
    reason: null,
  },
  {
    metricKey: "sax_percentage" as const,
    snapshotDate: null,
    snapshotUpdatedAt: null,
    unavailable: true,
    reason: "Metric unavailable in this context.",
  },
];

describe("skaterCompositeWriter", () => {
  it("calculates bounded percentile-based composite scores", () => {
    expect(calculateOffenseRating(strongPercentiles)).toBe(83.88);
    expect(calculateDefenseRating(strongPercentiles)).toBe(79.25);
    expect(calculateMcmScore(strongPercentiles)).toBe(86.53);
    expect(calculateArchetypeScores(strongPercentiles)).toMatchObject({
      shootFirstScore: 77.3,
      passFirstScore: 71.2,
      playDriverScore: 81,
    });
  });

  it("refuses Offense and Defense when a required input is missing instead of reweighting (decision 102)", () => {
    // The defect: goals-only percentiles of 80 produced an Offense Rating of 80.
    expect(calculateOffenseRating({ goals_per_60: 80 })).toBeNull();
    expect(calculateDefenseRating({ blocks_per_60: 80 })).toBeNull();
    const { sax_percentage: _missing, ...withoutSax } = strongPercentiles;
    expect(calculateOffenseRating(withoutSax)).toBeNull();
    const { xga_per_60: _missingXga, ...withoutXga } = strongPercentiles;
    expect(calculateDefenseRating(withoutXga)).toBeNull();
  });

  it("resolves BEAST tiers from transparent multi-category gates", () => {
    expect(resolveBeastTier(strongPercentiles, calculateMcmScore(strongPercentiles))).toBe(
      "BEAST",
    );
    expect(
      resolveBeastTier(
        {
          sog_per_60: 61,
          hits_per_60: 62,
          blocks_per_60: 10,
          goals_per_60: 65,
        },
        null,
      ),
    ).toBeNull();
  });

  it("requests every live MCM scoring component from the source surfaces", () => {
    expect(SKATER_COMPOSITE_SOURCE_METRICS).toEqual(
      expect.arrayContaining([...MCM_COMPONENTS.scoring]),
    );
    expect(SKATER_COMPOSITE_SOURCE_METRICS).toContain("pp_points_per_60");
  });

  it("builds an upsert row with methodology, provenance, and missing luck status", () => {
    const row = buildSkaterCompositeRatingRow({
      request,
      baseRow,
      snapshotDate: "2026-03-01",
      snapshotUpdatedAt: "2026-03-01T12:00:00.000Z",
      percentiles: strongPercentiles,
      unavailableMetrics: [],
      sourceFreshness,
    });

    expect(row).toMatchObject({
      player_id: 8478402,
      team_id: 14,
      season_id: 20252026,
      snapshot_date: "2026-03-01",
      window_type: "season",
      window_size: 0,
      window_semantics: "season_to_date",
      strength_state: "5v5",
      peer_group_type: "all_skaters",
      peer_group_key: "all_skaters",
      position_group: "forward",
      deployment_bucket: "all",
      offense_rating_overall: 83.88,
      defense_rating_overall: 79.25,
      mcm_score: 86.23,
      beast_tier: "BEAST",
      results_luck_index: null,
      methodology_version: "contextual_composites_v3",
    });
    expect(row.tags).toEqual(["play_driver", "BEAST"]);
    expect(JSON.stringify(row.components_json)).toContain("not_computed");
    expect(JSON.stringify(row.components_json)).toContain("player_baselines");
    expect(row.components_json).toMatchObject({
      mcm: {
        liveComponents: {
          scoring: [
            "goals_per_60",
            "primary_assists_per_60",
            "points_per_60",
          ],
        },
        sourcePendingComponents: [],
      },
      resultsLuck: {
        signalComponents: [
          { key: "goals_above_expected", weight: 0.35 },
          { key: "sax_percentage", weight: 0.25 },
          { key: "ipp", weight: 0.2 },
          { key: "on_ice_shooting_context", weight: 0.2 },
        ],
        baselineProvenance: {
          baselineSource: "unavailable",
          baselineSnapshotDate: null,
          baselineWindowExcluded: false,
          baselineWeight: 0,
          peerBaselineValue: null,
          currentWindow: "season",
          warnings: [
            "baseline_not_persisted",
            "selected_window_exclusion_not_verified",
          ],
        },
      },
    });
    expect(JSON.stringify(row.provenance)).toContain("contextual_composites_v3");
    expect(row.provenance).toMatchObject({
      sourceFreshness,
    });
    expect(row.provenance).toMatchObject({
      sourceMetrics: expect.arrayContaining(["pp_points_per_60"]),
      sourcePendingMetrics: [],
    });
    expect(row.components_json).toMatchObject({
      percentiles: {
        pp_points_per_60: 92,
      },
    });
  });

  it("writes Results Luck only when source provenance passes the publish gate", () => {
    const row = buildSkaterCompositeRatingRow({
      request: { ...request, window: "last5" },
      baseRow,
      snapshotDate: "2026-03-01",
      snapshotUpdatedAt: "2026-03-01T12:00:00.000Z",
      percentiles: strongPercentiles,
      unavailableMetrics: [],
      sourceFreshness,
      resultsLuckSource: {
        playerId: 8478402,
        gameDate: "2026-03-01",
        strengthState: "5v5",
        baselineProvenance: {
          baselineSource: "player_non_overlapping",
          baselineSnapshotDate: "2026-03-01",
          baselineWindowExcluded: true,
          baselineWeight: 1,
          peerBaselineValue: null,
          warnings: [],
        },
        components: [
          {
            key: "goals_above_expected",
            semantics: "signed_difference",
            currentValue: 1.2,
            baselineValue: 0.2,
            scale: 2,
            weight: 0.35,
          },
          {
            key: "sax_percentage",
            semantics: "signed_difference",
            currentValue: 6,
            baselineValue: 2,
            scale: 10,
            weight: 0.25,
          },
          {
            key: "ipp",
            semantics: "ratio",
            currentValue: 0.72,
            baselineValue: 0.6,
            weight: 0.2,
          },
          {
            key: "on_ice_shooting_context",
            semantics: "contextual_on_ice",
            currentValue: 12,
            baselineValue: 10,
            scale: 10,
            weight: 0.2,
          },
        ],
      },
    });

    expect(row.results_luck_index).toBe(135.5);
    expect(row.components_json).toMatchObject({
      resultsLuck: {
        status: "computed",
        reason: null,
        baselineProvenance: {
          baselineSource: "player_non_overlapping",
          baselineWindowExcluded: true,
        },
        score: {
          canPublish: true,
          indexValue: 135.5,
        },
      },
    });
  });

  it("keeps Results Luck null when source provenance fails the publish gate", () => {
    const row = buildSkaterCompositeRatingRow({
      request: { ...request, window: "last5" },
      baseRow,
      snapshotDate: "2026-03-01",
      snapshotUpdatedAt: "2026-03-01T12:00:00.000Z",
      percentiles: strongPercentiles,
      unavailableMetrics: [],
      sourceFreshness,
      resultsLuckSource: {
        playerId: 8478402,
        gameDate: "2026-03-01",
        strengthState: "5v5",
        baselineProvenance: {
          baselineSource: "peer_fallback",
          baselineSnapshotDate: "2026-03-01",
          baselineWindowExcluded: false,
          baselineWeight: 0,
          peerBaselineValue: 100,
          warnings: ["selected_window_exclusion_not_verified"],
        },
        components: [
          {
            key: "ipp",
            semantics: "ratio",
            currentValue: 0.72,
            baselineValue: 0.6,
            weight: 1,
          },
        ],
      },
    });

    expect(row.results_luck_index).toBeNull();
    expect(row.components_json).toMatchObject({
      resultsLuck: {
        status: "not_computed",
        baselineProvenance: {
          baselineSource: "peer_fallback",
          baselineWindowExcluded: false,
        },
        score: {
          canPublish: false,
          indexValue: 120,
        },
      },
    });
  });

  it("writes deployment ratings when the request is scoped to a deployment bucket", () => {
    const row = buildSkaterCompositeRatingRow({
      request: { ...request, deployment: "L1", peerGroupType: "deployment" },
      baseRow,
      snapshotDate: "2026-03-01",
      snapshotUpdatedAt: null,
      percentiles: strongPercentiles,
      unavailableMetrics: [],
      sourceFreshness,
    });

    expect(row.offense_rating_overall).toBeNull();
    expect(row.defense_rating_overall).toBeNull();
    expect(row.peer_group_type).toBe("deployment");
    expect(row.peer_group_key).toBe("L1");
    expect(row.deployment_bucket).toBe("L1");
    expect(row.offense_rating_deployment).toBe(83.88);
    expect(row.defense_rating_deployment).toBe(79.25);
  });
});


describe("MCM integrity invariants", () => {
  const fields = [...MCM_COMPONENTS.riff, ...MCM_COMPONENTS.scoring];
  const uniform = (value: number) => Object.fromEntries(fields.map((field) => [field, value]));

  it("uses a fixed strength-specific universe, never availability-based reweighting", () => {
    expect(getMcmComponentGroups("5v5").scoring).not.toContain("pp_points_per_60");
    expect(getMcmComponentGroups("all").scoring).toContain("pp_points_per_60");
    const missingPp = { ...strongPercentiles, pp_points_per_60: null };
    expect(calculateMcmScore(missingPp)).toBeNull();
    expect(calculateMcmScore(missingPp, "5v5")).toBe(calculateMcmScore(strongPercentiles, "5v5"));
    expect(calculateMcmScore({ ...strongPercentiles, blocks_per_60: null }, "5v5")).toBeNull();
  });

  it.each([null, undefined, NaN, Infinity, -1, 100.01])("rejects missing/invalid required percentile %s", (bad) => {
    const values = { ...strongPercentiles, hits_per_60: bad } as any;
    expect(calculateMcmScore(values)).toBeNull();
    expect(resolveBeastTier(values, 100)).toBeNull();
  });

  it("respects endpoint, monotonicity and component permutation invariants", () => {
    expect(calculateMcmScore(uniform(0))).toBe(0);
    expect(calculateMcmScore(uniform(100))).toBe(100);
    for (const field of fields) {
      expect(calculateMcmScore({ ...uniform(50), [field]: 51 })!).toBeGreaterThanOrEqual(50);
    }
    expect(calculateMcmScore({ ...strongPercentiles, sog_per_60: 65, blocks_per_60: 82 })).toBe(calculateMcmScore(strongPercentiles));
    expect(calculateMcmScore({ ...strongPercentiles, goals_per_60: 95, points_per_60: 90 })).toBe(calculateMcmScore(strongPercentiles));
  });

  it("uses unrounded scores at every numeric gate", () => {
    for (const [threshold, belowTier, atTier] of [[70, "MCM Watch", "MCM"], [80, "MCM", "BEAST"], [88, "BEAST", "BEAST+"]] as const) {
      const values = uniform(threshold - 0.001);
      expect(calculateMcmScore(values)).toBe(threshold);
      expect(resolveBeastTier(values, calculateMcmScore(values))).toBe(belowTier);
      expect(resolveBeastTier(uniform(threshold), threshold)).toBe(atTier);
    }
  });

  it("cannot award a badge from a caller-supplied high score", () => {
    expect(resolveBeastTier(uniform(65), 100)).toBe("MCM Watch");
    expect(resolveBeastTier(uniform(100), null)).toBeNull();
  });
});

function completeSurfaces() {
  return new Map(SKATER_COMPOSITE_SOURCE_METRICS.map((metricKey) => [metricKey, {
    success: true,
    rankings: [1, 2, 3].map((id) => ({
      ...baseRow,
      entity: { ...baseRow.entity, id },
      metric: { ...baseRow.metric, key: metricKey, value: 4 - id, percentile: (3 - id) * 50, qualifiedPeerCount: 3 },
    })),
    meta: { snapshotDate: "2026-03-01", latestAvailableSnapshotDate: "2026-03-01", snapshotUpdatedAt: "2026-03-01T12:00:00Z", unavailable: false },
  } as ContextualRankingsResponse]));
}

describe("composite source and publication integrity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    surfacesMock.mockResolvedValue(completeSurfaces());
    coverageMock.mockResolvedValue({ verified: true, blockers: [], expectedPlayerCount: 3, scannedSourceRows: 3, staleOrMissingPlayerIds: [], cutoffDate: "2026-03-01" });
  });

  it("ranks all metrics in one complete-cohort read and limits only joined output", async () => {
    const result = await buildSkaterCompositeRatingRows({ ...request, limit: 1 });
    expect(surfacesMock).toHaveBeenCalledTimes(1);
    expect(surfacesMock.mock.calls[0][0].limit).toBeNull();
    expect(surfacesMock.mock.calls[0][2]).toEqual({ completeSeasonRows: [] });
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].mcm_score).toBe(100);
    expect(result.publication).toMatchObject({ ready: false, candidateCount: 3, scoredCount: 3, truncated: true });
  });

  it("blocks fresh-looking composites when individual rolling players are stale", async () => {
    coverageMock.mockResolvedValueOnce({ verified: false, blockers: ["326 stale players"], staleOrMissingPlayerIds: [1] });
    const result = await buildSkaterCompositeRatingRows(request);
    expect(result.publication.ready).toBe(false);
    expect(result.publication.blockers.join()).toContain("326 stale players");
  });

  it("does not penalize a structurally excluded PP source in 5v5", async () => {
    const surfaces = completeSurfaces();
    surfaces.delete("pp_points_per_60");
    surfacesMock.mockResolvedValue(surfaces);
    const result = await buildSkaterCompositeRatingRows(request);
    expect(result.publication.ready).toBe(true);
    expect(result.rows.map((row) => row.mcm_score)).toEqual([100, 50, 0]);
  });

  it("independently rejects plausible in-range but incorrectly calculated percentiles", async () => {
    const surfaces = completeSurfaces();
    surfaces.get("hits_per_60")!.rankings[1].metric.percentile = 75;
    surfacesMock.mockResolvedValue(surfaces);
    const result = await buildSkaterCompositeRatingRows(request);
    expect(result.publication.ready).toBe(false);
    expect(result.publication.blockers.join()).toContain("does not match the complete raw population");
  });

  it("reproduces published six-component sample arithmetic independently checked by the audit", () => {
    const beast = { sog_per_60: 95.890, hits_per_60: 94.110, blocks_per_60: 86.712, goals_per_60: 84.658, primary_assists_per_60: 86.849, points_per_60: 85.890, pp_points_per_60: null };
    const other = { sog_per_60: 70.959, hits_per_60: 10.685, blocks_per_60: 6.575, goals_per_60: 92.055, primary_assists_per_60: 52.740, points_per_60: 92.466, pp_points_per_60: null };
    expect(calculateMcmScore(beast, "5v5")).toBe(90.95);
    expect(resolveBeastTier(beast, 90.95, "5v5")).toBe("BEAST+");
    expect(calculateMcmScore(other, "5v5")).toBe(61.58);
    expect(resolveBeastTier(other, 61.58, "5v5")).toBeNull();
  });

  it("does not merge older metrics into a fresh composite snapshot", async () => {
    const surfaces = completeSurfaces();
    surfaces.get("hits_per_60")!.meta.snapshotDate = "2026-02-28";
    surfacesMock.mockResolvedValue(surfaces);
    const result = await buildSkaterCompositeRatingRows(request);
    expect(result.rows.every((row) => row.mcm_score == null && row.beast_tier == null)).toBe(true);
    expect(result.publication.ready).toBe(false);
    expect(result.publication.blockers.join()).toContain("snapshot does not match");
  });

  it.each(["sample", "peers", "peer", "missing", "invalid"])("suppresses unqualified %s components instead of reweighting", async (fault) => {
    const surfaces = completeSurfaces();
    const rows = surfaces.get("hits_per_60")!.rankings;
    if (fault === "sample") rows[0].sample = { ...rows[0].sample, minimumSampleMet: false };
    if (fault === "peers") rows[0].metric.qualifiedPeerCount = 1;
    if (fault === "peer") rows[0].peerGroup = { type: "team", key: "14" };
    if (fault === "missing") rows.shift();
    if (fault === "invalid") rows[0].metric.percentile = 101;
    surfacesMock.mockResolvedValue(surfaces);
    const result = await buildSkaterCompositeRatingRows(request);
    expect(result.rows[0].mcm_score).toBeNull();
    expect(result.rows[0].beast_tier).toBeNull();
    expect(result.rows[0].components_json).toMatchObject({ mcm: { missingRequiredComponents: ["hits_per_60"], status: "unavailable" } });
  });

  it("rejects mixed per-player source versions within the same global snapshot", async () => {
    const surfaces = completeSurfaces();
    surfaces.get("hits_per_60")!.rankings[0].sourceSnapshot = { date: "2026-02-28", updatedAt: "2026-03-01T12:00:00Z" };
    surfacesMock.mockResolvedValue(surfaces);
    const result = await buildSkaterCompositeRatingRows(request);
    expect(result.rows[0].mcm_score).toBeNull();
    expect(result.publication.blockers.join()).toContain("inconsistent per-player source snapshot");
  });

  it("rejects duplicate IDs and durable-key collisions before publication", async () => {
    const surfaces = completeSurfaces();
    surfaces.get("hits_per_60")!.rankings.push(surfaces.get("hits_per_60")!.rankings[0]);
    surfacesMock.mockResolvedValue(surfaces);
    const result = await buildSkaterCompositeRatingRows({ ...request, teamId: 1, position: "F", minGp: 5 });
    expect(result.publication.ready).toBe(false);
    expect(result.publication.blockers.join()).toContain("duplicate player IDs");
    expect(result.publication.blockers.join()).toContain("Combined filters");
    expect(result.publication.blockers.join()).toContain("Custom sample thresholds");
  });
});


describe("atomic composite publication", () => {
  it("writes the whole bounded cohort in one bulk statement, not partial chunks", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const client = { from: vi.fn(() => ({ upsert })) };
    const rows = Array.from({ length: 732 }, (_, player_id) => ({ player_id })) as any;
    expect(await upsertSkaterCompositeRatingRows(client as any, rows)).toBe(732);
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(upsert.mock.calls[0][0]).toHaveLength(732);
  });

  it("fails without retry or partial fallback when the statement fails", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: { message: "fixture failure" } });
    const client = { from: vi.fn(() => ({ upsert })) };
    await expect(upsertSkaterCompositeRatingRows(client as any, [{ player_id: 1 }] as any)).rejects.toThrow("fixture failure");
    expect(upsert).toHaveBeenCalledTimes(1);
  });
});
