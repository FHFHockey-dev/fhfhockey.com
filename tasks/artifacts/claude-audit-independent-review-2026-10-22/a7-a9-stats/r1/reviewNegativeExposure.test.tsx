import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";

const mocks = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("lib/supabase", () => ({ default: { from: mocks.from } }));
import { AdvancedL10Metrics } from "components/TeamDashboard/AdvancedL10Metrics";

// This mock executes the production predicates, including SQL-like null handling
// for gt, instead of returning rows the actual query would have discarded.
function query(input: any[]) {
  let rows = [...input];
  const q: any = { select: () => q };
  q.eq = (field: string, value: unknown) => { rows = rows.filter(r => r[field] === value); return q; };
  for (const op of ["gte", "lte", "gt"]) {
    q[op] = (field: string, value: any) => {
      rows = rows.filter(r => r[field] != null && (op === "gt" ? r[field] > value : op === "gte" ? r[field] >= value : r[field] <= value));
      return q;
    };
  }
  q.order = (field: string, { ascending }: { ascending: boolean }) => {
    rows.sort((a, b) => (a[field] < b[field] ? -1 : a[field] > b[field] ? 1 : 0) * (ascending ? 1 : -1));
    return q;
  };
  q.or = (expression: string) => {
    const branches = expression.split(",").map((branch) => {
      const match = /^(\w+)\.(neq|is)\.(0|null)$/.exec(branch);
      if (!match) throw new Error(`Unsupported predicate: ${branch}`);
      const [, field, op, value] = match;
      if (op === "is" && value === "null") return (row: any) => row[field] == null;
      if (op === "neq" && value === "0") return (row: any) => row[field] != null && row[field] !== 0;
      throw new Error(`Unsupported predicate: ${branch}`);
    });
    rows = rows.filter(row => branches.some(test => test(row)));
    return q;
  };
  q.limit = (count: number) => { rows = rows.slice(0, count); return q; };
  q.then = (resolve: any, reject: any) => Promise.resolve({ data: rows, error: null }).then(resolve, reject);
  return q;
}

afterEach(() => { cleanup(); vi.resetAllMocks(); });

it.each([
  ["wgo_team_stats", "games_played", "Power Play"],
  ["nst_team_5v5", "gp", "Corsi For %"]
])("retains invalid negative exposure in the %s consumer sample", async (table, field, label) => {
  const common = { team_id: 4, team_abbreviation: "PHI", season_id: 20262027, date: "2026-10-10" };
  const wgo = { ...common, games_played: 1, shots_for_per_game: 25, shots_against_per_game: 30, power_play_goals_for: 1, pp_opportunities: 5, pp_goals_against: 1, times_shorthanded: 4, faceoffs_won: 10, faceoffs_lost: 20 };
  const nst = { ...common, gp: 1, cf: 10, ca: 20, xgf: 1, xga: 2, hdcf: 3, hdca: 4, gf: 1, ga: 2, sf: 10, sa: 20 };
  const tables: Record<string, any[]> = {
    nhl_standings_details: [{ ...common, team_abbrev: "PHI", l10_wins: 1, l10_losses: 1, l10_ot_losses: 0 }],
    wgo_team_stats: [wgo, { ...wgo, date: "2026-10-11" }],
    nst_team_5v5: [nst, { ...nst, date: "2026-10-11" }]
  };
  tables[table][1][field] = -1;
  mocks.from.mockImplementation((name: string) => query(tables[name] ?? []));
  render(<AdvancedL10Metrics teamId="4" teamAbbrev="PHI" seasonId="20262027" />);
  await waitFor(() => expect(screen.getByText("Corsi For %")).toBeTruthy());
  const observed = screen.getByText(label).parentElement?.textContent;
  console.log("FILTER_AWARE_EXPOSURE_OBSERVED", JSON.stringify({ table, field, observed, incompleteNote: screen.queryAllByText(/Incomplete game sample/).length > 0 }));
  expect(observed).toContain("—");
  expect(screen.getAllByText(/Incomplete game sample/).length).toBeGreaterThan(0);
});
