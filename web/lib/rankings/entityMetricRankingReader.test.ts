import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

type QueryState = {
  table: string;
  selectFields: string | null;
  filters: Record<string, unknown>;
  rangeFrom: number | null;
  rangeTo: number | null;
  cutoffs: Record<string, unknown>;
  orders: Array<{ key: string; ascending: boolean }>;
  limitCount: number | null;
};

const { queryCalls, scenario, supabaseMock } = vi.hoisted(() => {
  const queryCalls: QueryState[] = [];
  const scenario = {
    rows: null as Array<Record<string, unknown>> | null,
    rollingRows: [] as Array<Record<string, unknown>>,
  };

  function resolveQuery(state: QueryState) {
    if (scenario.rows != null) {
      let rows: Array<Record<string, unknown>> = state.table === "entity_metric_rankings" ? scenario.rows
        : state.table === "rolling_player_game_metrics" ? scenario.rollingRows
          : state.table === "games" ? scenario.rollingRows.map(row => ({ date: row.game_date, seasonId: row.season }))
            : state.table === "players" ? scenario.rows.map(row => ({ id: row.entity_id, fullName: `Fixture ${row.entity_id}`, position: row.position_group === "defense" ? "D" : "C", team_id: row.team_id }))
              : state.table === "teams" ? [{ id: 10, abbreviation: "TST", name: "Fictional team" }] : [];
      rows = rows.filter(row => Object.entries(state.filters).every(([key, value]) =>
        key in state.cutoffs || (Array.isArray(value) ? value.includes(row[key]) : row[key] === value),
      ) && Object.entries(state.cutoffs).every(([key, value]) => String(row[key]) <= String(value)));
      rows = [...rows].sort((left, right) => {
        for (const { key, ascending } of state.orders) {
          const a = left[key] as number | string | null;
          const b = right[key] as number | string | null;
          if (a === b) continue;
          if (a == null) return 1;
          if (b == null) return -1;
          return (a < b ? -1 : 1) * (ascending ? 1 : -1);
        }
        return 0;
      });
      rows = rows.slice(state.rangeFrom ?? 0, state.rangeTo == null ? undefined : state.rangeTo + 1);
      if (state.limitCount != null) rows = rows.slice(0, state.limitCount);
      return { data: rows, error: null };
    }
    if (
      state.table === "entity_metric_rankings" &&
      state.selectFields === "snapshot_date"
    ) {
      return {
        data: [{ snapshot_date: "2026-04-16" }],
        error: null,
      };
    }

    if (state.table === "entity_metric_rankings") {
      return {
        data: [
          {
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
            position_group: "forward",
            deployment_bucket: "L1",
            raw_value: 3.2,
            normalized_value: 3.2,
            raw_rank: 1,
            percentile: 100,
            qualified_peer_count: 1,
            minimum_sample_met: true,
            sample_confidence: "high",
            games_played: 5,
            toi_seconds: 600,
            tags: ["L1"],
            explanation_items: ["Rank 1 of 1 in all_skaters:all."],
            provenance: {},
            methodology_version: "contextual_rankings_v1",
            created_at: "2026-04-16T06:00:00.000Z",
            updated_at: "2026-04-16T06:00:00.000Z",
          },
        ],
        error: null,
      };
    }

    if (state.table === "players") {
      return {
        data: [
          {
            id: 1,
            fullName: "Snapshot Skater",
            position: "C",
            team_id: 10,
            image_url: "https://example.test/player.png",
          },
        ],
        error: null,
      };
    }

    if (state.table === "teams") {
      return {
        data: [{ id: 10, abbreviation: "TST", name: "Test Team" }],
        error: null,
      };
    }

    return { data: [], error: null };
  }

  function createQuery(table: string) {
    const state: QueryState = {
      table,
      selectFields: null,
      filters: {},
      rangeFrom: null,
      rangeTo: null,
      cutoffs: {},
      orders: [],
      limitCount: null,
    };
    queryCalls.push(state);

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
        state.cutoffs[key] = value;
        return query;
      },
      order(key: string, options?: { ascending?: boolean }) {
        state.orders.push({ key, ascending: options?.ascending ?? true });
        return query;
      },
      limit(count: number) {
        state.limitCount = count;
        return Promise.resolve(resolveQuery(state));
      },
      in(key: string, value: unknown) {
        state.filters[key] = value;
        return query;
      },
      range(from: number, to: number) {
        state.rangeFrom = from;
        state.rangeTo = to;
        return Promise.resolve(resolveQuery(state));
      },
    };

    return query;
  }

  return {
    queryCalls,
    scenario,
    supabaseMock: {
      from: vi.fn((table: string) => createQuery(table)),
    },
  };
});

vi.mock("lib/supabase/server", () => ({
  default: supabaseMock,
}));

import {
  buildEntityMetricRankingSurfaces,
  clearEntityMetricRankingReaderCachesForTests,
} from "./entityMetricRankingReader";
import type { ContextualRankingsRequest } from "./rankingTypes";
import { buildContextualRankingsSurface, clearContextualRankingsQueryCachesForTests } from "./rankingQueries";
import { DEFAULT_RANKINGS_FILTERS, FANTASY_RANKINGS_PRESET } from "./rankingUrlState";
import { getContextualRankingMetricDefinition, type ContextualRankingMetricKey } from "./metricDefinitions";
import fixture from "./fixtures/rankingsTrust.json";
import { buildContextualRankingsMetadataSurface } from "./rankingMetadata";

function request(overrides: Partial<ContextualRankingsRequest> = {}): ContextualRankingsRequest {
  return {
    entity: "skaters", season: 20252026, asOfDate: "2026-04-16", window: "last5",
    position: "all", deployment: "all", strength: "5v5", metric: "points_per_60",
    minGp: 5, minToiSeconds: 300, teamId: null, peerGroupType: "all_skaters",
    sort: "percentile", direction: "desc", limit: null, entityIds: null, ...overrides,
  };
}

function snapshotRow(id: number, overrides: Record<string, unknown> = {}) {
  return {
    entity_type: "skater", entity_id: id, team_id: 10, season_id: 20252026,
    snapshot_date: "2026-04-16", window_type: "last_5", window_size: 5,
    strength_state: "5v5", metric_key: "points_per_60", peer_group_type: "all_skaters",
    peer_group_key: "all", position_group: "forward", deployment_bucket: "L1",
    raw_value: id === 1 ? 12 : id === 2 ? 4 : 0,
    raw_rank: id, percentile: id === 1 ? 100 : id === 2 ? 50 : 0,
    qualified_peer_count: 3, minimum_sample_met: true, sample_confidence: "high",
    games_played: id === 1 ? 1 : 5, toi_seconds: id === 1 ? 300 : 1800,
    tags: [], explanation_items: ["Stored rank from a different minimum."],
    updated_at: "2026-04-16T06:00:00.000Z", ...overrides,
  };
}

describe("entityMetricRankingReader", () => {
  beforeEach(() => {
    queryCalls.length = 0;
    scenario.rows = null;
    scenario.rollingRows = [];
    vi.useRealTimers();
    clearEntityMetricRankingReaderCachesForTests();
    clearContextualRankingsQueryCachesForTests();
    supabaseMock.from.mockClear();
  });

  it("reranks the complete snapshot cohort under selected minimums before applying a limit", async () => {
    scenario.rows = [snapshotRow(1), snapshotRow(2), snapshotRow(3)];
    const surfaces = await buildEntityMetricRankingSurfaces(request({ limit: 1 }), ["points_per_60"]);
    expect(surfaces.get("points_per_60")?.rankings).toMatchObject([
      { entity: { id: 2 }, metric: { rawRank: 1, percentile: 100, qualifiedPeerCount: 2 } },
    ]);
    expect(queryCalls.find(call => call.table === "entity_metric_rankings" && call.selectFields !== "snapshot_date")?.limitCount).toBeNull();
  });

  it("preserves cohort ranks when selecting a single displayed entity", async () => {
    scenario.rows = [snapshotRow(1), snapshotRow(2), snapshotRow(3)];
    const surfaces = await buildEntityMetricRankingSurfaces(request({ entityIds: [3] }), ["points_per_60"]);
    expect(surfaces.get("points_per_60")?.rankings[0]?.metric).toMatchObject({ rawRank: 2, percentile: 0, qualifiedPeerCount: 2 });
  });

  it("ranks newly qualified rows when a selected minimum is relaxed", async () => {
    scenario.rows = [snapshotRow(1, { raw_rank: null, percentile: null, minimum_sample_met: false }), snapshotRow(2), snapshotRow(3)];
    const surfaces = await buildEntityMetricRankingSurfaces(request({ minGp: 1 }), ["points_per_60"]);
    expect(surfaces.get("points_per_60")?.rankings[0]).toMatchObject({ entity: { id: 1 }, metric: { rawRank: 1, percentile: 100, qualifiedPeerCount: 3 } });
  });

  it("does not trust stored ranks for a missing metric value", async () => {
    scenario.rows = [snapshotRow(1, { raw_value: null, games_played: 5 }), snapshotRow(2), snapshotRow(3)];
    const surfaces = await buildEntityMetricRankingSurfaces(request(), ["points_per_60"]);
    expect(surfaces.get("points_per_60")?.rankings.find(row => row.entity.id === 1)?.metric).toMatchObject({ value: null, rawRank: null, percentile: null, qualifiedPeerCount: 2 });
  });

  it("paginates full cohorts with stable ordering beyond one database page", async () => {
    scenario.rows = Array.from({ length: 1001 }, (_, i) => snapshotRow(i + 1, { games_played: 5, raw_value: 1001 - i }));
    const surfaces = await buildEntityMetricRankingSurfaces(request({ limit: 1 }), ["points_per_60"]);
    expect(surfaces.get("points_per_60")?.rankings[0]?.metric).toMatchObject({ rawRank: 1, percentile: 100, qualifiedPeerCount: 1001 });
    const calls = queryCalls.filter(call => call.table === "entity_metric_rankings" && call.selectFields !== "snapshot_date");
    expect(calls.map(call => call.rangeFrom)).toEqual([0, 1000]);
    expect(calls.every(call => call.orders.some(order => order.key === "entity_id" && order.ascending))).toBe(true);
  });

  it("uses each metric's own latest snapshot instead of the requested metric's date", async () => {
    scenario.rows = [snapshotRow(2), snapshotRow(3, { metric_key: "goals_per_60", snapshot_date: "2026-04-15" })];
    const surfaces = await buildEntityMetricRankingSurfaces(request(), ["points_per_60", "goals_per_60"]);
    expect(surfaces.get("goals_per_60")?.meta).toMatchObject({ snapshotDate: "2026-04-15", unavailable: false });
  });

  it("defaults the snapshot cutoff to today and excludes future snapshots", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-17T12:00:00Z"));
    scenario.rows = [snapshotRow(2), snapshotRow(3, { snapshot_date: "2026-04-18" })];
    const surfaces = await buildEntityMetricRankingSurfaces(request({ asOfDate: null }), ["points_per_60"]);
    expect(surfaces.get("points_per_60")?.meta.snapshotDate).toBe("2026-04-16");
    vi.useRealTimers();
  });

  it("leaves a metric unavailable at a strength its methodology does not support", async () => {
    scenario.rows = [snapshotRow(2, { metric_key: "xga_per_60", strength_state: "pp" })];
    const surfaces = await buildEntityMetricRankingSurfaces(request({ metric: "xga_per_60", strength: "pp" }), ["xga_per_60"]);
    expect(surfaces.get("xga_per_60")?.meta).toMatchObject({ unavailable: true, snapshotSelectionReason: "metric_unavailable" });
    expect(surfaces.get("xga_per_60")?.rankings).toEqual([]);
  });

  it("keeps position cohorts separate when both forward and defense rows exist", async () => {
    scenario.rows = [
      snapshotRow(1, { peer_group_type: "position", peer_group_key: "forward" }),
      snapshotRow(2, { peer_group_type: "position", peer_group_key: "defense", position_group: "defense" }),
      snapshotRow(3, { peer_group_type: "position", peer_group_key: "defense", position_group: "defense" }),
    ];
    const surfaces = await buildEntityMetricRankingSurfaces(request({ position: "D", peerGroupType: "position" }), ["points_per_60"]);
    expect(surfaces.get("points_per_60")?.rankings.map(row => row.entity.id)).toEqual([2, 3]);
    expect(surfaces.get("points_per_60")?.rankings.every(row => row.metric.qualifiedPeerCount === 2)).toBe(true);
  });

  it("reads entity_metric_rankings snapshots and returns ranking surfaces", async () => {
    const surfaces = await buildEntityMetricRankingSurfaces(
      {
        entity: "skaters",
        season: 20252026,
        asOfDate: "2026-04-17",
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
      ["points_per_60", "goals_per_60"],
    );

    const surface = surfaces.get("points_per_60");
    const missingMetricSurface = surfaces.get("goals_per_60");
    expect(surface?.meta).toMatchObject({
      sourceTable: "entity_metric_rankings",
      snapshotDate: "2026-04-16",
      latestAvailableSnapshotDate: "2026-04-16",
      unavailable: false,
      rowCount: 1,
    });
    expect(surface?.rankings[0]).toMatchObject({
      entity: {
        id: 1,
        name: "Snapshot Skater",
        position: "C",
        positionGroup: "forward",
      },
      team: {
        id: 10,
        abbreviation: "TST",
      },
      deployment: {
        ev: "L1",
        pp: null,
        pk: null,
      },
      metric: {
        key: "points_per_60",
        value: 3.2,
        formattedValue: "3.20",
        rawRank: 1,
        percentile: 100,
      },
    });
    expect(
      queryCalls.find(
        (call) =>
          call.table === "entity_metric_rankings" &&
          call.selectFields === "snapshot_date",
      )?.filters,
    ).toMatchObject({
      entity_type: "skater",
      season_id: 20252026,
      window_type: "last_5",
      window_size: 5,
      strength_state: "5v5",
      metric_key: "points_per_60",
      peer_group_type: "all_skaters",
      peer_group_key: "all",
      snapshot_date: "2026-04-17",
    });
    const rankingRowQueries = queryCalls.filter(
      (call) =>
        call.table === "entity_metric_rankings" &&
        call.selectFields !== "snapshot_date",
    );
    expect(rankingRowQueries).toHaveLength(1);
    expect(rankingRowQueries[0]?.filters.metric_key).toEqual([
      "points_per_60",
      "goals_per_60",
    ]);
    expect(missingMetricSurface?.meta).toMatchObject({
      sourceTable: "entity_metric_rankings",
      unavailable: true,
      rowCount: 0,
      message: "No entity_metric_rankings rows matched the selected snapshot.",
    });
  });
});

const fixtureReceipts: Array<Record<string, unknown>> = [];
const browserFixtures: Record<string, Awaited<ReturnType<typeof buildContextualRankingsSurface>>> = {};
const fixtureContexts: Array<Partial<ContextualRankingsRequest> & { name: string; caseIndex: number }> = [
  { name: "default-matrix", caseIndex: 0, season: 20252026, window: "season", strength: "5v5", position: "all" },
  { name: "ev-forward-last5", caseIndex: 0, window: "last5", strength: "ev", position: "F" },
  { name: "all-forward-last10-strict-gp", caseIndex: 1, window: "last10", strength: "all", position: "F" },
  { name: "fantasy-defense-points-component", caseIndex: 2, window: "season", strength: "all", position: "D" },
  { name: "pk-defense-last20-penalties", caseIndex: 3, window: "last20", strength: "pk", position: "D" },
  { name: "pp-forward-last5-penalties", caseIndex: 3, window: "last5", strength: "pp", position: "F" },
  { name: "current-season-default", caseIndex: 0, season: 20262027, window: "season", strength: "5v5", position: "all" },
  { name: "current-season-fantasy-points-component", caseIndex: 2, season: 20262027, window: "season", strength: "all", position: "all" },
  { name: "empty-last20-pp", caseIndex: 4, window: "last20", strength: "pp", position: "all" },
  { name: "default-explorer", caseIndex: 5, season: 20252026, window: "season", strength: "5v5", position: "all" },
];

function loadFixture(input: ContextualRankingsRequest) {
  const peerGroupKey = input.position === "D" ? "defense" : input.position === "F" ? "forward" : "all";
  scenario.rows = fixture.rows.map(row => snapshotRow(row.id, {
    season_id: input.season, snapshot_date: input.asOfDate,
    window_type: input.window === "season" ? "season" : input.window.replace("last", "last_"),
    window_size: input.window === "season" ? 0 : Number(input.window.slice(4)),
    metric_key: input.metric, strength_state: input.strength,
    peer_group_type: input.peerGroupType, peer_group_key: peerGroupKey,
    position_group: input.position === "D" ? "defense" : "forward",
    games_played: row.gp, toi_seconds: row.toi,
    raw_value: row.toi == null || row.toi <= 0 || (input.metric === "penalties_taken_per_60" ? row.penalties : row.points) == null
      ? null : Number((((input.metric === "penalties_taken_per_60" ? row.penalties : row.points) ?? 0) / row.toi * 3600).toFixed(6)),
  }));
  scenario.rollingRows = fixture.rows.map(row => ({
    player_id: row.id, game_id: row.id, season: input.season, strength_state: input.strength,
    game_date: input.asOfDate, updated_at: `${input.asOfDate}T06:00:00Z`, team_id: 10,
    season_games_played: row.gp, season_participation_games: row.gp, games_played: row.gp,
    line_combo_group: input.position === "D" ? "defense" : "forward", line_combo_slot: 1,
    points_avg_season: row.gp == null || row.gp <= 0 || row.points == null ? null : row.points / row.gp,
    toi_seconds_avg_season: row.gp == null || row.gp <= 0 || row.toi == null ? null : row.toi / row.gp,
    [`points_total_${input.window}`]: row.points, [`toi_seconds_total_${input.window}`]: row.toi,
    goals_per_60_goals_season: row.points, goals_per_60_toi_seconds_season: row.toi,
    [`goals_per_60_total_${input.window}`]: row.points,
    penalties_taken_per_60_penalties_season: row.penalties,
    penalties_taken_per_60_toi_seconds_season: row.toi,
    [`penalties_taken_per_60_total_${input.window}`]: row.penalties,
  }));
}

function rankedValues(rows: NonNullable<Awaited<ReturnType<typeof buildContextualRankingsSurface>>>["rankings"]) {
  return rows.filter(row => row.metric.rawRank != null)
    .sort((a, b) => a.entity.id - b.entity.id)
    .map(row => [row.entity.id, row.metric.value, row.metric.rawRank, row.metric.percentile]);
}

describe("frozen Rankings trust evaluation", () => {
  beforeEach(() => {
    clearEntityMetricRankingReaderCachesForTests();
    clearContextualRankingsQueryCachesForTests();
  });

  it.each(fixtureContexts)("reconciles both readers against independent expected identities/ranks: $name", async (context) => {
    const { name, caseIndex, ...scope } = context;
    const selectedCase = fixture.cases[caseIndex];
    const input = request({
      ...scope, metric: selectedCase.metric as ContextualRankingMetricKey,
      minGp: selectedCase.minGp, minToiSeconds: selectedCase.minToi,
      asOfDate: context.season === 20262027 ? "2026-10-01" : fixture.cutoff,
      peerGroupType: context.position === "all" ? "all_skaters" : "position",
    });
    loadFixture(input);
    const durable = (await buildEntityMetricRankingSurfaces(input, [input.metric])).get(input.metric)!;
    const rolling = await buildContextualRankingsSurface(input);
    const observed = { durable: rankedValues(durable.rankings), rolling: rankedValues(rolling.rankings) };
    const expectedIds = selectedCase.expected.map(row => row[0]);
    const receipt: Record<string, unknown> = {
      name, request: input, expected: selectedCase.expected, observed,
      exclusions: fixture.rows.filter(row => !expectedIds.includes(row.id)).map(row => ({
        id: row.id, fixtureInputReason: row.reason,
        durableWarnings: durable.rankings.find(item => item.entity.id === row.id)?.warnings,
        rollingWarnings: rolling.rankings.find(item => item.entity.id === row.id)?.warnings,
      })),
      status: JSON.stringify(observed.durable) === JSON.stringify(selectedCase.expected) && JSON.stringify(observed.rolling) === JSON.stringify(selectedCase.expected) ? "passed" : "failed",
    };
    fixtureReceipts.push(receipt);
    expect(observed.durable).toEqual(selectedCase.expected);
    expect(observed.rolling).toEqual(selectedCase.expected);
    const expectedAllIds = fixture.rows.map(row => row.id);
    expect(durable.rankings.map(row => row.entity.id).sort((a, b) => a - b)).toEqual(expectedAllIds);
    expect(rolling.rankings.map(row => row.entity.id).sort((a, b) => a - b)).toEqual(expectedAllIds);
    expect(durable.rankings.every(row => row.metric.qualifiedPeerCount === expectedIds.length)).toBe(true);
    expect(rolling.rankings.every(row => row.metric.qualifiedPeerCount === expectedIds.length)).toBe(true);
    scenario.rows!.reverse();
    scenario.rollingRows.reverse();
    clearContextualRankingsQueryCachesForTests();
    const replay = (await buildEntityMetricRankingSurfaces(input, [input.metric])).get(input.metric)!;
    const rollingReplay = await buildContextualRankingsSurface(input);
    expect(rankedValues(replay.rankings)).toEqual(observed.durable);
    expect(rankedValues(rollingReplay.rankings)).toEqual(observed.rolling);
    receipt.replayAndInputPermutation = "passed";
  });

  it("records descriptive leave-one-peer sensitivity without claiming forecast accuracy", async () => {
    const input = request({ minGp: 1 });
    loadFixture(input);
    const before = (await buildEntityMetricRankingSurfaces(input, [input.metric])).get(input.metric)!;
    scenario.rows = scenario.rows!.filter(row => row.entity_id !== 1);
    const after = (await buildEntityMetricRankingSurfaces(input, [input.metric])).get(input.metric)!;
    const deltas = after.rankings.filter(row => row.metric.rawRank != null).map(row => ({
      id: row.entity.id,
      rankDelta: row.metric.rawRank! - before.rankings.find(prior => prior.entity.id === row.entity.id)!.metric.rawRank!,
    }));
    expect(deltas).toEqual([{ id: 2, rankDelta: -1 }, { id: 3, rankDelta: -1 }, { id: 4, rankDelta: -1 }]);
    fixtureReceipts.push({ name: "leave-one-peer", removedId: 1, before: rankedValues(before.rankings), after: rankedValues(after.rankings), deltas, status: "descriptive", limits: "Fictional cohort perturbation; no game deletion, stability threshold, holdout or forecast-accuracy claim." });
  });

  it("captures independently checked explorer responses for fictional browser verification", async () => {
    for (const minGp of [1, 5]) {
      const input = request({ window: "season", minGp });
      loadFixture(input);
      const surface = (await buildEntityMetricRankingSurfaces(input, [input.metric])).get(input.metric)!;
      expect(rankedValues(surface.rankings)).toEqual(fixture.cases[minGp === 1 ? 0 : 1].expected);
      browserFixtures[String(minGp)] = surface;
    }
  });
});

afterAll(() => {
  const output = process.env.RANKINGS_VALIDATION_REPORT;
  if (!output) return;
  const fixtureBytes = readFileSync(resolve("lib/rankings/fixtures/rankingsTrust.json"), "utf8");
  const inventory = [20252026, 20262027].flatMap(season =>
    (["season", "last5", "last10", "last20"] as const).flatMap(window =>
      (["all", "5v5", "ev", "pp", "pk"] as const).flatMap(strength =>
        (["F", "D"] as const).map(position => ({ season, window, strength, position,
          metrics: (["points_per_60", "penalties_taken_per_60", "xga_per_60", "pp_points_per_60"] as const).map(metric => ({
            metric, declaredApplicable: getContextualRankingMetricDefinition(metric)!.applicableStrengthStates.includes(strength),
            status: fixtureContexts.some(context => (context.season ?? 20252026) === season && context.window === window && context.strength === strength && context.position === position && fixture.cases[context.caseIndex].metric === metric) ? "fixture evaluated" : "not individually evaluated",
          })),
        })),
      ),
    ),
  );
  writeFileSync(resolve(output), JSON.stringify({
    fixtureVersion: fixture.version, fixtureSha256: createHash("sha256").update(fixtureBytes).digest("hex"),
    defaultPreset: DEFAULT_RANKINGS_FILTERS, fantasyPreset: FANTASY_RANKINGS_PRESET,
    inventory, receipts: fixtureReceipts,
    limits: fixture.limits,
    historicalDatasetStatus: "blocked: immutable full-population inputs and original producer/version unavailable",
  }, null, 2) + "\n");
  if (process.env.RANKINGS_BROWSER_FIXTURE_OUTPUT) {
    const metadata = buildContextualRankingsMetadataSurface();
    writeFileSync(resolve(process.env.RANKINGS_BROWSER_FIXTURE_OUTPUT), JSON.stringify({
      kind: "Known fictional fixture; produced by the tested durable reader after independent rank assertions.",
      inputSha256: createHash("sha256").update(fixtureBytes).digest("hex"),
      metadata: {
        success: metadata.success, generatedAt: metadata.generatedAt, filters: metadata.filters,
        availableFilters: metadata.availableFilters, glossary: metadata.glossary,
        metrics: metadata.metrics.filter(metric => ["points_per_60", "goals_per_60", "mcm_score", "penalties_taken_per_60"].includes(metric.key)),
      },
      surfaces: browserFixtures,
    }, null, 2) + "\n");
  }
});
