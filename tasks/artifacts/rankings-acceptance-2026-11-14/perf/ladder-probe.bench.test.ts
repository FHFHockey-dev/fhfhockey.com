/*
 * OFFLINE probe: which matrix surface metrics never become "calculable" on the
 * rolling fallback, forcing the 30-date ladder (30+29+…+1 date reads)?
 * Same fail-closed synthetic client idea as rankings-perf.bench.test.ts,
 * reduced to the tables the fallback reads. Not production data.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
const P = vi.hoisted(() => {
  const DATES: string[] = [];
  for (let d = 0; d < 60; d += 1) DATES.push(new Date(Date.UTC(2026, 10, 13) - d * 86_400_000).toISOString().slice(0, 10));
  const rnd = (s: number) => { const x = Math.sin(s) * 10000; return x - Math.floor(x); };
  const calls: string[] = [];
  function row(i: number, d: number, fields: string[], strength: string) {
    const r: Record<string, unknown> = {};
    for (const f of fields) {
      r[f] = f === "player_id" ? 8470000 + i : f === "game_date" ? DATES[d] : f === "updated_at" ? `${DATES[d]}T08:00:00Z`
        : f === "game_id" ? 2026020000 + d * 40 + (i % 40) : f === "season" ? 20262027 : f === "team_id" ? (i % 32) + 1
        : f === "strength_state" ? strength : f === "line_combo_group" ? (i % 3 === 2 ? "defense" : "forward")
        : f === "line_combo_slot" ? (i % 4) + 1 : f === "pp_unit" ? (i % 5 === 0 ? 1 : null)
        : /games_played|participation_games/.test(f) ? 14 : /^toi_seconds_avg/.test(f) ? 900
        : /^toi_seconds_total/.test(f) ? 12000 : Math.round(rnd(i * 13 + d + f.length * 3) * 1000) / 100;
    }
    return r;
  }
  const win = (n: number) => ({ appearances: n, gameIds: Array.from({ length: n }, (_, k) => 2026020000 + k), gameDates: [], ratio: {}, secondary: {} });
  function resolve(q: any): any[] {
    const s = String(q.eq.strength_state ?? "5v5");
    if (q.t === "rolling_player_game_metrics") {
      if (q.sel === "game_date") return [{ game_date: DATES[0] }];
      const d = DATES.indexOf(String(q.eq.game_date));
      const out = [];
      for (let i = 0; i < 750; i += 1) if ((i + d) % 2 === 0) out.push(row(i, d, q.sel.split(","), s));
      return out;
    }
    if (q.t === "rolling_player_metric_support_payloads") {
      const d = DATES.indexOf(String(q.eq.game_date));
      const out = [];
      for (let i = 0; i < 750; i += 1) if ((i + d) % 2 === 0) out.push({ player_id: 8470000 + i, game_date: DATES[d], game_id: null,
        windowCountSupport: { version: "rolling-player-window-counts-v1", strengthState: s, anchor: { gameId: null, gameDate: DATES[d], season: 20262027 },
          selection: "chronological_appearances_in_strength_state", game: { appeared: true, ratio: {}, additive: {} },
          windows: { last5: win(5), last10: win(10), last20: win(20) } } });
      return out;
    }
    if (q.t === "games") return DATES.flatMap((date) => [{ date }, { date }]);
    if (q.t === "players") return (q.in.id ?? []).map((id: number) => ({ id, fullName: `P${id}`, position: id % 3 === 2 ? "D" : "C", team_id: (id % 32) + 1, image_url: null }));
    if (q.t === "teams") return Array.from({ length: 32 }, (_, k) => ({ id: k + 1, abbreviation: `T${k + 1}`, name: `Team ${k + 1}` }));
    throw new Error(`FAIL-CLOSED: ${q.t}`);
  }
  function from(t: string) {
    const q: any = { t, sel: null, eq: {}, in: {}, range: null };
    const c: any = {
      select(s: string) { q.sel = s; return c; }, eq(k: string, v: unknown) { q.eq[k] = v; return c; },
      lte() { return c; }, order() { return c; }, in(k: string, v: unknown) { q.in[k] = v; return c; },
      range(a: number, b: number) { q.range = [a, b]; return c; }, limit() { return c; },
      then(res: any, rej: any) {
        calls.push(t);
        try { let r = resolve(q); r = q.range ? r.slice(q.range[0], q.range[1] + 1) : r.slice(0, 1000); return Promise.resolve({ data: r, error: null }).then(res, rej); }
        catch (e) { return Promise.reject(e).then(res, rej); }
      },
    };
    return c;
  }
  return { client: { from }, calls };
});
vi.mock("/Users/tim/Code/fhfhockey.com/web/lib/supabase/server", () => ({ default: P.client }));

import { writeFileSync } from "node:fs";
import { buildContextualRankingsSurfaces, clearContextualRankingsQueryCachesForTests } from "/Users/tim/Code/fhfhockey.com/web/lib/rankings/rankingQueries";
import { getDefaultMatrixMetricColumns } from "/Users/tim/Code/fhfhockey.com/web/lib/rankings/matrixMetricRegistry";
import { parseContextualRankingsRequest } from "/Users/tim/Code/fhfhockey.com/web/lib/rankings/rankingTypes";

it("lists matrix surface metrics that stay uncalculable at 5v5 season", async () => {
  globalThis.fetch = (async () => { throw new Error("FAIL-CLOSED fetch"); }) as typeof fetch;
  clearContextualRankingsQueryCachesForTests();
  const columns = getDefaultMatrixMetricColumns({ strength: "5v5" });
  const keys = columns.filter((c) => c.availabilityState === "available" && !String(c.metricKey).match(/mcm|offense_rating|defense_rating|beast|shoot_first|pass_first|play_driver|results_luck/))
    .map((c) => c.metricKey as any);
  const request = parseContextualRankingsRequest({ entity: "skaters", season: "20262027", window: "season", strength: "5v5", metric: "points_per_60", min_gp: "10", min_toi: "300" } as any);
  const surfaces = await buildContextualRankingsSurfaces({ ...request, limit: null } as any, keys);
  const summary = keys.map((k: string) => {
    const s = surfaces.get(k as any)!;
    return { metric: k, unavailable: s.meta.unavailable, reason: s.meta.snapshotSelectionReason, snapshotDate: s.meta.snapshotDate,
      nonNullValues: s.rankings.filter((r: any) => r.metric?.value != null).length, message: s.meta.message };
  });
  const out = { label: "OFFLINE synthetic probe", metricCount: keys.length, roundTrips: P.calls.length,
    supportReads: P.calls.filter((t) => t === "rolling_player_metric_support_payloads").length, summary };
  writeFileSync(`${__dirname}/ladder-probe-results.json`, JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out));
});
