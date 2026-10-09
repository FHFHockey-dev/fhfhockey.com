import { describe, expect, it } from "vitest";
import {
  clampTime,
  isActive,
  matrixData,
  normalizeGame,
  normalizeSchedule,
  sortedPlayers,
  statsAt,
  toiAt,
} from "./model";
import { gameFixture } from "./testFixtures";
import { getTOIData } from "components/LinemateMatrix";

function fixtureGame() {
  const f = gameFixture();
  return normalizeGame(f.box, f.shifts, f.pbp);
}

describe("Game Grid replay model", () => {
  it("keeps shiftless players, merges duplicate shifts, and computes cursor-relative TOI", () => {
    const f = gameFixture();
    f.shifts.data.push(f.shifts.data[0]);
    const game = normalizeGame(f.box, f.shifts, f.pbp);
    expect(game.players.find((p) => p.id === 202)?.shifts).toEqual([]);
    const player = game.players[0];
    expect(toiAt(player, 20)).toBe(20);
    expect(toiAt(player, 45)).toBe(30);
    expect(toiAt(player, 90)).toBe(60);
    expect(toiAt(player, 3600)).toBe(90);
  });
  it("uses half-open shift boundaries and actual goalie shifts", () => {
    const game = fixtureGame();
    expect(isActive(game.players[0], 0)).toBe(true);
    expect(isActive(game.players[0], 30)).toBe(false);
    const starter = game.players.find((p) => p.id === 104)!;
    const backup = game.players.find((p) => p.id === 105)!;
    expect(isActive(starter, 599)).toBe(true);
    expect(isActive(backup, 599)).toBe(false);
    expect(isActive(starter, 600)).toBe(false);
    expect(isActive(backup, 600)).toBe(true);
  });
  it("sorts active players first with stable position and roster order", () => {
    const game = fixtureGame();
    expect(
      sortedPlayers(
        game.players.filter((p) => p.teamId === 68),
        new Set([102, 103, 104]),
      ).map((p) => p.id),
    ).toEqual([102, 103, 104, 101, 105]);
  });
  it("counts goals as shots and includes events at the selected instant", () => {
    const game = fixtureGame();
    expect(statsAt(game, 9).teams[68]).toEqual({ goals: 0, shots: 0 });
    expect(statsAt(game, 20).teams[68]).toEqual({ goals: 1, shots: 2 });
    expect(statsAt(game, 20).shots[101]).toBe(2);
    expect(statsAt(game, 60).teams[21].shots).toBe(1);
  });
  it.each([
    [2, 4, "OT", 200, 3700, 3900],
    [2, 5, "SO", 0, 3900, 3900],
    [3, 5, "OT", 900, 5100, 6000],
  ])(
    "normalizes game type %s period %s %s",
    (gameType, period, periodType, remaining, duration, axis) => {
      const f = gameFixture();
      f.box.gameType = gameType;
      f.box.periodDescriptor = { number: period, periodType };
      f.box.clock.secondsRemaining = remaining;
      const game = normalizeGame(f.box, f.shifts, f.pbp);
      expect(game.duration).toBe(duration);
      expect(game.axisDuration).toBe(axis);
    },
  );
  it("excludes shootout goals from replay shots and score", () => {
    const f = gameFixture();
    f.box.periodDescriptor = { number: 5, periodType: "SO" };
    f.pbp.plays.push({
      eventId: 4,
      typeDescKey: "goal",
      timeInPeriod: "00:00",
      periodDescriptor: { number: 5, periodType: "SO" },
      details: { eventOwnerTeamId: 21, scoringPlayerId: 201 },
    });
    const game = normalizeGame(f.box, f.shifts, f.pbp);
    expect(statsAt(game, game.duration).teams[21]).toEqual({
      goals: 0,
      shots: 1,
    });
    expect(game.shootout).toBe(true);
  });
  it("uses the same absolute clock for goals, shifts and special teams in overtime", () => {
    const f = gameFixture();
    f.box.periodDescriptor = { number: 4, periodType: "OT" };
    f.box.clock.secondsRemaining = 200;
    f.shifts.data.push({
      ...f.shifts.data[0],
      period: 4,
      startTime: "00:00",
      endTime: "01:40",
    });
    f.pbp.plays.push(
      {
        eventId: 4,
        typeDescKey: "penalty",
        timeInPeriod: "00:10",
        periodDescriptor: { number: 4, periodType: "OT" },
        details: { eventOwnerTeamId: 21, duration: 2, typeCode: "MIN" },
      },
      {
        eventId: 5,
        typeDescKey: "goal",
        timeInPeriod: "01:40",
        periodDescriptor: { number: 4, periodType: "OT" },
        details: { eventOwnerTeamId: 68, scoringPlayerId: 101 },
      },
    );
    const game = normalizeGame(f.box, f.shifts, f.pbp);
    expect(game.players[0].shifts.at(-1)).toEqual({ start: 3600, end: 3700 });
    expect(game.events.at(-1)?.time).toBe(3700);
    expect(game.powerPlays).toEqual([{ teamId: 68, start: 3610, end: 3700 }]);
  });
  it("calculates full-game pairwise TOI from merged shift intersections", () => {
    const game = fixtureGame();
    const data = matrixData(game, "line-combination");
    expect(
      data.toi[68].find((p) => p.p1.id === 101 && p.p2.id === 103)?.toi,
    ).toBe(90);
    expect(data.rosters[68].every((p) => p.position !== "G")).toBe(true);
    expect(matrixData(game, "pp-toi").toi[68].every((p) => p.toi === 0)).toBe(
      true,
    );
  });
  it("preserves the standalone matrix shared-seconds calculation", () => {
    const f = gameFixture();
    const game = normalizeGame(f.box, f.shifts, f.pbp);
    const data = matrixData(game, "total-toi");
    const rostersMap = Object.fromEntries(
      Object.values(data.rosters)
        .flat()
        .map((p) => [p.id, p]),
    );
    const legacy = getTOIData(
      [
        { data: f.shifts.data },
        { rostersMap, teams: [game.home, game.away] },
        { plays: f.pbp.plays },
      ],
      "total-toi",
    );
    expect(data.toi).toEqual(legacy.toi);
  });
  it("reports unfinished games, missing shifts, and malformed required inputs", () => {
    const f = gameFixture();
    expect(() =>
      normalizeGame({ ...f.box, gameState: "LIVE" }, f.shifts, f.pbp),
    ).toThrow("Game status: LIVE");
    expect(() => normalizeGame(f.box, { data: [] }, f.pbp)).toThrow(
      "Shift data is not available",
    );
    expect(() => normalizeGame(f.box, f.shifts, {})).toThrow(
      "play-by-play events",
    );
    expect(() => normalizeGame(f.box, f.shifts, { plays: [] })).toThrow(
      "Play-by-play data is not available",
    );
  });
  it("clamps seeking to the recorded game and parses the schedule", () => {
    expect(clampTime(-30, 3700)).toBe(0);
    expect(clampTime(3900, 3700)).toBe(3700);
    expect(
      normalizeSchedule({
        gameWeek: [
          {
            date: "2026-09-26",
            games: [
              {
                id: 1,
                gameState: "FINAL",
                homeTeam: { abbrev: "UTA" },
                awayTeam: { abbrev: "COL" },
              },
            ],
          },
        ],
      }),
    ).toEqual([
      { id: 1, date: "2026-09-26", state: "FINAL", home: "UTA", away: "COL" },
    ]);
  });
});
