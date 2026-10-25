import { describe, expect, it, vi } from "vitest";

import { loadSustainabilityHealth } from "./health";

const windows = ["l3", "l5", "l10", "l20"];
const distributionRows = () => windows.map(window_code => ({
  window_code, season_id: 20252026, config_revision: 7,
  model_version: "fixture-v1", config_hash: "fixture-config", population_count: 250,
}));

function createClient(args: {
  failingTable?: string;
  aggregateCount?: number | null;
  scoreDate?: string | null;
  counts?: Record<string, number | null>;
  missingQuintiles?: number | null;
  distributions?: ReturnType<typeof distributionRows>;
  distributionCount?: number | null;
  returnedLimit?: number;
  failDiagnostic?: "window" | "quintiles" | "distributions";
} = {}) {
  const queries: Array<{ table: string; fields: string; filters: Record<string, unknown>; options?: { head?: boolean; count?: string }; limit?: number; orders: string[] }> = [];
  const from = vi.fn((table: string) => {
    const state = { table, fields: "", filters: {} as Record<string, unknown>, options: undefined as { head?: boolean; count?: string } | undefined, limit: undefined as number | undefined, orders: [] as string[] };
    queries.push(state);
    const resolveQuery = () => {
      const diagnostic = state.filters.snapshot_date != null;
      const quintiles = "sustainability_quintile" in state.filters;
      const distributions = table === "sustainability_distribution_snapshots";
      if (table === args.failingTable || (diagnostic && (
        (args.failDiagnostic === "window" && !quintiles && !distributions) ||
        (args.failDiagnostic === "quintiles" && quintiles) ||
        (args.failDiagnostic === "distributions" && distributions)
      ))) return { data: null, count: null, error: new Error(`${table} count failed`) };
      if (distributions) {
        const rows = args.distributions ?? distributionRows();
        return { data: rows.slice(0, Math.min(state.limit ?? rows.length, args.returnedLimit ?? rows.length)), count: "distributionCount" in args ? args.distributionCount : rows.length, error: null };
      }
      const count = !diagnostic ? ("aggregateCount" in args ? args.aggregateCount : table === "sustainability_projections" ? 0 : 12)
        : quintiles ? ("missingQuintiles" in args ? args.missingQuintiles : 0)
        : args.counts && String(state.filters.window_code) in args.counts ? args.counts[String(state.filters.window_code)] : 250;
      return { data: null, count, error: null };
    };
    const query = {
      select(fields: string, options?: { head?: boolean; count?: string }) { state.fields = fields; state.options = options; return query; },
      eq(key: string, value: unknown) { state.filters[key] = value; return query; },
      in(key: string, value: unknown) { state.filters[key] = value; return query; },
      is(key: string, value: unknown) { state.filters[key] = value; return query; },
      order(key: string) { state.orders.push(key); return query; },
      limit(value: number) { state.limit = value; return query; },
      maybeSingle() {
        const date = table === "sustainability_projections" ? null
          : table === "sustainability_scores" && "scoreDate" in args ? args.scoreDate : "2026-07-22";
        return Promise.resolve({ data: date == null ? null : { snapshot_date: date }, error: null });
      },
      then(resolve: (value: ReturnType<typeof resolveQuery>) => unknown, reject?: (reason: unknown) => unknown) { return Promise.resolve(resolveQuery()).then(resolve, reject); },
    };
    return query;
  });
  return { from, queries };
}

describe("loadSustainabilityHealth", () => {
  it("returns exact counts and latest snapshot dates for canonical output tables", async () => {
    const client = createClient();

    await expect(
      loadSustainabilityHealth(client as any, "2026-07-22T18:00:00.000Z"),
    ).resolves.toMatchObject({
      generatedAt: "2026-07-22T18:00:00.000Z",
      tables: {
        sustainability_scores: {
          latestSnapshotDate: "2026-07-22",
          rowCount: 12,
        },
        sustainability_trend_bands: {
          latestSnapshotDate: "2026-07-22",
          rowCount: 12,
        },
        sustainability_projections: {
          latestSnapshotDate: null,
          rowCount: 0,
        },
      },
    });

    expect(client.from.mock.calls.map(([table]) => table)).toEqual([
      "sustainability_scores",
      "sustainability_scores",
      "sustainability_trend_bands",
      "sustainability_trend_bands",
      "sustainability_projections",
      "sustainability_projections",
      ...Array(5).fill("sustainability_scores"),
      "sustainability_distribution_snapshots",
    ]);
  });

  it("fails closed when an exact count cannot be loaded", async () => {
    const client = createClient({ failingTable: "sustainability_trend_bands" });

    await expect(loadSustainabilityHealth(client as any)).rejects.toThrow(
      "sustainability_trend_bands count failed",
    );
  });

  it("makes no additional queries without a latest observed score date", async () => {
    const client = createClient({ scoreDate: null });
    const report = await loadSustainabilityHealth(client as any);
    expect(client.from).toHaveBeenCalledTimes(6);
    expect(report.snapshotDiagnostics).toMatchObject({ snapshotDate: null, coverage: "unverified", expectedPopulation: null, scoreRowsByWindow: null, missingQuintileRows: null, issues: ["no_score_snapshot"] });
  });

  it("rejects an unavailable aggregate count instead of reporting zero rows", async () => {
    await expect(loadSustainabilityHealth(createClient({ aggregateCount: null }) as any))
      .rejects.toThrow("exact count is unavailable");
  });

  it("keeps equal250-row windows and matching producer populations unverified within fixed query bounds", async () => {
    const client = createClient();
    const { snapshotDiagnostics: diagnostic } = await loadSustainabilityHealth(client as any);
    expect(diagnostic).toMatchObject({ expectedPopulation: null, coverage: "unverified", scoreRowsByWindow: { l3: 250, l5: 250, l10: 250, l20: 250 }, missingQuintileRows: 0, distributions: { rowCount: 4, truncated: false, missingWindows: [] }, issues: [] });
    expect(diagnostic.coverageReason).toContain("matching counts do not verify membership");
    expect(client.from).toHaveBeenCalledTimes(12);
    const added = client.queries.slice(6);
    expect(added.every(query => query.filters.snapshot_date === "2026-07-22")).toBe(true);
    expect(added.slice(0, 4).map(query => query.filters.window_code)).toEqual(windows);
    expect(added.slice(0, 5).every(query => query.options?.head && query.options.count === "exact")).toBe(true);
    expect(added[4].filters).toMatchObject({ window_code: windows, sustainability_quintile: null });
    expect(added[5]).toMatchObject({ limit: 5, fields: "window_code,season_id,config_revision,model_version,config_hash,population_count", options: { count: "exact" }, filters: { window_code: windows }, orders: ["config_revision", "season_id", "window_code"] });
  });

  it("reports missing windows, unequal counts and null quintiles without inferring expected membership", async () => {
    const client = createClient({ counts: { l3: 0, l5: 249 }, missingQuintiles: 7, distributions: distributionRows().slice(1) });
    const { snapshotDiagnostics: diagnostic } = await loadSustainabilityHealth(client as any);
    expect(diagnostic).toMatchObject({ coverage: "unverified", expectedPopulation: null, missingScoreWindows: ["l3"], missingQuintileRows: 7, distributions: { missingWindows: ["l3"] }, issues: ["missing_score_windows", "unequal_score_window_counts", "missing_quintiles", "missing_distribution_windows"] });
  });

  it("reports absent distribution evidence at the anchored date", async () => {
    const { snapshotDiagnostics: diagnostic } = await loadSustainabilityHealth(createClient({ distributions: [] }) as any);
    expect(diagnostic.distributions).toMatchObject({ rowCount: 0, truncated: false, missingWindows: windows });
    expect(diagnostic.issues).toContain("missing_distribution_windows");
  });

  it.each(["multiple identities", "duplicate window", "sentinel", "backend cap"])("does not select a complete version from %s observations", async (scenario) => {
    const rows = distributionRows();
    if (scenario === "multiple identities") rows[3].config_revision = 8;
    if (scenario === "duplicate window") rows[3].window_code = "l3";
    if (scenario === "sentinel") rows.push({ ...rows[0], config_revision: 8 });
    const client = createClient({ distributions: rows, returnedLimit: scenario === "backend cap" ? 2 : undefined });
    const { snapshotDiagnostics: diagnostic } = await loadSustainabilityHealth(client as any);
    expect(diagnostic.coverage).toBe("unverified");
    expect(diagnostic.distributions.missingWindows).toBeNull();
    expect(diagnostic.distributions.rows.length).toBeLessThanOrEqual(5);
    expect(diagnostic.issues).toContain("ambiguous_distribution_identity");
    if (scenario === "backend cap") {
      expect(diagnostic.distributions.truncated).toBe(true);
      expect(diagnostic.issues).toContain("truncated_distributions");
    }
  });

  it.each([null, -1, Number.NaN])("rejects unavailable or invalid new window counts %s", async (count) => {
    await expect(loadSustainabilityHealth(createClient({ counts: { l3: count } }) as any)).rejects.toThrow("exact count is unavailable");
  });

  it.each(["window", "quintiles", "distributions"] as const)("fails closed on new %s query errors", async (failDiagnostic) => {
    await expect(loadSustainabilityHealth(createClient({ failDiagnostic }) as any)).rejects.toThrow("count failed");
  });

  it("rejects unknown quintile and distribution counts instead of treating them as zero", async () => {
    await expect(loadSustainabilityHealth(createClient({ missingQuintiles: null }) as any)).rejects.toThrow("exact count is unavailable");
    await expect(loadSustainabilityHealth(createClient({ distributionCount: null }) as any)).rejects.toThrow("exact count is unavailable");
  });
});
