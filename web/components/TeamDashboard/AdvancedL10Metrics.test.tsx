import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { fromMock } = vi.hoisted(() => ({ fromMock: vi.fn() }));

vi.mock("lib/supabase", () => ({ default: { from: fromMock } }));

import { aggregateWgoTeamGames } from "lib/stats/percentUnits";
import { AdvancedL10Metrics } from "./AdvancedL10Metrics";

type Rows = Record<string, unknown>[];

function query(rows: Rows) {
  const result = Promise.resolve({ data: rows, error: null });
  const q: any = {};
  for (const method of ["select", "eq", "gte", "lte", "gt", "or", "order", "limit"]) {
    q[method] = vi.fn(() => q);
  }
  q.then = (resolve: any, reject: any) => result.then(resolve, reject);
  return q;
}

function install(tables: Record<string, Rows>) {
  const queries: Record<string, any> = {};
  fromMock.mockImplementation((table: string) => {
    queries[table] = query(tables[table] ?? []);
    return queries[table];
  });
  return queries;
}

const standings = {
  l10_wins: 2,
  l10_losses: 5,
  l10_ot_losses: 3,
  l10_goals_for: 20,
  l10_goals_against: 31,
  l10_goal_differential: -11,
  home_wins: 1,
  home_losses: 2,
  home_ot_losses: 2,
  road_wins: 1,
  road_losses: 3,
  road_ot_losses: 1
};

// Ten 5v5 game rows: 412 attempts for of 1000 (41.2%), as NST stores counts.
const nstRows = Array.from({ length: 10 }, (_, index) => ({
  date: `2026-10-${String(19 - index).padStart(2, "0")}`,
  gp: 1,
  cf: index < 6 ? 42 : 40,
  ca: index < 6 ? 58 : 60,
  xgf: 2,
  xga: 3,
  hdcf: 8,
  hdca: 12,
  gf: 2,
  ga: 3,
  sf: 25,
  sa: 30
}));

const wgoRows = Array.from({ length: 10 }, (_, index) => ({
  date: `2026-10-${String(19 - index).padStart(2, "0")}`,
  games_played: 1,
  shots_for_per_game: 25,
  shots_against_per_game: 30,
  power_play_goals_for: index < 2 ? 1 : 0,
  pp_opportunities: 3,
  pp_goals_against: index < 6 ? 1 : 0,
  times_shorthanded: 4,
  faceoffs_won: 27,
  faceoffs_lost: 33
}));

afterEach(() => {
  cleanup();
  fromMock.mockReset();
});

describe("AdvancedL10Metrics", () => {
  it("shows incomplete game exposure separately from zero games", async () => {
    install({
      nhl_standings_details: [standings],
      wgo_team_stats: [wgoRows[0], { ...wgoRows[1], games_played: null }],
      nst_team_5v5: [nstRows[0], { ...nstRows[1], gp: null }]
    });
    render(<AdvancedL10Metrics teamId="4" teamAbbrev="PHI" seasonId="20262027" />);
    await waitFor(() => expect(screen.getByText("Corsi For %")).toBeTruthy());
    expect(screen.getAllByText(/Incomplete game sample/)).toHaveLength(3);
    expect(screen.queryByText("No games in sample")).toBeNull();
    expect(screen.getAllByText("—").length).toBeGreaterThan(5);
    expect(screen.queryByText("0.0%")).toBeNull();
  });

  it("does not render precise rates from asymmetric missing counts", async () => {
    install({
      nhl_standings_details: [standings],
      wgo_team_stats: [wgoRows[0], { ...wgoRows[1], power_play_goals_for: null, shots_for_per_game: null }],
      nst_team_5v5: [nstRows[0], { ...nstRows[1], ca: null }]
    });
    render(<AdvancedL10Metrics teamId="4" teamAbbrev="PHI" seasonId="20262027" />);
    await waitFor(() => expect(screen.getByText("Corsi For %")).toBeTruthy());
    for (const label of ["Corsi For %", "Power Play", "Shots For/GP"]) {
      expect(screen.getByText(label).parentElement?.textContent).toContain("—");
    }
  });

  it("shows L10 shares from summed counts with fraction thresholds", async () => {
    const queries = install({
      nhl_standings_details: [standings],
      wgo_team_stats: wgoRows,
      nst_team_5v5: nstRows
    });

    render(
      <AdvancedL10Metrics
        teamId="4"
        teamAbbrev="PHI"
        seasonId="20262027"
        regularSeasonStartDate="2026-10-07T00:00:00"
        regularSeasonEndDate="2027-04-15T00:00:00"
      />
    );

    const corsi = await screen.findByText("41.2%");
    expect(screen.queryByText(/4120|4158/)).toBeNull();
    expect(corsi.className).toContain("poor");
    expect(screen.getByText("40.0%")).toBeTruthy(); // xG For: 20 / 50
    expect(screen.getByText("6.7%")).toBeTruthy(); // PP: 2 / 30
    expect(screen.getByText("85.0%")).toBeTruthy(); // PK: 1 - 6 / 40
    expect(screen.getByText("45.0%")).toBeTruthy(); // FO: 270 / 600
    expect(screen.getByText("0.980")).toBeTruthy(); // PDO: 20/250 + 1 - 30/300
    expect(screen.getAllByText(/Last 10 games through 2026-10-19/)).toHaveLength(3);

    const nst = queries.nst_team_5v5;
    expect(nst.gte).toHaveBeenCalledWith("date", "2026-10-07");
    expect(nst.lte).toHaveBeenCalledWith("date", "2027-04-15");
    expect(nst.or).toHaveBeenCalledWith("gp.neq.0,gp.is.null");
    expect(nst.limit).toHaveBeenCalledWith(10);
    expect(queries.wgo_team_stats.gte).toHaveBeenCalledWith("date", "2026-10-07");
  });

  it("shows unavailable values instead of zeros when counts are missing", async () => {
    install({
      nhl_standings_details: [standings],
      wgo_team_stats: [],
      nst_team_5v5: [{ date: "2026-10-19", gp: 1, cf: null, ca: null }]
    });

    render(<AdvancedL10Metrics teamId="4" teamAbbrev="PHI" seasonId="20262027" />);

    await waitFor(() => expect(screen.getByText("Corsi For %")).toBeTruthy());
    expect(screen.queryByText("0.0%")).toBeNull();
    expect(screen.getAllByText("—").length).toBeGreaterThan(5);
    expect(screen.getAllByText("No games in sample")).toHaveLength(2);
    expect(screen.getByText(/Last 1 game through 2026-10-19/)).toBeTruthy();
  });
});

describe("aggregateWgoTeamGames", () => {
  it("weights per-game fields by games and keeps PP/PK as ratios of counts", () => {
    const totals = aggregateWgoTeamGames([
      { ...wgoRows[0], power_play_goals_for: 2, pp_opportunities: 2 },
      { ...wgoRows[1], power_play_goals_for: 0, pp_opportunities: 6 }
    ]);
    // Mean of game PP% would be 50%; the ratio of sums is 2 / 8.
    expect(totals.powerPlayPct).toBeCloseTo(0.25);
    expect(totals.games).toBe(2);
    expect(totals.shotDifferential).toBeCloseTo(-5);
  });
});
