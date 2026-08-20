import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import TransactionTrends from "./TransactionTrends";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const makePlayer = (direction: "rise" | "fall", index: number) => ({
  playerKey: `${direction}-${index}`,
  playerId: index,
  name: `${direction === "rise" ? "Rising" : "Falling"} Player ${index}`,
  headshot: `https://example.com/${direction}-${index}.png`,
  displayPosition: index % 2 ? "C" : "D",
  teamAbbrev: index % 2 ? "OTT" : "BOS",
  eligiblePositions: index % 2 ? ["C", "LW"] : ["D"],
  latest: 20 + index,
  previous: 19 + index,
  delta: direction === "rise" ? index : -index,
  deltaPct: direction === "rise" ? index : -index,
  sparkline: [
    { date: "2026-07-22", value: 10 },
    { date: "2026-07-23", value: direction === "rise" ? 11 : 9 },
    { date: "2026-07-24", value: direction === "rise" ? 12 : 8 },
  ],
});

const makeResponse = (
  count = 10,
  options: {
    generatedAt?: string;
    metric?: "ownership" | "adp";
    totalRisers?: number;
    totalFallers?: number;
  } = {},
) => ({
  success: true,
  metric: options.metric ?? "ownership",
  windowDays: 3,
  generatedAt: options.generatedAt ?? new Date().toISOString(),
  page: 1,
  pageSize: 10,
  offset: 0,
  totalRisers: options.totalRisers ?? count,
  totalFallers: options.totalFallers ?? count,
  risers: Array.from({ length: count }, (_, index) =>
    makePlayer("rise", index + 1),
  ),
  fallers: Array.from({ length: count }, (_, index) =>
    makePlayer("fall", index + 1),
  ),
});

const mockResponse = (body: ReturnType<typeof makeResponse>) =>
  vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
    const url = new URL(String(input), "https://example.test");
    const windowDays = Number(url.searchParams.get("window") ?? body.windowDays);
    const metric =
      url.searchParams.get("metric") === "adp" ? "adp" : "ownership";
    const offset = Number(url.searchParams.get("offset") ?? 0);
    const risers =
      metric === "adp"
        ? body.risers.map((player) => ({
            ...player,
            latest: 80,
            previous: 100,
            delta: 20,
            deltaPct: 20,
            sparkline: [
              { date: "2026-07-22", value: 100 },
              { date: "2026-07-23", value: 90 },
              { date: "2026-07-24", value: 80 },
            ],
          }))
        : body.risers;
    const fallers =
      metric === "adp"
        ? body.fallers.map((player) => ({
            ...player,
            latest: 120,
            previous: 100,
            delta: -20,
            deltaPct: -20,
            sparkline: [
              { date: "2026-07-22", value: 100 },
              { date: "2026-07-23", value: 110 },
              { date: "2026-07-24", value: 120 },
            ],
          }))
        : body.fallers;

    return {
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          ...body,
          metric,
          windowDays,
          offset,
          page: Math.floor(offset / body.pageSize) + 1,
          risers,
          fallers,
        }),
    };
  });

const renderOwnershipTrends = () =>
  render(<TransactionTrends defaultMetric="ownership" />);

describe("TransactionTrends", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders two aligned semantic tables with all ten rows", async () => {
    vi.stubGlobal("fetch", mockResponse(makeResponse()));
    renderOwnershipTrends();

    expect(
      await screen.findByRole("heading", { name: "Top Risers (Δ 3D)" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "Top Fallers (Δ 3D)" }),
    ).toBeTruthy();

    const tables = screen.getAllByRole("table");
    expect(tables).toHaveLength(2);
    expect(within(tables[0]).getAllByRole("row")).toHaveLength(11);
    expect(within(tables[1]).getAllByRole("row")).toHaveLength(11);
    expect(
      screen.getAllByRole("columnheader", { name: "Team · Elig" }),
    ).toHaveLength(2);
    expect(
      screen.getAllByRole("columnheader", { name: "Trend (3D)" }),
    ).toHaveLength(2);
    expect(screen.queryByText("Ownership movement may be stale.")).toBeNull();
    expect(
      screen.getByRole("link", { name: /view all/i }).getAttribute("href"),
    ).toBe("/trends");
  });

  it("keeps filters authoritative and updates dynamic timeframe labels", async () => {
    const fetchMock = mockResponse(makeResponse());
    vi.stubGlobal("fetch", fetchMock);
    renderOwnershipTrends();

    await screen.findByRole("heading", { name: "Top Risers (Δ 3D)" });
    expect(
      screen.getByRole("button", { name: "All" }).getAttribute("aria-pressed"),
    ).toBe("true");
    expect(
      screen.getByRole("button", { name: "3D" }).getAttribute("aria-pressed"),
    ).toBe("true");
    expect(
      screen
        .getByRole("button", { name: "Ownership" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    expect(
      fetchMock.mock.calls.some(([url]) =>
        String(url).includes("metric=ownership"),
      ),
    ).toBe(true);

    const goalieFilter = screen.getByRole("button", { name: "G" });
    fireEvent.click(goalieFilter);
    expect(goalieFilter.getAttribute("aria-pressed")).toBe("true");

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(([url]) => String(url).includes("pos=G")),
      ).toBe(true);
    });

    const oneDayFilter = screen.getByRole("button", { name: "1D" });
    fireEvent.click(oneDayFilter);
    expect(oneDayFilter.getAttribute("aria-pressed")).toBe("true");
    expect(
      screen.getByText("Ownership movement over the last day."),
    ).toBeTruthy();

    await waitFor(() => {
      expect(
        screen.getAllByRole("columnheader", { name: "Trend (1D)" }),
      ).toHaveLength(2);
      expect(
        screen.getAllByRole("columnheader", { name: "Δ 1D" }),
      ).toHaveLength(2);
    });
  });

  it("defaults to ADP average-pick values, deltas, and sparklines", async () => {
    const fetchMock = mockResponse(makeResponse(1));
    vi.stubGlobal("fetch", fetchMock);
    render(<TransactionTrends />);

    await screen.findByRole("heading", { name: "Top Risers (Δ 3D)" });
    const adpToggle = screen.getByRole("button", { name: "ADP" });

    expect(adpToggle.getAttribute("aria-pressed")).toBe("true");
    expect(
      await screen.findByText(
        "Average draft pick movement over the last 3 days.",
      ),
    ).toBeTruthy();

    await waitFor(() => {
      expect(
        screen.getAllByRole("columnheader", { name: "Avg Pick" }),
      ).toHaveLength(2);
      expect(
        fetchMock.mock.calls.some(([url]) =>
          String(url).includes("metric=adp"),
        ),
      ).toBe(true);
    });
    expect(
      screen.getAllByLabelText(/average draft pick trend over 3 days/i),
    ).toHaveLength(2);
    expect(
      screen.getByLabelText("Average pick moved 20.0% earlier"),
    ).toBeTruthy();
    expect(
      screen.getByLabelText("Average pick moved 20.0% later"),
    ).toBeTruthy();
    const risingSparkline = screen.getByLabelText(
      "Rising Player 1 average draft pick trend over 3 days",
    );
    expect(risingSparkline.querySelector("path")?.getAttribute("d")).toBe(
      "M 0.00 22.00 L 50.00 12.00 L 100.00 2.00",
    );
    expect(screen.getByText(/lower average picks rank as risers/i)).toBeTruthy();
  });

  it("normalizes object metadata, deduplicates positions, and falls back safely", async () => {
    const response = makeResponse(2) as any;
    response.risers[0] = {
      ...response.risers[0],
      teamAbbrev: { abbreviation: "tor" },
      teamFullName: { name: "Toronto Maple Leafs" },
      eligiblePositions: [
        { position: "C" },
        { position: { code: "LW" } },
        { position: "C" },
      ],
    };
    response.risers[1] = {
      ...response.risers[1],
      teamAbbrev: null,
      teamFullName: null,
      eligiblePositions: [{ unexpected: "value" }],
      displayPosition: null,
    };
    vi.stubGlobal("fetch", mockResponse(response));

    const { container } = renderOwnershipTrends();
    await screen.findByRole("heading", { name: "Top Risers (Δ 3D)" });

    expect(screen.getAllByText("TOR · C, LW").length).toBeGreaterThan(0);
    expect(screen.getAllByText("— · —").length).toBeGreaterThan(0);
    expect(container.textContent?.toLowerCase()).not.toContain("[object object]");
  });

  it("renders signed, directional delta text without boxed duplicates", async () => {
    vi.stubGlobal("fetch", mockResponse(makeResponse(1)));
    renderOwnershipTrends();

    const rise = await screen.findByLabelText("Up 1.0 percentage points");
    const fall = screen.getByLabelText("Down 1.0 percentage points");
    expect(rise.textContent).toContain("▲ +1.0%");
    expect(fall.textContent).toContain("▼ -1.0%");
  });

  it("keeps real counts and Prev/Next paging data-driven", async () => {
    const fetchMock = mockResponse(
      makeResponse(10, { totalRisers: 23, totalFallers: 17 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    renderOwnershipTrends();

    expect(
      await screen.findByText("Risers: 23 | Fallers: 17"),
    ).toBeTruthy();
    const previous = screen.getByRole("button", { name: /prev/i });
    const next = screen.getByRole("button", { name: /next/i });
    expect(previous.hasAttribute("disabled")).toBe(true);
    expect(next.hasAttribute("disabled")).toBe(false);

    fireEvent.click(next);
    await waitFor(() => {
      expect(screen.getByText("Page 2")).toBeTruthy();
      expect(
        fetchMock.mock.calls.some(([url]) => String(url).includes("offset=10")),
      ).toBe(true);
    });
    expect(previous.hasAttribute("disabled")).toBe(false);

    fireEvent.click(previous);
    await waitFor(() => {
      expect(screen.getByText("Page 1")).toBeTruthy();
    });
  });

  it("shows the stale state only as a compact status message", async () => {
    vi.stubGlobal(
      "fetch",
      mockResponse(makeResponse(1, { generatedAt: "2020-01-01T00:00:00Z" })),
    );
    renderOwnershipTrends();

    const message = await screen.findByText(
      "Ownership movement may be stale.",
    );
    expect(message.getAttribute("role")).toBe("status");
    expect(screen.getByRole("table", { name: "Top Risers" })).toBeTruthy();
  });

  it("preserves controls and a deliberate no-data state", async () => {
    vi.stubGlobal("fetch", mockResponse(makeResponse(0)));
    renderOwnershipTrends();

    expect(
      await screen.findByText("No ownership movement is available right now."),
    ).toBeTruthy();
    expect(screen.getByRole("group", { name: /position filter/i })).toBeTruthy();
    expect(screen.getByRole("group", { name: /time windows/i })).toBeTruthy();
    expect(screen.getByRole("link", { name: /view all/i })).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.queryByText(/sparkline shows/i)).toBeNull();
  });

  it("switches the narrow presentation without creating another data request", async () => {
    const fetchMock = mockResponse(makeResponse(1));
    vi.stubGlobal("fetch", fetchMock);
    renderOwnershipTrends();

    await screen.findByRole("heading", { name: "Top Risers (Δ 3D)" });
    const fallers = screen.getByRole("button", { name: "Fallers" });
    fireEvent.click(fallers);
    expect(fallers.getAttribute("aria-pressed")).toBe("true");

    await waitFor(() => {
      expect(document.activeElement?.id).toBe("fallers-heading");
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
