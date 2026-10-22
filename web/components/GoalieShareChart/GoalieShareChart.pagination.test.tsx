import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

const mocks = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock("lib/cors-fetch", () => ({ default: mocks.fetch }));
vi.mock("react-chartjs-2", () => ({
  Doughnut: ({ data }: any) => <pre data-testid="chart">{JSON.stringify(data)}</pre>
}));

import GoalieShareChart, { type GoalieGameRow } from "./index";

const rows: GoalieGameRow[] = Array.from({ length: 250 }, (_, index) => ({
  gameId: index + 1,
  gameDate: new Date(Date.UTC(2025, 9, 1 + index)).toISOString().slice(0, 10),
  teamAbbrev: "PHI",
  playerId: index < 200 ? 1 : 2,
  goalieFullName: index < 200 ? "Starter One" : "Backup Two",
  gamesPlayed: 1,
  wins: 0,
  losses: 0,
  otLosses: 0,
  saves: 27,
  shotsAgainst: 30,
  goalsAgainst: 3,
  timeOnIce: 3600
}));

const response = (data: unknown, status = 200) => ({
  ok: status === 200,
  status,
  json: async () => data
});

function mockPages(page: (start: number) => ReturnType<typeof response>) {
  mocks.fetch.mockImplementation(async (url: string) => {
    const parsed = new URL(url);
    return parsed.pathname.endsWith("/season")
      ? response({ data: [{ id: 20252026 }] })
      : page(Number(parsed.searchParams.get("start")));
  });
}

const completePage = (start: number) =>
  response({ total: rows.length, data: rows.slice(start, start + 100) });

async function finishRequests() {
  await act(async () => { await vi.advanceTimersByTimeAsync(2500); });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.resetAllMocks();
});

describe("GoalieShareChart complete page sets", () => {
  it.each([0, 100, 200])("withholds every window after repeated 429s at offset %i", async (failedStart) => {
    mockPages((start) => start === failedStart ? response({}, 429) : completePage(start));
    render(<GoalieShareChart />);
    await finishRequests();

    expect(screen.queryAllByTestId("chart")).toHaveLength(0);
    expect(screen.getByRole("alert").textContent).toMatch(/unavailable|incomplete/i);
    const failedCalls = mocks.fetch.mock.calls.filter(([url]) =>
      new URL(url).searchParams.get("start") === String(failedStart));
    expect(failedCalls).toHaveLength(2);

    const calls = mocks.fetch.mock.calls.length;
    for (const span of ["L10", "L20", "L30", "Season"]) {
      fireEvent.click(screen.getByRole("button", { name: span }));
      expect(screen.queryAllByTestId("chart")).toHaveLength(0);
    }
    expect(mocks.fetch).toHaveBeenCalledTimes(calls);
  });

  it.each([0, 100, 200])("rejects a successful but short page at offset %i", async (shortStart) => {
    mockPages((start) => start === shortStart
      ? response({ total: rows.length, data: rows.slice(start, start + 1) })
      : completePage(start));
    render(<GoalieShareChart />);
    await finishRequests();
    expect(screen.queryAllByTestId("chart")).toHaveLength(0);
    expect(screen.getByRole("alert").textContent).toMatch(/unavailable|incomplete/i);
  });

  it.each([
    { data: rows.slice(0, 100) },
    { total: 250, data: null },
    { total: -1, data: [] }
  ])("rejects invalid completeness metadata: %j", async (payload) => {
    mockPages(() => response(payload));
    render(<GoalieShareChart />);
    await finishRequests();
    expect(screen.queryAllByTestId("chart")).toHaveLength(0);
    expect(screen.getByRole("alert")).toBeTruthy();
  });

  it("rejects totals that change between pages", async () => {
    mockPages((start) => start === 100
      ? response({ total: 300, data: rows.slice(100, 200) })
      : completePage(start));
    render(<GoalieShareChart />);
    await finishRequests();
    expect(screen.queryAllByTestId("chart")).toHaveLength(0);
    expect(screen.getByRole("alert")).toBeTruthy();
  });

  it("recovers within the retry budget and re-slices complete data without fetching", async () => {
    let attempts = 0;
    mockPages((start) => start === 100 && attempts++ === 0
      ? response({}, 429)
      : completePage(start));
    render(<GoalieShareChart />);
    await finishRequests();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(JSON.parse(screen.getByTestId("chart").textContent!).datasets[0].data).toEqual([200, 50]);
    const calls = mocks.fetch.mock.calls.length;
    fireEvent.click(screen.getByRole("button", { name: "L10" }));
    expect(JSON.parse(screen.getByTestId("chart").textContent!).datasets[0].data).toEqual([10]);
    expect(mocks.fetch).toHaveBeenCalledTimes(calls);
  });

  it("keeps a verified empty season distinct from a failed page", async () => {
    mockPages(() => response({ total: 0, data: [] }));
    render(<GoalieShareChart />);
    await finishRequests();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByText(/No goalie data available/)).toBeTruthy();
    expect(mocks.fetch).toHaveBeenCalledTimes(2);
  });

  it("keeps page concurrency bounded at eight", async () => {
    let active = 0;
    let maximum = 0;
    mocks.fetch.mockImplementation(async (url: string) => {
      const parsed = new URL(url);
      if (parsed.pathname.endsWith("/season")) return response({ data: [{ id: 20252026 }] });
      const start = Number(parsed.searchParams.get("start"));
      active++;
      maximum = Math.max(maximum, active);
      await new Promise((resolve) => setTimeout(resolve, 10));
      active--;
      return response({
        total: 1000,
        data: Array.from({ length: 100 }, (_, index) => ({ ...rows[0], gameId: start + index + 1 }))
      });
    });
    render(<GoalieShareChart />);
    await finishRequests();
    expect(maximum).toBe(8);
    expect(mocks.fetch).toHaveBeenCalledTimes(11);
    expect(screen.getAllByTestId("chart")).toHaveLength(1);
  });
});
