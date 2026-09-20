import { describe, expect, it } from "vitest";

import {
  TEAM_DRIVER_MIN_LEAGUE_SAMPLE,
  buildTeamPerformanceDrivers,
  aggregateTeamSpecialTeams,
  aggregateTeamFiveOnFive,
  formatPercentileOrdinal,
} from "./teamPerformanceDriverModel";

const fiveOnFiveRows = Array.from(
  { length: TEAM_DRIVER_MIN_LEAGUE_SAMPLE },
  (_, index) => ({
    team_abbreviation: `T${index}`,
    date: "2026-03-20",
    gp: 10,
    xgf: 15 + index,
    xga: 45 - index,
    gf: 12 + index,
  }),
);

const specialTeamsRows = Array.from(
  { length: TEAM_DRIVER_MIN_LEAGUE_SAMPLE },
  (_, index) => ({
    team_id: index + 1,
    date: "2026-03-21",
    power_play_pct: 12 + index,
    penalty_kill_pct: 70 + index * 0.5,
  }),
);

describe("buildTeamPerformanceDrivers", () => {
  it.each(["xgf", "xga", "gf"] as const)("requires enough valid values for %s, not just team identities", key => {
    expect(buildTeamPerformanceDrivers({
      teamAbbreviation: "T0", teamId: 1, specialTeamsRows,
      fiveOnFiveRows: fiveOnFiveRows.map((row, index) => index === 1 ? { ...row, [key]: null } : row)
    })).toBeNull();
  });

  it.each(["xgf", "xga", "gf"] as const)("rejects negative source values for %s", key => {
    expect(buildTeamPerformanceDrivers({
      teamAbbreviation: "T0", teamId: 1, specialTeamsRows,
      fiveOnFiveRows: fiveOnFiveRows.map(row => ({ ...row, [key]: -1 }))
    })).toBeNull();
  });

  it("assigns tied metrics midrank and keeps finishing ratio distinct from percentile", () => {
    const result = buildTeamPerformanceDrivers({
      teamAbbreviation: "T0", teamId: 1,
      fiveOnFiveRows: fiveOnFiveRows.map(row => ({ ...row, xgf: 20, xga: 25, gf: 22 })),
      specialTeamsRows: specialTeamsRows.map(row => ({ ...row, power_play_pct: 20, penalty_kill_pct: 80 }))
    });
    expect(result?.drivers.map(driver => driver.percentile)).toEqual([50, 50, 50, 50]);
    expect(result?.drivers[2].valueLabel).toBe("110.0% GF/xGF");
  });

  it("rejects zero exposure instead of producing infinite finishing or per-game rates", () => {
    for (const missing of [{ gp: 0 }, { xgf: 0 }]) {
      expect(buildTeamPerformanceDrivers({
        teamAbbreviation: "T0", teamId: 1, specialTeamsRows,
        fiveOnFiveRows: fiveOnFiveRows.map(row => ({ ...row, ...missing }))
      })).toBeNull();
    }
  });
  it("formats percentile ordinals correctly", () => {
    expect(
      [1, 2, 3, 4, 11, 12, 13, 21, 42, 73].map(formatPercentileOrdinal),
    ).toEqual([
      "1st",
      "2nd",
      "3rd",
      "4th",
      "11th",
      "12th",
      "13th",
      "21st",
      "42nd",
      "73rd",
    ]);
  });

  it("creates directionally honest league-relative driver cards", () => {
    const result = buildTeamPerformanceDrivers({
      teamAbbreviation: "T23",
      teamId: 24,
      fiveOnFiveRows,
      specialTeamsRows,
    });

    expect(result?.leagueSample).toBe(TEAM_DRIVER_MIN_LEAGUE_SAMPLE);
    expect(result?.fiveOnFiveDate).toBe("2026-03-20");
    expect(result?.fiveOnFiveOldestDate).toBe("2026-03-20");
    expect(result?.specialTeamsDate).toBe("2026-03-21");
    expect(result?.specialTeamsOldestDate).toBe("2026-03-21");
    expect(result?.drivers.map((driver) => driver.key)).toEqual([
      "generation",
      "suppression",
      "finishing",
      "specialTeams",
    ]);
    expect(result?.drivers[0].status).toBe("strength");
    expect(result?.drivers[1].status).toBe("strength");
    expect(result?.drivers[2].explanation).toContain(
      "not a permanent talent claim",
    );
  });

  it("rejects partial league snapshots instead of assigning misleading bands", () => {
    expect(
      buildTeamPerformanceDrivers({
        teamAbbreviation: "T0",
        teamId: 1,
        fiveOnFiveRows: fiveOnFiveRows.slice(0, 10),
        specialTeamsRows: specialTeamsRows.slice(0, 10),
      }),
    ).toBeNull();
  });

  it("rejects missing driver inputs", () => {
    expect(
      buildTeamPerformanceDrivers({
        teamAbbreviation: "T0",
        teamId: 1,
        fiveOnFiveRows: fiveOnFiveRows.map((row, index) =>
          index === 0 ? { ...row, xgf: null } : row,
        ),
        specialTeamsRows,
      }),
    ).toBeNull();
  });

  it("uses the freshest special-teams row per team inside a bounded window", () => {
    const result = buildTeamPerformanceDrivers({
      teamAbbreviation: "T0",
      teamId: 1,
      fiveOnFiveRows,
      specialTeamsRows: [
        ...specialTeamsRows,
        {
          ...specialTeamsRows[0],
          date: "2026-03-19",
          power_play_pct: 99,
        },
      ],
    });

    expect(result?.drivers[3].valueLabel).toContain("PP 12.0%");
  });

  it("falls back to the freshest complete special-teams row in percentage points", () => {
    const ratioRows = specialTeamsRows.map((row) => ({
      ...row,
      power_play_pct: row.power_play_pct,
      penalty_kill_pct: row.penalty_kill_pct,
    }));
    const result = buildTeamPerformanceDrivers({
      teamAbbreviation: "T0",
      teamId: 1,
      fiveOnFiveRows,
      specialTeamsRows: [
        ...ratioRows,
        {
          ...ratioRows[0],
          date: "2026-03-22",
          power_play_pct: null,
        },
      ],
    });

    expect(result?.specialTeamsDate).toBe("2026-03-21");
    expect(result?.drivers[3].valueLabel).toContain("PP 12.0%");
  });

  it("uses the freshest five-on-five row per team inside a bounded window", () => {
    const result = buildTeamPerformanceDrivers({
      teamAbbreviation: "T0",
      teamId: 1,
      fiveOnFiveRows: [
        ...fiveOnFiveRows,
        { ...fiveOnFiveRows[0], date: "2026-03-18", xgf: 999 },
      ],
      specialTeamsRows,
    });

    expect(result?.drivers[0].valueLabel).toContain("1.50 xGF/GP");
  });
});


describe("cumulative team special teams", () => {
  const game = { team_id: 1, game_id: 1, date: "2026-01-01", pp_opportunities: 1, power_play_goals_for: 1, times_shorthanded: 1, pp_goals_against: 0 };
  it("uses ratio of summed counts, not mean game percentages, and deduplicates games", () => {
    const other = { ...game, game_id: 2, date: "2026-01-02", pp_opportunities: 9, power_play_goals_for: 0, times_shorthanded: 9, pp_goals_against: 2 };
    expect(aggregateTeamSpecialTeams([game, other, game])).toEqual([
      { team_id: 1, date: "2026-01-02", power_play_pct: 10, penalty_kill_pct: 80 }
    ]);
  });
  it("does not use partial or zero-opportunity data as a percentage", () => {
    expect(aggregateTeamSpecialTeams([{ ...game, pp_opportunities: null }])[0].power_play_pct).toBeNull();
    expect(aggregateTeamSpecialTeams([{ ...game, pp_opportunities: 0, power_play_goals_for: 0 }])[0].power_play_pct).toBeNull();
  });
  it("rejects conflicting observations for a game", () => {
    expect(() => aggregateTeamSpecialTeams([game, { ...game, power_play_goals_for: 0 }])).toThrow("Conflicting");
  });
});

describe("cumulative five-on-five coverage", () => {
  const game = { team_abbreviation: "T0", date: "2026-01-01", gp: 1, xgf: 2, xga: 1, gf: 3 };
  const expected = new Map([["T0", new Map([["2026-01-01", 1], ["2026-01-02", 1]])]]);
  it("sums daily totals over unique expected dates", () => {
    expect(aggregateTeamFiveOnFive([game, game, { ...game, date: "2026-01-02", xgf: 4 }], expected))
      .toEqual([{ team_abbreviation: "T0", date: "2026-01-02", gp: 2, xgf: 6, xga: 2, gf: 6 }]);
  });
  it("rejects incomplete calendar coverage and partial metric data", () => {
    expect(aggregateTeamFiveOnFive([game], expected)).toEqual([]);
    expect(aggregateTeamFiveOnFive([game, { ...game, date: "2026-01-02", gf: null }], expected)).toEqual([]);
  });
  it("rejects cumulative rows masquerading as daily observations", () => {
    expect(aggregateTeamFiveOnFive([game, { ...game, date: "2026-01-02", gp: 2 }], expected)).toEqual([]);
  });
});
