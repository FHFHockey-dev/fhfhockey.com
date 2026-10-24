// C7 independent controls for C4 SITE-WIGO workflow links. Reviewer scratch only.
import React from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { writeFileSync } from "node:fs";

const OUT = "/private/tmp/claude-501/-Users-tim-Code-fhfhockey-com/b948d22c-6ba8-446f-ba36-c2db70333467/scratchpad/c7/out/c4-observed.json";
const observed: Record<string, unknown> = {};
afterAll(() => writeFileSync(OUT, JSON.stringify(observed, null, 2)));

const s = vi.hoisted(() => ({ query: {} as Record<string, string>, player: null as null | { id: number; fullName: string }, abbr: null as string | null }));
vi.mock("next/router", () => ({ useRouter: () => ({ query: s.query, pathname: "/wigoCharts", replace: () => Promise.resolve(true), push: () => Promise.resolve(true) }) }));
vi.mock("components/WiGO/WigoDashboardSections", () => ({
  WigoDashboardHeader: () => <div />, WigoOverviewSection: () => <div />, WigoTrendsSection: () => <div />,
  WigoPercentilesSection: () => <div />, WigoComparisonSection: () => <div />,
}));
vi.mock("hooks/useWigoPlayerDashboard", () => ({
  default: () => ({ selectedPlayer: s.player, headshotUrl: null, currentSeasonId: 20262027,
    teamColors: { primaryColor: "#000", secondaryColor: "#111", accentColor: "#222", altColor: "#333", jerseyColor: "#444" },
    teamName: "", teamAbbreviation: s.abbr, teamIdForLog: null, rawCombinedData: [], isLoadingAggData: false, aggDataError: null,
    playerDataError: null, handlePlayerSelect: () => {}, updateUrlWith: async () => true }),
}));

import WigoCharts from "pages/wigoCharts";
import { getWigoSurfaceLinks } from "lib/navigation/siteSurfaceLinks";
import { teamsInfo, getTeamInfoById, teamNameToAbbreviationMap } from "lib/teamsInfo";

const section = () => screen.getByText(/WiGO workflow/i).closest("section") as HTMLElement;
beforeEach(() => { s.query = {}; s.player = null; s.abbr = null; Object.defineProperty(window, "innerWidth", { configurable: true, value: 1280 }); });
afterEach(cleanup);

describe("C4 WiGO links: IDs, context, Back", () => {
  it("W1 every teamsInfo team round-trips id → name → abbreviation → route-valid key", () => {
    const bad: unknown[] = [];
    for (const [key, info] of Object.entries(teamsInfo as Record<string, any>)) {
      const abbr = teamNameToAbbreviationMap[getTeamInfoById(info.id)!.name];
      const links = getWigoSurfaceLinks(abbr).map(l => l.href);
      if (abbr !== key || links[0] !== `/stats/team/${key}` || links[1] !== `/lines/${key}`) bad.push({ key, abbr, links: links.slice(0, 2) });
    }
    observed.W1 = { teams: Object.keys(teamsInfo).length, mismatches: bad };
    expect(bad).toEqual([]);
  });
  it("W2 league-wide links carry no player/team context although their copy promises it", () => {
    s.player = { id: 8478402, fullName: "Synthetic Player" }; s.abbr = "EDM";
    render(<WigoCharts />);
    const links = within(section()).getAllByRole("link").map(a => ({ href: a.getAttribute("href"), text: a.textContent }));
    observed.W2 = links;
    const start = links.find(l => l.href?.startsWith("/start-chart"))!;
    expect(start.href).toBe("/start-chart");
    expect(start.text).toMatch(/player and team context/i);
    expect(links.every(l => !/8478402|playerId|team=/.test(l.href!))).toBe(true);
  });
  it("W3 player selected but team unresolved: heading names the player while copy says 'Select a player'", () => {
    s.player = { id: 8478402, fullName: "Synthetic Player" }; s.abbr = null;
    render(<WigoCharts />);
    const text = section().textContent!;
    observed.W3 = { text };
    expect(text).toMatch(/Take the Synthetic Player read further/);
    expect(text).toMatch(/Select a player to add their team HQ/);
  });
  it("W4 links are plain push anchors (no replace / target / rel tricks); URL already holds playerId+tab", () => {
    s.query = { playerId: "8478402", tab: "trends" }; s.player = { id: 8478402, fullName: "Synthetic Player" }; s.abbr = "TOR";
    render(<WigoCharts />);
    const anchors = within(section()).getAllByRole("link");
    observed.W4 = anchors.map(a => ({ href: a.getAttribute("href"), target: a.getAttribute("target"), rel: a.getAttribute("rel") }));
    for (const a of anchors) { expect(a.getAttribute("target")).toBeNull(); expect(a.getAttribute("href")!.startsWith("/")).toBe(true); }
  });
  it("W5 exactly one workflow section at desktop and at mobile widths", () => {
    for (const w of [1280, 769, 768, 375]) {
      Object.defineProperty(window, "innerWidth", { configurable: true, value: w });
      render(<WigoCharts />);
      const n = screen.queryAllByText(/WiGO workflow/i).length;
      (observed.W5 ??= {} as any)[w] = n; expect(n).toBe(1); cleanup();
    }
  });
});
