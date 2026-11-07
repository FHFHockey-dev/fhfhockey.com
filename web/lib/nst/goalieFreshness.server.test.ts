import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { readGoalieFreshness } from "./goalieFreshness.server";

const NOW = new Date("2026-11-01T13:00:00Z");
function fixture() {
  const rows: Record<string, any[]> = {
    seasons: [{ id: 20262027, startDate: "2026-10-07", regularSeasonEndDate: "2027-04-15" }],
    games: [{ id: 1, date: "2026-10-30" }, { id: 2, date: "2026-10-31" }],
    wgo_goalie_stats: ["2026-10-30", "2026-10-31"].flatMap(date => [1, 2].map(goalie_id => ({ goalie_id, date, season_id: 20262027, games_played: 1 }))),
    nst_gamelog_goalie_all_counts: ["2026-10-30", "2026-10-31"].flatMap(date_scraped => [1, 2].map(player_id => ({ player_id, date_scraped, season: 20262027, hd_shots_against: 0 })))
  };
  const calls: Array<{ table: string; from: number; to: number; signal: AbortSignal; filters: unknown[] }> = [];
  const fail = new Set<string>();
  const hang = new Set<string>();
  const progress: Record<string, any> = { version: 1, enabled: true, configurationKnown: true, reviewRequired: false,
    pending: 0, held: 0, inFlight: 0, noProgressWindows: 0, lastCommitAt: null, datasets: [] };
  const rpc = vi.fn(() => ({ abortSignal: (_signal: AbortSignal) => Promise.resolve({ data: progress, error: null }) }));
  const client = { rpc, from(table: string) {
    let from = 0; let to = 0;
    const filters: unknown[] = [];
    const chain = {
      select: () => chain,
      eq: (...args: unknown[]) => { filters.push(["eq", ...args]); return chain; },
      gte: (...args: unknown[]) => { filters.push(["gte", ...args]); return chain; },
      lte: (...args: unknown[]) => { filters.push(["lte", ...args]); return chain; },
      order: () => chain,
      range: (a: number, b: number) => { from = a; to = b; return chain; },
      abortSignal: (signal: AbortSignal) => {
        calls.push({ table, from, to, signal, filters });
        if (hang.has(table)) return new Promise<any>(() => {});
        return Promise.resolve(fail.has(table) ? { data: null, error: { message: "fixture failure" }, count: null }
          : { data: (rows[table] ?? []).slice(from, to + 1), error: null, count: (rows[table] ?? []).length });
      }
    };
    return chain;
  } } as unknown as SupabaseClient;
  return { rows, calls, fail, hang, client, progress, rpc };
}
function read(client: SupabaseClient, override: Partial<Parameters<typeof readGoalieFreshness>[0]> = {}) {
  return readGoalieFreshness({ client, now: NOW, season: { state: "in_season", seasonId: 20262027 },
    sourceDeadlineAt: NOW.getTime() + 180_000, writerAuditPresent: false, ...override });
}

describe("bounded goalie freshness reads", () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(NOW); });
  afterEach(() => { vi.useRealTimers(); });

  it("detects a partial middle date independently of a missing writer audit", async () => {
    const f = fixture();
    f.rows.nst_gamelog_goalie_all_counts = f.rows.nst_gamelog_goalie_all_counts.filter(row => row.player_id !== 2 || row.date_scraped !== "2026-10-30");
    const result = await read(f.client);
    expect(result.status).toBe("warning");
    expect(result.expected).toBe(4);
    expect(result.matched).toBe(3);
    expect(result.latestCompleteDate).toBe("2026-10-31");
    expect(result.missing[0]).toMatchObject({ date: "2026-10-30", goalieId: 2 });
    expect(result.warnings.some(value => value.includes("No acknowledged goalie writer audit"))).toBe(true);
    expect(f.calls).toHaveLength(8); // Two verified reads per source.
    expect(f.calls.find(value => value.table === "games")?.filters).toContainEqual(["eq", "type", 2]);
    expect(f.calls.find(value => value.table === "nst_gamelog_goalie_all_counts")?.filters).toContainEqual(["lte", "date_scraped", "2026-10-31"]);
  });

  it("returns unknown for stale WGO or any failed source", async () => {
    const stale = fixture(); stale.rows.wgo_goalie_stats.pop();
    expect((await read(stale.client)).status).toBe("unknown");
    const failed = fixture(); failed.fail.add("nst_gamelog_goalie_all_counts");
    expect((await read(failed.client)).status).toBe("unknown");
    expect(failed.calls.filter(call => call.table === "nst_gamelog_goalie_all_counts")).toHaveLength(2);
  });

  it("fails closed at page limits rather than reporting partial enumeration healthy", async () => {
    const f = fixture();
    f.rows.nst_gamelog_goalie_all_counts = Array.from({ length: 2001 }, (_, index) => ({ player_id: index + 1, date_scraped: "2026-10-31", season: 20262027, hd_shots_against: 0 }));
    expect((await read(f.client)).status).toBe("unknown");
    expect(f.calls.filter(call => call.table === "nst_gamelog_goalie_all_counts")).toHaveLength(4);
  });

  it("bounds hung reads even if a query ignores AbortSignal", async () => {
    const f = fixture(); f.hang.add("games");
    const pending = read(f.client, { sourceDeadlineAt: NOW.getTime() + 7000 });
    await vi.runAllTimersAsync();
    expect((await pending).status).toBe("unknown");
    expect(Date.now() - NOW.getTime()).toBeLessThanOrEqual(7000);
    expect(f.calls.filter(call => call.table === "games").every(call => call.signal.aborted)).toBe(true);
  });

  it("avoids IO when the season is paused, unknown, or the report budget is gone", async () => {
    const f = fixture();
    expect((await read(f.client, { season: { state: "off_season" } })).status).toBe("not_due");
    expect((await read(f.client, { season: { state: "unknown" } })).status).toBe("unknown");
    expect((await read(f.client, { sourceDeadlineAt: NOW.getTime() })).status).toBe("unknown");
    expect(f.calls).toHaveLength(0);
  });
  it("escalates held or two-window stalled dataset work even when allCounts HD is complete", async () => {
    const f = fixture();
    Object.assign(f.progress, { pending: 1, noProgressWindows: 2,
      datasets: [{ dataset: "ppRates", pending: 1, held: 0, inFlight: 0, complete: 0 }] });
    const result = await read(f.client);
    expect(result).toMatchObject({ status: "critical", matched: 4, missing: [], checkpoint: { pending: 1, noProgressWindows: 2 } });
    expect(result.warnings.some(w => w.includes("two latest closed"))).toBe(true);
    f.progress.noProgressWindows = 0; f.progress.reviewRequired = true;
    expect((await read(f.client)).status).toBe("critical");
  });
  it("keeps missing, malformed or disabled progress distinct from zero stalls", async () => {
    const f = fixture(); f.progress.enabled = false;
    expect((await read(f.client)).checkpoint?.status).toBe("disabled");
    f.progress.enabled = true; f.progress.pending = 1; // Dataset totals disagree.
    expect(await read(f.client)).toMatchObject({ status: "unknown", checkpoint: { noProgressWindows: null } });
    f.rpc.mockImplementation(() => { throw new Error("RPC missing"); });
    expect((await read(f.client)).checkpoint?.status).toBe("unknown");
  });
  it("never reports an empty queue healthy when activation prerequisites are invalid", async () => {
    const f = fixture();
    Object.assign(f.progress, { configurationKnown: false, reviewRequired: true });
    expect(await read(f.client)).toMatchObject({ status: "unknown", matched: 4, missing: [],
      checkpoint: { status: "unknown", pending: null, noProgressWindows: null } });
  });
  it("bounds a hung progress RPC independently of successful coverage reads", async () => {
    const f = fixture(); f.rpc.mockImplementation(() => ({ abortSignal: () => new Promise(() => {}) }));
    const pending = read(f.client); await vi.runAllTimersAsync();
    expect(await pending).toMatchObject({ status: "unknown", matched: 4, checkpoint: { pending: null } });
    expect(Date.now() - NOW.getTime()).toBe(5_000);
  });

});
