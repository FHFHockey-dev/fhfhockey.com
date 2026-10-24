import React from "react";
import type { GetServerSidePropsContext } from "next";
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const router = vi.hoisted(() => ({ isReady: true, query: { gameId: "2026020001" as string | string[] | undefined } }));
vi.mock("next/router", () => ({ useRouter: () => router }));
vi.mock("next/head", () => ({ default: () => null }));
vi.mock("components/StatsPage/PlayerSearchBar", () => ({ default: () => null }));
import GameStatsPage, { getServerSideProps } from "pages/stats/game/[gameId]";

const A = "2026020001", B = "2026020002";
const date = (id: string) => id === A ? "2026-10-15" : "2026-10-16";
const url = (id: string, endpoint: string) => `/api/v1/game/${id}/${endpoint}`;
const scheduleUrl = (id: string) => `/api/v1/schedule/date/${date(id)}`;
const game = (id: string) => ({
  id: Number(id), gameDate: date(id), gameState: "OFF",
  awayTeam: { id: 6, abbrev: `AW-${id}`, score: 0 },
  homeTeam: { id: 10, abbrev: `HM-${id}`, score: 2 },
});
const box = (id: string) => ({ success: true, data: {
  ...game(id), playerByGameStats: { awayTeam: { forwards: [{ playerId: 11, name: { default: `${id} player` }, points: 0, sog: 0 }] } },
} });
const rail = (id: string) => ({ seasonSeries: [game(id)], teamGameStats: [{ category: "sog", awayValue: 0, homeValue: 2 }], last10Record: { awayTeam: { record: `${id} record` } } });
const response = (data: unknown, status = 200) => ({ ok: status < 400, status, json: async () => data }) as Response;
const fetchMock = vi.fn();
let handlers: Map<string, () => Promise<Response>>;
function hold(target: string) {
  let resolve!: (value: Response) => void;
  const promise = new Promise<Response>(yes => { resolve = yes; });
  handlers.set(target, () => promise);
  return (value: unknown, status = 200) => resolve(response(value, status));
}
beforeEach(() => {
  router.isReady = true; router.query.gameId = A;
  handlers = new Map(); fetchMock.mockReset();
  fetchMock.mockImplementation(async (target: string) => {
    const custom = handlers.get(target); if (custom) return custom();
    for (const id of [A, B]) {
      if (target === url(id, "boxscore")) return response(box(id));
      if (target === url(id, "right-rail")) return response(rail(id));
      if (target === scheduleUrl(id)) return response({ gameWeek: [{ games: [] }] });
    }
    throw new Error(`Unexpected isolated request: ${target}`);
  });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
function mount() {
  const cache = new Map();
  const config = { provider: () => cache, dedupingInterval: 0, shouldRetryOnError: false, revalidateOnFocus: false };
  const tree = () => <SWRConfig value={config}><GameStatsPage /></SWRConfig>;
  const view = render(tree());
  return { ...view, route: (id: typeof router.query.gameId) => { router.query.gameId = id; view.rerender(tree()); } };
}
const requested = async (target: string) => { await waitFor(() => expect(fetchMock.mock.calls.some(([value]) => value === target)).toBe(true)); };
const panel = (name: string) => within(screen.getByRole("heading", { name }).closest("section")!);

it.each([[A], "0202602000", "20260200010", "２０２６０２０００１"].map(id => ({ id })))("rejects additional ambiguous or malformed client/server ID $id without fetching", async ({ id }) => {
  router.query.gameId = id; mount();
  await act(async () => {});
  expect(screen.getByText("Invalid game ID.")).toBeTruthy();
  expect(await getServerSideProps({ params: { gameId: id } } as unknown as GetServerSidePropsContext)).toEqual({ notFound: true });
  expect(fetchMock).not.toHaveBeenCalled();
});

it.each(["success", "failure"])("isolates late A %s while B is loading and then shows B independently of its pending rail", async outcome => {
  const oldBox = hold(url(A, "boxscore")), oldRail = hold(url(A, "right-rail"));
  const newBox = hold(url(B, "boxscore")), newRail = hold(url(B, "right-rail"));
  const view = mount(); await requested(url(A, "boxscore"));
  view.route(B); await requested(url(B, "boxscore"));
  await act(async () => {
    oldBox(outcome === "success" ? box(A) : { success: false, message: "obsolete secret failure", data: null });
    oldRail(outcome === "success" ? rail(A) : { error: "obsolete rail failure" }, outcome === "success" ? 200 : 503);
  });
  expect(screen.getByText("Loading...")).toBeTruthy();
  expect(screen.queryByText(`${A} player`)).toBeNull();
  expect(screen.queryByText("Boxscore could not be loaded.")).toBeNull();
  expect(screen.queryByText("Team game context could not be loaded.")).toBeNull();
  expect(fetchMock.mock.calls.some(([target]) => target === scheduleUrl(A))).toBe(false);
  await act(async () => { newBox(box(B)); });
  expect(await screen.findByText(`${B} player`)).toBeTruthy();
  expect(screen.queryByText("Loading...")).toBeNull();
  await act(async () => { newRail(rail(B)); });
  expect(screen.queryByText(/obsolete/)).toBeNull();
});

it.each(["success", "failure"])("keeps current A after A to B to A when old B ends in %s", async outcome => {
  const oldBox = hold(url(B, "boxscore")), oldRail = hold(url(B, "right-rail"));
  const view = mount(); expect(await screen.findByText(`${A} player`)).toBeTruthy();
  view.route(B); await requested(url(B, "boxscore"));
  expect(screen.queryByText(`${A} player`)).toBeNull();
  expect(screen.getByText("Loading...")).toBeTruthy();
  view.route(A); expect(await screen.findByText(`${A} player`)).toBeTruthy();
  await act(async () => {
    oldBox(outcome === "success" ? box(B) : { success: false, data: null });
    oldRail(outcome === "success" ? rail(B) : { error: "old B error" }, outcome === "success" ? 200 : 500);
  });
  expect(screen.getByText(`${A} player`)).toBeTruthy();
  expect(screen.queryByText(`${B} player`)).toBeNull();
  expect(screen.queryByText("Boxscore could not be loaded.")).toBeNull();
  expect(screen.queryByText("Team game context could not be loaded.")).toBeNull();
  expect(screen.queryByText("Loading...")).toBeNull();
});

it("invalidating the ID removes all prior panels and prevents a late rail from reviving them", async () => {
  const oldRail = hold(url(A, "right-rail"));
  const view = mount(); expect(await screen.findByText(`${A} player`)).toBeTruthy();
  await requested(scheduleUrl(A));
  const calls = fetchMock.mock.calls.length;
  view.route([A]);
  expect(screen.getByText("Invalid game ID.")).toBeTruthy();
  expect(screen.queryByRole("heading", { name: "Top Skaters" })).toBeNull();
  await act(async () => { oldRail(rail(A)); });
  expect(fetchMock).toHaveBeenCalledTimes(calls);
  expect(screen.queryByText(`${A} player`)).toBeNull();
});

it("late A schedule odds cannot become B probabilities", async () => {
  const oldSchedule = hold(scheduleUrl(A)), newSchedule = hold(scheduleUrl(B));
  const odds = (id: string, away: string, home: string) => ({ gameWeek: [{ games: [{ ...game(id), startTimeUTC: `${date(id)}T23:00:00Z`, awayTeam: { odds: [{ providerId: 9, value: away }] }, homeTeam: { odds: [{ providerId: 9, value: home }] } }] }] });
  const view = mount(); await requested(scheduleUrl(A));
  view.route(B); expect(await screen.findByText(`${B} player`)).toBeTruthy(); await requested(scheduleUrl(B));
  await act(async () => { oldSchedule(odds(A, "-400", "+400")); });
  expect(panel("Implied Win Probability").getByText("Market odds unavailable.")).toBeTruthy();
  expect(screen.queryByText(`AW-${A} 80%`)).toBeNull();
  await act(async () => { newSchedule(odds(B, "+100", "-100")); });
  expect(await screen.findByText(`AW-${B} 50%`)).toBeTruthy();
  expect(screen.queryByText(`${A} player`)).toBeNull();
});

it("a non-JSON boxscore and failed odds request leave independently valid rail statistics visible", async () => {
  handlers.set(url(A, "boxscore"), async () => ({ ok: false, status: 503, json: async () => { throw new Error("private parser failure"); } }) as unknown as Response);
  handlers.set(scheduleUrl(A), async () => response({ error: "private odds failure" }, 503));
  mount();
  expect(await screen.findByText("Boxscore could not be loaded.")).toBeTruthy();
  expect(panel("Team Game Stats").getByText("Shots on Goal")).toBeTruthy();
  expect(panel("Team Game Stats").getByText("0")).toBeTruthy();
  expect(panel("Implied Win Probability").getByText("Market odds unavailable.")).toBeTruthy();
  expect(screen.queryByText(/private/)).toBeNull();
});

it("withholds one-sided strength bars and does not assign a winner to a nonzero tie", async () => {
  handlers.set(url(A, "right-rail"), async () => response({ ...rail(A),
    teamGameStats: [{ category: "sog", awayValue: 0, homeValue: null }],
    seasonSeries: [{ ...game(A), awayTeam: { ...game(A).awayTeam, score: 2 }, homeTeam: { ...game(A).homeTeam, score: 2 } }],
  }));
  mount(); expect(await screen.findByText(`${A} player`)).toBeTruthy();
  const strengths = screen.getByRole("heading", { name: "Team Strengths" }).closest("section")!;
  expect(strengths.querySelectorAll('[style*="width"]')).toHaveLength(0);
  expect(panel("Team Game Stats").getByText("0")).toBeTruthy();
  expect(panel("Team Game Stats").getByText("-")).toBeTruthy();
  expect(panel("Recent Head-to-Head").getByText("Result unavailable")).toBeTruthy();
  expect(panel("Recent Head-to-Head").queryByText(/ Win$/)).toBeNull();
});
