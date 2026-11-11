import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { lineMock } = vi.hoisted(() => ({
  lineMock: vi.fn((_props: Record<string, any>) => null)
}));
vi.mock("react-chartjs-2", () => ({ Line: lineMock }));

import { indexNstRowsByDate, mergeNstGameRow } from "./nstGameLogMerge";
import {
  aggregateSummaryStat,
  rollingAverage,
  seasonIndexSeries
} from "./playerStatsContract";
import { PlayerStatsSummary } from "./PlayerStatsSummary";
import { PlayerStatsChart } from "./PlayerStatsChart";

// W3-P0-1: the player page joins WGO rows with NST rows by date
// (`pages/stats/player/[playerId].tsx` calls these two helpers), then the
// summary and chart read the merged log. Fixtures go through that merge.
type GameSpec = {
  date: string;
  team?: string;
  goals: number | null;
  toi: number | null;
  cf?: number;
  ca?: number;
  extraCounts?: Record<string, unknown>;
  extraOi?: Record<string, unknown>;
};

function pageLog(games: GameSpec[], omit: { countsFor?: string } = {}) {
  const wgo = games.map((g) => ({
    date: g.date,
    team_abbrev: g.team ?? "BOS",
    games_played: 1,
    goals: g.goals,
    toi_per_game: g.toi
  }));
  const counts = games
    .filter((g) => g.date !== omit.countsFor)
    .map((g) => ({ date_scraped: g.date, toi: g.toi, goals: g.goals, ...g.extraCounts }));
  const countsOi = games.map((g) => {
    const cf = g.cf ?? 10;
    const ca = g.ca ?? 10;
    return {
      date_scraped: g.date,
      toi: g.toi,
      cf,
      ca,
      cf_pct: cf + ca > 0 ? (cf / (cf + ca)) * 100 : null,
      ...g.extraOi
    };
  });
  const rates = games.map((g) => ({
    date_scraped: g.date,
    goals_per_60:
      g.goals === null || !g.toi ? null : (g.goals * 3600) / g.toi
  }));
  const byCounts = indexNstRowsByDate(counts);
  const byCountsOi = indexNstRowsByDate(countsOi);
  const byRates = indexNstRowsByDate(rates);
  return wgo.map((row) =>
    mergeNstGameRow(row, {
      counts: byCounts.get(row.date),
      countsOi: byCountsOi.get(row.date),
      rates: byRates.get(row.date)
    })
  );
}

const twoGames: GameSpec[] = [
  { date: "2026-10-10", goals: 1, toi: 600, cf: 10, ca: 0 },
  { date: "2026-10-12", goals: 0, toi: 1200, cf: 10, ca: 30 }
];

// One goal in a 600 s game, then five scoreless 1,200 s games.
const sixGames: GameSpec[] = Array.from({ length: 6 }, (_, i) => ({
  date: `2026-10-1${i}`,
  goals: i === 0 ? 1 : 0,
  toi: i === 0 ? 600 : 1200
}));

// Summary card: label, value, games-played note.
const summaryValue = (label: string) =>
  (screen.getByText(label).parentElement as HTMLElement).children[1].textContent;

afterEach(() => {
  cleanup();
  lineMock.mockClear();
});

describe("W3-P0-1 page merge carries source-matched NST primitives", () => {
  it("keeps NST TOI seconds and on-ice pairs, not the individual HDCF", () => {
    const [row] = pageLog([
      {
        date: "2026-10-10",
        goals: 1,
        toi: 600,
        extraCounts: { hdcf: 2 },
        extraOi: { hdcf: 5, hdca: 5, hdcf_pct: 50 }
      }
    ]);
    expect(row.nst_toi).toBe(600);
    expect(row.nst_oi_toi).toBe(600);
    expect(row.nst_goals).toBe(1);
    expect(row.nst_hdcf).toBe(2);
    expect(row.nst_oi_hdcf).toBe(5);
    expect(row.nst_oi_hdca).toBe(5);
    // HDCF% pools the on-ice pair (5 / 10), not individual HDCF (2 / 7).
    expect(aggregateSummaryStat([row], "hdcf_pct")).toBeCloseTo(50);
  });

  it("an ambiguous date (two NST rows) is missing, not resolved by order", () => {
    const map = indexNstRowsByDate([
      { date_scraped: "2026-10-10", goals: 1 },
      { date_scraped: "2026-10-10", goals: 0 }
    ]);
    expect(map.get("2026-10-10")).toBeNull();
  });

  it("a known zero zone-start count is a valid zero, not a missing share", () => {
    const [row] = pageLog([
      {
        date: "2026-10-10",
        goals: 0,
        toi: 600,
        extraOi: { off_zone_starts: 0, neu_zone_starts: 2, def_zone_starts: 3 }
      }
    ]);
    expect(row.def_zone_start_pct).toBeCloseTo(60);
    expect(row.neu_zone_start_pct).toBeCloseTo(40);
  });
});

describe("W3-P0-1 summary pools per-60 by TOI and shares by denominators", () => {
  it("two games: 2.0 G/60 (not 3.0) and 40% CF% (not 62.5%); TOI/GP stays a per-game mean", () => {
    const log = pageLog(twoGames);
    expect(aggregateSummaryStat(log, "goals_per_60")).toBeCloseTo(2);
    expect(aggregateSummaryStat(log, "cf_pct")).toBeCloseTo(40);
    // Mean TOI per game is 900 s; a TOI-weighted mean would be 1,000 s.
    expect(aggregateSummaryStat(log, "toi_per_game")).toBeCloseTo(900);

    render(
      <PlayerStatsSummary
        gameLog={log as any}
        selectedStats={["goals_per_60", "cf_pct", "toi_per_game"]}
        isGoalie={false}
      />
    );
    expect(summaryValue("G/60")).toBe("2.0");
    expect(summaryValue("CF%")).toBe("40.0%");
    expect(summaryValue("TOI")).toBe("15:00");
  });

  it("a traded player pools across teams by TOI, not by team or game rates", () => {
    const log = pageLog([
      { date: "2026-10-10", team: "BOS", goals: 1, toi: 600 },
      { date: "2026-10-12", team: "BOS", goals: 0, toi: 1200 },
      { date: "2026-11-02", team: "NYR", goals: 2, toi: 900 }
    ]);
    // 3 goals in 2,700 s = 4.0 (game mean 4.67; team-rate mean 5.0).
    expect(aggregateSummaryStat(log, "goals_per_60")).toBeCloseTo(4);
  });

  it("a game with no NST counts row makes the window rate unavailable", () => {
    const log = pageLog(twoGames, { countsFor: "2026-10-12" });
    expect(aggregateSummaryStat(log, "goals_per_60")).toBeNull();
    render(
      <PlayerStatsSummary
        gameLog={log as any}
        selectedStats={["goals_per_60"]}
        isGoalie={false}
      />
    );
    expect(summaryValue("G/60")).toBe("-");
  });

  it("zero opportunity is unavailable; a zero count with exposure is a real zero", () => {
    const noAttempts = pageLog(twoGames.map((g) => ({ ...g, cf: 0, ca: 0 })));
    expect(aggregateSummaryStat(noAttempts, "cf_pct")).toBeNull();
    const noTime = pageLog(twoGames.map((g) => ({ ...g, goals: 0, toi: 0 })));
    expect(aggregateSummaryStat(noTime, "goals_per_60")).toBeNull();
    const scoreless = pageLog(twoGames.map((g) => ({ ...g, goals: 0 })));
    expect(aggregateSummaryStat(scoreless, "goals_per_60")).toBe(0);
  });

  it("on-ice SH%, SV% and PDO pool their own counts", () => {
    const log = pageLog([
      { date: "2026-10-10", goals: 0, toi: 600, extraOi: { gf: 1, sf: 4, ga: 0, sa: 6 } },
      { date: "2026-10-12", goals: 0, toi: 1200, extraOi: { gf: 1, sf: 16, ga: 3, sa: 14 } }
    ]);
    // SH 2/20 = 10% (game mean 28.1%); SV 17/20 = 85% (game mean 89.3%).
    expect(aggregateSummaryStat(log, "on_ice_sh_pct")).toBeCloseTo(10);
    expect(aggregateSummaryStat(log, "on_ice_sv_pct")).toBeCloseTo(85);
    expect(aggregateSummaryStat(log, "pdo")).toBeCloseTo(0.95);
  });
});

describe("W3-P0-1 chart pools its rolling window and season index", () => {
  it("5-game rolling G/60 pools the window's TOI", () => {
    const rolling = rollingAverage(pageLog(sixGames), "goals_per_60");
    // Games 1-5: 1 goal in 5,400 s = 0.667 (mean of game rates: 1.2).
    expect(rolling[4]).toBeCloseTo(3600 / 5400);
  });

  it("season index at game 5 is pooled window ÷ pooled season (122.2, not 120)", () => {
    const log = pageLog(sixGames);
    const expected = (3600 / 5400 / (3600 / 6600)) * 100;
    expect(seasonIndexSeries(log, "goals_per_60")[4]).toBeCloseTo(expected);

    render(
      <PlayerStatsChart
        gameLog={log as any}
        seasonGameLog={log as any}
        selectedStats={["goals_per_60"]}
      />
    );
    lineMock.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Relative to season average" }));
    const [relative] = lineMock.mock.calls.map(([props]) => props as Record<string, any>);
    const g60 = relative.data.datasets.find((d: any) => d.label === "G/60");
    expect(g60.data[4]).toBeCloseTo(expected);
  });
});
