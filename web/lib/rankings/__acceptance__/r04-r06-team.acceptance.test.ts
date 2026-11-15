// Regression tests for F4 (team tokens), F9 (unit-TOI cutoff), F15 (unit-TOI
// read volume) and the R06 power-season check. Only the data layer (Supabase)
// is faked; the real URL builders, parsers, team matrix, snapshot and
// comparison code run unchanged.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { failClosedFetch, type FakeDb } from "./fakeSupabase";

const db = vi.hoisted(() => ({ tables: {}, calls: [] }) as FakeDb);
vi.mock("lib/supabase/server", async () => {
  const { createFakeSupabase } = await import("./fakeSupabase");
  return { default: createFakeSupabase(db) };
});

import {
  aggregateTeamUnitToiRows,
  buildTeamMatrixSurface,
  clearTeamMatrixSurfaceCachesForTests,
  parseTeamMatrixRequest,
} from "../teamMatrix";
import { parsePlayerMatrixRequestWithResolvedTeam } from "../playerMatrix";
import { buildContextualRankingSnapshotSurface } from "../snapshot";
import { buildContextualRankingComparisonSurface } from "../comparison";
import {
  DEFAULT_RANKINGS_FILTERS,
  buildSnapshotRequestPath,
  buildTeamMatrixRequestPath,
  type RankingsFilterState,
} from "../rankingUrlState";

const fetchSpy = vi.fn(failClosedFetch());
const SEASON = 20262027;
const EDM = { id: 22, abbreviation: "EDM", name: "Edmonton Oilers" };
const TOR = { id: 10, abbreviation: "TOR", name: "Toronto Maple Leafs" };

function queryOf(path: string | null) {
  if (path == null) throw new Error("URL builder returned null");
  return Object.fromEntries(new URLSearchParams(path.split("?")[1]));
}

function teamFilters(overrides: Partial<RankingsFilterState> = {}): RankingsFilterState {
  return { ...DEFAULT_RANKINGS_FILTERS, entity: "teams", season: String(SEASON), teamMinGp: "1", ...overrides };
}

function unitRow(args: { gameId: number; teamId: number; snapshotDate: string; share: number }) {
  return {
    id: `${args.snapshotDate}:${args.gameId}:${args.teamId}`,
    season_id: SEASON,
    team_id: args.teamId,
    game_id: args.gameId,
    game_date: "2026-11-01",
    snapshot_date: args.snapshotDate,
    unit_type: "forward_line",
    unit_number: 1,
    unit_share: args.share,
    unit_toi_seconds: 600,
    team_unit_pool_toi_seconds: 1500,
    coverage_status: "complete",
    coverage_warnings: [],
  };
}

function seedTeamDb() {
  db.tables = {
    seasons: [{ id: SEASON, startDate: "2026-10-07", regularSeasonEndDate: "2027-04-15" }],
    team_power_ratings_daily: [EDM, TOR].map((team, index) => ({
      team_abbreviation: team.abbreviation, date: "2026-11-08",
      off_rating: 60 - index, def_rating: 55 - index, pace_rating: 50, xgf60: 2.8, gf60: 3,
      sf60: 30, xga60: 2.5, ga60: 2.7, sa60: 29, pace60: 60, trend10: 0, pp_tier: 2, pk_tier: 2,
      finishing_rating: 50, goalie_rating: 50, danger_rating: 50, special_rating: 50,
      discipline_rating: 50, variance_flag: 0,
    })),
    teams: [EDM, TOR].map((team) => ({ ...team })),
    games: [{ id: 1, date: "2026-11-01", seasonId: SEASON, type: 2, homeTeamId: EDM.id, awayTeamId: TOR.id }],
    wgo_team_stats: [EDM, TOR].map((team, index) => ({
      id: index + 1, season_id: SEASON, date: "2026-11-01", team_id: team.id, game_id: 1,
      goals_for: index === 0 ? 3 : 2, goals_against: index === 0 ? 2 : 3, point_pct: index === 0 ? 1 : 0,
      pp_opportunities_per_game: 3, penalties_taken_per_60: 4,
    })),
    nst_team_5v5: [],
    team_unit_toi: [unitRow({ gameId: 1, teamId: EDM.id, snapshotDate: "2026-11-08", share: 0.4 })],
  };
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchSpy);
  fetchSpy.mockClear();
  db.calls = [];
  seedTeamDb();
  clearTeamMatrixSurfaceCachesForTests();
});

afterEach(() => {
  expect(fetchSpy).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
});

describe("R04 team token parity across snapshot and comparison (F4)", () => {
  it("FIXED F4 R04-TEAM-SNAPSHOT-TOKEN (was DEFECT PRESENT): the team snapshot accepts an id, abbreviation or full name, like every other parser", async () => {
    for (const token of ["22", "Edmonton Oilers", "EDM", "edm"]) {
      const snapshot = await buildContextualRankingSnapshotSurface(
        queryOf(buildSnapshotRequestPath(teamFilters({ selectedTeam: token }))),
      );
      expect(snapshot.status).toBe("available");
      expect((snapshot.row as { team: { abbreviation: string } }).team.abbreviation).toBe("EDM");
    }
    // An unknown token is still an explicit "unavailable" subject.
    const unknown = await buildContextualRankingSnapshotSurface(
      queryOf(buildSnapshotRequestPath(teamFilters({ selectedTeam: "XYZ" }))),
    );
    expect(unknown.status).toBe("unavailable");
    // Parity with the shared resolver used by the skater parsers.
    for (const token of ["22", "Edmonton Oilers", "edm"]) {
      expect((await parsePlayerMatrixRequestWithResolvedTeam({ season: String(SEASON), team: token })).teamId).toBe(22);
    }
  });

  it("FIXED F4 R04-TEAM-COMPARISON-TOKEN (was DEFECT PRESENT): team comparison resolves each subject by id, abbreviation or full name", async () => {
    const comparison = await buildContextualRankingComparisonSurface({
      entity: "teams", season: String(SEASON), min_gp: "1", teams: "22,Toronto Maple Leafs,XYZ",
    });
    expect(comparison.subjects.map((subject) => [subject.key, subject.status, subject.label])).toEqual([
      ["22", "available", "Edmonton Oilers"],
      ["TORONTO MAPLE LEAFS", "available", "Toronto Maple Leafs"],
      ["XYZ", "unavailable", "XYZ"],
    ]);
    // Abbreviations keep working.
    const control = await buildContextualRankingComparisonSurface({
      entity: "teams", season: String(SEASON), min_gp: "1", teams: "EDM,TOR",
    });
    expect(control.subjects.map((subject) => subject.status)).toEqual(["available", "available"]);
  });
});

describe("R06 team unit-TOI as-of (F9)", () => {
  it("FIXED F9 R06-UNIT-TOI-CUTOFF (was DEFECT PRESENT): without as_of_date the unit-TOI publication is capped at the power snapshot, so a later rebuild cannot leak in", async () => {
    // A later unit-TOI rebuild (2026-11-10) restates the same 11-01 game.
    db.tables.team_unit_toi.push(unitRow({ gameId: 1, teamId: EDM.id, snapshotDate: "2026-11-10", share: 0.55 }));

    // The page's own request never sends as_of_date.
    const pageQuery = queryOf(buildTeamMatrixRequestPath(teamFilters()));
    expect(pageQuery.as_of_date).toBeUndefined();
    const response = await buildTeamMatrixSurface(parseTeamMatrixRequest(pageQuery));
    const edm = response.rows.find((row) => row.team.abbreviation === "EDM")!;
    expect(response.meta.snapshotDate).toBe("2026-11-08");
    expect(edm.unitUsage.snapshotDate).toBe("2026-11-08");

    // Identical to an explicit as_of equal to the power date.
    clearTeamMatrixSurfaceCachesForTests();
    const pinned = await buildTeamMatrixSurface(
      parseTeamMatrixRequest({ ...pageQuery, as_of_date: "2026-11-08" }),
    );
    const pinnedEdm = pinned.rows.find((row) => row.team.abbreviation === "EDM")!;
    expect(pinnedEdm.unitUsage).toEqual(edm.unitUsage);

    // With only a later publication, unit usage is explicitly unavailable.
    clearTeamMatrixSurfaceCachesForTests();
    db.tables.team_unit_toi = db.tables.team_unit_toi.filter((row) => row.snapshot_date === "2026-11-10");
    const laterOnly = await buildTeamMatrixSurface(parseTeamMatrixRequest(pageQuery));
    const laterOnlyEdm = laterOnly.rows.find((row) => row.team.abbreviation === "EDM")!;
    expect(laterOnlyEdm.unitUsage.snapshotDate).toBeNull();
    expect(laterOnlyEdm.unitUsage.forwardTopLoadIndex).toBeNull();
    expect(laterOnly.meta.sourceWarnings).toContain("team_unit_toi source rows are unavailable for team usage metrics");
  });

  it("FIXED F9 R06-UNIT-TOI-COMPLETED-SEASON: a completed season (power through its last regular-season date) uses the later unit-TOI publication; rows stay bounded by the power date", async () => {
    // 2025-26 shape: regular season ends 2026-04-17, the last power snapshot is
    // 2026-04-17, and the season's unit-TOI snapshot was published in June.
    db.tables.seasons.push({ id: 20252026, startDate: "2025-10-07", regularSeasonEndDate: "2026-04-17" });
    db.tables.team_power_ratings_daily.push(
      ...db.tables.team_power_ratings_daily.map((row) => ({ ...row, date: "2026-04-17" })),
    );
    db.tables.games.push({ id: 7, date: "2026-04-16", seasonId: 20252026, type: 2, homeTeamId: EDM.id, awayTeamId: TOR.id });
    db.tables.wgo_team_stats.push(...[EDM, TOR].map((team, index) => ({
      id: 100 + index, season_id: 20252026, date: "2026-04-16", team_id: team.id, game_id: 7,
      goals_for: 3 - index, goals_against: 2 + index, point_pct: 1 - index,
      pp_opportunities_per_game: 3, penalties_taken_per_60: 4,
    })));
    db.tables.team_unit_toi.push(
      { ...unitRow({ gameId: 7, teamId: EDM.id, snapshotDate: "2026-06-22", share: 0.35 }), season_id: 20252026, game_date: "2026-04-16" },
      // A game after the power date must still be excluded by game_date.
      { ...unitRow({ gameId: 8, teamId: EDM.id, snapshotDate: "2026-06-22", share: 0.9 }), season_id: 20252026, game_date: "2026-04-18" },
    );

    const pageQuery = queryOf(buildTeamMatrixRequestPath(teamFilters({ season: "20252026" })));
    const response = await buildTeamMatrixSurface(parseTeamMatrixRequest(pageQuery));
    const edm = response.rows.find((row) => row.team.abbreviation === "EDM")!;
    expect(response.meta.snapshotDate).toBe("2026-04-17");
    expect(edm.unitUsage).toMatchObject({ games: 1, snapshotDate: "2026-06-22", forwardTopLoadIndex: 35 });

    // An explicit as_of still wins: before the June publication there is none.
    clearTeamMatrixSurfaceCachesForTests();
    const pinned = await buildTeamMatrixSurface(parseTeamMatrixRequest({ ...pageQuery, as_of_date: "2026-04-17" }));
    expect(pinned.rows.find((row) => row.team.abbreviation === "EDM")!.unitUsage.snapshotDate).toBeNull();
  });

  it("FIXED-CHECK R06-POWER-SEASON: a historical season never reads a later season's power snapshot", async () => {
    db.tables.seasons.push({ id: 20252026, startDate: "2025-10-07", regularSeasonEndDate: "2026-04-17" });
    await expect(
      buildTeamMatrixSurface(parseTeamMatrixRequest({ season: "20252026" })),
    ).rejects.toThrow("No team power snapshot available");
    const powerCall = db.calls.find((call) => call.table === "team_power_ratings_daily")!;
    expect(powerCall.filters).toEqual(expect.arrayContaining([
      ["gte", "date", "2025-10-07"],
      ["lte", "date", "2026-04-17"],
    ]));
  });
});

describe("F15 team unit-TOI read volume", () => {
  const CONSUMED_FILTER = "unit_type.eq.power_play,unit_number.eq.1";

  /** Writer-shaped rows for one team-game: 4 lines, 3 pairs, 3 PP units, 1 PK row. */
  function teamGameRows(args: { gameId: number; teamId: number; snapshotDate: string; seed: number }) {
    const base = {
      season_id: SEASON, team_id: args.teamId, game_id: args.gameId,
      game_date: "2026-11-01", snapshot_date: args.snapshotDate, coverage_warnings: [],
    };
    const units: Array<[string, number, number, number, string]> = [
      ...[0.38, 0.3, 0.2, 0.12].map((share, index) => ["forward_line", index + 1, share, 1500, "complete"] as [string, number, number, number, string]),
      ...[0.42, 0.33, 0.25].map((share, index) => ["defense_pair", index + 1, share, 1500, "partial"] as [string, number, number, number, string]),
      ...[0.55, 0.35, 0.1].map((share, index) => ["power_play", index + 1, share, 240, index === 2 ? "partial" : "complete"] as [string, number, number, number, string]),
      ["penalty_kill", 1, 0.5, 200, "complete"],
    ];
    return units.map(([unitType, unitNumber, share, pool, status], index) => ({
      ...base,
      id: `${args.snapshotDate}:${args.gameId}:${args.teamId}:${index}`,
      unit_type: unitType,
      unit_number: unitNumber,
      unit_share: share + args.seed / 1000,
      unit_toi_seconds: Math.round(pool * (share + args.seed / 1000)),
      team_unit_pool_toi_seconds: pool,
      coverage_status: status,
      ...(status === "partial" ? { coverage_warnings: [`seed_${args.seed}`] } : {}),
    }));
  }

  const consumed = (row: { unit_type: string; unit_number: number }) =>
    row.unit_type === "power_play" || row.unit_number === 1;

  it("FIXED F15 UNIT-TOI-READ: the aggregate is identical with and without non-top ES and PK rows, the read carries the filter, and page count drops", async () => {
    // 1. Aggregator identity on writer-shaped rows (non-top lines/pairs, all PP units, a PK row).
    const allRows = [1, 2, 3].flatMap((gameId) =>
      [EDM.id, TOR.id].flatMap((teamId) => teamGameRows({ gameId, teamId, snapshotDate: "2026-11-08", seed: gameId + teamId })));
    expect(allRows.some((row) => !consumed(row))).toBe(true);
    const full = aggregateTeamUnitToiRows(allRows as never);
    const filtered = aggregateTeamUnitToiRows(allRows.filter(consumed) as never);
    expect(filtered).toEqual(full);
    expect(full.get(EDM.id)!.gamesCount).toBe(3);

    // 2. The surface read carries the filter and the served unit usage equals the full aggregate.
    db.tables.games = [1, 2, 3].map((id) => ({ id, date: "2026-11-01", seasonId: SEASON, type: 2, homeTeamId: EDM.id, awayTeamId: TOR.id }));
    db.tables.team_unit_toi = allRows;
    db.calls = [];
    const response = await buildTeamMatrixSurface(parseTeamMatrixRequest(queryOf(buildTeamMatrixRequestPath(teamFilters()))));
    const unitReads = db.calls.filter((call) => call.table === "team_unit_toi" &&
      call.filters.some(([method, key]) => method === "eq" && key === "snapshot_date"));
    expect(unitReads.length).toBeGreaterThan(0);
    for (const call of unitReads) expect(call.filters).toContainEqual(["or", "", CONSUMED_FILTER]);
    const fullEdm = full.get(EDM.id)!;
    expect(response.rows.find((row) => row.team.abbreviation === "EDM")!.unitUsage).toMatchObject({
      games: fullEdm.gamesCount,
      forwardTopLoadIndex: fullEdm.forwardTopLoadIndex,
      defensePairTopLoadIndex: fullEdm.defensePairTopLoadIndex,
      pp1Pp2UsageShare: fullEdm.pp1Pp2UsageShare,
      coverage: fullEdm.coverage,
    });

    // 3. Page count on a large fixture: 2 teams x 300 games x 11 rows = 6,600 rows
    // (7 pages of 1,000) of which 2 x 300 x 5 = 3,000 are consumed (3 pages).
    clearTeamMatrixSurfaceCachesForTests();
    db.tables.team_unit_toi = Array.from({ length: 300 }, (_, index) => index + 1000).flatMap((gameId) =>
      [EDM.id, TOR.id].flatMap((teamId) => teamGameRows({ gameId, teamId, snapshotDate: "2026-11-08", seed: 1 })));
    expect(db.tables.team_unit_toi).toHaveLength(6600);
    db.calls = [];
    await buildTeamMatrixSurface(parseTeamMatrixRequest(queryOf(buildTeamMatrixRequestPath(teamFilters()))));
    const largeReads = db.calls.filter((call) => call.table === "team_unit_toi" &&
      call.filters.some(([method, key]) => method === "eq" && key === "snapshot_date"));
    expect(largeReads).toHaveLength(4); // 3 full pages + 1 empty terminating read (was 7: 6 full + 1 partial)
  });
});
