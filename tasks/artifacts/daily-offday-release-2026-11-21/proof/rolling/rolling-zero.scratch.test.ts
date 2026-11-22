// Scratch proof (2026-11-21): the real rolling writer `main` for a source date with no WGO skater rows.
import { writeFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

const queries: Array<{ table: string; selected: string; filters: Record<string, unknown> }> = [];
function createEmptyDayClient() {
  return {
    rpc: vi.fn(async () => ({ data: null, error: null })),
    from(table: string) {
      const filters: Record<string, unknown> = {};
      let selected = "";
      const query: Record<string, unknown> = {};
      for (const method of ["neq", "gt", "lt", "is", "not", "or", "order", "limit", "delete", "range"]) {
        query[method] = () => query;
      }
      query.select = (fields: string) => { selected = fields; return query; };
      query.eq = (f: string, v: unknown) => { filters[f] = v; return query; };
      query.in = (f: string, v: unknown[]) => { filters[f] = v; return query; };
      query.gte = (f: string, v: unknown) => { filters[`${f}>=`] = v; return query; };
      query.lte = (f: string, v: unknown) => { filters[`${f}<=`] = v; return query; };
      query.then = (resolve: (v: unknown) => unknown, reject?: (r: unknown) => unknown) => {
        queries.push({ table, selected, filters: { ...filters } });
        // 2026-11-20: no games, no WGO skater rows. Every other read is empty too.
        return Promise.resolve({ data: [], error: null }).then(resolve, reject);
      };
      return query;
    }
  };
}

describe("rolling writer on a zero-game source date", () => {
  afterEach(() => { vi.restoreAllMocks(); });
  it("returns a complete zero-player summary before any budget or deadline check", async () => {
    for (const m of ["info", "warn", "debug", "error", "time", "timeEnd", "log"] as const) {
      vi.spyOn(console, m).mockImplementation(() => undefined);
    }
    vi.resetModules();
    vi.doMock("@supabase/supabase-js", () => ({ createClient: () => createEmptyDayClient() }));
    const { main } = await import("lib/supabase/Upserts/fetchRollingPlayerAverages");
    vi.doUnmock("@supabase/supabase-js");
    const now = Date.now();
    // The pipeline's first chunk: maxPlayers 16, claim budget and in-flight deadline set.
    const summary = await main({
      startDate: "2026-11-20", endDate: "2026-11-20", fastMode: true, executionProfile: "daily_incremental",
      maxPlayers: 16, stopClaimingPlayersAtMs: now + 150_000, abortInFlightAtMs: now + 200_000, dryRunUpsert: true
    } as any);
    writeFileSync(process.env.ROLLING_OUT_JSON!, JSON.stringify({ summary, queries }, null, 2));
    expect(summary).toMatchObject({ processedPlayers: 0, rowsUpserted: 0, stoppedReason: "complete", nextResumeFrom: null });
    expect(queries.some((q) => q.table === "wgo_skater_stats")).toBe(true);
  });
});
