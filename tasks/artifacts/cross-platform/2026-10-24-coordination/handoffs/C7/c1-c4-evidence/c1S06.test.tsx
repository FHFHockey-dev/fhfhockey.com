// C7 independent controls for C1 STATS-S06 (lines placement, inactive reads, stale team). Reviewer scratch only.
import React from "react";
import { act, cleanup, render, screen, within } from "@testing-library/react";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { writeFileSync } from "node:fs";

const OUT = "/private/tmp/claude-501/-Users-tim-Code-fhfhockey-com/b948d22c-6ba8-446f-ba36-c2db70333467/scratchpad/c7/out/c1-observed.json";
const observed: Record<string, unknown> = {};
afterAll(() => writeFileSync(OUT, JSON.stringify(observed, null, 2)));

const h = vi.hoisted(() => {
  type Deferred = { resolve: (v: any) => void; table: string; arg: unknown };
  const pending: Deferred[] = [];
  const calls: { table: string; arg: unknown }[] = [];
  const fromMock = (table: string) => {
    const chain: any = {};
    let arg: unknown = null;
    const settle = () => new Promise(resolve => { pending.push({ resolve, table, arg }); });
    chain.select = () => chain;
    chain.eq = (_c: string, v: unknown) => { arg = v; return chain; };
    chain.order = () => chain;
    chain.limit = () => { calls.push({ table, arg }); return settle(); };
    chain.in = (_c: string, v: unknown) => { arg = v; calls.push({ table, arg }); return settle(); };
    return chain;
  };
  return { pending, calls, fromMock, routerState: { isReady: true, pathname: "/stats/team/[teamAbbreviation]", query: {} as Record<string, unknown>, replace: () => Promise.resolve(true) },
    lineProps: [] as any[] };
});

vi.mock("next/router", () => ({ useRouter: () => h.routerState }));
vi.mock("lib/supabase", () => ({ default: { from: h.fromMock } }));
vi.mock("hooks/useTeamSchedule", () => ({ useTeamSchedule: () => ({ games: [], loading: false, error: null, record: null, standingsDetails: null, scheduleTeam: null }) }));
vi.mock("components/TeamDashboard/TeamDashboard", () => ({ TeamDashboard: () => <div>dash</div> }));
vi.mock("components/GameStateAnalysis/GameStateAnalysis", () => ({ GameStateAnalysis: () => <div>gs</div> }));
vi.mock("components/MetricsTimeline/MetricsTimeline", () => ({ default: () => <div>mt</div> }));
vi.mock("components/RosterMatrix/RosterMatrixWrapper", () => ({ default: () => <div>rm</div> }));
vi.mock("components/ShotVisualization/ShotVisualization", () => ({ ShotVisualization: () => <div>shots</div> }));
vi.mock("components/TeamScheduleCalendar/TeamScheduleCalendar", () => ({ TeamScheduleCalendar: () => <div>cal</div> }));
vi.mock("components/LineCombinations/LineCombinationsGrid", async (orig) => {
  const real: any = await orig();
  return { LineCombinationsGrid: (p: any) => { h.lineProps.push(p); return <real.LineCombinationsGrid {...p} />; } };
});

import { TeamTabNavigation } from "components/TeamTabNavigation/TeamTabNavigation";
const { LineCombinationsGrid } = await vi.importActual<any>("components/LineCombinations/LineCombinationsGrid");

const ids = (prefix: number, n: number) => Array.from({ length: n }, (_, i) => String(prefix + i + 1));
function sectionIds(label: string) {
  const labelEl = screen.getByText(label, { selector: "div" });
  return within(labelEl.parentElement as HTMLElement).queryAllByRole("link").map(a => a.getAttribute("href")!.split("/").pop());
}
const tick = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });
async function resolveNext(table: string, value: any, arg?: unknown) {
  const i = h.pending.findIndex(p => p.table === table && (arg === undefined || JSON.stringify(p.arg) === JSON.stringify(arg)));
  if (i < 0) throw new Error(`no pending ${table} ${JSON.stringify(arg)}`);
  const [d] = h.pending.splice(i, 1);
  await act(async () => { d.resolve(value); await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); });
}
const lineRow = (team: number) => ({ data: [{ forwards: ids(team * 100, 12), defensemen: ids(team * 100 + 50, 6), goalies: ids(team * 100 + 90, 2), gameId: 2026020001 }], error: null });
const props = (teamId: string) => ({ teamId, teamAbbrev: "X", seasonId: "20262027", filters: {}, onFilterChange: () => {}, summaries: [] } as any);

afterEach(() => { cleanup(); h.pending.splice(0); h.calls.splice(0); h.lineProps.splice(0); });
beforeEach(() => { h.routerState.query = {}; });

describe("C1 LineCombinationsGrid placement", () => {
  it.each([
    ["12F/6D", 12, 6], ["11F/7D", 11, 7], ["13F/5D", 13, 5], ["14F/4D", 14, 4], ["10F/8D", 10, 8], ["13F/6D (19 skaters)", 13, 6], ["12F/7D (19 skaters)", 12, 7],
  ])("L1 %s", (name, f, d) => {
    const forwards = ids(100, f), defensemen = ids(500, d);
    render(<LineCombinationsGrid forwards={forwards} defensemen={defensemen} goalies={["901", "902"]} playerMap={{}} />);
    const fwdSection = sectionIds("Forwards"), defSection = sectionIds("Defense");
    const shown = new Set([...fwdSection, ...defSection]);
    const dropped = [...forwards, ...defensemen].filter(x => !shown.has(x));
    const forwardsInDefense = defSection.filter(x => forwards.includes(x!));
    const defenseInForwards = fwdSection.filter(x => defensemen.includes(x!));
    observed[`L1 ${name}`] = { forwardsInDefenseSection: forwardsInDefense, defensemenInForwardSection: defenseInForwards, dropped };
    if (f + d <= 18) expect(dropped).toEqual([]);
  });
  it("L2 13F/5D with no player-map row: the extra forward's card under 'Defense' carries no position cue", () => {
    render(<LineCombinationsGrid forwards={ids(100, 13)} defensemen={ids(500, 5)} goalies={["901"]} playerMap={{}} />);
    const defLabel = screen.getByText("Defense", { selector: "div" });
    const link = within(defLabel.parentElement as HTMLElement).getByRole("link", { name: /113/ });
    const card = link.parentElement as HTMLElement;
    observed.L2 = { cardText: card.textContent, href: link.getAttribute("href"), sectionLabel: "Defense" };
    expect(card.textContent).toBe("113");
  });
});

describe("C1 inactive-tab read gating and stale-team guard", () => {
  it("G1 non-stats tabs make zero lineCombinations / player-map reads", async () => {
    const r = render(<TeamTabNavigation {...props("10")} />); await tick();
    for (const tab of ["schedule", "analysis", "timeline", "roster", "visualization"]) { h.routerState.query = { tab }; r.rerender(<TeamTabNavigation {...props("10")} />); await tick(); }
    observed.G1 = { calls: [...h.calls] }; expect(h.calls).toEqual([]);
  });
  it("G2 stats tab reads once; leaving and returning for the same team reuses the result", async () => {
    h.routerState.query = { tab: "stats" };
    const r = render(<TeamTabNavigation {...props("10")} />); await tick();
    await resolveNext("lineCombinations", lineRow(10)); await resolveNext("yahoo_nhl_player_map", { data: [], error: null });
    h.routerState.query = { tab: "roster" }; r.rerender(<TeamTabNavigation {...props("10")} />); await tick();
    h.routerState.query = { tab: "stats" }; r.rerender(<TeamTabNavigation {...props("10")} />); await tick();
    observed.G2 = { calls: h.calls.map(c => c.table) };
    expect(h.calls.map(c => c.table)).toEqual(["lineCombinations", "yahoo_nhl_player_map"]);
  });
  it("G3 late line response for team A after switching to B is discarded and never triggers A's player-map read", async () => {
    h.routerState.query = { tab: "stats" };
    const r = render(<TeamTabNavigation {...props("10")} />); await tick();
    r.rerender(<TeamTabNavigation {...props("22")} />); await tick();
    await resolveNext("lineCombinations", lineRow(22), 22);
    await resolveNext("yahoo_nhl_player_map", { data: [], error: null });
    await resolveNext("lineCombinations", lineRow(10), 10); // late A
    const last = h.lineProps.at(-1);
    observed.G3 = { calls: h.calls, lastGridForwardsHead: last?.forwards.slice(0, 2) };
    expect(last.forwards[0]).toBe("2201");
    expect(h.calls.filter(c => c.table === "yahoo_nhl_player_map")).toHaveLength(1);
    expect(screen.queryByRole("link", { name: /^1001$/ })).toBeNull();
  });
  it("G4 late player-map response for A after switching to B does not render A", async () => {
    h.routerState.query = { tab: "stats" };
    const r = render(<TeamTabNavigation {...props("10")} />); await tick();
    await resolveNext("lineCombinations", lineRow(10), 10);           // A lines done, A map pending
    r.rerender(<TeamTabNavigation {...props("22")} />); await tick();
    await resolveNext("yahoo_nhl_player_map", { data: [{ nhl_player_id: 1001, nhl_player_name: "Stale Alpha" }], error: null }, ids(1000, 12).concat(ids(1050, 6), ids(1090, 2)));
    observed.G4a = { gridRendersAfterStale: h.lineProps.length, staleNameVisible: !!screen.queryByText(/Stale/) };
    expect(screen.queryByText(/Stale/)).toBeNull(); expect(h.lineProps).toHaveLength(0);
    await resolveNext("lineCombinations", lineRow(22), 22); await resolveNext("yahoo_nhl_player_map", { data: [], error: null });
    expect(h.lineProps.at(-1).forwards[0]).toBe("2201");
  });
  it("G5 leaving the tab mid-flight drops the response; returning refetches and renders correctly", async () => {
    h.routerState.query = { tab: "stats" };
    const r = render(<TeamTabNavigation {...props("10")} />); await tick();
    h.routerState.query = { tab: "roster" }; r.rerender(<TeamTabNavigation {...props("10")} />); await tick();
    await resolveNext("lineCombinations", lineRow(10), 10);
    const mapReadsWhileInactive = h.calls.filter(c => c.table === "yahoo_nhl_player_map").length;
    h.routerState.query = { tab: "stats" }; r.rerender(<TeamTabNavigation {...props("10")} />); await tick();
    await resolveNext("lineCombinations", lineRow(10), 10); await resolveNext("yahoo_nhl_player_map", { data: [], error: null });
    observed.G5 = { calls: h.calls.map(c => c.table), mapReadsWhileInactive };
    expect(mapReadsWhileInactive).toBe(0); expect(h.lineProps.at(-1).forwards[0]).toBe("1001");
  });
  it("G6 an error is shown, and re-entering the tab retries", async () => {
    h.routerState.query = { tab: "stats" };
    const r = render(<TeamTabNavigation {...props("10")} />); await tick();
    await resolveNext("lineCombinations", { data: null, error: { message: "synthetic failure" } });
    const shown = !!screen.queryByText("synthetic failure");
    h.routerState.query = { tab: "roster" }; r.rerender(<TeamTabNavigation {...props("10")} />); await tick();
    h.routerState.query = { tab: "stats" }; r.rerender(<TeamTabNavigation {...props("10")} />); await tick();
    observed.G6 = { errorShown: shown, lineReads: h.calls.filter(c => c.table === "lineCombinations").length };
    expect(shown).toBe(true); expect(h.calls.filter(c => c.table === "lineCombinations")).toHaveLength(2);
  });
  it("G7 null / blank / nested IDs never become player links", async () => {
    h.routerState.query = { tab: "stats" };
    render(<TeamTabNavigation {...props("10")} />); await tick();
    await resolveNext("lineCombinations", { data: [{ forwards: [["101", null], ["", " ", "102"], null], defensemen: [null, "501"], goalies: [undefined, "901"], gameId: 1 }], error: null });
    await resolveNext("yahoo_nhl_player_map", { data: [], error: null });
    const hrefs = screen.getAllByRole("link").map(a => a.getAttribute("href"));
    observed.G7 = { hrefs, mapReadArg: h.calls.find(c => c.table === "yahoo_nhl_player_map")?.arg };
    expect(hrefs.every(x => /\/stats\/player\/\d+$/.test(x!))).toBe(true);
  });
});
