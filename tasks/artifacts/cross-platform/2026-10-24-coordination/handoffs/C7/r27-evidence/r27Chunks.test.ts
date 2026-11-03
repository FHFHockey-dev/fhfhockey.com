// @vitest-environment node
// C7 R27: chunked recent reads against a recording mock of the anon client.
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { writeFileSync } from "node:fs";
const m = vi.hoisted(() => ({ calls: [] as any[], rowsPer: 7, failChunkWith: null as null | number, inflight: { skater: 0, goalie: 0 }, peak: { skater: 0, goalie: 0 }, failAll: false }));
vi.mock("lib/supabase/public-client", () => ({ default: { from(table: string) {
  const kind = table === "rolling_player_game_metrics" ? "skater" : "goalie";
  const rec: any = { table, ids: [] as number[], range: null as any, orders: [] as any[] };
  const q: any = new Proxy({}, { get: (_t, k: string) => {
    if (k === "then") return (resolve: any) => { m.calls.push(rec); m.inflight[kind]++; m.peak[kind] = Math.max(m.peak[kind], m.inflight[kind]);
      return new Promise(r => setTimeout(r, 5)).then(() => { m.inflight[kind]--;
        if (m.failAll || (m.failChunkWith != null && rec.ids.includes(m.failChunkWith))) return resolve({ data: null, error: { code: "57014", message: "canceling statement due to statement timeout" }, count: null });
        const idKey = kind === "skater" ? "player_id" : "goalie_id", dateKey = kind === "skater" ? "game_date" : "date";
        const all = rec.ids.flatMap((id: number) => Array.from({ length: m.rowsPer }, (_, i) => ({ [idKey]: id, [dateKey]: `2026-10-${String(24 - i).padStart(2, "0")}` })));
        const [from, to] = rec.range; return resolve({ data: all.slice(from, to + 1), error: null, count: all.length }); }); };
    return (...a: any[]) => { if (k === "in") rec.ids = a[1]; if (k === "range") rec.range = [a[0], a[1]]; if (k === "order") rec.orders.push([a[0], a[1]?.ascending]); return q; }; } });
  return q; } } }));
import { loadSharePlayerRecent, RECENT_ID_CHUNK, RECENT_CHUNK_CONCURRENCY, RECENT_LIMITS } from "lib/socialShare/playerSources";
import { RANK_POOL_MAX, TRIMMED_PLAYERS_MAX } from "lib/socialShare/tiers";
const out: Record<string, unknown> = {};
afterAll(() => { if (process.env.C7_R27_OUT) writeFileSync(process.env.C7_R27_OUT, JSON.stringify(out, null, 2)); });
beforeEach(() => { m.calls.length = 0; m.rowsPer = 7; m.failChunkWith = null; m.failAll = false; m.inflight = { skater: 0, goalie: 0 }; m.peak = { skater: 0, goalie: 0 }; vi.spyOn(console, "warn").mockImplementation(() => undefined); });
const ids = (n: number, base: number) => Array.from({ length: n }, (_, i) => base + ((i * 7919) % n));
describe("C7 R27 chunked recent reads", () => {
  it("C1 186-player pool (RANK_POOL_MAX): every row exactly once, chunks ≤ 20 disjoint ascending, order player asc then date desc, concurrency ≤ 2 per source", async () => {
    const sk = ids(170, 8470000), gk = ids(16, 8480000);
    const r = await loadSharePlayerRecent(20262027, [...sk, sk[0]], gk, "2026-10-04");
    const keys = r.rolling!.map((x: any) => `${x.player_id}|${x.game_date}`);
    const chunkIds = m.calls.filter(c => c.table === "rolling_player_game_metrics").map(c => c.ids);
    const flat = chunkIds.flat();
    out.C1 = { RANK_POOL_MAX, TRIMMED_PLAYERS_MAX, statements: m.calls.length, skaterStatements: chunkIds.length, goalieStatements: m.calls.length - chunkIds.length, rows: keys.length, unique: new Set(keys).size, peak: m.peak, orders: m.calls[0].orders, chunkSizes: chunkIds.map((c: number[]) => c.length) };
    expect(new Set(keys).size).toBe(keys.length); expect(keys.length).toBe(170 * 7); expect(r.goalieGames!.length).toBe(16 * 7);
    expect(new Set(flat).size).toBe(flat.length); expect(flat.length).toBe(170); expect(chunkIds.every((c: number[]) => c.length <= RECENT_ID_CHUNK && c.every((v, i) => i === 0 || v > c[i - 1])));
    expect(m.peak.skater).toBeLessThanOrEqual(RECENT_CHUNK_CONCURRENCY); expect(m.peak.goalie).toBeLessThanOrEqual(RECENT_CHUNK_CONCURRENCY);
    expect(m.calls[0].orders).toEqual(expect.arrayContaining([["player_id", true]]));
  });
  it("C2 one failing chunk costs only its own 20 ids; all failing → source null", async () => {
    const sk = ids(100, 8470000).sort((a, b) => a - b); m.failChunkWith = sk[45];
    const r = await loadSharePlayerRecent(20262027, sk, [], "2026-10-04");
    const expected = sk.slice(40, 60);
    out.C2 = { failedIds: r.failedIds.length, sameChunk: JSON.stringify([...r.failedIds].sort()) === JSON.stringify(expected), rows: r.rolling!.length };
    expect([...r.failedIds].sort((a, b) => a - b)).toEqual(expected); expect(r.rolling!.length).toBe(80 * 7);
    m.failAll = true; const z = await loadSharePlayerRecent(20262027, sk, [], "2026-10-04"); expect(z.rolling).toBeNull(); expect(z.failedIds.length).toBe(100);
  });
  it("C3 an exact-multiple chunk (20 ids × 22 rows = its full 440 limit) is one statement, no 416 page past the end", async () => {
    m.rowsPer = RECENT_LIMITS.skaterRowsPerPlayer; const sk = ids(20, 8470000);
    const r = await loadSharePlayerRecent(20262027, sk, [], "2026-10-04");
    out.C3 = { statements: m.calls.length, ranges: m.calls.map(c => c.range), rows: r.rolling!.length };
    expect(m.calls.length).toBe(1); expect(r.rolling!.length).toBe(440);
  });
  it("C4 worst-case statement count: pool 186 and shown 84, any skater/goalie split", () => {
    const worst = (n: number) => Math.max(...Array.from({ length: n + 1 }, (_, g) => Math.ceil((n - g) / RECENT_ID_CHUNK) + Math.ceil(g / RECENT_ID_CHUNK)));
    out.C4 = { pool186: worst(186), shown84: worst(84), perStatementLimit: RECENT_ID_CHUNK * RECENT_LIMITS.skaterRowsPerPlayer };
    expect(worst(186)).toBe(11); expect(worst(84)).toBe(6);
  });
});
