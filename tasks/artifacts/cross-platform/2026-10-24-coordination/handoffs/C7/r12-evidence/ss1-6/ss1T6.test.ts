// @vitest-environment node
// C7 controls for SS1-6: Wednesday Thu–Sun isolation, Tuesday column provenance, independent gates, server read scope.
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { writeFileSync } from "node:fs";
const OUT = process.env.C7_SS1T6_OUT; const observed: Record<string, unknown> = {};
afterAll(() => { if (OUT) writeFileSync(OUT, JSON.stringify(observed, null, 2)); });
const m = vi.hoisted(() => ({ schedule: vi.fn(), rates: vi.fn() }));
vi.mock("lib/NHL/server", () => ({ getSchedule: m.schedule }));
vi.mock("lib/socialShare/teamRates", async (o) => ({ ...(await o<object>()), loadShareTeamRates: m.rates }));
import { buildScheduleSnapshot, weekDates } from "lib/socialShare/schedule";
import { fictionalLeagueWeek, fictionalTeamStats } from "lib/socialShare/fixtures";
import { fictionalPlayerSources } from "lib/socialShare/pickupsFixture";
import { fictionalTrendSources } from "lib/socialShare/trendsFixture";
import { mondayGridRows, countsAsOpportunity } from "lib/socialShare/mondayGrid";
import { buildOpponentLayer, easiestSchedules, streamingNights } from "lib/socialShare/matchups";
import { buildPlayerLayer, pickupTiers, specialists } from "lib/socialShare/players";
import { buildTrendLayer, hotCold, deploymentChanges, rateStandouts, ownershipMovers, MIN_RATE_TOI_SECONDS_LAST5 } from "lib/socialShare/trends";
import { loadScheduleShareSnapshot } from "lib/socialShare/server";
import type { SocialShareSnapshot } from "lib/socialShare/types";

const WEEK = "2026-10-26", WED = "2026-10-28T12:00:00Z", season = 20262027;
const MON_WED = weekDates(WEEK).slice(0, 3);
function wednesday(mutate?: (s: any) => void): SocialShareSnapshot {
  const schedule: any = fictionalLeagueWeek(WEEK, WED); mutate?.(schedule);
  const s = buildScheduleSnapshot({ format: "remaining-week", weekStart: WEEK, generatedAt: WED, schedule });
  return { ...s, opponents: buildOpponentLayer(fictionalTeamStats(season, "2026-10-28T06:00:00Z") as any, { season, teams: s.teams, fetchedAt: WED, generatedAt: s.generatedAt }),
    players: buildPlayerLayer(fictionalPlayerSources(season, "2026-10-28", "2026-10-28T08:00:00Z"), { season, teams: s.teams.map(t => t.abbreviation), fetchedAt: WED, generatedAt: WED }) } as SocialShareSnapshot;
}
beforeEach(() => { vi.clearAllMocks(); });

describe("C7 SS1-6 Wednesday", () => {
  it("W1 default selection is Thu–Sun and nothing on Mon–Wed is counted anywhere", () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date(WED));
    const s = wednesday(); const sel = s.selectedDates;
    const leaks: string[] = [];
    for (const r of mondayGridRows(s, true)) for (const c of r.cells) for (const g of c.games) if (g.counted && MON_WED.includes(c.date)) leaks.push(`grid ${r.team.abbreviation} ${c.date}`);
    for (const row of s.rows) { const n = s.games.filter(g => (g.homeTeam.id === row.team.id || g.awayTeam.id === row.team.id) && countsAsOpportunity(s, g)).length; if (n !== row.remainingGames) leaks.push(`rows ${row.team.abbreviation}`); }
    for (const r of easiestSchedules(s, true).rows) for (const g of r.games) if (!sel.includes(g.date)) leaks.push(`easiest ${g.date}`);
    for (const n of streamingNights(s, true)) if (!sel.includes(n.date)) leaks.push(`stream ${n.date}`);
    vi.useRealTimers();
    observed.W1 = { selected: sel, leaks, easiest: easiestSchedules(s, true).rows.length, streams: streamingNights(s, true).length, tiers: pickupTiers(s, true).length };
    expect(sel).toEqual(weekDates(WEEK).slice(3)); expect(leaks).toEqual([]);
  });
  it("W2 adversarial: a team whose only games are Mon–Wed gets 0 remaining, no rank and appears on no card", () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date(WED));
    let target = "";
    const s = wednesday(schedule => {
      const games = schedule.games ?? Object.values(schedule.data ?? {}).flat();
      const first: any = (schedule.games ?? []).find((g: any) => MON_WED.includes(g.gameDate)); target = first.homeTeam.abbrev;
      // Drop the target team's Thu–Sun games.
      schedule.games = schedule.games.filter((g: any) => MON_WED.includes(g.gameDate) || (g.homeTeam.abbrev !== target && g.awayTeam.abbrev !== target));
      schedule.numGamesPerDay = weekDates(WEEK).map(d => schedule.games.filter((g: any) => g.gameDate === d).length);
    });
    const row = s.rows.find(r => r.team.abbreviation === target)!;
    const onEasiest = easiestSchedules(s, true).rows.some(r => r.team.abbreviation === target);
    const onStream = streamingNights(s, true).some(n => n.team.abbreviation === target);
    const onPickups = pickupTiers(s, true).some(t => [...t.groups.F, ...t.groups.D, ...t.groups.G].some(p => p.team === target));
    const onSpec = Object.values(specialists(s, true)).flat().some((p: any) => p.team === target);
    vi.useRealTimers();
    const gridRow = mondayGridRows(s, true).find(r => r.team.abbreviation === target) as any;
    observed.W2 = { gridRank: gridRow?.rank ?? null, target, state: s.state, remaining: row?.remainingGames, rank: row?.rank, onEasiest, onStream, onPickups, onSpec };
    expect(row.remainingGames).toBe(0); expect(onEasiest || onStream || onPickups || onSpec).toBe(false);
  });
});

describe("C7 SS1-6 Tuesday", () => {
  const now = "2026-10-27T13:00:00Z";
  // run1 passed an old ownToday as the fixture's "today", which also aged the game rows (reviewer error); now only ownership timelines shift.
  const tuesday = (metricsAt = "2026-10-27T08:00:00Z", ownShiftDays = 0) => {
    const s = buildScheduleSnapshot({ format: "tuesday-trends", weekStart: WEEK, generatedAt: now, schedule: fictionalLeagueWeek(WEEK, now) });
    const src = fictionalTrendSources(season, "2026-10-27", metricsAt);
    if (ownShiftDays) for (const row of src.ownership as any[]) row.ownership_timeline = (row.ownership_timeline ?? []).map((pt: any) => ({ ...pt, date: new Date(Date.parse(pt.date + "T00:00:00Z") - ownShiftDays * 86400000).toISOString().slice(0, 10) }));
    return { s: { ...s, trends: buildTrendLayer(src, { season, teams: s.teams, fetchedAt: now, generatedAt: now }) } as SocialShareSnapshot, src };
  };
  it("T1 every displayed delta equals its own last5 − season column on the latest strength-all row", () => {
    const { s, src } = tuesday(); const bad: string[] = [];
    const latest = (id: number) => src.rolling.filter((r: any) => r.player_id === id && r.strength_state === "all").sort((a: any, b: any) => a.game_date.localeCompare(b.game_date)).at(-1) as any;
    const hc = hotCold(s, true); for (const p of [...hc.hot, ...hc.cold]) { const r = latest(p.nhlId); if (Math.abs(p.delta - (r.points_avg_last5 - r.points_avg_season)) > 1e-9) bad.push(`pts ${p.nhlId}`); }
    const dc = deploymentChanges(s, true); for (const p of [...dc.up, ...dc.down]) { const r = latest(p.nhlId); if (Math.abs(p.delta - (r.toi_seconds_avg_last5 - r.toi_seconds_avg_season)) > 1e-6 && Math.abs(p.delta - (r.toi_seconds_avg_last5 - r.toi_seconds_avg_season) / 60) > 1e-6) bad.push(`toi ${p.nhlId}`); }
    const col = { sogPer60: ["sog_per_60_last5", "sog_per_60_season"], icfPer60: ["shot_attempts_per_60_last5", "shot_attempts_per_60_season"], ixgPer60: ["ixg_per_60_last5", "ixg_per_60_season"] } as const;
    const rs = rateStandouts(s, true); let underToi = 0;
    for (const [k, [a, b]] of Object.entries(col)) for (const p of (rs as any)[k]) { const r = latest(p.nhlId); if (Math.abs(p.delta - (r[a] - r[b])) > 1e-9) bad.push(`${k} ${p.nhlId}`); if (r.toi_seconds_total_last5 < MIN_RATE_TOI_SECONDS_LAST5) underToi++; }
    observed.T1 = { bad, underToi, counts: { hot: hc.hot.length, cold: hc.cold.length, up: dc.up.length, down: dc.down.length } };
    expect(bad).toEqual([]); expect(underToi).toBe(0);
  });
  it("T2 independent gates: stale metrics → stats cards empty, Movers still ranked; stale ownership → Movers empty, stats ranked", () => {
    const a = tuesday("2026-10-20T08:00:00Z").s, b = tuesday("2026-10-27T08:00:00Z", 12).s;
    const r = { staleMetrics: { state: a.trends!.state, moversState: a.trends!.moversState, hot: hotCold(a, true).hot.length, movers: ownershipMovers(a, true).risers.length },
      staleOwnership: { state: b.trends!.state, moversState: b.trends!.moversState, hot: hotCold(b, true).hot.length, movers: ownershipMovers(b, true).risers.length } };
    observed.T2 = r;
    expect(r.staleMetrics.hot).toBe(0); expect(r.staleMetrics.movers).toBeGreaterThan(0); expect(r.staleOwnership.movers).toBe(0); expect(r.staleOwnership.hot).toBeGreaterThan(0);
  });
  it("T3 server: tuesday-trends reads the schedule only (no team-rate read, no trend layer); blocked formats read nothing", async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date(now)); m.schedule.mockResolvedValue(fictionalLeagueWeek(WEEK, now)); m.rates.mockResolvedValue({});
    const t = await loadScheduleShareSnapshot("tuesday-trends", WEEK);
    const scheduleCalls = m.schedule.mock.calls.length, rateCalls = m.rates.mock.calls.length;
    const p = await loadScheduleShareSnapshot("player-spotlight" as any, WEEK);
    vi.useRealTimers();
    observed.T3 = { trendsLayer: t.trends ?? null, opponents: t.opponents ?? null, scheduleCalls, rateCalls, spotlightState: p.state, callsAfterSpotlight: m.schedule.mock.calls.length };
    expect(scheduleCalls).toBe(1); expect(rateCalls).toBe(0); expect(t.trends ?? null).toBeNull(); expect(m.schedule.mock.calls.length).toBe(1);
  });
  it("T4 movers layer carries no Yahoo key/timeline; adds/drops are not modeled", () => {
    const { s } = tuesday(); const json = JSON.stringify(s.trends);
    observed.T4 = { leak: /465\.p\.|ownership_timeline|player_key/.test(json), moverKeys: Object.keys(s.trends!.movers[0] ?? {}) };
    expect(json).not.toMatch(/465\.p\.|ownership_timeline|player_key/); expect(json).not.toMatch(/"adds"|"drops"/);
  });
});
