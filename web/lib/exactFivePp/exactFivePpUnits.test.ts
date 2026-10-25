import { describe, expect, it } from "vitest";

import {
  AWAY,
  FIXTURES,
  HOME,
  UNIT_A,
  randomGame,
} from "./exactFivePpFixtures";
import { oraclePairwiseSeconds, runExactFiveOracle, type OracleTallies } from "./exactFivePpOracle";
import {
  buildExactFivePpGame,
  buildExactFiveUnitKey,
  classifyTeamSituation,
  parseExactFiveUnitKey,
  summarizeExactFivePp,
  type ExactFiveGameResult,
} from "./exactFivePpUnits";

function nonZero(record: Record<string, number>) {
  return Object.fromEntries(Object.entries(record).filter(([, value]) => value !== 0));
}

/** Project a library result onto the oracle's tally shape. */
function tallies(result: ExactFiveGameResult): OracleTallies {
  const out: OracleTallies = {
    unitSeconds: {},
    qualifyingSeconds: {},
    unknownSeconds: {},
    excludedSeconds: {},
  };
  const add = (target: Record<string, number>, key: string, value: number) => {
    if (value !== 0) target[key] = (target[key] ?? 0) + value;
  };
  for (const interval of result.intervals) {
    add(
      out.unitSeconds,
      `${interval.teamId}|${interval.manpower}|${interval.unitKey}`,
      interval.endSecond - interval.startSecond,
    );
  }
  for (const team of result.teams) {
    for (const [manpower, value] of Object.entries(team.pbpQualifyingSeconds)) {
      add(out.qualifyingSeconds, `${team.teamId}|${manpower}`, value);
    }
    for (const [reason, value] of Object.entries(team.unknownSeconds)) {
      add(out.unknownSeconds, `${team.teamId}|${reason}`, value);
    }
    for (const [kind, value] of Object.entries(team.excludedAdvantageSeconds)) {
      add(out.excludedSeconds, `${team.teamId}|${kind}`, value);
    }
  }
  return out;
}

function homeUnits(result: ExactFiveGameResult) {
  const units: Record<string, number> = {};
  for (const interval of result.intervals.filter((row) => row.teamId === HOME)) {
    const key = `${interval.manpower}|${interval.unitKey}`;
    units[key] = (units[key] ?? 0) + interval.endSecond - interval.startSecond;
  }
  return units;
}

describe("exact-five unit key", () => {
  it("sorts numerically and round-trips", () => {
    const key = buildExactFiveUnitKey([110, 9, 1001, 42, 7]);
    expect(key).toBe("x5:7-9-42-110-1001");
    expect(parseExactFiveUnitKey(key)).toEqual([7, 9, 42, 110, 1001]);
  });

  it("rejects non-five, duplicate, non-positive and non-canonical identities", () => {
    expect(() => buildExactFiveUnitKey([1, 2, 3, 4])).toThrow();
    expect(() => buildExactFiveUnitKey([1, 2, 3, 4, 4])).toThrow();
    expect(() => buildExactFiveUnitKey([0, 2, 3, 4, 5])).toThrow();
    expect(() => buildExactFiveUnitKey([1.5, 2, 3, 4, 5])).toThrow();
    expect(parseExactFiveUnitKey("x5:5-4-3-2-1")).toBeNull();
    expect(parseExactFiveUnitKey("x5:1-1-2-3-4")).toBeNull();
    expect(parseExactFiveUnitKey("x5:01-2-3-4-5")).toBeNull();
  });
});

describe("team situation classification", () => {
  it.each([
    ["1451", "home", "5v4"],
    ["1541", "away", "5v4"],
    ["1351", "home", "5v3"],
    ["1341", "home", "4v3"],
    ["1460", "home", "own_net_empty"],
    ["0551", "home", "opponent_net_empty"],
    ["1451", "away", "shorthanded"],
    ["1551", "home", "even"],
    ["1431", "away", "4v3"],
    ["1641", "away", "other_advantage"],
    ["2451", "home", null],
  ] as const)("%s for %s is %s", (code, side, expected) => {
    expect(classifyTeamSituation(code, side)).toBe(expected);
  });
});

describe("exact-five PP fixtures", () => {
  it.each(FIXTURES.map((fixture) => [fixture.name, fixture] as const))(
    "%s",
    (_name, fixture) => {
      const result = buildExactFivePpGame(fixture.input);
      expect(result.status).toBe(fixture.expected.status);
      expect(homeUnits(result)).toEqual(fixture.expected.unitSeconds);

      const home = result.teams.find((team) => team.teamId === HOME)!;
      if (fixture.expected.qualifying) {
        expect(home.pbpQualifyingSeconds).toEqual(fixture.expected.qualifying);
        const attributed = home.attributedSeconds["5v4"] + home.attributedSeconds["5v3"];
        const unknown = Object.values(home.unknownSeconds).reduce((a, b) => a + b, 0);
        // Every qualifying second is either attributed or unknown, never both.
        expect(attributed + unknown).toBe(
          fixture.expected.qualifying["5v4"] + fixture.expected.qualifying["5v3"],
        );
      }
      if (fixture.expected.unknown) {
        expect(nonZero(home.unknownSeconds)).toEqual(fixture.expected.unknown);
      }
      if (fixture.expected.excluded) {
        expect(nonZero(home.excludedAdvantageSeconds)).toEqual(fixture.expected.excluded);
      }
      if (fixture.expected.shiftOnlyAdvantageSeconds != null) {
        expect(home.shiftOnlyAdvantageSeconds).toBe(fixture.expected.shiftOnlyAdvantageSeconds);
      }
      if (fixture.expected.duplicateShiftSeconds != null) {
        expect(home.duplicateShiftSeconds).toBe(fixture.expected.duplicateShiftSeconds);
      }

      // Independent per-second oracle agrees on every tally for both teams.
      if (result.status === "included") {
        expect(tallies(result)).toEqual(runExactFiveOracle(fixture.input));
      }
    },
  );

  it("keeps intervals inside one period and disjoint per team", () => {
    const boundary = buildExactFivePpGame(FIXTURES[1].input);
    expect(boundary.intervals.map((row) => [row.period, row.startSecond, row.endSecond])).toEqual([
      [1, 1100, 1200],
      [2, 0, 20],
    ]);
    for (const fixture of FIXTURES) {
      const { intervals } = buildExactFivePpGame(fixture.input);
      for (const [index, row] of intervals.entries()) {
        const next = intervals[index + 1];
        if (next && next.teamId === row.teamId && next.period === row.period) {
          expect(next.startSecond).toBeGreaterThanOrEqual(row.endSecond);
        }
      }
    }
  });

  it("reports pairwise co-presence for every pair of a five that never formed", () => {
    const fixture = FIXTURES.find((row) => row.input.gameId === 1006)!;
    const target = [101, 102, 103, 104, 105];
    for (let i = 0; i < target.length; i += 1) {
      for (let j = i + 1; j < target.length; j += 1) {
        expect(oraclePairwiseSeconds(fixture.input, HOME, target[i], target[j])).toBeGreaterThan(0);
      }
    }
    const result = buildExactFivePpGame(fixture.input);
    expect(result.intervals.map((row) => row.unitKey)).not.toContain(
      buildExactFiveUnitKey(target),
    );
  });

  it("does not equal pooled player-seconds or summed pairwise overlaps", () => {
    const fixture = FIXTURES.find((row) => row.input.gameId === 1001)!;
    const result = buildExactFivePpGame(fixture.input);
    const unitClock = homeUnits(result)[`5v4|${buildExactFiveUnitKey(UNIT_A)}`];
    expect(unitClock).toBe(60);
    // team_unit_toi-style pooled seconds for the same 60s would be 300.
    expect(unitClock * UNIT_A.length).toBe(300);
    let pairwiseSum = 0;
    for (let i = 0; i < UNIT_A.length; i += 1) {
      for (let j = i + 1; j < UNIT_A.length; j += 1) {
        pairwiseSum += oraclePairwiseSeconds(fixture.input, HOME, UNIT_A[i], UNIT_A[j]);
      }
    }
    expect(pairwiseSum).toBeGreaterThan(unitClock);
  });
});

describe("game holds", () => {
  it("excludes upstream holds without computing intervals", () => {
    const held = FIXTURES.find((row) => row.input.gameId === 1008)!;
    const result = buildExactFivePpGame(held.input);
    expect(result.status).toBe("excluded");
    expect(result.holdReasons).toEqual(["shift_validation_not_passed", "upstream_hold"]);
    expect(result.upstreamHoldReasons).toHaveLength(1);
    expect(result.intervals).toEqual([]);
  });

  it("holds invalid intervals, foreign teams and broken situation timelines", () => {
    const base = FIXTURES[0].input;
    const withShift = (shift: (typeof base.shifts)[number]) => ({
      ...base,
      shifts: [...base.shifts, shift],
    });
    expect(
      buildExactFivePpGame(withShift({ playerId: 101, teamId: HOME, period: 1, startSecond: 50, endSecond: 50 })).holdReasons,
    ).toEqual(["invalid_shift_interval"]);
    expect(
      buildExactFivePpGame(withShift({ playerId: 101, teamId: HOME, period: 1, startSecond: 1190, endSecond: 1210 })).holdReasons,
    ).toEqual(["invalid_shift_interval"]);
    expect(
      buildExactFivePpGame(withShift({ playerId: 101, teamId: HOME, period: 4, startSecond: 0, endSecond: 10 })).holdReasons,
    ).toEqual(["invalid_shift_interval"]);
    expect(
      buildExactFivePpGame(withShift({ playerId: 301, teamId: 3, period: 1, startSecond: 0, endSecond: 10 })).holdReasons,
    ).toEqual(["shift_team_not_in_game"]);
    const gap = {
      ...base,
      periods: [{ period: 1, playedEndSecond: 1200, situationSegments: [
        { startSecond: 0, endSecond: 100, situationCode: "1551" },
        { startSecond: 110, endSecond: 1200, situationCode: "1551" },
      ] }],
    };
    expect(buildExactFivePpGame(gap).holdReasons).toEqual(["invalid_situation_timeline"]);
  });
});

describe("summary across games", () => {
  it("reports clock seconds, game count, latest appearance and denominators", () => {
    const results = FIXTURES.map((fixture) => buildExactFivePpGame(fixture.input));
    const { units, teams } = summarizeExactFivePp(results);

    const unitA = units.find(
      (unit) => unit.teamId === HOME && unit.manpower === "5v4" && unit.unitKey === buildExactFiveUnitKey(UNIT_A),
    )!;
    // 1001:60 + 1002:120 + 1003:100 + 1004:70 + 1005:70 + 1007:120 + 1009:30
    expect(unitA.sharedClockSeconds).toBe(570);
    expect(unitA.gameIds).toEqual([1001, 1002, 1003, 1004, 1005, 1007, 1009]);
    expect(unitA.gameCount).toBe(7);
    expect(unitA.firstGameDate).toBe("2026-10-01");
    expect(unitA.latestGameDate).toBe("2026-10-17");
    expect(unitA.latestGameId).toBe(1009);

    const unitA5v3 = units.find(
      (unit) => unit.teamId === HOME && unit.manpower === "5v3" && unit.unitKey === buildExactFiveUnitKey(UNIT_A),
    )!;
    expect(unitA5v3.sharedClockSeconds).toBe(30);
    expect(unitA5v3.gameCount).toBe(1);

    const home = teams.find((team) => team.teamId === HOME)!;
    expect(home.gamesIncluded).toBe(8);
    expect(home.gamesExcluded).toEqual([
      { gameId: 1008, holdReasons: ["shift_validation_not_passed", "upstream_hold"] },
    ]);
    // 120+120+100+100+70+120+150+100 qualifying 5v4 seconds in included games.
    expect(home.pbpQualifyingSeconds).toEqual({ "5v4": 880, "5v3": 30 });
    expect(nonZero(home.unknownSeconds)).toEqual({
      team_skater_count_mismatch: 30,
      opponent_skater_count_mismatch: 30,
      goalie_presence_conflict: 20,
      unknown_position: 50,
    });
    expect(home.attributionCoverage).toBeCloseTo((910 - 130) / 910, 10);

    const away = teams.find((team) => team.teamId === AWAY)!;
    expect(away.pbpQualifyingSeconds).toEqual({ "5v4": 0, "5v3": 0 });
    expect(away.attributionCoverage).toBeNull();
  });

  it("refuses to double count a repeated game result", () => {
    const result = buildExactFivePpGame(FIXTURES[0].input);
    expect(() => summarizeExactFivePp([result, result])).toThrow(/Duplicate/);
  });
});

describe("randomized agreement with the per-second oracle", () => {
  it("matches every tally on 300 seeded noisy games", () => {
    let attributedGames = 0;
    for (let seed = 1; seed <= 300; seed += 1) {
      const input = randomGame(seed);
      const result = buildExactFivePpGame(input);
      expect(result.status, `seed ${seed}`).toBe("included");
      const expected = runExactFiveOracle(input);
      expect(tallies(result), `seed ${seed}`).toEqual(expected);
      if (Object.keys(expected.unitSeconds).length > 0) attributedGames += 1;
    }
    // Guard against a vacuous comparison where nothing ever qualifies.
    expect(attributedGames).toBeGreaterThan(20);
  });
});
