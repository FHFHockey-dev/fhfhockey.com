// Open-defect reproductions (skaters: F2, F3, Fantasy preset). A PASSING
// "DEFECT PRESENT" test means the defect still exists; when a fix lands, flip
// it into a regression test in web/lib/rankings/__acceptance__/. Only the data
// layer (Supabase) is faked.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { failClosedFetch, type FakeDb } from "./fakeSupabase";

const db = vi.hoisted(() => ({ tables: {}, calls: [] }) as FakeDb);
vi.mock("/Users/tim/Code/fhfhockey.com/web/lib/supabase/server", async () => {
  const { createFakeSupabase } = await import("./fakeSupabase");
  return { default: createFakeSupabase(db) };
});

import {
  buildPlayerMatrixSurface,
  clearPlayerMatrixSurfaceCachesForTests,
  parsePlayerMatrixRequestWithResolvedTeam,
} from "/Users/tim/Code/fhfhockey.com/web/lib/rankings/playerMatrix";
import {
  buildSnapshotFirstContextualRankingsSurface,
  clearContextualRankingsQueryCachesForTests,
} from "/Users/tim/Code/fhfhockey.com/web/lib/rankings/rankingQueries";
import { clearEntityMetricRankingReaderCachesForTests } from "/Users/tim/Code/fhfhockey.com/web/lib/rankings/entityMetricRankingReader";
import { parseContextualRankingsRequestWithResolvedTeam } from "/Users/tim/Code/fhfhockey.com/web/lib/rankings/rankingTypes";
import {
  DEFAULT_RANKINGS_FILTERS,
  FANTASY_RANKINGS_PRESET,
  buildMatrixRequestPath,
  buildRankingsRequestPath,
  type RankingsFilterState,
} from "/Users/tim/Code/fhfhockey.com/web/lib/rankings/rankingUrlState";

const fetchSpy = vi.fn(failClosedFetch());
const SEASON = 20262027;
const SNAPSHOT = "2026-11-08";

function queryOf(path: string | null) {
  if (path == null) throw new Error("URL builder returned null");
  return Object.fromEntries(new URLSearchParams(path.split("?")[1]));
}

function skaterFilters(overrides: Partial<RankingsFilterState> = {}): RankingsFilterState {
  return {
    ...DEFAULT_RANKINGS_FILTERS,
    entity: "skaters",
    season: String(SEASON),
    strength: "all",
    pageSize: "50",
    ...overrides,
  };
}

const PLAYERS = [
  { id: 1, gp: 25, points: 30, mcm: 80 },
  { id: 2, gp: 25, points: 20, mcm: 70 },
  { id: 3, gp: 12, points: 14, mcm: 90 },
  { id: 4, gp: 12, points: 8, mcm: 60 },
];

function durableRow(player: (typeof PLAYERS)[number], metricKey: string, rawValue: number) {
  return {
    entity_type: "skater", season_id: SEASON, snapshot_date: SNAPSHOT,
    window_type: "season", window_size: 0, strength_state: "all",
    metric_key: metricKey, peer_group_type: "all_skaters", peer_group_key: "all",
    entity_id: player.id, team_id: 22, position_group: "forward", deployment_bucket: null,
    raw_value: rawValue, raw_rank: null, percentile: null, qualified_peer_count: null,
    minimum_sample_met: true, sample_confidence: "high",
    games_played: player.gp, toi_seconds: player.gp * 900,
    tags: [], explanation_items: [], updated_at: `${SNAPSHOT}T06:00:00.000Z`,
  };
}

function rollingRow(playerId: number, gameDate: string, gp = 25) {
  return {
    player_id: playerId, season: SEASON, strength_state: "all", team_id: 22,
    game_id: Number(gameDate.replaceAll("-", "")) * 10 + playerId, game_date: gameDate,
    updated_at: `${gameDate}T06:00:00.000Z`, line_combo_group: "forward", line_combo_slot: 1,
    pp_unit: null, games_played: gp, season_games_played: gp,
    goals_per_60_goals_season: playerId * 2, goals_per_60_toi_seconds_season: gp * 900,
    toi_seconds_avg_season: 900,
  };
}

function seedSkaterDb() {
  db.tables = {
    entity_metric_rankings: PLAYERS.map((player) =>
      durableRow(player, "points_per_60", player.points)),
    skater_composite_ratings: PLAYERS.map((player) => ({
      player_id: player.id, season_id: SEASON, snapshot_date: SNAPSHOT,
      window_type: "season", window_size: 0, strength_state: "all",
      peer_group_type: "all_skaters", peer_group_key: "all_skaters",
      position_group: "forward", deployment_bucket: null, updated_at: `${SNAPSHOT}T06:00:00.000Z`,
      offense_rating_overall: null, offense_rating_deployment: null,
      defense_rating_overall: null, defense_rating_deployment: null,
      mcm_score: player.mcm, beast_tier: null, results_luck_index: null,
      components_json: null, methodology_version: "test",
    })),
    rolling_player_game_metrics: PLAYERS.map((player) => rollingRow(player.id, SNAPSHOT, player.gp)),
    rolling_player_metric_support_payloads: [],
    games: [{ id: 1, date: SNAPSHOT, seasonId: SEASON, type: 2, homeTeamId: 22, awayTeamId: 10 }],
    players: [1, 2, 3, 4, 5].map((id) => ({
      id, fullName: `Skater ${id}`, position: "C", team_id: 22, image_url: null,
    })),
    teams: [{ id: 22, abbreviation: "EDM", name: "Edmonton Oilers" }],
  };
}

beforeEach(() => {
  vi.useFakeTimers({ now: new Date("2026-11-10T12:00:00.000Z"), toFake: ["Date"] });
  vi.stubGlobal("fetch", fetchSpy);
  fetchSpy.mockClear();
  db.calls = [];
  seedSkaterDb();
  clearPlayerMatrixSurfaceCachesForTests();
  clearContextualRankingsQueryCachesForTests();
  clearEntityMetricRankingReaderCachesForTests();
});

afterEach(() => {
  expect(fetchSpy).not.toHaveBeenCalled();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function matrix(filters: RankingsFilterState) {
  return buildPlayerMatrixSurface(
    await parsePlayerMatrixRequestWithResolvedTeam(queryOf(buildMatrixRequestPath(filters))),
  );
}

async function metricExplorer(filters: RankingsFilterState) {
  return buildSnapshotFirstContextualRankingsSurface(
    await parseContextualRankingsRequestWithResolvedTeam(queryOf(buildRankingsRequestPath(filters))),
  );
}

describe("Open: Metric Explorer vs matrix source (F2)", () => {
  it("DEFECT PRESENT PARITY-DURABLE-FALLBACK: the matrix takes every column from the source chosen for the sort metric, while Metric Explorer chooses per metric, so Goals/60 is ranked in Metric Explorer but blank in the matrix", async () => {
    const filters = skaterFilters({ metric: "goals_per_60", matrixSortMetric: "points_per_60" });

    const tableResponse = await metricExplorer(filters);
    expect(tableResponse.meta.rankingSource).toBe("fallback_rolling_player_game_metrics");
    const tableRow = tableResponse.rankings.find((row) => row.entity.id === 1)!;
    expect(tableRow.metric.rawRank).not.toBeNull();

    const matrixResponse = await matrix(filters);
    expect(matrixResponse.meta.rankingSource).toBe("entity_metric_rankings");
    const matrixCell = matrixResponse.rows.find((row) => row.entity.id === 1)!.metrics.goals_per_60 as any;
    expect(matrixCell).toMatchObject({ rank: null, rawValue: null });
    expect(matrixCell.availabilityReason).not.toBeNull();

    // Paired control: once durable Goals/60 rows exist, both views read the same source and rank.
    db.tables.entity_metric_rankings.push(
      ...PLAYERS.map((player) => durableRow(player, "goals_per_60", (player.id * 2 * 3600) / (player.gp * 900))),
    );
    clearPlayerMatrixSurfaceCachesForTests();
    clearContextualRankingsQueryCachesForTests();
    clearEntityMetricRankingReaderCachesForTests();
    const durableTable = await metricExplorer(filters);
    const durableCell = (await matrix(filters)).rows.find((row) => row.entity.id === 1)!.metrics.goals_per_60 as any;
    expect(durableTable.meta.rankingSource).toBe("entity_metric_rankings");
    expect(durableCell.rank).toBe(durableTable.rankings.find((row) => row.entity.id === 1)!.metric.rawRank);
  });
});

describe("R03 rolling fallback population horizon (F3, interactive path)", () => {
  function seedHorizon(absentPlayerDateIndex: number) {
    // 40 distinct game dates, one game each, newest first.
    const dates = Array.from({ length: 40 }, (_, index) =>
      new Date(Date.UTC(2026, 10, 8 - index)).toISOString().slice(0, 10));
    db.tables.entity_metric_rankings = [];
    db.tables.games = dates.map((date, index) => ({
      id: index + 1, date, seasonId: SEASON, type: 2, homeTeamId: 22, awayTeamId: 10,
    }));
    db.tables.rolling_player_game_metrics = [
      ...PLAYERS.map((player) => rollingRow(player.id, dates[0], player.gp)),
      // Player 5: 25 games, last appearance `absentPlayerDateIndex` game dates ago.
      rollingRow(5, dates[absentPlayerDateIndex], 25),
    ];
  }

  it("DEFECT PRESENT R03-HORIZON: a qualified skater whose last game is older than 30 distinct game dates disappears from the rolling-fallback season ranking", async () => {
    seedHorizon(35);
    const response = await metricExplorer(skaterFilters({ metric: "goals_per_60" }));
    expect(response.meta.rankingSource).toBe("fallback_rolling_player_game_metrics");
    expect(response.rankings.map((row) => row.entity.id).sort()).toEqual([1, 2, 3, 4]);

    // Paired control: the same player 10 dates back is ranked.
    clearContextualRankingsQueryCachesForTests();
    clearEntityMetricRankingReaderCachesForTests();
    seedHorizon(10);
    const control = await metricExplorer(skaterFilters({ metric: "goals_per_60" }));
    const five = control.rankings.find((row) => row.entity.id === 5)!;
    expect(five.metric.rawRank).not.toBeNull();
    expect(control.rankings).toHaveLength(5);
    // The row keeps its own last-observed date, while meta reports the global date.
    expect(five.sourceSnapshot?.date).not.toBe(control.meta.snapshotDate);
  });
});

describe("Open: Fantasy preset floor (product decision)", () => {
  it("DEFECT PRESENT R07-FANTASY-PRESET (product decision, not in F11): the Fantasy preset still sets a 1 GP floor", () => {
    expect(FANTASY_RANKINGS_PRESET.minGp).toBe("1");
  });
});
