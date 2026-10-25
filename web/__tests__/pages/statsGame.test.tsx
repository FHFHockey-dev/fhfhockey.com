import React from "react";
import type { GetServerSidePropsContext } from "next";
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const router = vi.hoisted(() => ({ isReady: true, query: { gameId: "2026020001" as string | string[] | undefined } }));
vi.mock("next/router", () => ({ useRouter: () => router }));
vi.mock("next/head", () => ({ default: () => null }));
vi.mock("components/StatsPage/PlayerSearchBar", () => ({ default: () => null }));

import GameStatsPage, { getServerSideProps } from "pages/stats/game/[gameId]";

const game = (gameState = "OFF") => ({
  id: 2026020001, gameDate: "2026-10-15", gameState,
  awayTeam: { id: 6, abbrev: "BOS", score: 0 },
  homeTeam: { id: 10, abbrev: "TOR", score: 0 },
});
const response = (data: unknown, status = 200) => ({ ok: status < 400, status, json: async () => data }) as Response;
const fetchMock = vi.fn();
let boxscore: unknown;
let rail: unknown;
let schedule: unknown;

beforeEach(() => {
  router.isReady = true;
  router.query.gameId = "2026020001";
  boxscore = { success: true, data: game() };
  rail = { seasonSeries: [], teamGameStats: [] };
  schedule = { gameWeek: [{ games: [] }] };
  fetchMock.mockReset().mockImplementation(async (url: string) => {
    if (url.endsWith("/boxscore")) return response(boxscore);
    if (url.endsWith("/right-rail")) return response(rail);
    if (url.startsWith("/api/v1/schedule/date/")) return response(schedule);
    throw new Error(`Unexpected fixture request: ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

function mount() {
  return render(<SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0, shouldRetryOnError: false, revalidateOnFocus: false }}><GameStatsPage /></SWRConfig>);
}
async function settled() {
  await waitFor(() => expect(screen.queryByText("Loading...")).toBeNull());
}
function panel(name: string) {
  return within(screen.getByRole("heading", { name }).closest("section")!);
}

describe("stats game route admission and envelopes", () => {
  it.each([undefined, "abc", "0", " 2026020001", "2026020001/../x", ["2026020001", "2026020002"]].map((id) => ({ id })))(
    "does not fetch an invalid or ambiguous route ID: $id", async ({ id }) => {
      router.query.gameId = id;
      mount();
      await act(async () => {});
      expect(fetchMock).not.toHaveBeenCalled();
      expect(screen.getByText("Invalid game ID.")).toBeTruthy();
    },
  );

  it("returns notFound for an invalid server route before any request", async () => {
    const result = await getServerSideProps({ params: { gameId: "not-a-game" } } as unknown as GetServerSidePropsContext);
    expect(result).toEqual({ notFound: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("admits the valid server route without fetching on the server", async () => {
    expect(await getServerSideProps({ params: { gameId: "2026020001" } } as unknown as GetServerSidePropsContext)).toEqual({ props: {} });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("recognizes the API's HTTP-200 failure envelope and preserves the independent rail panel", async () => {
    boxscore = { success: false, message: "Cannot get the boxscore data", data: null };
    rail = { seasonSeries: [game("LIVE")], teamGameStats: [{ category: "sog", awayValue: 0, homeValue: 3 }] };
    mount();
    await settled();
    expect(screen.getByText("Boxscore could not be loaded.")).toBeTruthy();
    expect(panel("Team Game Stats").getByText("Shots on Goal")).toBeTruthy();
    expect(panel("Team Game Stats").getByText("0")).toBeTruthy();
  });

  it.each([null, {}, { success: true, data: null }])("settles a successful empty boxscore: %j", async (payload) => {
    boxscore = payload;
    mount();
    await settled();
    expect(screen.getByText("Game data is unavailable for this id.")).toBeTruthy();
    expect(screen.queryByText("Boxscore could not be loaded.")).toBeNull();
  });

  it("keeps a valid boxscore visible while the optional right rail is pending", async () => {
    fetchMock.mockImplementation((url: string) => url.endsWith("/right-rail")
      ? new Promise<Response>(() => {})
      : Promise.resolve(response(url.endsWith("/boxscore") ? boxscore : schedule)));
    mount();
    expect(await screen.findByText("Final")).toBeTruthy();
    expect(screen.queryByText("Loading...")).toBeNull();
  });

  it("keeps boxscore players when right rail fails and does not invent context records", async () => {
    boxscore = { success: true, data: { ...game(), playerByGameStats: { awayTeam: { forwards: [{ playerId: 11, name: { default: "Known Player" }, points: 1, sog: 0 }] } } } };
    fetchMock.mockImplementation(async (url: string) => url.endsWith("/right-rail") ? response({ error: "synthetic failure" }, 503) : response(url.endsWith("/boxscore") ? boxscore : schedule));
    mount();
    await settled();
    expect(screen.getByText("Known Player")).toBeTruthy();
    expect(screen.getByText("Team game context could not be loaded.")).toBeTruthy();
    expect(screen.queryByText("Away (0-0-0)")).toBeNull();
    expect(screen.queryByText("First meeting of the season.")).toBeNull();
  });

  it("uses rail identity with a partial boxscore while preserving known player IDs", async () => {
    rail = { seasonSeries: [game("LIVE")] };
    boxscore = { success: true, data: { id: 2026020001, playerByGameStats: { awayTeam: { forwards: [{ playerId: 11, name: { default: "Known Player" }, points: 1, sog: 0 }] } } } };
    mount();
    await settled();
    expect(screen.getByText("Known Player")).toBeTruthy();
    expect(screen.getByText("Live")).toBeTruthy();
  });

  it("reports failures rather than a successful empty game when both sources fail", async () => {
    fetchMock.mockResolvedValue(response({ error: "synthetic failure" }, 503));
    mount();
    await settled();
    expect(screen.getByText("Game data could not be loaded.")).toBeTruthy();
    expect(screen.queryByText("Game data is unavailable for this id.")).toBeNull();
  });

  it("does not admit another game's boxscore or query its date", async () => {
    boxscore = { success: true, data: { ...game(), id: 2026020002 } };
    mount();
    await settled();
    expect(screen.getByText("Game data is unavailable for this id.")).toBeTruthy();
    expect(fetchMock.mock.calls.some(([url]) => url.includes("/schedule/"))).toBe(false);
  });
});

describe("stats game route state and missing values", () => {
  it.each([
    ["FUT", "Scheduled"], ["PRE", "Pregame"], ["LIVE", "Live"], ["CRIT", "Live"],
    ["OFF", "Final"], ["OVER", "Final"], ["FINAL", "Final"], ["unknown", "Status unavailable"],
  ])("labels %s explicitly as %s", async (state, label) => {
    boxscore = { success: true, data: game(state) };
    mount();
    await settled();
    expect(screen.getByText(label)).toBeTruthy();
  });

  it("uses the current boxscore state ahead of a season-series snapshot", async () => {
    rail = { seasonSeries: [game("FUT")] };
    mount();
    await settled();
    expect(screen.getByText("Final")).toBeTruthy();
  });

  it("preserves zero scores without presenting them as market probabilities or a home win", async () => {
    rail = { seasonSeries: [game()] };
    mount();
    await settled();
    expect(panel("Implied Win Probability").getAllByText("Score: 0")).toHaveLength(2);
    expect(panel("Implied Win Probability").queryByText("BOS 50%")).toBeNull();
    expect(panel("Implied Win Probability").getByText("Market odds unavailable.")).toBeTruthy();
    expect(panel("Recent Head-to-Head").queryByText("TOR Win")).toBeNull();
    expect(panel("Recent Head-to-Head").getByText("Result unavailable")).toBeTruthy();
  });

  it("includes OVER results and requires both scores before naming a winner", async () => {
    rail = { seasonSeries: [
      { ...game("OVER"), id: 2026020002, awayTeam: { id: 6, abbrev: "BOS", score: 0 }, homeTeam: { id: 10, abbrev: "TOR", score: 2 } },
      { ...game(), id: 2026020003, awayTeam: { id: 6, abbrev: "BOS", score: null } },
    ] };
    mount();
    await settled();
    expect(panel("Recent Head-to-Head").getAllByText("TOR Win")).toHaveLength(1);
    expect(panel("Recent Head-to-Head").getByText("Result unavailable")).toBeTruthy();
  });

  it("does not paint equal-strength bars for absent statistics", async () => {
    mount();
    await settled();
    const strengths = screen.getByRole("heading", { name: "Team Strengths" }).closest("section")!;
    expect(strengths.querySelectorAll('[style*="width: 50%"]')).toHaveLength(0);
  });

  it.each([
    ["-150", "+130", "BOS 58%", "TOR 42%"],
    ["2.0", "3.0", "BOS 60%", "TOR 40%"],
  ])("retains valid market probabilities from %s / %s", async (away, home, awayLabel, homeLabel) => {
    schedule = { gameWeek: [{ games: [{ ...game(), startTimeUTC: "2026-10-15T23:00:00Z", awayTeam: { odds: [{ providerId: 9, value: away }] }, homeTeam: { odds: [{ providerId: 9, value: home }] } }] }] };
    mount();
    expect(await screen.findByText(awayLabel)).toBeTruthy();
    expect(panel("Implied Win Probability").getByText(homeLabel)).toBeTruthy();
    expect(panel("Implied Win Probability").getAllByText("Score: 0")).toHaveLength(2);
  });

  it.each([undefined, "invalid", "+120junk", "1", "-0"])("does not substitute a probability for absent/invalid odds: %s", async (value) => {
    schedule = { gameWeek: [{ games: [{ ...game(), startTimeUTC: "2026-10-15T23:00:00Z", awayTeam: { odds: [{ providerId: 9, value }] }, homeTeam: { odds: [{ providerId: 9, value: "+130" }] } }] }] };
    mount();
    await settled();
    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => url.includes("/schedule/"))).toBe(true));
    await act(async () => {});
    expect(panel("Implied Win Probability").getByText("Market odds unavailable.")).toBeTruthy();
  });

  it("preserves separate same-name players by ID and distinguishes zero from unknown counts", async () => {
    boxscore = { success: true, data: { ...game(), playerByGameStats: { awayTeam: { forwards: [
      { playerId: 11, name: { default: "Same Name" }, points: 0, sog: 0 },
      { playerId: 12, name: { default: "Same Name" }, points: null, sog: null },
    ] } } } };
    mount();
    await settled();
    expect(panel("Top Skaters").getAllByText("Same Name")).toHaveLength(2);
    expect(panel("Top Skaters").getByText("0P / 0 SOG")).toBeTruthy();
    expect(panel("Top Skaters").getByText("-P / - SOG")).toBeTruthy();
  });
});
