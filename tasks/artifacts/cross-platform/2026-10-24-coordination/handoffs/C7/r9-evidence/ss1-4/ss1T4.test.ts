// @vitest-environment node
// C7 controls for SS1-4 player layer: export gates, freshness semantics, tier semantics, no leak, no projection.
import { afterAll, describe, expect, it, vi } from "vitest";
import { writeFileSync } from "node:fs";
import { buildScheduleSnapshot, weekDates } from "lib/socialShare/schedule";
import { fictionalLeagueWeek } from "lib/socialShare/fixtures";
import { fictionalPlayerSources } from "lib/socialShare/pickupsFixture";
import { buildPlayerLayer, pickupTiers, specialists } from "lib/socialShare/players";
import { assertExportable } from "lib/socialShare/export";
import type { SocialShareSnapshot } from "lib/socialShare/types";

const OUT = process.env.C7_SS1T4_OUT; const observed: Record<string, unknown> = {};
afterAll(() => { if (OUT) writeFileSync(OUT, JSON.stringify(observed, null, 2)); });
const weekStart = "2026-10-26", now = "2026-10-26T12:00:00Z", season = 20262027;
function edition(sources: ReturnType<typeof fictionalPlayerSources> | null) {
  const snapshot = buildScheduleSnapshot({ format: "game-grid", weekStart, generatedAt: now, schedule: fictionalLeagueWeek(weekStart, now) });
  return { ...snapshot, players: buildPlayerLayer(sources, { season, teams: snapshot.teams.map(t => t.abbreviation), fetchedAt: now, generatedAt: now }) } as SocialShareSnapshot;
}
const fresh = () => fictionalPlayerSources(season, "2026-10-26", "2026-10-26T08:00:00Z");

describe("C7 SS1-4", () => {
  it("G1 export gate: missing/stale/future player layer blocks {players:true}; ready passes; other cards unaffected", () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date(now));
    const cases: Record<string, any> = { ready: fresh(), missing: null, staleOwnership: fictionalPlayerSources(season, "2026-10-20", "2026-10-26T08:00:00Z"),
      staleStats: fictionalPlayerSources(season, "2026-10-26", "2026-10-22T08:00:00Z"), futureOwnership: fictionalPlayerSources(season, "2026-10-28", "2026-10-26T08:00:00Z") };
    const out: Record<string, unknown> = {};
    for (const [name, src] of Object.entries(cases)) {
      const s = edition(src); let blocked = false; try { assertExportable(s, { players: true }); } catch { blocked = true; }
      let gridOk = true; try { assertExportable(s); } catch { gridOk = false; }
      out[name] = { state: s.players!.state, blocked, gridStillExportable: gridOk, tiers: pickupTiers(s, true).length, specialistsHits: specialists(s, true).hits.length };
    }
    vi.useRealTimers(); observed.G1 = out;
    expect((out.ready as any).blocked).toBe(false);
    for (const k of ["missing", "staleOwnership", "staleStats", "futureOwnership"]) { expect((out[k] as any).blocked).toBe(true); expect((out[k] as any).tiers).toBe(0); expect((out[k] as any).specialistsHits).toBe(0); expect((out[k] as any).gridStillExportable).toBe(true); }
  });
  it("G2 untrusted schedule yields no tiers/specialists even with a ready player layer", () => {
    const s = edition(fresh()); expect(pickupTiers(s, false)).toEqual([]); expect(specialists(s, false)).toEqual({ hits: [], shots: [], blocks: [] });
  });
  it("F1 (finding probe) freshness uses the newest timestamps: one fresh row can make mostly-stale ownership 'ready'", () => {
    const src = fictionalPlayerSources(season, "2026-10-01", "2026-10-26T08:00:00Z");
    // Make exactly one Yahoo row fresh; every other row is 25 days old.
    const one = src.yahoo.find(r => r.status === "" || r.status === null)!;
    (one as any).ownership_timeline = [{ date: "2026-10-26", value: (one as any).ownership_timeline?.at?.(-1)?.value ?? "10" }];
    const layer = edition(src).players!;
    observed.F1 = { state: layer.state, ownershipAsOf: layer.ownershipAsOf, players: layer.players.length };
    // Observation only: records whether the gate considers per-player age.
  });
  it("T1 tier semantics: each player once; the under-50 card holds no one under 30 (strictest-first fill)", () => {
    const tiers = pickupTiers(edition(fresh()), true); const by = Object.fromEntries(tiers.map(t => [t.max, t]));
    const ids = tiers.flatMap(t => [...t.groups.F, ...t.groups.D, ...t.groups.G].map(p => p.nhlId));
    const under50Below30 = [...by[50].groups.F, ...by[50].groups.D, ...by[50].groups.G].filter(p => p.ownership < 30).length;
    const bounds = tiers.every(t => [...t.groups.F, ...t.groups.D, ...t.groups.G].every(p => p.ownership < t.max));
    observed.T1 = { tiers: tiers.map(t => t.max), unique: new Set(ids).size === ids.length, under50Below30, bounds };
    expect(new Set(ids).size).toBe(ids.length); expect(bounds).toBe(true); expect(under50Below30).toBe(0);
  });
  it("R1 specialist rate is exactly total ÷ GP; pickups order by an existing column (no projection fields)", () => {
    const s = edition(fresh()); const sp = specialists(s, true);
    const bad = (["hits", "shots", "blocks"] as const).flatMap(c => sp[c].filter(p => Math.abs(p.perGame - (p as any)[c] / p.gamesPlayed) > 1e-12));
    const keys = new Set(s.players!.players.flatMap(p => Object.keys(p)));
    observed.R1 = { mismatches: bad.length, playerKeys: [...keys].sort() };
    expect(bad).toEqual([]); for (const k of keys) expect(k).not.toMatch(/proj|forecast|expected|xg/i);
    expect(JSON.stringify(s.players)).not.toMatch(/player_key|ownership_timeline|editorial|465\.p\./);
  });
});
