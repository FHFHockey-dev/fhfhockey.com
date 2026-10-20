import { describe, expect, it } from "vitest";
import {
  aggregateSummaryStat,
  formatMinutes,
  groupStatsByUnit,
  rollingAverage,
  toChartValue,
  computeAvailability,
  countAppearances,
  formatPlayerStat,
  leagueDateKey,
  parseLocalDate,
  scopeLogToSeason,
  seasonDateWindow,
  seasonIdForDate,
  sortGameLogAscending,
  splitTeamSchedule,
  windowGameLog
} from "./playerStatsContract";

const teamGame = (date: string, extra: Record<string, unknown> = {}) => ({
  date,
  gameId: Number(date.replace(/-/g, "")),
  homeTeamId: 1,
  awayTeamId: 2,
  isPlayoff: false,
  seasonId: 20262027,
  ...extra
});

describe("league dates", () => {
  it("uses the league-local (Eastern) calendar date, not UTC", () => {
    // 02:00 UTC on Oct 21 is still Oct 20 in New York.
    expect(leagueDateKey(new Date("2026-10-21T02:00:00Z"))).toBe("2026-10-20");
  });

  it("parses YYYY-MM-DD as a local calendar day", () => {
    const d = parseLocalDate("2026-10-01");
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 9, 1]);
  });

  it("assigns September openers and June playoffs to the right season", () => {
    expect(seasonIdForDate("2026-09-30")).toBe(20262027);
    expect(seasonIdForDate("2026-10-01")).toBe(20262027);
    expect(seasonIdForDate("2027-06-20")).toBe(20262027);
  });
});

describe("season date window", () => {
  it("uses the seasons row dates when available", () => {
    expect(
      seasonDateWindow(20242025, { startDate: "2024-10-04T00:00:00", endDate: "2025-06-17" })
    ).toEqual({ start: "2024-10-04", end: "2025-06-17" });
  });

  it("falls back to Sep 1 .. Aug 31 when the seasons row is missing", () => {
    expect(seasonDateWindow(20242025, null)).toEqual({ start: "2024-09-01", end: "2025-08-31" });
    expect(seasonDateWindow("20242025")).toEqual({ start: "2024-09-01", end: "2025-08-31" });
  });

  it("has no window for an invalid season id", () => {
    expect(seasonDateWindow(null)).toBeNull();
    expect(seasonDateWindow(2024)).toBeNull();
  });
});

describe("season scope", () => {
  const log = [
    { date: "2026-09-30", games_played: 1 },
    { date: "2026-10-01", games_played: 1 },
    { date: "2026-10-18", games_played: 1 }
  ];

  it("keeps every row of the server-scoped season", () => {
    expect(scopeLogToSeason(log, 20262027, 20262027)).toHaveLength(3);
  });

  it("filters by date only for a season other than the page season", () => {
    expect(scopeLogToSeason(log, 20252026, 20262027)).toHaveLength(0);
  });
});

describe("game-log order and windows", () => {
  const desc = Array.from({ length: 12 }, (_, i) => ({
    date: `2026-10-${String(12 - i).padStart(2, "0")}`,
    games_played: 1
  }));

  it("sorts newest-first provider rows into ascending order", () => {
    expect(sortGameLogAscending(desc).map((g) => g.date)[0]).toBe("2026-10-01");
  });

  it("Last 10 means the latest ten games", () => {
    const window = windowGameLog(sortGameLogAscending(desc), "last10");
    expect(window).toHaveLength(10);
    expect(window[0].date).toBe("2026-10-03");
    expect(window[9].date).toBe("2026-10-12");
  });

  it("counts appearances only for rows with games_played > 0", () => {
    expect(
      countAppearances([
        { date: "a", games_played: 1 },
        { date: "b", games_played: 0 },
        { date: "c", games_played: null }
      ])
    ).toBe(1);
  });
});

describe("played / missed / future denominators", () => {
  const asOfDate = "2026-10-20";

  it("never counts future or same-day scheduled games as absences", () => {
    const schedule = [
      teamGame("2026-10-10"),
      teamGame("2026-10-20"),
      teamGame("2026-10-22", { isFuture: true }),
      teamGame("2026-10-25")
    ];
    const { absences, upcoming } = splitTeamSchedule(schedule, asOfDate);
    expect(absences.map((g) => g.date)).toEqual(["2026-10-10"]);
    expect(upcoming.map((g) => g.date)).toEqual([
      "2026-10-20",
      "2026-10-22",
      "2026-10-25"
    ]);
  });

  it("a past game without a loaded box score is awaiting data, not an absence", () => {
    const schedule = [
      teamGame("2026-10-10"),
      teamGame("2026-10-15", { isUnconfirmed: true })
    ];
    const split = splitTeamSchedule(schedule, asOfDate);
    expect(split.absences.map((g) => g.date)).toEqual(["2026-10-10"]);
    expect(split.unconfirmed.map((g) => g.date)).toEqual(["2026-10-15"]);
    expect(
      computeAvailability([{ date: "2026-10-12", games_played: 1 }], schedule, asOfDate)
    ).toEqual({ played: 1, missed: 1, possible: 2, percentage: 50, unconfirmed: 1 });
  });

  it("limits absences to the selected game window", () => {
    const schedule = [teamGame("2026-10-02"), teamGame("2026-10-15")];
    const { absences } = splitTeamSchedule(schedule, asOfDate, "2026-10-10");
    expect(absences.map((g) => g.date)).toEqual(["2026-10-15"]);
  });

  it("early season: 10 played with 74 future games is 10 of 10", () => {
    const log = Array.from({ length: 10 }, (_, i) => ({
      date: `2026-10-${String(i + 1).padStart(2, "0")}`,
      games_played: 1
    }));
    const future = Array.from({ length: 74 }, (_, i) =>
      teamGame(`2026-11-${String((i % 28) + 1).padStart(2, "0")}`, {
        isFuture: true
      })
    );
    expect(computeAvailability(log, future, asOfDate)).toEqual({
      played: 10,
      missed: 0,
      possible: 10,
      percentage: 100,
      unconfirmed: 0
    });
  });

  it("counts elapsed regular-season absences only", () => {
    const log = [{ date: "2026-10-05", games_played: 1 }];
    const schedule = [
      teamGame("2026-10-03"),
      teamGame("2026-10-04", { isPlayoff: true })
    ];
    expect(computeAvailability(log, schedule, asOfDate)).toMatchObject({
      played: 1,
      missed: 1,
      possible: 2,
      percentage: 50
    });
  });

  it("reports unavailable rather than 100% when the schedule is unknown", () => {
    expect(
      computeAvailability([{ date: "2026-10-05", games_played: 1 }], null, asOfDate)
    ).toEqual({ played: 1, missed: null, possible: null, percentage: null, unconfirmed: null });
  });

  it("no games and no absences has no percentage", () => {
    expect(computeAvailability([], [], asOfDate).percentage).toBeNull();
  });
});

describe("summary aggregation", () => {
  it("SH% is summed goals over summed shots, as a fraction", () => {
    const log = [
      { date: "1", games_played: 1, goals: 1, shots: 3, shooting_percentage: 0.333 },
      { date: "2", games_played: 1, goals: 0, shots: 4, shooting_percentage: 0 },
      { date: "3", games_played: 1, goals: 1, shots: 4, shooting_percentage: 0.25 }
    ];
    expect(aggregateSummaryStat(log, "shooting_percentage")).toBeCloseTo(2 / 11);
  });

  it("zero shots makes SH% unavailable, not 0", () => {
    const log = [{ date: "1", games_played: 1, goals: 0, shots: 0, shooting_percentage: null }];
    expect(aggregateSummaryStat(log, "shooting_percentage")).toBeNull();
  });

  it("SV% is summed saves over summed shots against", () => {
    const log = [
      { date: "1", games_played: 1, saves: 27, shots_against: 30, save_pct: 0.9 },
      { date: "2", games_played: 1, saves: 10, shots_against: 10, save_pct: 1 }
    ];
    expect(aggregateSummaryStat(log, "save_pct")).toBeCloseTo(37 / 40);
  });

  it("partial data: null rows are skipped, never treated as zero", () => {
    const log = [
      { date: "1", games_played: 1, cf_pct: 60, goals_per_60: 0, hits: null },
      { date: "2", games_played: 1, cf_pct: null, goals_per_60: 2, hits: null }
    ];
    expect(aggregateSummaryStat(log, "cf_pct")).toBe(60);
    expect(aggregateSummaryStat(log, "goals_per_60")).toBe(1);
    expect(aggregateSummaryStat(log, "hits")).toBeNull();
  });
});

describe("unit-aware formatting", () => {
  it("WGO fractions display as percentage points", () => {
    expect(formatPlayerStat(1 / 3, "shooting_percentage")).toBe("33.3%");
    expect(formatPlayerStat(0.5, "fow_percentage")).toBe("50.0%");
  });

  it("NST percentage points are not rescaled", () => {
    expect(formatPlayerStat(52.4, "cf_pct")).toBe("52.4%");
  });

  it("whole counts are integers; averages keep two decimals", () => {
    expect(formatPlayerStat(1, "goals")).toBe("1");
    expect(formatPlayerStat(0, "points")).toBe("0");
    expect(formatPlayerStat(0.3, "points")).toBe("0.30");
  });

  it("unavailable stays unavailable", () => {
    expect(formatPlayerStat(null, "shooting_percentage")).toBe("-");
  });
});

describe("chart units", () => {
  it("splits selected stats into counts, rates, percentages and TOI", () => {
    expect(
      groupStatsByUnit([
        "points",
        "fow_percentage",
        "toi_per_game",
        "cf_pct",
        "ixg_per_60",
        "goals"
      ])
    ).toEqual([
      { unit: "count", stats: ["points", "goals"] },
      { unit: "rate", stats: ["ixg_per_60"] },
      { unit: "percent", stats: ["fow_percentage", "cf_pct"] },
      { unit: "toi", stats: ["toi_per_game"] }
    ]);
  });

  it("goalie SV% is a percentage; GAA and PDO are rates", () => {
    expect(groupStatsByUnit(["save_pct", "goals_against_avg", "pdo"])).toEqual([
      { unit: "rate", stats: ["goals_against_avg", "pdo"] },
      { unit: "percent", stats: ["save_pct"] }
    ]);
  });

  it("plots percentages on a 0-100 scale and TOI in minutes", () => {
    expect(toChartValue(0.25, "shooting_percentage")).toBeCloseTo(25);
    expect(toChartValue(52.4, "cf_pct")).toBe(52.4);
    expect(toChartValue(0.915, "save_pct")).toBeCloseTo(91.5);
    expect(toChartValue(1095, "toi_per_game")).toBeCloseTo(18.25);
    expect(toChartValue(2, "points")).toBe(2);
    expect(toChartValue(null, "points")).toBeNull();
  });

  it("formats minutes as mm:ss", () => {
    expect(formatMinutes(18.25)).toBe("18:15");
    expect(formatMinutes(9.999)).toBe("10:00");
  });
});

describe("rolling average", () => {
  it("averages the trailing window over present values; all-missing is a gap", () => {
    const log = [
      { date: "1", points: 1 },
      { date: "2", points: null },
      { date: "3", points: 3 },
      { date: "4", points: null },
      { date: "5", points: null },
      { date: "6", points: null },
      { date: "7", points: null },
      { date: "8", points: null }
    ];
    expect(rollingAverage(log, "points", 5)).toEqual([1, 1, 2, 2, 2, 3, 3, null]);
  });
});
