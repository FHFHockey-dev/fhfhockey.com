// Skater regression tests for F1 (composite ranks vs the Sample confidence
// filter) and F11 (API min_gp window floor). Only the data layer (Supabase) is
// faked: the real URL builders, parsers, durable reader, rolling fallback,
// matrix and snapshot run. Open-defect reproductions live in
// tasks/artifacts/rankings-acceptance-2026-11-14/offline-correctness/repros/.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { failClosedFetch, type FakeDb } from "./fakeSupabase";

const db = vi.hoisted(() => ({ tables: {}, calls: [] }) as FakeDb);
vi.mock("lib/supabase/server", async () => {
  const { createFakeSupabase } = await import("./fakeSupabase");
  return { default: createFakeSupabase(db) };
});

import {
  buildPlayerMatrixSurface,
  clearPlayerMatrixSurfaceCachesForTests,
  parsePlayerMatrixRequestWithResolvedTeam,
} from "../playerMatrix";
import {
  buildSnapshotFirstContextualRankingsSurface,
  clearContextualRankingsQueryCachesForTests,
} from "../rankingQueries";
import { clearEntityMetricRankingReaderCachesForTests } from "../entityMetricRankingReader";
import { parseContextualRankingsRequestWithResolvedTeam } from "../rankingTypes";
import { buildContextualRankingSnapshotSurface } from "../snapshot";
import {
  DEFAULT_RANKINGS_FILTERS,
  buildMatrixRequestPath,
  buildRankingsRequestPath,
  buildSnapshotRequestPath,
  type RankingsFilterState,
} from "../rankingUrlState";

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
    // No completion markers yet: the reader keeps the #449 date match.
    ranking_publications: [],
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

describe("Skater view parity (offline, 89da739cb)", () => {
  it("FIXED F1 PARITY-COMPOSITE-CONFIDENCE (was DEFECT PRESENT): composite ranks are computed over the whole pool, so the Sample confidence display filter no longer changes them and matrix and drawer agree", async () => {
    const filters = skaterFilters({
      matrixSortMetric: "mcm_score", sampleConfidence: "high", selectedPlayerId: "1",
    });
    // The snapshot request still omits the display filter (rankingUrlState is out of scope).
    expect(queryOf(buildMatrixRequestPath(filters)).sample_confidence).toBe("high");
    expect(queryOf(buildSnapshotRequestPath(filters)).sample_confidence).toBeUndefined();

    const highMatrix = await matrix(filters);
    const matrixRow = highMatrix.rows.find((row) => row.entity.id === 1)!;
    const snapshot = await buildContextualRankingSnapshotSurface(queryOf(buildSnapshotRequestPath(filters)));
    const snapshotRow = snapshot.row as typeof matrixRow;

    // The filter still narrows the displayed rows to high-confidence players...
    expect(highMatrix.rows.map((row) => row.entity.id).sort()).toEqual([1, 2]);
    // ...but player 1 keeps his rank among all four qualified peers (#2 behind player 3).
    expect(matrixRow.sort).toMatchObject({ metricKey: "mcm_score", rank: 2 });
    expect(snapshot.status).toBe("available");
    expect(snapshotRow.sort.rank).toBe(matrixRow.sort.rank);
    expect(snapshotRow.sort.percentile).toBe(matrixRow.sort.percentile);
    expect(matrixRow.metrics.mcm_score.rank).toBe(2);

    // And it matches the unfiltered matrix.
    clearPlayerMatrixSurfaceCachesForTests();
    const allRow = (await matrix({ ...filters, sampleConfidence: "all" })).rows.find((row) => row.entity.id === 1)!;
    expect(allRow.sort.rank).toBe(matrixRow.sort.rank);
    expect(allRow.sort.percentile).toBe(matrixRow.sort.percentile);
  });

});

describe("R07 sample minimums (F11)", () => {
  it("FIXED F11 R07-API-FLOOR (was DEFECT PRESENT R07-PRESET-AND-API-FLOOR): an API call without min_gp uses the page's window floor; explicit thresholds are unchanged", async () => {
    db.tables.entity_metric_rankings.push(
      durableRow({ id: 5, gp: 1, points: 99, mcm: 0 }, "points_per_60", 99),
    );
    const apiDefault = await buildSnapshotFirstContextualRankingsSurface(
      await parseContextualRankingsRequestWithResolvedTeam({
        season: String(SEASON), strength: "all", metric: "points_per_60",
      }),
    );
    const oneGame = apiDefault.rankings.find((row) => row.entity.id === 5)!;
    expect(oneGame.metric.rawRank).toBeNull();
    expect(oneGame.sample.minimumSampleMet).toBe(false);
    // Season floor is 10 GP: the 12-GP players (3, 4) still qualify.
    expect(apiDefault.rankings.filter((row) => row.metric.rawRank != null).map((row) => row.entity.id).sort())
      .toEqual([1, 2, 3, 4]);

    // Same result as the page's own default request.
    clearContextualRankingsQueryCachesForTests();
    clearEntityMetricRankingReaderCachesForTests();
    const pageDefault = await metricExplorer(skaterFilters({ metric: "points_per_60" }));
    expect(pageDefault.rankings.find((row) => row.entity.id === 5)?.metric.rawRank ?? null).toBeNull();

    // An explicit min_gp=1 is honoured exactly as before.
    clearContextualRankingsQueryCachesForTests();
    clearEntityMetricRankingReaderCachesForTests();
    const explicit = await buildSnapshotFirstContextualRankingsSurface(
      await parseContextualRankingsRequestWithResolvedTeam({
        season: String(SEASON), strength: "all", metric: "points_per_60", min_gp: "1",
      }),
    );
    expect(explicit.rankings[0]).toMatchObject({ entity: { id: 5 }, metric: { rawRank: 1 } });
  });

});
