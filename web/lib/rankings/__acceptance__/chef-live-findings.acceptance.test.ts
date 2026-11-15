// Regression tests for Chef's 2026-11-14 live findings, fixed by W1 (writer
// population), F13 (derived peer pools) and F14 (one-build snapshot). Only the
// data layer (Supabase) is faked.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { failClosedFetch, type FakeDb } from "./fakeSupabase";

const db = vi.hoisted(() => ({ tables: {}, calls: [] }) as FakeDb);
vi.mock("lib/supabase/server", async () => {
  const { createFakeSupabase } = await import("./fakeSupabase");
  return { default: createFakeSupabase(db) };
});

import { buildEntityMetricRankingRows } from "../entityMetricRankingWriter";
import { loadSkaterCompositeSeasonSources } from "../skaterCompositeSourceCoverage";
import {
  buildContextualRankingsSurfaces,
  clearContextualRankingsQueryCachesForTests,
} from "../rankingQueries";
import { clearEntityMetricRankingReaderCachesForTests } from "../entityMetricRankingReader";
import {
  buildPlayerMatrixSurface,
  clearPlayerMatrixSurfaceCachesForTests,
  parsePlayerMatrixRequestWithResolvedTeam,
} from "../playerMatrix";
import { buildContextualRankingSnapshotSurface } from "../snapshot";
import {
  DEFAULT_RANKINGS_FILTERS,
  buildMatrixRequestPath,
  buildSnapshotRequestPath,
  type RankingsFilterState,
} from "../rankingUrlState";
import type { ContextualRankingsRequest } from "../rankingTypes";
import serverSupabase from "lib/supabase/server";

const fetchSpy = vi.fn(failClosedFetch());
const SEASON = 20262027;
const SNAPSHOT = "2026-11-08";

function queryOf(path: string | null) {
  if (path == null) throw new Error("URL builder returned null");
  return Object.fromEntries(new URLSearchParams(path.split("?")[1]));
}

/** `count` distinct game dates, newest first, ending at 2026-11-08. */
function gameDates(count: number) {
  return Array.from({ length: count }, (_, index) =>
    new Date(Date.UTC(2026, 10, 8 - index)).toISOString().slice(0, 10));
}

function rollingRow(playerId: number, gameDate: string, strength: string, teamId = 22) {
  return {
    player_id: playerId, season: SEASON, strength_state: strength, team_id: teamId,
    game_id: 2026020000 + playerId, game_date: gameDate, updated_at: `${gameDate}T06:00:00.000Z`,
    line_combo_group: "forward", line_combo_slot: 1, pp_unit: null,
    games_played: 20, season_games_played: 20,
    goals_per_60_goals_season: playerId, goals_per_60_toi_seconds_season: 18000,
    toi_seconds_avg_season: 900,
  };
}

function players(ids: number[]) {
  return ids.map((id) => ({ id, fullName: `Skater ${id}`, position: "C", team_id: 22, image_url: null }));
}

beforeEach(() => {
  vi.useFakeTimers({ now: new Date("2026-11-10T12:00:00.000Z"), toFake: ["Date"] });
  vi.stubGlobal("fetch", fetchSpy);
  fetchSpy.mockClear();
  db.tables = {};
  db.calls = [];
  clearPlayerMatrixSurfaceCachesForTests();
  clearContextualRankingsQueryCachesForTests();
  clearEntityMetricRankingReaderCachesForTests();
});

afterEach(() => {
  expect(fetchSpy).not.toHaveBeenCalled();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("Chef live finding 1: entity ranking writer population (W1)", () => {
  it("FIXED W1 WRITER-POPULATION (was DEFECT PRESENT): the entity_metric_rankings writer publishes the WGO-anchored complete population, including a skater last seen > 30 game dates ago, and refuses unverified coverage", async () => {
    const dates = gameDates(40);
    const stale = dates[35]; // player 5's last appearance
    db.tables = {
      games: dates.map((date, index) => ({ id: index + 1, date, seasonId: SEASON, type: 2, homeTeamId: 22, awayTeamId: 10 })),
      rolling_player_game_metrics: [
        ...[1, 2, 3, 4].map((id) => rollingRow(id, dates[0], "5v5")),
        rollingRow(5, stale, "5v5"),
      ],
      rolling_player_metric_support_payloads: [],
      wgo_skater_stats: [
        ...[1, 2, 3, 4].map((id) => ({ player_id: id, date: dates[0], game_id: 2026020100 + id, season_id: SEASON, games_played: 1 })),
        { player_id: 5, date: stale, game_id: 2026020005, season_id: SEASON, games_played: 1 },
      ],
      players: players([1, 2, 3, 4, 5]),
      teams: [{ id: 22, abbreviation: "EDM", name: "Edmonton Oilers" }],
    };
    const base = {
      season: SEASON, asOfDate: SNAPSHOT, position: "all", deployment: "all", strength: "5v5",
      minGp: 1, minToiSeconds: 300, teamId: null, peerGroupType: "all_skaters",
    } as const;

    // Entity ranking writer, exactly as the cron route calls it.
    const entity = await buildEntityMetricRankingRows({
      ...base, windows: ["season"], metricKeys: ["goals_per_60"],
    });
    expect(entity.rows.map((row) => row.entity_id).sort()).toEqual([1, 2, 3, 4, 5]);

    // Composite writer's source path (skaterCompositeWriter.ts:674-680): WGO-anchored
    // complete population passed as completeSeasonRows.
    const { report, rows: sourceRows } = await loadSkaterCompositeSeasonSources(serverSupabase as never, {
      season: SEASON, strength: "5v5", cutoffDate: SNAPSHOT,
    });
    expect(report.expectedPlayerCount).toBe(5);
    const request: ContextualRankingsRequest = {
      ...base, entity: "skaters", window: "season", windowScope: "current_season",
      metric: "goals_per_60", sort: "percentile", direction: "desc", limit: null, entityIds: null,
    };
    const composite = await buildContextualRankingsSurfaces(request, ["goals_per_60"], { completeSeasonRows: sourceRows });
    expect(composite.get("goals_per_60")!.rankings.map((row) => row.entity.id).sort()).toEqual([1, 2, 3, 4, 5]);

    // Both writers now rank the same complete population with the same values.
    const entityGoals = new Map(entity.rows.map((row) => [row.entity_id, [row.raw_value, row.raw_rank]]));
    for (const row of composite.get("goals_per_60")!.rankings) {
      expect(entityGoals.get(row.entity.id)).toEqual([row.metric.value, row.metric.rawRank]);
    }

    // Refusal: a WGO appearance with no matching rolling row leaves coverage
    // unverified, and the writer publishes nothing.
    clearContextualRankingsQueryCachesForTests();
    db.tables.wgo_skater_stats.push({ player_id: 6, date: dates[0], game_id: 2026020106, season_id: SEASON, games_played: 1 });
    await expect(buildEntityMetricRankingRows({ ...base, windows: ["season"], metricKeys: ["goals_per_60"] }))
      .rejects.toThrow(/source coverage is not verified/i);
  });
});

function durableRow(playerId: number, rawValue: number) {
  return {
    entity_type: "skater", season_id: SEASON, snapshot_date: SNAPSHOT,
    window_type: "season", window_size: 0, strength_state: "5v5",
    metric_key: "points_per_60", peer_group_type: "all_skaters", peer_group_key: "all",
    entity_id: playerId, team_id: playerId <= 3 ? 22 : 10, position_group: "forward",
    deployment_bucket: null, raw_value: rawValue, raw_rank: null, percentile: null,
    qualified_peer_count: null, minimum_sample_met: true, sample_confidence: "high",
    games_played: 25, toi_seconds: 22500, tags: [], explanation_items: [],
    updated_at: `${SNAPSHOT}T06:00:00.000Z`,
  };
}

function compositeRow(playerId: number, mcm: number) {
  return {
    player_id: playerId, season_id: SEASON, snapshot_date: SNAPSHOT,
    window_type: "season", window_size: 0, strength_state: "5v5",
    peer_group_type: "all_skaters", peer_group_key: "all_skaters",
    position_group: "forward", deployment_bucket: null, updated_at: `${SNAPSHOT}T06:00:00.000Z`,
    offense_rating_overall: null, offense_rating_deployment: null,
    defense_rating_overall: null, defense_rating_deployment: null,
    mcm_score: mcm, beast_tier: null, results_luck_index: null,
    components_json: null, methodology_version: "test",
  };
}

function skaterFilters(overrides: Partial<RankingsFilterState> = {}): RankingsFilterState {
  return {
    ...DEFAULT_RANKINGS_FILTERS, entity: "skaters", season: String(SEASON),
    strength: "5v5", pageSize: "50", ...overrides,
  };
}

async function matrix(filters: RankingsFilterState) {
  return buildPlayerMatrixSurface(
    await parsePlayerMatrixRequestWithResolvedTeam(queryOf(buildMatrixRequestPath(filters))),
  );
}

describe("Chef live finding 2: team filter (F13)", () => {
  it("FIXED F13 TEAM-POOL-FROM-PUBLICATION (was DEFECT PRESENT TEAM-FILTER-SOURCE): team, position and deployment pools are re-ranked from the published all-skater cohort, with league-scope composites", async () => {
    const ids = [1, 2, 3, 4, 5, 6];
    db.tables = {
      entity_metric_rankings: ids.map((id) => ({
        ...durableRow(id, 10 - id),
        position_group: id === 6 ? "defense" : "forward",
        deployment_bucket: id === 1 || id === 4 ? "L1" : "L2",
      })),
      skater_composite_ratings: ids.map((id) => compositeRow(id, 100 - id)),
      // The rolling fallback is a day newer than the durable publication.
      rolling_player_game_metrics: ids.map((id) => ({
        ...rollingRow(id, "2026-11-09", "5v5", id <= 3 ? 22 : 10),
        points_avg_season: (10 - id) / 4,
      })),
      rolling_player_metric_support_payloads: [],
      games: [{ id: 1, date: "2026-11-09", seasonId: SEASON, type: 2, homeTeamId: 22, awayTeamId: 10 }],
      players: players(ids),
      teams: [{ id: 22, abbreviation: "EDM", name: "Edmonton Oilers" }, { id: 10, abbreviation: "TOR", name: "Toronto Maple Leafs" }],
    };

    const league = await matrix(skaterFilters());
    const leagueRow = league.rows.find((row) => row.entity.id === 2)!;
    expect(league.meta.rankingSource).toBe("entity_metric_rankings");
    expect(leagueRow.peerGroup).toMatchObject({ type: "all_skaters", key: "all" });
    expect(leagueRow.metrics.mcm_score.rawValue).toBe(98);

    clearPlayerMatrixSurfaceCachesForTests();
    const team = await matrix(skaterFilters({ team: "EDM" }));
    const teamRow = team.rows.find((row) => row.entity.id === 2)!;
    // Same source and snapshot date as the unfiltered view.
    expect(team.meta.rankingSource).toBe("entity_metric_rankings");
    expect(team.meta.snapshotDate).toBe(league.meta.snapshotDate);
    expect(team.rows.map((row) => row.entity.id).sort()).toEqual([1, 2, 3]);
    // Re-ranked inside the declared team pool.
    expect(teamRow.peerGroup).toMatchObject({ type: "team", key: "22" });
    expect(teamRow.metrics.points_per_60).toMatchObject({ rank: 2, qualifiedPeerCount: 3 });
    // League-scope composite value, labelled, ranked inside the team pool.
    expect(teamRow.metrics.mcm_score.rawValue).toBe(98);
    expect(teamRow.composite).toMatchObject({ mcmScore: 98, peerGroupType: "all_skaters", peerGroupKey: "all_skaters" });
    expect(team.meta.sourceWarnings?.join(" ")).toMatch(/league-scope/);
    expect(team.meta.sourceWarnings?.join(" ")).toMatch(/all-skater publication/);

    clearPlayerMatrixSurfaceCachesForTests();
    const forwards = await matrix(skaterFilters({ position: "F" }));
    expect(forwards.meta.rankingSource).toBe("entity_metric_rankings");
    expect(forwards.rows.map((row) => row.entity.id).sort()).toEqual([1, 2, 3, 4, 5]);
    expect(forwards.rows.find((row) => row.entity.id === 2)!.peerGroup).toMatchObject({ type: "position", key: "forward" });

    clearPlayerMatrixSurfaceCachesForTests();
    const lineOne = await matrix(skaterFilters({ deployment: "L1" }));
    expect(lineOne.meta.rankingSource).toBe("entity_metric_rankings");
    expect(lineOne.rows.map((row) => row.entity.id).sort()).toEqual([1, 4]);
    expect(lineOne.rows.find((row) => row.entity.id === 4)!.metrics.points_per_60).toMatchObject({ rank: 2, qualifiedPeerCount: 2 });
  });
});

describe("Chef live finding 3: snapshot for an unpublished skater (F14)", () => {
  async function seedAndSnapshot(selectedPlayerId: number) {
    const ids = Array.from({ length: 120 }, (_, index) => index + 1);
    db.tables = {
      entity_metric_rankings: ids.map((id) => durableRow(id, 200 - id)),
      skater_composite_ratings: [],
      rolling_player_game_metrics: [],
      rolling_player_metric_support_payloads: [],
      games: [],
      players: players(ids),
      teams: [{ id: 22, abbreviation: "EDM", name: "Edmonton Oilers" }],
    };
    db.calls = [];
    clearPlayerMatrixSurfaceCachesForTests();
    clearEntityMetricRankingReaderCachesForTests();
    const snapshot = await buildContextualRankingSnapshotSurface(
      queryOf(buildSnapshotRequestPath(skaterFilters({ selectedPlayerId: String(selectedPlayerId) }))),
    );
    const entityReads = db.calls.filter((call) => call.table === "entity_metric_rankings").length;
    const perPlayerToiReads = db.calls.filter((call) => call.table === "rolling_player_game_metrics" &&
      call.filters.some(([method, key]) => method === "eq" && key === "player_id")).length;
    return { snapshot, entityReads, perPlayerToiReads, totalReads: db.calls.length };
  }

  it("FIXED F14 SNAPSHOT-ONE-BUILD (was DEFECT PRESENT SNAPSHOT-UNPUBLISHED-SCAN): a snapshot costs one matrix build wherever the skater sits, and a missing skater gets an explicit not-in-cohort reason", async () => {
    // Before F14 (89da739cb): missing id = 169 reads and 120 per-player TOI reads (3 rebuilt pages).
    const pageOne = await seedAndSnapshot(1);
    expect(pageOne.snapshot.status).toBe("available");
    expect(pageOne.perPlayerToiReads).toBe(50);

    // A skater on page 3 (rows 101-120) is found in the same single build:
    // only that page is enriched, and nothing else is re-read.
    const pageThree = await seedAndSnapshot(120);
    expect(pageThree.snapshot.status).toBe("available");
    expect((pageThree.snapshot.row as { entity: { id: number } }).entity.id).toBe(120);
    expect(pageThree.perPlayerToiReads).toBe(20);
    expect(pageThree.totalReads - pageThree.perPlayerToiReads).toBe(
      pageOne.totalReads - pageOne.perPlayerToiReads,
    );

    // A missing skater: one build, no page enrichment, explicit reason.
    const missing = await seedAndSnapshot(8473533);
    expect(missing.snapshot.status).toBe("unavailable");
    expect((missing.snapshot as { reason?: string }).reason).toBe(
      "Selected skater is not in the published cohort for this context.",
    );
    expect(missing.perPlayerToiReads).toBe(0);
    expect(missing.totalReads).toBeLessThan(pageOne.totalReads);
  });
});
