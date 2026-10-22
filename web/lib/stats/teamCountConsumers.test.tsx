import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";

const mocks = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("lib/supabase", () => ({ default: { from: mocks.from } }));
vi.mock("lib/fetchWithCache", () => ({ default: async () => ({ data: [], games: [] }) }));
vi.mock("hooks/useCurrentSeason", () => ({
  useCurrentSeasonQuery: () => ({
    data: {
      seasonId: 20262027,
      regularSeasonStartDate: "2026-10-01T00:00:00Z",
      regularSeasonEndDate: "2027-04-20T00:00:00Z",
      seasonEndDate: "2027-06-30T00:00:00Z"
    },
    isPending: false, isError: false, status: "success"
  })
}));
vi.mock("components/TeamDashboard/TeamLeaders", () => ({ TeamLeaders: () => null }));
vi.mock("components/TeamDashboard/GameByGameTimeline", () => ({ GameByGameTimeline: () => null }));
vi.mock("recharts", async (importOriginal) => ({
  ...await importOriginal<typeof import("recharts")>(),
  ResponsiveContainer: () => null
}));

import { AdvancedL10Metrics } from "components/TeamDashboard/AdvancedL10Metrics";
import { TeamDashboard } from "components/TeamDashboard/TeamDashboard";
import { GameStateAnalysis } from "components/GameStateAnalysis/GameStateAnalysis";

type Row = Record<string, string | number | null>;

// Execute the requested filters before ordering/limits/projection. In particular,
// SQL comparisons reject null; only an explicit is.null branch retains it.
function query(input: Row[]) {
  const predicates: ((row: Row) => boolean)[] = [];
  const order: { field: string; ascending: boolean }[] = [];
  let fields: string[] | null = null;
  let start = 0;
  let limit = Infinity;
  const result = () => {
    const rows = input.filter((row) => predicates.every((test) => test(row)));
    rows.sort((a, b) => {
      for (const { field, ascending } of order) {
        const left = a[field];
        const right = b[field];
        if (left === right) continue;
        const comparison = left == null ? 1 : right == null ? -1 : left < right ? -1 : 1;
        return ascending ? comparison : -comparison;
      }
      return 0;
    });
    return rows.slice(start, start + limit).map((row) => fields
      ? Object.fromEntries(fields.map((field) => [field, row[field] ?? null]))
      : row);
  };
  const q: any = {};
  q.select = (columns: string) => {
    fields = columns === "*" ? null : columns.split(",").map((field) => field.trim());
    return q;
  };
  q.eq = (field: string, value: string | number) => {
    predicates.push((row) => row[field] === value);
    return q;
  };
  for (const op of ["gte", "lte", "gt"]) {
    q[op] = (field: string, value: string | number) => {
      predicates.push((row) => {
        const actual = row[field];
        return actual != null && (op === "gt" ? actual > value : op === "gte" ? actual >= value : actual <= value);
      });
      return q;
    };
  }
  q.or = (expression: string) => {
    const branches = expression.split(",").map((branch) => {
      const match = /^(\w+)\.(neq|is)\.(0|null)$/.exec(branch);
      if (!match) throw new Error(`Unsupported test predicate: ${branch}`);
      const [, field, op, value] = match;
      if (op === "is" && value === "null") return (row: Row) => row[field] == null;
      if (op === "neq" && value === "0") return (row: Row) => row[field] != null && row[field] !== 0;
      throw new Error(`Unsupported test predicate: ${branch}`);
    });
    predicates.push((row) => branches.some((test) => test(row)));
    return q;
  };
  q.order = (field: string, { ascending }: { ascending: boolean }) => {
    order.push({ field, ascending });
    return q;
  };
  q.limit = (count: number) => { limit = count; return q; };
  q.range = (from: number, to: number) => { start = from; limit = to - from + 1; return q; };
  q.single = async () => {
    const rows = result();
    return { data: rows.length === 1 ? rows[0] : null, error: rows.length === 1 ? null : new Error("Expected one synthetic row") };
  };
  q.then = (resolve: any, reject: any) => Promise.resolve({ data: result(), error: null }).then(resolve, reject);
  return q;
}

const common = { team_id: 4, team_abbreviation: "PHI", season_id: 20262027, date: "2026-10-10" };
const wgo: Row = {
  ...common, games_played: 1, shots_for_per_game: 25, shots_against_per_game: 30,
  power_play_goals_for: 1, pp_opportunities: 5, pp_goals_against: 1, times_shorthanded: 4,
  sh_goals_for: 0, sh_goals_against: 0, faceoffs_won: 10, faceoffs_lost: 20
};
const nst: Row = {
  ...common, gp: 1, toi: 3000, cf: 10, ca: 20, xgf: 1, xga: 2, hdcf: 3, hdca: 4,
  scf: 5, sca: 6, gf: 1, ga: 2, sf: 10, sa: 20
};
let tables: Record<string, Row[]>;

beforeEach(() => {
  tables = {
    nhl_standings_details: [{ ...common, team_abbrev: "PHI", l10_wins: 1, l10_losses: 1, l10_ot_losses: 0 }],
    team_summary_years: [{ ...common, games_played: 2, goals_for: 3, goals_against: 2, wins: 1, points: 2 }],
    wgo_team_stats: [{ ...wgo }, { ...wgo, date: "2026-10-11" }],
    nst_team_5v5: [{ ...nst }, { ...nst, date: "2026-10-11" }],
    nst_team_pp: [{ ...nst }, { ...nst, date: "2026-10-11" }],
    nst_team_pk: [{ ...nst }, { ...nst, date: "2026-10-11" }]
  };
  mocks.from.mockImplementation((table: string) => query(tables[table] ?? []));
});
afterEach(() => { cleanup(); vi.resetAllMocks(); });

describe("count consumers retain source exposure", () => {
  it.each([
    ["wgo_team_stats", "games_played", "Power Play"],
    ["nst_team_5v5", "gp", "Corsi For %"]
  ])("keeps an existing null-exposure row in the %s L10 sample", async (table, field, label) => {
    tables[table][1][field] = null;
    render(<AdvancedL10Metrics teamId="4" teamAbbrev="PHI" seasonId="20262027" />);
    const value = await screen.findByText(label);
    expect(value.parentElement?.textContent).toContain("—");
    expect(screen.getAllByText(/Incomplete game sample/).length).toBeGreaterThan(0);
  });

  it("keeps unknown rows inside L10 without allowing known zero rows to displace them", async () => {
    for (const [table, field, row] of [
      ["wgo_team_stats", "games_played", wgo], ["nst_team_5v5", "gp", nst]
    ] as const) {
      tables[table] = [
        ...Array.from({ length: 10 }, (_, i) => ({ ...row, date: `2026-10-${10 + i}` })),
        { ...row, date: "2026-10-20", [field]: null },
        ...Array.from({ length: 12 }, (_, i) => ({ ...row, date: `2026-11-${String(i + 1).padStart(2, "0")}`, [field]: 0 }))
      ];
    }
    render(<AdvancedL10Metrics teamId="4" teamAbbrev="PHI" seasonId="20262027" />);
    await screen.findByText("Corsi For %");
    expect(screen.getByText("Power Play").parentElement?.textContent).toContain("—");
    expect(screen.getByText("Corsi For %").parentElement?.textContent).toContain("—");
    expect(screen.getAllByText(/Incomplete game sample/)).toHaveLength(3);
    expect(screen.queryByText("No games in sample")).toBeNull();
  });

  it("preserves L10 date/team/season bounds and excludes zero rows before the limit", async () => {
    for (const [table, field, row] of [
      ["wgo_team_stats", "games_played", wgo], ["nst_team_5v5", "gp", nst]
    ] as const) {
      tables[table] = [
        ...Array.from({ length: 10 }, (_, i) => ({ ...row, date: `2026-10-${10 + i}` })),
        { ...row, date: "2026-10-01", [field]: null }, // Outside the latest ten.
        { ...row, date: "2026-08-31", [field]: null },
        { ...row, date: "2027-09-01", [field]: null },
        { ...row, team_id: 22, team_abbreviation: "EDM", date: "2026-10-22", [field]: null },
        ...Array.from({ length: 12 }, (_, i) => ({ ...row, date: `2026-11-${String(i + 1).padStart(2, "0")}`, [field]: 0 }))
      ];
    }
    tables.wgo_team_stats.push({ ...wgo, season_id: 20252026, date: "2026-10-23", games_played: null });
    render(<AdvancedL10Metrics teamId="4" teamAbbrev="PHI" seasonId="20262027" />);
    await screen.findByText("Corsi For %");
    expect(screen.getByText("Power Play").parentElement?.textContent).toContain("20.0%");
    expect(screen.getByText("Corsi For %").parentElement?.textContent).toContain("33.3%");
    expect(screen.getAllByText(/Last 10 games through 2026-10-19/)).toHaveLength(3);
    expect(screen.queryByText(/Incomplete game sample/)).toBeNull();
  });

  it.each([
    ["nst_team_5v5", "5v5"], ["nst_team_pp", "Power Play"], ["nst_team_pk", "Penalty Kill"]
  ])("retains null exposure in %s strength totals", async (table, title) => {
    tables[table][1].gp = null;
    render(<GameStateAnalysis teamId="4" teamAbbrev="PHI" seasonId="20262027" />);
    const heading = await screen.findByRole("heading", { name: title });
    const card = within(heading.parentElement!.parentElement!);
    expect(card.getByText("CF%").parentElement?.textContent).toContain("—");
    expect(card.getByText("Incomplete game sample · Natural Stat Trick")).toBeTruthy();
  });

  it("retains null exposure in season WGO totals", async () => {
    tables.wgo_team_stats[1].games_played = null;
    render(<TeamDashboard teamId="4" teamAbbrev="PHI" seasonId="20262027" />);
    const label = await screen.findByText("Power Play %");
    expect(label.parentElement?.textContent).toContain("N/A");
    expect(screen.getByText("PP Goals For").parentElement?.textContent).toContain("—");
  });

  it.each(["current", "peer"])("retains null exposure from the %s team in both ranking sources", async (missing) => {
    if (missing === "current") {
      tables.nst_team_5v5[1].gp = null;
      tables.wgo_team_stats[1].games_played = null;
    } else {
      tables.nst_team_5v5.push({ ...nst, team_abbreviation: "EDM", team_id: 22, gp: null });
      tables.wgo_team_stats.push({ ...wgo, team_abbreviation: "EDM", team_id: 22, games_played: null });
    }
    render(<TeamDashboard teamId="4" teamAbbrev="PHI" seasonId="20262027" />);
    const rank = await screen.findByText("CF%");
    expect(rank.parentElement?.textContent).toContain("#—");
    expect(screen.getByText("PP Goals For").parentElement?.textContent).toContain("#—");
    if (missing === "current") expect(screen.getByTitle(/incomplete game sample/)).toBeTruthy();
  });
});
