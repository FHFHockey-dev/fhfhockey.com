import { beforeEach, describe, expect, it, vi } from "vitest";

const fixtures = vi.hoisted(() => ({
  legacy: [] as Record<string, any>[],
  unified: [] as Record<string, any>[],
}));

vi.mock("lib/supabase/server", () => ({
  default: {
    from: (table: string) => {
      let rows = table === "sustainability_scores" ? [...fixtures.legacy]
        : table === "entity_sustainability_scores_daily" ? [...fixtures.unified]
        : table === "players" || table === "player_baselines" ? [] : null;
      if (!rows) throw new Error(`Unexpected test table: ${table}`);
      const query: any = {
        select: () => query,
        eq: (key: string, value: unknown) => { rows = rows!.filter((row) => row[key] === value); return query; },
        lte: (key: string, value: string) => { rows = rows!.filter((row) => row[key] <= value); return query; },
        in: (key: string, values: unknown[]) => { rows = rows!.filter((row) => values.includes(row[key])); return query; },
        order: () => query,
        limit: (count: number) => { rows = rows!.slice(0, count); return query; },
        then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: rows, count: rows!.length, error: null }).then(resolve),
      };
      return query;
    },
  },
}));

import { fetchSandboxScores } from "./entitySurfaceServer";

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
