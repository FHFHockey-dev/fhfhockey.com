import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { fromMock } = vi.hoisted(() => ({ fromMock: vi.fn() }));

// jsdom has no ResizeObserver; recharts' ResponsiveContainer needs one.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

vi.mock("lib/supabase", () => ({ default: { from: fromMock } }));

import {
  GameStateAnalysis,
  buildScoreStateCard,
  buildStrengthCard
} from "./GameStateAnalysis";

function query(rows: Record<string, unknown>[]) {
  const result = Promise.resolve({ data: rows, error: null });
  const q: any = {};
  for (const method of ["select", "eq", "gte", "lte", "gt", "or", "order", "limit"]) {
    q[method] = vi.fn(() => q);
  }
  q.then = (resolve: any, reject: any) => result.then(resolve, reject);
  return q;
}

// NST rows as written: counts plus `toi` in seconds, one date per row.
const strengthRow = (overrides: Record<string, unknown> = {}) => ({
  date: "2026-10-19",
  gp: 1,
  toi: 2700,
  cf: 45,
  ca: 55,
  xgf: 2,
  xga: 3,
  gf: 2,
  ga: 1,
  sf: 25,
  sa: 30,
  ...overrides
});

afterEach(() => {
  cleanup();
  fromMock.mockReset();
});

describe("GameStateAnalysis", () => {
  it("renders measured strength totals and honest score-state cards", async () => {
    const queries: Record<string, any> = {};
    fromMock.mockImplementation((table: string) => {
      const rows: Record<string, Record<string, unknown>[]> = {
        wgo_team_stats: [
          { games_played: 1, sat_pct_ahead: 0.4, usat_pct_ahead: 0.42, sat_pct_tied: 0.5 },
          { games_played: 1, sat_pct_ahead: null, usat_pct_ahead: null, sat_pct_tied: 0.6 }
        ],
        nst_team_5v5: [strengthRow(), strengthRow({ date: "2026-10-18", gf: 1, ga: 2 })],
        nst_team_pp: [strengthRow({ cf: 30, ca: 5, toi: 240 })],
        nst_team_pk: []
      };
      queries[table] = query(rows[table] ?? []);
      return queries[table];
    });

    render(<GameStateAnalysis teamId="4" teamAbbrev="PHI" seasonId="20262027" />);

    expect(await screen.findByRole("heading", { name: "5v5" })).toBeTruthy();
    // 5v5 season goals and TOI come from the NST count columns.
    expect(screen.getByText("3-3")).toBeTruthy();
    expect(screen.getByText("90:00")).toBeTruthy();
    expect(screen.getByText("85.7%")).toBeTruthy(); // PP CF%: 30 / 35
    // Score states are shot-attempt shares, labelled as such.
    expect(screen.getByText(/Average of per-game shares · 1 game ·/)).toBeTruthy();
    expect(screen.getAllByText("40.0%").length).toBe(3); // 5v5 xGF, PP xGF, leading SAT
    expect(screen.getByText("55.0%")).toBeTruthy(); // tied SAT average of 0.5 and 0.6
    expect(screen.getAllByText("FF%").length).toBeGreaterThan(0);
    // No fabricated neutral or zero values; blowouts are unavailable.
    expect(screen.queryByText("50.0%")).toBeNull();
    expect(screen.getByText(/Not available: no score-differential source/)).toBeTruthy();
    expect(screen.getAllByText("No games in sample").length).toBeGreaterThan(0);
    // Unsupported sub-views are hidden until they have data.
    expect(screen.queryByRole("button", { name: "Trends" })).toBeNull();
    expect(screen.queryByText(/Coming Soon/)).toBeNull();

    expect(queries.nst_team_5v5.gte).toHaveBeenCalledWith("date", "2026-09-01");
    expect(queries.nst_team_5v5.lte).toHaveBeenCalledWith("date", "2027-08-31");
  });
});

describe("situation cards", () => {
  it("keeps an incomplete strength sample unknown", () => {
    const card = buildStrengthCard("5v5", "5v5", [strengthRow(), strengthRow({ gp: null })]);
    expect(card.games).toBeNull();
    expect(card.attemptsPct).toBeNull();
    expect(card.goalsFor).toBeNull();
    expect(card.toiSeconds).toBeNull();
    expect(card.note).toBe("Incomplete game sample · Natural Stat Trick");
  });

  it("never labels shot-attempt shares as xGF", () => {
    const card = buildScoreStateCard(
      "leading",
      "Leading",
      [{ games_played: 1, sat_pct_ahead: 0.55, usat_pct_ahead: 0.53 }],
      "sat_pct_ahead",
      "usat_pct_ahead"
    );
    expect(card.secondLabel).toBe("FF%");
    expect(card.secondPct).toBeCloseTo(0.53);
    expect(card.pdo).toBeNull();
    expect(card.goalsFor).toBeNull();
  });

  it("keeps a strength with no rows unavailable rather than zero", () => {
    const card = buildStrengthCard("penalty_kill", "Penalty Kill", []);
    expect(card.attemptsPct).toBeNull();
    expect(card.goalsFor).toBeNull();
    expect(card.toiSeconds).toBeNull();
    expect(card.games).toBe(0);
  });
});
