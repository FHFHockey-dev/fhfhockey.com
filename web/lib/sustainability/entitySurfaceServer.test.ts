import { beforeEach, describe, expect, it, vi } from "vitest";

const fixtures = vi.hoisted(() => ({
  legacy: [] as Record<string, any>[],
  unified: [] as Record<string, any>[],
  bands: [] as Record<string, any>[],
  unifiedBands: [] as Record<string, any>[],
  baselines: [] as Record<string, any>[],
  calls: [] as { table: string; method: string; args: unknown[] }[],
}));

vi.mock("lib/supabase/server", () => ({
  default: {
    from: (table: string) => {
      fixtures.calls.push({ table, method: "from", args: [] });
      let rows = table === "sustainability_scores" ? [...fixtures.legacy]
        : table === "entity_sustainability_scores_daily" ? [...fixtures.unified]
        : table === "sustainability_trend_bands" ? [...fixtures.bands]
        : table === "entity_sustainability_bands_daily" ? [...fixtures.unifiedBands]
        : table === "player_baselines" ? [...fixtures.baselines]
        : table === "players" || table === "wgo_skater_stats" ? [] : null;
      if (!rows) throw new Error(`Unexpected test table: ${table}`);
      const query: any = {
        select: () => query,
        eq: (key: string, value: unknown) => { fixtures.calls.push({ table, method: "eq", args: [key, value] }); rows = rows!.filter((row) => row[key] === value); return query; },
        lte: (key: string, value: string) => { rows = rows!.filter((row) => row[key] <= value); return query; },
        gt: (key: string, value: string) => { rows = rows!.filter((row) => row[key] == null || row[key] > value); return query; },
        gte: (key: string, value: string) => { rows = rows!.filter((row) => row[key] == null || row[key] >= value); return query; },
        in: (key: string, values: unknown[]) => { fixtures.calls.push({ table, method: "in", args: [key, values] }); rows = rows!.filter((row) => values.includes(row[key])); return query; },
        order: () => query,
        limit: (count: number) => { rows = rows!.slice(0, count); return query; },
        single: () => Promise.resolve(rows!.length ? { data: rows![0], error: null } : { data: null, error: { code: "PGRST116" } }),
        then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: rows, count: rows!.length, error: null }).then(resolve),
      };
      return query;
    },
  },
}));

import { fetchSandboxBands, fetchSandboxScoreHistory, fetchSandboxScores } from "./entitySurfaceServer";
import { readUsualRange } from "./usualRange";

const baseRow = {
  snapshot_date: "2026-10-19", window_code: "l5", season_id: 20262027,
  s_raw: 1.2, s_100: 70, components: {}, computed_at: "2026-10-19T12:00:00Z",
};

describe("sandbox score semantics", () => {
  beforeEach(() => {
    fixtures.legacy = [];
    fixtures.unified = [];
  });

  it.each([1.2, -1.2, 0, null, undefined, NaN, Infinity, -Infinity])(
    "preserves legacy numeric conversion for %s while making performance unavailable",
    async (rawScore) => {
      fixtures.legacy = [{ ...baseRow, player_id: 1, s_raw: rawScore }];
      const result = await fetchSandboxScores({ entityType: "skater", entityId: 1, requestedDate: "2026-10-19" });
      expect(result.selectedRow).toMatchObject({
        entityType: "skater", expectationState: "unavailable", score: 70,
        provenance: { score_semantics: "process_support_index" },
      });
      expect(result.selectedRow?.rawScore).toBe(Number(rawScore));
      expect(result.selectedRow?.provenance.performance_state_note).toContain("does not measure observed performance");
      expect(result.rows).toHaveLength(1);
    },
  );

  it.each(["overperforming", "underperforming", "stable"])(
    "preserves the supplied unified %s state and provenance independently of raw score",
    async (expectationState) => {
      fixtures.unified = [{
        ...baseRow, entity_type: "team", entity_id: 6, player_id: null, team_id: 6,
        metric_scope: "overall", s_raw: -2, s_100: 10, expectation_state: expectationState,
        provenance: { supplied: "unified-expectation" },
      }];
      const result = await fetchSandboxScores({ entityType: "team", entityId: 6, requestedDate: "2026-10-19" });
      expect(result.selectedRow).toMatchObject({
        expectationState, rawScore: -2, score: 10, provenance: { supplied: "unified-expectation" },
      });
      expect(result.selectedRow?.provenance).not.toHaveProperty("score_semantics");
    },
  );
});

describe("sandbox band status (W1 P0 #24, W3-6 N3)", () => {
  beforeEach(() => {
    fixtures.legacy = [{ ...baseRow, player_id: 8478402 }];
    fixtures.unified = [];
    fixtures.bands = [];
  });

  const band = (overrides: Record<string, any>) => ({
    player_id: 8478402, season_id: 20262027, snapshot_date: "2026-10-19",
    metric_key: "pp_goals_per_60", window_code: "l5", baseline: 7.5,
    ewma: 14.8, value: 8.12, ci_lower: 6.9, ci_upper: 9.4, z_score: 0.4,
    percentile: null, exposure: 19.2, ...overrides,
  });

  it("reads status from the usual range and compares the observed value, not the shrunk one", async () => {
    fixtures.bands = [band({
      distribution: { usualRange: {
        basis: "pre_window_baseline_predictive", interval: "central_80", validated: false,
        family: "negative_binomial", observed: 15, lower: 3, upper: 15, baseline: 7.5,
        upperTail: 0.1088, lowerTail: 0.958, status: "neutral", count: 5, exposure: 20,
        gamesInWindow: 5, gamesCovered: 5, baselineEvidence: 6000, baselineSeasons: [20252026],
      } },
    })];
    const payload = await fetchSandboxBands({
      entityType: "skater", entityId: 8478402, requestedDate: "2026-10-19",
      windowCode: "l5", metricKey: "pp_goals_per_60",
    });
    const row = payload.currentRows[0]!;
    // The shrunk value (8.12) sits inside its own interval: the old status.
    expect(row.value).toBeGreaterThan(row.ciLower);
    expect(readUsualRange(row.distribution)).toMatchObject({ status: "neutral" });
    const season = row.comparisons.find((c) => c.key === "season");
    expect(season?.value).toBe(15);
  });

  it("a snapshot without a usual range is unknown, never neutral by its own interval", async () => {
    fixtures.bands = [band({ value: 0.02, ci_lower: 0.03, ci_upper: 0.2, distribution: {} })];
    const payload = await fetchSandboxBands({
      entityType: "skater", entityId: 8478402, requestedDate: "2026-10-19",
      windowCode: "l5", metricKey: "pp_goals_per_60",
    });
    expect(readUsualRange(payload.currentRows[0]!.distribution)).toEqual({
      status: "unknown", range: null, reason: "not_computed",
    });
  });
});

describe("sandbox score coverage (BC W1-9 A2)", () => {
  beforeEach(() => {
    fixtures.legacy = [];
    fixtures.unified = [];
    fixtures.bands = [];
  });

  it("leaves an all-missing score out of the list and shows the selected one as unavailable", async () => {
    const missingComponents = {
      warnings: [
        "missing_window_z_shp", "missing_window_z_oishp", "missing_window_z_ipp",
        "missing_window_z_ppshp", "missing_skill_window_ixg60",
        "missing_skill_window_icf60", "missing_skill_window_hdcf60",
      ],
      fallbackFlags: { missing_luck_stats: true, missing_skill_stats: true },
    };
    fixtures.legacy = [
      { ...baseRow, player_id: 1, s_raw: 0, s_100: 50, components: missingComponents },
      { ...baseRow, player_id: 2, components: { warnings: [], fallbackFlags: {} } },
    ];
    const payload = await fetchSandboxScores({
      entityType: "skater", requestedDate: "2026-10-19", windowCode: "l5", entityId: 1,
    } as any);
    expect(payload.rows.map((row) => row.entityId)).toEqual([2]);
    expect(payload.selectedRow).toMatchObject({ entityId: 1, score: null, rawScore: null });
  });
});

describe("unified band comparisons skip carried-forward days", () => {
  const teamBand = (date: string, observed: number, carriedForward: boolean) => ({
    snapshot_date: date, season_id: 20262027, entity_type: "team", entity_id: 22,
    team_id: 22, player_id: null, metric_key: "xgf_pct", window_code: "l5",
    baseline: 50, ewma: observed, value: observed, ci_lower: 45, ci_upper: 55,
    z_score: 0, percentile: 50, exposure: 5, provenance: {},
    distribution: { usualRange: {
      basis: "pre_window_baseline_league_prior", interval: "central_80", validated: false,
      family: "normal_league_residual", observed, lower: 45, upper: 55, baseline: 50,
      upperTail: 0.5, lowerTail: 0.5, status: "neutral", count: 1, exposure: 1,
      gamesInWindow: 5, gamesCovered: 5, baselineEvidence: 1, baselineSeasons: [20262027],
    } },
    metadata: { carried_forward: carriedForward, played_on_snapshot: !carriedForward },
  });

  beforeEach(() => {
    // Newest first: the test client ignores order(), and the reader takes the latest date.
    fixtures.unified = ["2026-11-22", "2026-11-21", "2026-11-20", "2026-11-19"].map((date) => ({
      ...baseRow, snapshot_date: date, entity_type: "team", entity_id: 22, team_id: 22,
      player_id: null, metric_scope: "overall", expectation_state: "stable",
    }));
    fixtures.unifiedBands = [
      teamBand("2026-11-19", 40, false),
      teamBand("2026-11-20", 40, true),
      teamBand("2026-11-21", 50, false),
      teamBand("2026-11-22", 60, false),
    ];
  });

  it("averages game snapshots only, so an off day does not count as a game", async () => {
    const payload = await fetchSandboxBands({
      entityType: "team", entityId: 22, requestedDate: "2026-11-22",
      windowCode: "l5", metricKey: "xgf_pct",
    });
    const row = payload.currentRows[0]!;
    expect(payload.snapshotDate).toBe("2026-11-22");
    expect(row.comparisons.find((c) => c.key === "season")?.value).toBe(50);
    expect(payload.historyRows).toHaveLength(4);
  });
});

describe("player baselines are read only for the players a request needs", () => {
  const missingComponents = {
    warnings: [
      "missing_window_z_shp", "missing_window_z_oishp", "missing_window_z_ipp",
      "missing_window_z_ppshp", "missing_skill_window_ixg60",
      "missing_skill_window_icf60", "missing_skill_window_hdcf60",
    ],
    fallbackFlags: { missing_luck_stats: true, missing_skill_stats: true },
  };
  const baselineCalls = () => fixtures.calls.filter((call) => call.table === "player_baselines");
  const baselineQueries = () => baselineCalls().filter((call) => call.method === "from").length;
  const baselinePlayerFilters = () => baselineCalls()
    .filter((call) => call.method === "in")
    .map((call) => [call.args[0], [...(call.args[1] as number[])].sort((a, b) => a - b)]);
  const expectSnapshotFilter = (date: string) =>
    expect(baselineCalls().filter((call) => call.method === "eq")).toEqual([
      { table: "player_baselines", method: "eq", args: ["snapshot_date", date] },
    ]);

  beforeEach(() => {
    fixtures.legacy = [];
    fixtures.unified = [];
    fixtures.bands = [];
    fixtures.baselines = [];
    fixtures.calls = [];
  });

  it("scores list asks for its listed players plus the selected one, and the selected one keeps its baseline", async () => {
    fixtures.legacy = [
      { ...baseRow, player_id: 1, s_raw: 0, s_100: 50, components: missingComponents },
      { ...baseRow, player_id: 2, components: { warnings: [], fallbackFlags: {} } },
      { ...baseRow, player_id: 3, components: { warnings: [], fallbackFlags: {} } },
    ];
    fixtures.baselines = [1, 2, 3, 4].map((id) => ({
      player_id: id, player_name: `Baseline ${id}`, snapshot_date: "2026-10-19",
    }));
    const payload = await fetchSandboxScores({
      entityType: "skater", requestedDate: "2026-10-19", windowCode: "l5", entityId: 1,
    });
    expect(baselineQueries()).toBe(1);
    expectSnapshotFilter("2026-10-19");
    expect(baselinePlayerFilters()).toEqual([["player_id", [1, 2, 3]]]);
    expect(payload.rows.map((row) => row.entityId)).toEqual([2, 3]);
    expect(payload.selectedRow).toMatchObject({ entityId: 1, entityName: "Baseline 1" });
  });

  it("scores list with no available players makes no baselines query", async () => {
    fixtures.legacy = [
      { ...baseRow, player_id: 1, s_raw: 0, s_100: 50, components: missingComponents },
    ];
    const payload = await fetchSandboxScores({
      entityType: "skater", requestedDate: "2026-10-19", windowCode: "l5",
    });
    expect(payload.snapshotDate).toBe("2026-10-19");
    expect(fixtures.calls.some((call) => call.table === "sustainability_scores")).toBe(true);
    expect(payload.rows).toEqual([]);
    expect(baselineQueries()).toBe(0);
  });

  it("bands ask for the selected player only", async () => {
    fixtures.legacy = [{ ...baseRow, player_id: 8478402 }];
    await fetchSandboxBands({
      entityType: "skater", entityId: 8478402, requestedDate: "2026-10-19",
      windowCode: "l5", metricKey: "pp_goals_per_60",
    });
    expect(baselineQueries()).toBe(1);
    expectSnapshotFilter("2026-10-19");
    expect(baselinePlayerFilters()).toEqual([["player_id", [8478402]]]);
  });

  it("score history asks for the selected player only", async () => {
    fixtures.legacy = [{ ...baseRow, player_id: 8478402 }];
    await fetchSandboxScoreHistory({
      entityType: "skater", entityId: 8478402, requestedDate: "2026-10-19", windowCode: "l5",
    });
    expect(baselineQueries()).toBe(1);
    expectSnapshotFilter("2026-10-19");
    expect(baselinePlayerFilters()).toEqual([["player_id", [8478402]]]);
  });
});
