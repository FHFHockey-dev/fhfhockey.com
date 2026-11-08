import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { readGoalieFreshness } from "/Users/tim/Code/fhfhockey.com/web/lib/nst/goalieFreshness.server";

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


// These fixtures are the receipts implied by the inspected old/current SQL
// for the two original invalid-control states. This executes the real report
// adapter, not SQL or a database migration.
describe("original invalid-control report symptom", () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(NOW); });
  afterEach(() => { vi.useRealTimers(); });
  it.each(["missing bootstrap", "future enabled_at"])("old/current receipt rendering: %s", async state => {
    const f = fixture();
    const old = await read(f.client);
    expect(old).toMatchObject({status:"healthy",matched:4,missing:[],checkpoint:{status:"healthy",pending:0}});
    Object.assign(f.progress,{configurationKnown:false,reviewRequired:true});
    const current = await read(f.client);
    expect(current).toMatchObject({status:"unknown",matched:4,missing:[],checkpoint:{status:"unknown",pending:null,noProgressWindows:null}});
    console.log(JSON.stringify({state,old:old.status,current:current.status,scope:"report adapter; SQL receipt fixtures"}));
  });
});
