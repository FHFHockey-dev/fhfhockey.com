// @vitest-environment node
// C7 controls for SS1-5: per-player freshness (my F1 case), band boundaries, primary position, oldest as-of.
import { afterAll, describe, expect, it } from "vitest";
import { writeFileSync } from "node:fs";
import { buildScheduleSnapshot } from "lib/socialShare/schedule";
import { fictionalLeagueWeek } from "lib/socialShare/fixtures";
import { fictionalPlayerSources } from "lib/socialShare/pickupsFixture";
import { buildPlayerLayer, pickupTiers, positionGroup, specialists, PICKUP_BANDS } from "lib/socialShare/players";
import type { SocialShareSnapshot } from "lib/socialShare/types";

const OUT = process.env.C7_SS1T5_OUT; const observed: Record<string, unknown> = {};
afterAll(() => { if (OUT) writeFileSync(OUT, JSON.stringify(observed, null, 2)); });
const weekStart = "2026-10-26", now = "2026-10-26T12:00:00Z", season = 20262027;
const edition = (sources: any) => { const s = buildScheduleSnapshot({ format: "game-grid", weekStart, generatedAt: now, schedule: fictionalLeagueWeek(weekStart, now) });
  return { ...s, players: buildPlayerLayer(sources, { season, teams: s.teams.map(t => t.abbreviation), fetchedAt: now, generatedAt: now }) } as SocialShareSnapshot; };
const setOwn = (row: any, date: string, value?: number) => { const v = value ?? Number((row.ownership_timeline?.at?.(-1)?.value) ?? row.percent_ownership ?? 10); row.ownership_timeline = [{ date, value: String(v) }]; row.percent_ownership = String(v); };

describe("C7 SS1-5", () => {
  it("F1 my SS1-4 case (all rows 25 days old except one) → layer stale, no tiers/specialists", () => {
    const src = fictionalPlayerSources(season, "2026-10-01", "2026-10-26T08:00:00Z");
    setOwn(src.yahoo.find((r: any) => !r.status)!, "2026-10-26");
    const s = edition(src); observed.F1 = { state: s.players!.state, reasons: s.players!.reasons, players: s.players!.players.length };
    expect(s.players!.state).toBe("stale"); expect(pickupTiers(s, true)).toEqual([]); expect(specialists(s, true).hits).toEqual([]);
  });
  it("F1b minority stale: ready, stale rows excluded, card as-of = oldest included", () => {
    const src = fictionalPlayerSources(season, "2026-10-26", "2026-10-26T08:00:00Z");
    const rows = src.yahoo.filter((r: any) => !r.status);
    rows.slice(0, 10).forEach((r: any) => setOwn(r, "2026-10-10"));      // stale, excluded
    rows.slice(10, 12).forEach((r: any) => setOwn(r, "2026-10-25"));     // yesterday, kept
    rows.slice(12, 14).forEach((r: any) => { r.ownership_timeline = []; r.last_updated = null; }); // undated → excluded
    const s = edition(src); const ids = new Set(s.players!.players.map(p => p.nhlId));
    const staleIds = rows.slice(0, 10).map((r: any) => Number(src.map.find((m: any) => m.yahoo_player_id === r.player_key)?.nhl_player_id));
    observed.F1b = { state: s.players!.state, ownershipAsOf: s.players!.ownershipAsOf, reasons: s.players!.reasons, staleIncluded: staleIds.filter((id: number) => ids.has(id)).length };
    expect(s.players!.state).toBe("ready"); expect(s.players!.ownershipAsOf).toBe("2026-10-25"); expect(staleIds.filter((id: number) => ids.has(id))).toEqual([]);
  });
  it("F1c exactly half stale → still ready (documented rule: stale must outnumber kept)", () => {
    const src = fictionalPlayerSources(season, "2026-10-26", "2026-10-26T08:00:00Z");
    const first = edition(src).players!.players.length; const rows = src.yahoo.filter((r: any) => !r.status);
    const mapped = new Set(edition(src).players!.players.map(p => p.nhlId));
    const eligibleRows = rows.filter((r: any) => mapped.has(Number(src.map.find((m: any) => m.yahoo_player_id === r.player_key)?.nhl_player_id)));
    eligibleRows.slice(0, Math.floor(first / 2)).forEach((r: any) => setOwn(r, "2026-10-01"));
    const s = edition(src); observed.F1c = { kept: s.players!.players.length, state: s.players!.state, reasons: s.players!.reasons };
  });
  it("B1 band boundaries: 50 excluded, 49.99→30–49, 30→30–49, 29.99→20–29, 20→20–29, 19.99→under 20, 0→under 20; each player once", () => {
    const src = fictionalPlayerSources(season, "2026-10-26", "2026-10-26T08:00:00Z"); const s0 = edition(src);
    const top = new Set(s0.rows.filter(r => r.rank <= 10 && r.remainingGames > 0).map(r => r.team.abbreviation));
    const forwards = s0.players!.players.filter(p => p.group === "F" && top.has(p.team)).slice(0, 7);
    const values = [50, 49.99, 30, 29.99, 20, 19.99, 0];
    const players = s0.players!.players.map(p => { const i = forwards.findIndex(f => f.nhlId === p.nhlId); return i >= 0 ? { ...p, ownership: values[i], pointsPerGame: 9 - i * 0.01 } : { ...p, pointsPerGame: 0 }; });
    const s = { ...s0, players: { ...s0.players!, players } } as SocialShareSnapshot;
    const tiers = pickupTiers(s, true); const bandOf: Record<number, string> = {};
    for (const t of tiers) for (const p of t.groups.F) if (values.includes(p.ownership) && forwards.some(f => f.nhlId === p.nhlId)) bandOf[p.ownership] = t.label;
    const all = tiers.flatMap(t => [...t.groups.F, ...t.groups.D, ...t.groups.G].map(p => p.nhlId));
    observed.B1 = { labels: PICKUP_BANDS.map(b => b.label), bandOf, unique: new Set(all).size === all.length };
    expect(bandOf).toEqual({ 49.99: "30–49%", 30: "30–49%", 29.99: "20–29%", 20: "20–29%", 19.99: "Under 20%", 0: "Under 20%" });
    expect(new Set(all).size).toBe(all.length);
  });
  it.each([["C,D", [{ position: "C" }, { position: "D" }], "F"], ["D,C", [{ position: "C" }, { position: "D" }, { position: "Util" }], "D"], ["Util,D,C", [{ position: "C" }, { position: "D" }], "D"],
    [null, [{ position: "D" }, { position: "C" }], "D"], ["G", [{ position: "G" }], "G"], ["BN", [{ position: "Util" }, { position: "BN" }], null]])("P1 display %s → group %s", (display, eligible, group) => {
    const r = positionGroup({ display_position: display, eligible_positions: eligible } as any);
    (observed.P1 ??= {} as any)[String(display)] = r; expect(r?.group ?? null).toBe(group);
  });
});
