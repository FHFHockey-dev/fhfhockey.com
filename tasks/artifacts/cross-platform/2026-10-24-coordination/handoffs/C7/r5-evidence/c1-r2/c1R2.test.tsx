// C7 R2 controls for C1 S06-R1 (C1-F1/F2 repair) and S05 (withheld retry, narrow fallback team).
import React from "react";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { writeFileSync } from "node:fs";

const OUT = process.env.C7_C1R2_OUT; const observed: Record<string, unknown> = {};
afterAll(() => { if (OUT) writeFileSync(OUT, JSON.stringify(observed, null, 2)); });
const m = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock("lib/cors-fetch", () => ({ default: m.fetch }));
vi.mock("react-chartjs-2", () => ({ Doughnut: ({ data }: any) => <pre data-testid="chart">{JSON.stringify(data)}</pre> }));
import { LineCombinationsGrid } from "components/LineCombinations/LineCombinationsGrid";
import GoalieShareChart from "components/GoalieShareChart";

const ids = (p: number, n: number) => Array.from({ length: n }, (_, i) => String(p + i + 1));
const linkIds = (el: HTMLElement) => within(el).queryAllByRole("link").map(a => a.getAttribute("href")!.split("/").pop()!);
afterEach(cleanup);

describe("S06-R1 overflow truthfulness", () => {
  it.each([["12F/6D", 12, 6, 2], ["11F/7D", 11, 7, 2], ["13F/5D", 13, 5, 2], ["14F/4D", 14, 4, 2], ["10F/8D", 10, 8, 2], ["13F/6D", 13, 6, 2], ["12F/7D", 12, 7, 2], ["12F/6D+3G", 12, 6, 3], ["9F/9D", 9, 9, 2], ["0F/0D", 0, 0, 0]])("R2-L %s", (name, f, d, g) => {
    const F = ids(100, f), D = ids(500, d), G = ids(900, g);
    render(<LineCombinationsGrid forwards={F} defensemen={D} goalies={G} playerMap={{}} />);
    const fwd = screen.getByRole("group", { name: "Forwards" }), def = screen.getByRole("group", { name: "Defense" }), gk = screen.getByRole("group", { name: "Goalies" });
    const inF = linkIds(fwd), inD = linkIds(def), inG = linkIds(gk);
    const extras = screen.queryAllByRole("group").filter(e => /^Extra/.test(e.getAttribute("aria-label") ?? "")).map(e => ({ label: e.getAttribute("aria-label"), ids: linkIds(e), title: e.getAttribute("title") }));
    const shown = new Set([...inF, ...inD, ...inG]);
    observed[`R2-L ${name}`] = { forwardSectionHasD: inF.filter(x => D.includes(x)), defenseSectionHasF: inD.filter(x => F.includes(x)), dropped: [...F, ...D, ...G].filter(x => !shown.has(x)), extras };
    expect(inF.filter(x => !F.includes(x))).toEqual([]); expect(inD.filter(x => !D.includes(x))).toEqual([]); expect(inG.filter(x => !G.includes(x))).toEqual([]);
    expect([...F, ...D, ...G].filter(x => !shown.has(x))).toEqual([]);
    expect(inF.length + inD.length + inG.length).toBe(f + d + g);
  });
});

describe("S05 goalie workload retry and narrow fallback", () => {
  const rows = (team: string, n: number, base = 0) => Array.from({ length: n }, (_, i) => ({ gameId: base + i + 1, gameDate: new Date(Date.UTC(2025, 9, 1 + i)).toISOString().slice(0, 10), teamAbbrev: team,
    playerId: base + (i % 2) + 1, goalieFullName: `G ${team} ${i % 2}`, gamesPlayed: 1, wins: 0, losses: 0, otLosses: 0, saves: 27, shotsAgainst: 30, goalsAgainst: 3, timeOnIce: 3600 }));
  const all = [...rows("BOS", 60, 0), ...rows("PHI", 60, 1000)];
  const resp = (data: unknown, status = 200) => ({ ok: status === 200, status, json: async () => data });
  let failing = true;
  beforeEach(() => { vi.useFakeTimers(); vi.spyOn(console, "warn").mockImplementation(() => {}); vi.spyOn(console, "error").mockImplementation(() => {}); failing = true;
    m.fetch.mockImplementation(async (url: string) => { const u = new URL(url); if (u.pathname.endsWith("/season")) return resp({ data: [{ id: 20252026 }] });
      const start = Number(u.searchParams.get("start")); return failing && start === 100 ? resp({}, 429) : resp({ total: all.length, data: all.slice(start, start + 100) }); }); });
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.resetAllMocks(); });
  const settle = () => act(async () => { await vi.advanceTimersByTimeAsync(3000); });
  it("R2-S1 withheld → Try again → complete; a second failure stays withheld with the retry offered again", async () => {
    render(<GoalieShareChart />); await settle();
    const firstCalls = m.fetch.mock.calls.length; const alert1 = screen.getByRole("alert").textContent;
    expect(screen.queryAllByTestId("chart")).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Try again" })); await settle();
    const secondFailCalls = m.fetch.mock.calls.length - firstCalls;
    expect(screen.queryAllByTestId("chart")).toHaveLength(0); expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
    failing = false; fireEvent.click(screen.getByRole("button", { name: "Try again" })); await settle();
    observed["R2-S1"] = { alert1, firstRunCalls: firstCalls, secondFailedRunCalls: secondFailCalls, charts: screen.queryAllByTestId("chart").length, alertAfter: screen.queryByRole("alert")?.textContent ?? null };
    expect(screen.queryByRole("alert")).toBeNull(); expect(screen.queryAllByTestId("chart").length).toBeGreaterThan(0);
  });
  it("R2-S2 narrow view: default/selected team without data falls back to a team with data; selector shows the shown team", async () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 }); failing = false;
    render(<GoalieShareChart />); await settle();
    const select = screen.getByRole("combobox", { name: "Team" }) as HTMLSelectElement;
    const options = Array.from(select.options).map(o => o.value);
    const charts = screen.queryAllByTestId("chart").length;
    observed["R2-S2"] = { selectValue: select.value, options, charts };
    expect(options.sort()).toEqual(["BOS", "PHI"]); expect(options).toContain(select.value); expect(charts).toBeGreaterThan(0);
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1024 });
  });
  it("R2-S3 narrow view hides the team selector while withheld", async () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
    render(<GoalieShareChart />); await settle();
    observed["R2-S3"] = { selector: !!screen.queryByRole("combobox", { name: "Team" }), alert: !!screen.queryByRole("alert") };
    expect(screen.queryByRole("combobox", { name: "Team" })).toBeNull(); expect(screen.getByRole("alert")).toBeTruthy();
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1024 });
  });
});
