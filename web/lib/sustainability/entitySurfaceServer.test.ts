import { beforeEach, describe, expect, it, vi } from "vitest";

const fixtures = vi.hoisted(() => ({
  legacy: [] as Record<string, any>[],
  unified: [] as Record<string, any>[],
  bands: [] as Record<string, any>[],
}));

vi.mock("lib/supabase/server", () => ({
  default: {
    from: (table: string) => {
      let rows = table === "sustainability_scores" ? [...fixtures.legacy]
        : table === "entity_sustainability_scores_daily" ? [...fixtures.unified]
        : table === "sustainability_trend_bands" ? [...fixtures.bands]
        : table === "players" || table === "player_baselines" || table === "wgo_skater_stats" ? [] : null;
      if (!rows) throw new Error(`Unexpected test table: ${table}`);
      const query: any = {
        select: () => query,
        eq: (key: string, value: unknown) => { rows = rows!.filter((row) => row[key] === value); return query; },
        lte: (key: string, value: string) => { rows = rows!.filter((row) => row[key] <= value); return query; },
        gt: (key: string, value: string) => { rows = rows!.filter((row) => row[key] == null || row[key] > value); return query; },
        gte: (key: string, value: string) => { rows = rows!.filter((row) => row[key] == null || row[key] >= value); return query; },
        in: (key: string, values: unknown[]) => { rows = rows!.filter((row) => values.includes(row[key])); return query; },
        order: () => query,
        limit: (count: number) => { rows = rows!.slice(0, count); return query; },
        then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: rows, count: rows!.length, error: null }).then(resolve),
      };
      return query;
    },
  },
}));

import { fetchSandboxBands, fetchSandboxScores } from "./entitySurfaceServer";
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
