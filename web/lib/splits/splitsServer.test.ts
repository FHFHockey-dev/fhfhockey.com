import { describe, expect, it, vi } from "vitest";

const fixtures = vi.hoisted(() => ({ goalieRows: [] as Record<string, unknown>[] }));
vi.mock("lib/supabase/server", () => ({ default: {
  from(table: string) {
    if (!["goaliesGameStats", "gameOutcomes"].includes(table)) throw new Error(`Unexpected table ${table}`);
    const query = { select: () => query, in: () => query, eq: () => query, order: () => query,
      range: async () => ({ data: table === "goaliesGameStats" ? fixtures.goalieRows : [], error: null }) };
    return query;
  },
} }));

import {
  aggregateSplitGoalieGames,
  buildGoalieRows,
  buildLandingGoalieLeaders,
  creditedStartersByGame,
  leagueSavePctFromOfficialLogs,
} from "./splitsServer";

const goalieRow = (playerId: number, gameId: number, saves: number, shots: number, toi: string) => ({
  playerId,
  gameId,
  goalsAgainst: shots - saves,
  saveShotsAgainst: `${saves}/${shots}`,
  toi,
});

const log = (goalieId: number, gameId: number, started: number, saves: number, shots: number) => ({
  goalie_id: goalieId,
  game_id: gameId,
  games_played: 1,
  games_started: started,
  saves,
  shots_against: shots,
});

describe("Splits goalie Quality Starts (decision 40)", () => {
  it("pools the league average over regular-season official appearances", () => {
    const savePct = leagueSavePctFromOfficialLogs({
      logs: [log(1, 1, 1, 9, 10), log(2, 2, 1, 89, 100), log(3, 3, 1, 0, 50)],
      regularSeasonGameIds: new Set([1, 2]),
    });
    // 98/110, not .90 and .89 averaged, and the preseason game 3 is excluded.
    expect(savePct).toBeCloseTo(98 / 110, 12);
  });

  it("uses Vollman's league-average rule instead of a fixed .910", () => {
    // 27/30 = .900 with 3 GA: below the old .910 threshold, above a .890
    // league average, so Vollman credits a Quality Start (old rule: 0).
    const result = aggregateSplitGoalieGames({
      rowsByGame: new Map([[1, [goalieRow(1, 1, 27, 30, "60:00")]]]),
      creditedStartersByGame: creditedStartersByGame([log(1, 1, 1, 27, 30)]),
      outcomeByGameId: new Map([[1, "WIN"]]),
      leagueSavePct: 0.89,
    });
    expect(result.get(1)).toMatchObject({ gamesStarted: 1, qualityStarts: 1, wins: 1, qualityStartsUnavailable: false });
  });

  it("credits the official starter, not the goalie with the longest TOI", () => {
    // The starter was pulled after 12 minutes; the reliever played 48. The old
    // longest-TOI rule gave the reliever the start, the QS and the win.
    const result = aggregateSplitGoalieGames({
      rowsByGame: new Map([[1, [goalieRow(1, 1, 5, 9, "12:00"), goalieRow(2, 1, 20, 20, "48:00")]]]),
      creditedStartersByGame: creditedStartersByGame([log(1, 1, 1, 5, 9), log(2, 1, 0, 20, 20)]),
      outcomeByGameId: new Map([[1, "WIN"]]),
      leagueSavePct: 0.9,
    });
    expect(result.get(1)).toMatchObject({ gamesStarted: 1, qualityStarts: 0, wins: 1 });
    expect(result.get(2)).toMatchObject({ gamesPlayed: 1, gamesStarted: 0, qualityStarts: 0, wins: 0 });
  });

  it("leaves QS unavailable without a credited starter or a league average", () => {
    const noStarter = aggregateSplitGoalieGames({
      rowsByGame: new Map([[1, [goalieRow(1, 1, 30, 30, "60:00")]]]),
      creditedStartersByGame: new Map(),
      outcomeByGameId: new Map([[1, "WIN"]]),
      leagueSavePct: 0.9,
    });
    expect(noStarter.get(1)).toMatchObject({ gamesStarted: 0, wins: 0, qualityStartsUnavailable: true });

    const noLeague = aggregateSplitGoalieGames({
      rowsByGame: new Map([[1, [goalieRow(1, 1, 30, 30, "60:00")]]]),
      creditedStartersByGame: creditedStartersByGame([log(1, 1, 1, 30, 30)]),
      outcomeByGameId: new Map(),
      leagueSavePct: null,
    });
    expect(noLeague.get(1)).toMatchObject({ gamesStarted: 1, qualityStarts: 0, qualityStartsUnavailable: true });
  });
});


describe("Splits nullable goalie source coverage", () => {
  const player = { playerId: 1, playerName: "Fixture goalie", teamId: 1, positionCode: "G" };
  const games = [1, 2].map(id => ({ id, homeTeamId: 1, awayTeamId: 2, type: 2 }));
  const row = (id: number, saveShotsAgainst: string | null, goalsAgainst: number, toi: string | null) =>
    ({ playerId: 1, gameId: id, saveShotsAgainst, goalsAgainst, toi });
  const build = async (rows: ReturnType<typeof row>[], officialLogs = [log(1, 1, 1, 20, 22), log(1, 2, 1, 10, 11)]) => {
    fixtures.goalieRows = rows;
    const roster = await buildGoalieRows({ teamId: 1, opponentTeamId: 2, games, rosterPlayers: [player], officialLogs });
    const landing = buildLandingGoalieLeaders({ goalieRows: rows, gamesById: new Map(games.map(g => [g.id, g])),
      playerDirectory: { byPlayerId: new Map([[1, player]]), byTeamId: new Map([[1, [player]]]) } });
    return { roster: roster[0], landing: landing[0] };
  };

  it("keeps measured zero shots and positive-clock all-zero appearances known", async () => {
    const result = await build([row(1, "20/22", 2, "60:00"), row(2, "0/0", 0, "60:00")]);
    expect(result.roster).toMatchObject({ gamesPlayed: 2, shotsAgainst: 22, goalsAllowed: 2, savePct: 0.909, goalsAllowedAverage: 1 });
    expect(result.landing).toMatchObject({ gamesPlayed: 2, shotsAgainst: 22, goalsAgainst: 2, savePct: 0.909 });
    const zero = await build([row(1, "0/0", 0, "60:00")]);
    expect(zero.roster).toMatchObject({ gamesPlayed: 1, shotsAgainst: 0, goalsAllowed: 0, goalsAllowedAverage: 0, savePct: null });
  });

  it.each([null, "bad", "25/20"])("withholds incomplete ratio totals without discarding known goals and clocks: %s", async ratio => {
    const result = await build([row(1, "20/22", 2, "60:00"), row(2, ratio, 1, "60:00")]);
    expect(result.roster).toMatchObject({ gamesPlayed: 2, shotsAgainst: null, savePct: null,
      goalsAllowed: 3, goalsAllowedAverage: 1.5, qualityStarts: null, qualityStartsPct: null });
    expect(result.landing).toMatchObject({ gamesPlayed: 2, shotsAgainst: null, savePct: null, goalsAgainst: 3 });
  });

  it("retains a proven appearance with unknown clock, keeping the GAA denominator unknown", async () => {
    const result = await build([row(1, "20/22", 2, "60:00"), row(2, "10/11", 1, null)]);
    expect(result.roster).toMatchObject({ gamesPlayed: 2, gamesStarted: 2, shotsAgainst: 33,
      savePct: 0.909, goalsAllowed: 3, goalsAllowedAverage: null });
    expect(result.landing).toMatchObject({ gamesPlayed: 2, shotsAgainst: 33, goalsAgainst: 3 });
  });

  it("uses existing official appearance evidence for an otherwise unknown zero-event row", async () => {
    const result = await build([row(2, null, 0, null)]);
    expect(result.roster).toMatchObject({ gamesPlayed: 1, gamesStarted: 1, shotsAgainst: null, goalsAllowedAverage: null });
    // Landing has no official-log join: it must disclose unknown participation.
    expect(result.landing).toMatchObject({ gamesPlayed: null, shotsAgainst: null });
  });

  it("does not count unproved participation as zero or an appearance", async () => {
    const result = await build([row(1, null, 0, null)], []);
    expect(result.roster).toMatchObject({ gamesPlayed: null, shotsAgainst: null, qualityStarts: null });
    expect(result.landing).toMatchObject({ gamesPlayed: null, shotsAgainst: null });
    const backup = await build([row(1, "0/0", 0, "00:00")], []);
    expect(backup.roster).toMatchObject({ gamesPlayed: 0, shotsAgainst: 0, goalsAllowed: 0 });
    expect(backup.landing).toBeUndefined();
  });

  it("preserves a measured penalty-shot appearance with a zero-duration clock", async () => {
    const result = await build([row(1, "0/1", 1, "00:00")], []);
    expect(result.roster).toMatchObject({ gamesPlayed: 1, shotsAgainst: 1, goalsAllowed: 1, savePct: 0, goalsAllowedAverage: null });
    expect(result.landing).toMatchObject({ gamesPlayed: 1, shotsAgainst: 1, savePct: 0 });
  });

  it("does not manufacture a shutout by excluding a possible relief appearance", async () => {
    fixtures.goalieRows = [row(1, "20/20", 0, "60:00"), { ...row(1, null, 0, null), playerId: 2 }];
    const result = await buildGoalieRows({ teamId: 1, opponentTeamId: 2, games,
      rosterPlayers: [player, { ...player, playerId: 2 }], officialLogs: [log(1, 1, 1, 20, 20)] });
    expect(result.find(r => r.playerId === 1)?.shutouts).toBeNull();
  });
});
