import { describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  tables: {} as Record<string, Record<string, unknown>[] | Record<string, unknown> | null>,
  calls: [] as Array<[string, string, unknown[]]>
}));
vi.mock("lib/supabase/server", () => ({ default: {
  from(table: string) {
    const result = () => ({ data: db.tables[table] ?? null, error: null });
    const query: Record<string, unknown> = {
      then: (resolve: (value: unknown) => void) => resolve(result()),
      maybeSingle: () => Promise.resolve(result())
    };
    for (const name of ["select", "eq", "or", "lt", "in", "order", "limit"]) {
      query[name] = (...args: unknown[]) => { db.calls.push([table, name, args]); return query; };
    }
    return query;
  }
} }));

import {
  buildTeamStrengthPriorFromInHouseXgAggregateRow,
  buildTeamStrengthPriorFromNhlTeamDataRows,
  fetchTeamOfficialPpUsage,
  fetchTeamStrengthAverages
} from "./team-context-queries";

describe("fetchTeamOfficialPpUsage", () => {
  const games = (count: number) => Array.from({ length: count }, (_, i) => ({ id: 2026020100 - i, date: `2026-10-${String(20 - i).padStart(2, "0")}` }));
  // 18 skaters x 1000 s = 18000 s; four of them on the PP for 45 s, 30 s, 30 s and 15 s (sub-minute seconds stay seconds).
  const gameRows = (gameId: number, abbrev = "EDM") => Array.from({ length: 18 }, (_, i) => ({
    player_id: 100 + i + (abbrev === "EDM" ? 0 : 50), game_id: gameId, team_abbrev: abbrev, toi_per_game: 1000, pp_toi: [45, 30, 30, 15][i] ?? 0, pp_toi_per_game: null, pp_shots: i < 2 ? 1 : 0
  }));
  function seed(gameCount: number, wgo: Record<string, unknown>[]) {
    db.calls.length = 0;
    db.tables = { games: games(gameCount), teams: { abbreviation: "EDM" }, wgo_skater_stats: wgo };
  }

  it("averages official per-game team sums over the last 10 regular-season games before the date", async () => {
    const ids = games(10).map((g) => g.id);
    seed(10, [...ids.flatMap((id) => gameRows(id)), ...gameRows(ids[0], "CGY")]);
    const usage = await fetchTeamOfficialPpUsage(22, "2026-10-21");
    expect(usage).toMatchObject({ games: 10, ppToiSkaterSecondsAvg: 120, ppShotsAvg: 2, totalToiSkaterSecondsAvg: 18000 });
    expect(usage?.perPlayerPpToiAvgSec.get(100)).toBe(45);
    expect(usage?.perPlayerPpToiAvgSec.get(117)).toBe(0);
    expect(usage?.perPlayerPpToiAvgSec.has(150)).toBe(false);
    const gameCalls = db.calls.filter(([table]) => table === "games").map(([, name, args]) => [name, args]);
    expect(gameCalls).toEqual(expect.arrayContaining([["eq", ["type", 2]], ["lt", ["date", "2026-10-21"]],
      ["order", ["date", { ascending: false }]], ["limit", [10]], ["or", ["homeTeamId.eq.22,awayTeamId.eq.22"]]]));
    expect(db.calls).toEqual(expect.arrayContaining([["wgo_skater_stats", "in", ["game_id", ids]],
      ["wgo_skater_stats", "eq", ["team_abbrev", "EDM"]]]));
  });

  it("reads minute-format TOI as minutes and falls back to pp_toi_per_game", async () => {
    const ids = games(3).map((g) => g.id);
    seed(3, ids.flatMap((id) => gameRows(id).map((row, i) => ({ ...row, toi_per_game: 1000 / 60,
      pp_toi: null, pp_toi_per_game: i < 4 ? 0.5 : null }))));
    const usage = await fetchTeamOfficialPpUsage(22, "2026-10-21");
    expect(usage?.totalToiSkaterSecondsAvg).toBeCloseTo(18000, 6);
    expect(usage?.ppToiSkaterSecondsAvg).toBeCloseTo(120, 6);
    expect(usage?.perPlayerPpToiAvgSec.get(100)).toBeCloseTo(30, 6);
  });

  it("averages each player's PP seconds over only the games in which he has a row", async () => {
    const ids = games(4).map((g) => g.id);
    const rows = ids.flatMap((id) => gameRows(id));
    // Player 100: 45 s in all four games; player 120 dressed for two games (300 s and 180 s).
    rows.push({ ...rows[0], player_id: 120, game_id: ids[0], pp_toi: 300 }, { ...rows[0], player_id: 120, game_id: ids[2], pp_toi: 180 });
    seed(4, rows);
    const usage = await fetchTeamOfficialPpUsage(22, "2026-10-21");
    expect(usage?.perPlayerPpToiAvgSec.get(120)).toBe(240);
    expect(usage?.perPlayerPpToiAvgSec.get(100)).toBe(45);
  });

  it("returns null with fewer than three games of official rows", async () => {
    seed(2, games(2).flatMap((g) => gameRows(g.id)));
    expect(await fetchTeamOfficialPpUsage(22, "2026-10-21")).toBeNull();
    const ids = games(5).map((g) => g.id);
    seed(5, ids.slice(0, 2).flatMap((id) => gameRows(id)));
    expect(await fetchTeamOfficialPpUsage(22, "2026-10-21")).toBeNull();
  });
});

describe("fetchTeamStrengthAverages", () => {
  it("averages PK time alongside ES and PP", async () => {
    db.calls.length = 0;
    db.tables = { forge_team_game_strength: [
      { game_date: "2026-10-20", toi_es_seconds: 15000, toi_pp_seconds: 600, toi_pk_seconds: 500, shots_es: 25, shots_pp: 5 },
      { game_date: "2026-10-18", toi_es_seconds: 15400, toi_pp_seconds: 400, toi_pk_seconds: 700, shots_es: 27, shots_pp: 3 }
    ] };
    expect(await fetchTeamStrengthAverages(22, "2026-10-21")).toEqual({
      toiEsSecondsAvg: 15200, toiPpSecondsAvg: 500, toiPkSecondsAvg: 600, shotsEsAvg: 26, shotsPpAvg: 4 });
    expect(db.calls).toContainEqual(["forge_team_game_strength", "select",
      ["game_date,toi_es_seconds,toi_pp_seconds,toi_pk_seconds,shots_es,shots_pp"]]);
  });
});

describe("buildTeamStrengthPriorFromInHouseXgAggregateRow", () => {
  it("maps in-house rolling team xG into projection team-strength prior fields", () => {
    const prior = buildTeamStrengthPriorFromInHouseXgAggregateRow({
      model_version: "logistic_l2-s20252026-p1-st1-f1-cfg9bac2706",
      feature_version: 1,
      as_of_game_date: "2026-05-01",
      window_games: 10,
      games_count: 10,
      xg_for: 31.24,
      xg_against: 27.91
    });

    expect(prior).toEqual({
      source: "nhl_xg_team_rolling_aggregates",
      sourceDate: "2026-05-01",
      xga: 27.91,
      xgaPerGame: 2.791,
      xgfPerGame: 3.124,
      sourceModelVersion: "logistic_l2-s20252026-p1-st1-f1-cfg9bac2706",
      featureVersion: 1,
      windowGames: 10
    });
  });

  it("rejects rows without a usable game denominator or xG totals", () => {
    expect(
      buildTeamStrengthPriorFromInHouseXgAggregateRow({
        games_count: 0,
        xg_for: 3,
        xg_against: 2
      })
    ).toBeNull();
    expect(
      buildTeamStrengthPriorFromInHouseXgAggregateRow({
        games_count: 10,
        xg_for: null,
        xg_against: 2
      })
    ).toBeNull();
  });
});

describe("buildTeamStrengthPriorFromNhlTeamDataRows", () => {
  // One row per NST season, as the view returns them on 2026-10-19.
  const rows = [
    { date: "2026-10-19", games_played: 8, xga: 210, xga_per_game: 3, xgf_per_game: 2.6 },
    { date: "2026-10-19", games_played: 8, xga: 246, xga_per_game: 3, xgf_per_game: 2.7 },
    { date: "2026-10-19", games_played: 8, xga: 24.8, xga_per_game: 3.1, xgf_per_game: 3.4 }
  ];

  it("picks the season-to-date row whose implied games played match", () => {
    for (const order of [rows, [...rows].reverse()]) {
      expect(buildTeamStrengthPriorFromNhlTeamDataRows(order)).toEqual({
        source: "nhl_team_data",
        sourceDate: "2026-10-19",
        xga: 24.8,
        xgaPerGame: 3.1,
        xgfPerGame: 3.4,
        rowSelection: {
          method: "implied_gp_match",
          candidateRows: 3,
          gamesPlayed: 8,
          impliedGamesPlayed: 8
        }
      });
    }
  });

  it("only considers rows from the latest date", () => {
    const prior = buildTeamStrengthPriorFromNhlTeamDataRows([
      { date: "2026-10-18", games_played: 7, xga: 21, xga_per_game: 3, xgf_per_game: 3 },
      ...rows
    ]);
    expect(prior?.sourceDate).toBe("2026-10-19");
    expect(prior?.rowSelection?.candidateRows).toBe(3);
  });

  it("tolerates a one-game NST lag but rejects prior-season rows", () => {
    expect(
      buildTeamStrengthPriorFromNhlTeamDataRows([
        { date: "2026-10-19", games_played: 9, xga: 24.8, xga_per_game: 3.1, xgf_per_game: 3.4 }
      ])?.rowSelection?.impliedGamesPlayed
    ).toBe(8);
    expect(buildTeamStrengthPriorFromNhlTeamDataRows(rows.slice(0, 2))).toBeNull();
  });

  it("uses a row without games played only when it is the only one", () => {
    const unknown = rows.map((row) => ({ ...row, games_played: null }));
    expect(buildTeamStrengthPriorFromNhlTeamDataRows(unknown)).toBeNull();
    expect(
      buildTeamStrengthPriorFromNhlTeamDataRows(unknown.slice(2))?.rowSelection
    ).toEqual({
      method: "single_row",
      candidateRows: 1,
      gamesPlayed: null,
      impliedGamesPlayed: null
    });
    expect(buildTeamStrengthPriorFromNhlTeamDataRows([])).toBeNull();
  });
});
