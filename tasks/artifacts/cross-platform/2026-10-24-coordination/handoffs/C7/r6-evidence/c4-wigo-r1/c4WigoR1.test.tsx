// C7 independent controls for C4 SITE-WIGO workflow links. Reviewer scratch only.
import React from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { writeFileSync } from "node:fs";

const OUT = "/private/tmp/claude-501/-Users-tim-Code-fhfhockey-com/b948d22c-6ba8-446f-ba36-c2db70333467/scratchpad/c7/out/c4r1-observed.json";
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
  it("W3-R1 player selected, team unresolved: heading names the player and the copy no longer says 'Select a player'", () => {
    s.player = { id: 8478402, fullName: "Synthetic Player" }; s.abbr = null;
    render(<WigoCharts />);
    const text = section().textContent!; observed["W3-R1"] = { text };
    expect(text).toMatch(/Take the Synthetic Player read further/);
    expect(text).not.toMatch(/Select a player/);
    expect(text).toMatch(/appear once this player's team is known/);
    expect(within(section()).getAllByRole("link").map(a => a.getAttribute("href"))).toEqual(["/trends", "/game-grid/7-Day-Forecast", "/start-chart"]);
  });
  it("W3-R1b no player keeps 'Select a player'; resolved team keeps the team copy", () => {
    render(<WigoCharts />); expect(section().textContent).toMatch(/Select a player to add their team HQ/); cleanup();
    s.player = { id: 1, fullName: "P" }; s.abbr = "TOR"; render(<WigoCharts />);
    expect(section().textContent).toMatch(/Open TOR team context/); expect(section().textContent).not.toMatch(/Select a player/);
  });
});
