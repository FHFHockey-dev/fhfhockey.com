import { describe, expect, it } from "vitest";

import {
  TEAM_DRIVER_MIN_LEAGUE_SAMPLE,
  buildTeamPerformanceDrivers,
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

  it("falls back to the freshest complete special-teams row and formats ratios", () => {
    const ratioRows = specialTeamsRows.map((row) => ({
      ...row,
      power_play_pct: row.power_play_pct / 100,
      penalty_kill_pct: row.penalty_kill_pct / 100,
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
