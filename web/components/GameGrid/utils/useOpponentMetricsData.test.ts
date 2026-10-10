import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TeamDataWithTotals } from "lib/NHL/types";
import useOpponentMetricsData, { computeOpponentMetrics, loadCurrentSeasonStats, OPPONENT_METRIC_COLUMNS, TeamStats } from "./useOpponentMetricsData";

const { source } = vi.hoisted(() => ({ source: { from: vi.fn(), read: vi.fn(), ranges: [] as number[][], filters: [] as unknown[][] } }));
vi.mock("lib/supabase/public-client", () => ({ default: { from: source.from } }));
let sourceRows: TeamStats[];
beforeEach(() => {
  sourceRows = [stats({ team_abbreviation: "B", gp: 2, xgf: 10 }), stats({ team_abbreviation: "C", xgf: 2 })];
  source.ranges = [];
  source.filters = [];
  source.read.mockReset().mockImplementation(async (from: number, to: number, season: number) => {
    const rows = sourceRows.filter((row) => row.season === season && row.situation === "all");
    return { data: rows.slice(from, to + 1), count: rows.length, error: null };
  });
  source.from.mockReset().mockImplementation(() => {
    let season = 0;
    const query = {
      select: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(),
      eq: vi.fn((field: string, value: unknown) => { source.filters.push([field, value]); if (field === "season") season = value as number; return query; }),
      range: vi.fn((from: number, to: number) => { source.ranges.push([from, to]); return source.read(from, to, season); })
    };
    return query;
  });
});
afterEach(cleanup);

const team = (opponents: string[]): TeamDataWithTotals => ({
  teamId: 1, teamAbbreviation: "A", avgOpponentPointPct: 0,
  weeks: [{ weekNumber: 1, opponents: opponents.map((abbreviation, i) => ({ abbreviation, teamId: i + 2 })), gamesPlayed: opponents.length, offNights: 0 }],
  totals: { opponents: [], gamesPlayed: opponents.length, offNights: 0 }
});
const stats = (overrides: Partial<TeamStats> = {}): TeamStats => ({
  team_abbreviation: "B", team_name: "B", gp: 2, sf: 8, sa: 10, gf: 6, ga: 2,
  xgf: 4, xga: 6, points: 3, season: 20262027, situation: "all", ...overrides
});

describe("current-season source identity and completeness", () => {
  it("reports the oldest database update without claiming provider observation freshness", async () => {
    sourceRows = [stats({ updated_at: "2026-10-10T01:31:00Z" }), stats({ team_abbreviation: "C", updated_at: "2026-10-10T01:30:08Z" })];
    const { result } = renderHook(() => useOpponentMetricsData([team(["B"])], 20262027));
    await waitFor(() => expect(result.current.statsLoading).toBe(false));
    expect(result.current.sourceLabel).toContain("Database snapshot updated 2026-10-10 01:30:08 UTC");
    expect(result.current.sourceLabel).toContain("Source observation freshness unknown");
    expect(source.from.mock.results[0].value.select.mock.calls[0][0]).toContain("updated_at");
  });
  it.each([null, "invalid"])("keeps freshness unknown when a team timestamp is %s", async (updated_at) => {
    sourceRows = [stats({ updated_at: "2026-10-10T01:30:08Z" }), stats({ team_abbreviation: "C", updated_at })];
    const { result } = renderHook(() => useOpponentMetricsData([team(["B"])], 20262027));
    await waitFor(() => expect(result.current.statsLoading).toBe(false));
    expect(result.current.sourceLabel).toContain("Snapshot freshness unknown");
    expect(result.current.sourceLabel).not.toContain("Database snapshot updated");
  });
  it("explains an empty current-season source without borrowing prior-season totals", async () => {
    sourceRows = [stats({ season: 20252026 })];
    const { result } = renderHook(() => useOpponentMetricsData([team(["B"])], 20262027));
    await waitFor(() => expect(result.current.statsLoading).toBe(false));
    expect(result.current.sourceLabel).toContain("No 2026–27 regular-season team totals are available");
    expect(result.current.entries[0].averages.avgXgf).toBeNull();
    expect(result.current.entries[0].coverage.avgXgf).toEqual({ known: 0, expected: 1 });
    expect(source.filters.filter(([field]) => field === "season")).toEqual([["season", 20262027]]);
  });
  it("reads cumulative season counts rather than the last daily game and re-averages new schedules locally", async () => {
    const initial = { teams: [team(["B"])], season: 20262027, refresh: 0 };
    const { result, rerender } = renderHook(({ teams, season, refresh }) => useOpponentMetricsData(teams, season, refresh), { initialProps: initial });
    await waitFor(() => expect(result.current.statsLoading).toBe(false));
    // Daily xGF 1 and 9 at GP 1 imply cumulative xGF 10 / GP 2 = 5, not 9.
    expect(result.current.entries[0].averages.avgXgf).toBe(5);
    expect(source.from).toHaveBeenCalledWith("nst_team_stats");
    expect(source.filters).toContainEqual(["season", 20262027]);
    expect(source.filters).toContainEqual(["situation", "all"]);
    expect(result.current.sourceLabel).toContain("Snapshot freshness unknown");
    rerender({ ...initial, teams: [team(["B"])] });
    expect(source.from).toHaveBeenCalledTimes(1);
    rerender({ ...initial, teams: [team(["B", "B", "C"])] });
    expect(result.current.entries[0].averages.avgXgf).toBeCloseTo(11 / 3);
    rerender({ ...initial, teams: [team(["C"])] });
    expect(result.current.entries[0].averages.avgXgf).toBe(1);
    expect(source.from).toHaveBeenCalledTimes(1);
  });
  it("returns all ordered rows beyond 1000 without a silent cap", async () => {
    sourceRows = Array.from({ length: 1005 }, (_, i) => stats({ team_abbreviation: `T${String(i).padStart(4, "0")}` }));
    expect(Object.keys(await loadCurrentSeasonStats(20262027))).toHaveLength(1005);
    expect(source.ranges).toEqual([[0, 499], [500, 999], [1000, 1499]]);
    expect(source.from.mock.results[0].value.order).toHaveBeenCalledWith("team_abbreviation", { ascending: true });
  });
  it("rejects truncated and ambiguous source results", async () => {
    source.read.mockResolvedValueOnce({ data: [stats()], count: 1005, error: null });
    await expect(loadCurrentSeasonStats(20262027)).rejects.toThrow("incomplete");
    sourceRows = [stats(), stats({ team_abbreviation: "b" })];
    await expect(loadCurrentSeasonStats(20262027)).rejects.toThrow("ambiguous");
  });
  it("refreshes explicitly, keeps stale values hidden and reports source errors", async () => {
    const { result, rerender } = renderHook(({ refresh }) => useOpponentMetricsData([team(["B"])], 20262027, refresh), { initialProps: { refresh: 0 } });
    await waitFor(() => expect(result.current.statsLoading).toBe(false));
    sourceRows = [stats({ xgf: 16 })];
    rerender({ refresh: 1 });
    expect(result.current.entries[0].averages.avgXgf).toBeNull();
    await waitFor(() => expect(result.current.entries[0].averages.avgXgf).toBe(8));
    source.read.mockRejectedValueOnce(new Error("synthetic unavailable"));
    rerender({ refresh: 2 });
    await waitFor(() => expect(result.current.statsError).toContain("unavailable"));
    expect(result.current.entries[0].averages.avgXgf).toBeNull();
  });
  it("ignores a late response for a previous season and disables empty schedules", async () => {
    let resolveOld!: (value: { data: TeamStats[]; count: number; error: null }) => void;
    source.read.mockImplementation(async (_from, _to, season) => season === 20262027
      ? new Promise((resolve) => { resolveOld = resolve; })
      : { data: [stats({ season, xgf: 8 })], count: 1, error: null });
    const { result, rerender } = renderHook(({ season, teams }) => useOpponentMetricsData(teams, season), { initialProps: { season: 20262027, teams: [team(["B"])] } });
    await waitFor(() => expect(resolveOld).toBeTypeOf("function"));
    rerender({ season: 20252026, teams: [team(["B"])] });
    await waitFor(() => expect(result.current.entries[0].averages.avgXgf).toBe(4));
    await act(async () => resolveOld({ data: [stats({ xgf: 100 })], count: 1, error: null }));
    expect(result.current.entries[0].averages.avgXgf).toBe(4);
    rerender({ season: 20252026, teams: [] });
    expect(result.current.entries).toEqual([]);
    expect(result.current.statsLoading).toBe(false);
  });
});

describe("opponent metric missingness and exposure", () => {
  it("preserves real zeros, per-opponent historical GP, repeated schedule weighting and PTS%", () => {
    const { averages, coverage } = computeOpponentMetrics(team(["B", "B", "C"]), {
      B: stats({ gp: 2, xgf: 4, gf: 0 }), C: stats({ gp: 10, xgf: 50, gf: 0 })
    });
    expect(averages.avgXgf).toBe(3);
    expect(averages.avgGoalFor).toBe(0);
    expect(averages.avgWinPct).toBeCloseTo((0.75 + 0.75 + 0.15) / 3);
    expect(coverage.avgXgf).toEqual({ known: 3, expected: 3 });
    expect(OPPONENT_METRIC_COLUMNS.at(-1)?.label).toBe("PTS%");
  });
  it("suppresses incomplete means with per-metric known/expected coverage", () => {
    const { averages, coverage } = computeOpponentMetrics(team(["B", "C"]), { B: stats() });
    expect(averages.avgXgf).toBeNull();
    expect(coverage.avgXgf).toEqual({ known: 1, expected: 2 });
    const partial = computeOpponentMetrics(team(["B"]), { B: stats({ xgf: null }) });
    expect(partial.averages.avgXgf).toBeNull();
    expect(partial.coverage.avgXgf).toEqual({ known: 0, expected: 1 });
    expect(partial.averages.avgXga).toBe(3);
  });
  it.each([0, -1, null, NaN, Infinity])("keeps invalid GP %s unavailable", (gp) => {
    const result = computeOpponentMetrics(team(["B"]), { B: stats({ gp }) });
    expect(Object.values(result.averages).every((value) => value === null)).toBe(true);
    expect(result.coverage.avgXgf.known).toBe(0);
  });
  it("keeps all missing, empty and nonfinite observations unavailable", () => {
    expect(computeOpponentMetrics(team(["B"]), {}).averages.avgXgf).toBeNull();
    expect(computeOpponentMetrics(team([]), {}).coverage.avgXgf).toEqual({ known: 0, expected: 0 });
    expect(computeOpponentMetrics(team(["B"]), { B: stats({ xgf: Infinity, sf: NaN }) }).averages.avgSf).toBeNull();
  });
});
