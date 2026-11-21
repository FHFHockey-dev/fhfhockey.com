import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { StrictMode } from "react";
import TransactionTrends, { transactionTrendRequests } from "./TransactionTrends";

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
    sourceDate?: string | null;
    seasonFallbackApplied?: boolean;
    metric?: "ownership" | "adp";
    totalRisers?: number;
    totalFallers?: number;
  } = {},
) => ({
  success: true,
  metric: options.metric ?? "ownership",
  windowDays: 3,
  generatedAt: options.generatedAt ?? new Date().toISOString(),
  sourceDate: options.sourceDate,
  seasonFallbackApplied: options.seasonFallbackApplied,
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
          pos: url.searchParams.get("pos"),
          risers,
          fallers,
        }),
    };
  });

const renderOwnershipTrends = () =>
  render(<TransactionTrends defaultMetric="ownership" />);

describe("TransactionTrends", () => {
  it("shares the initial request through StrictMode remounts", async () => {
    const fetchMock = mockResponse(makeResponse());
    vi.stubGlobal("fetch", fetchMock);
    render(<StrictMode><TransactionTrends defaultMetric="ownership" /></StrictMode>);
    expect(screen.getByText("Loading ownership movement...")).toBeTruthy();
    await screen.findByRole("heading", { name: "Top Risers (Δ 3D)" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  afterEach(() => {
    cleanup();
    transactionTrendRequests.clear();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
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
      screen.getAllByRole("columnheader", { name: "Trend" }),
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
      screen.getByText("Ownership movement for a 1-day target window."),
    ).toBeTruthy();

    await waitFor(() => {
      expect(
        screen.getAllByRole("columnheader", { name: "Trend" }),
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
        /Average draft pick movement for a 3-day target window\./,
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
      screen.getAllByLabelText(/recent daily average draft pick history/i),
    ).toHaveLength(2);
    expect(
      screen.getByText("Average pick moved 20.0% earlier"),
    ).toBeTruthy();
    expect(
      screen.getByText("Average pick moved 20.0% later"),
    ).toBeTruthy();
    const risingSparkline = screen.getByLabelText(
      "Rising Player 1 recent daily average draft pick history",
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

    const rise = (await screen.findByText("Up 1.0 percentage points")).parentElement!;
    const fall = screen.getByText("Down 1.0 percentage points").parentElement!;
    expect(rise.hasAttribute("aria-label")).toBe(false);
    expect(rise.textContent).toContain("▲ +1.0 pp");
    expect(fall.textContent).toContain("▼ -1.0 pp");
  });

  it("discloses source date, season fallback, and actual comparison dates", async () => {
    const response = makeResponse(2, {
      sourceDate: "2026-10-19",
      seasonFallbackApplied: true,
    });
    Object.assign(response.risers[0], {
      movementStartDate: "2026-10-15",
      movementEndDate: "2026-10-18",
    });
    Object.assign(response.risers[1], {
      playerId: null,
      movementStartDate: "2026-10-12",
      movementEndDate: "2026-10-17",
    });
    vi.stubGlobal("fetch", mockResponse(response));
    renderOwnershipTrends();

    const sourceDate = await screen.findByText("Oct 19, 2026");
    expect(sourceDate.getAttribute("datetime")).toBe("2026-10-19");
    expect(sourceDate.parentElement?.textContent).toContain("Searched across seasons.");
    const risers = screen.getByRole("table", { name: "Top Risers" });
    expect(within(risers).getByRole("link", { name: "Rising Player 1" }).getAttribute("href"))
      .toBe("/trends/player/1");
    const mapped = within(risers).getByRole("row", { name: /Rising Player 1/ });
    expect(within(mapped).getByText("To Oct 18").getAttribute("datetime")).toBe("2026-10-18");
    expect(within(mapped).queryByText(/D span/)).toBeNull();
    expect(within(mapped).queryByText("Yahoo listing")).toBeNull();
    const unmapped = within(risers).getByRole("row", { name: /Rising Player 2/ });
    expect(within(unmapped).queryByRole("link")).toBeNull();
    const listing = within(unmapped).getByText("Yahoo listing");
    expect(listing.getAttribute("title")).toBe("NHL identity unconfirmed");
    expect(listing.textContent).toBe("Yahoo listing. NHL identity unconfirmed.");
    expect(within(unmapped).getByText("To Oct 17").getAttribute("datetime")).toBe("2026-10-17");
    expect(within(unmapped).getByText("5D span")).toBeTruthy();
    expect(within(unmapped).getByTitle("Oct 12, 2026 to Oct 17, 2026")).toBeTruthy();
    expect(
      within(unmapped).getByText("Up 2.0 percentage points from Oct 12, 2026 to Oct 17, 2026"),
    ).toBeTruthy();
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
    expect(screen.getByRole("button", { name: /prev/i }).hasAttribute("disabled")).toBe(false);
    const risers = screen.getByRole("table", { name: "Top Risers" });
    expect(within(risers).getByRole("rowheader", { name: "11" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /prev/i }));
    await waitFor(() => {
      expect(screen.getByText("Page 1")).toBeTruthy();
    });
  });

  it.each(["G", "5D", "ADP"])(
    "requests only the first page when switching to %s from a later page",
    async (filter) => {
      const fetchMock = mockResponse(makeResponse(10, { totalRisers: 20 }));
      vi.stubGlobal("fetch", fetchMock);
      renderOwnershipTrends();

      fireEvent.click(await screen.findByRole("button", { name: /next/i }));
      const risers = await screen.findByRole("table", { name: "Top Risers" });
      expect(within(risers).getByRole("rowheader", { name: "11" })).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: filter }));
      expect(screen.queryByRole("table")).toBeNull();
      await screen.findByText("Page 1");

      const offsets = fetchMock.mock.calls.map(([request]) =>
        new URL(String(request), "https://example.test").searchParams.get("offset"),
      );
      expect(offsets).toEqual(["0", "10", "0"]);
    },
  );

  it("discards late filter results after a newer filter request fails", async () => {
    const original = mockResponse(makeResponse(1, { sourceDate: "2026-10-19" }));
    let finishSlowRequest: (() => void) | undefined;
    vi.stubGlobal("fetch", async (input: string) => {
      const params = new URL(input, "https://example.test").searchParams;
      if (params.get("window") === "5") {
        return new Response("Unavailable", { status: 503 });
      }
      if (params.get("pos") === "G") {
        await new Promise<void>((resolve) => { finishSlowRequest = resolve; });
      }
      return original(input);
    });
    renderOwnershipTrends();

    await screen.findByRole("table", { name: "Top Risers" });
    fireEvent.click(screen.getByRole("button", { name: "G" }));
    expect(screen.getByText("Loading ownership movement...")).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.queryByText("Oct 19, 2026")).toBeNull();
    await waitFor(() => expect(finishSlowRequest).toBeDefined());
    fireEvent.click(screen.getByRole("button", { name: "5D" }));
    await screen.findByText("Transaction trend data is temporarily unavailable.");

    await act(async () => { finishSlowRequest?.(); });
    expect(screen.getByText("Transaction trend data is temporarily unavailable.")).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("rejects a response for the wrong page and allows going back", async () => {
    const original = mockResponse(makeResponse(1, { totalRisers: 20 }));
    vi.stubGlobal("fetch", async (input: string) => {
      const params = new URL(input, "https://example.test").searchParams;
      return params.get("offset") === "10"
        ? Response.json(makeResponse(1))
        : original(input);
    });
    renderOwnershipTrends();

    fireEvent.click(await screen.findByRole("button", { name: /next/i }));
    await screen.findByText("Transaction trend data did not match the selected filters or page.");
    expect(screen.queryByRole("table")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /prev/i }));
    await screen.findByRole("table", { name: "Top Risers" });
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

  it.each(["ownership", "adp"] as const)(
    "uses today's sourceDate for %s even when generatedAt is later today",
    async (metric) => {
      vi.spyOn(Date, "now").mockReturnValue(
        Date.parse("2026-10-19T13:04:00.000Z"),
      );
      vi.stubGlobal(
        "fetch",
        mockResponse(makeResponse(1, {
          sourceDate: "2026-10-19",
          generatedAt: "2026-10-19T23:59:59.999Z",
        })),
      );
      render(<TransactionTrends defaultMetric={metric} />);

      await screen.findByRole("table", { name: "Top Risers" });
      expect(screen.queryByText(/movement may be stale\./)).toBeNull();
    },
  );

  it.each(["ownership", "adp"] as const)(
    "preserves the %s warning for an old sourceDate even with recent generatedAt",
    async (metric) => {
      vi.spyOn(Date, "now").mockReturnValue(
        Date.parse("2026-10-19T13:04:00.000Z"),
      );
      vi.stubGlobal(
        "fetch",
        mockResponse(makeResponse(1, {
          sourceDate: "2026-10-17",
          generatedAt: "2026-10-19T13:00:00.000Z",
        })),
      );
      render(<TransactionTrends defaultMetric={metric} />);

      const message = await screen.findByText(
        `${metric === "adp" ? "ADP" : "Ownership"} movement may be stale.`,
      );
      expect(message.getAttribute("role")).toBe("status");
      expect(screen.getByRole("table", { name: "Top Risers" })).toBeTruthy();
    },
  );

  it.each([
    { sourceDate: undefined, generatedAt: "2026-10-19T13:00:00.000Z", stale: false },
    { sourceDate: null, generatedAt: "2026-10-19T13:00:00.000Z", stale: false },
    { sourceDate: undefined, generatedAt: "2026-10-17T23:59:59.999Z", stale: true },
    { sourceDate: null, generatedAt: "2026-10-17T23:59:59.999Z", stale: true },
  ])(
    "falls back to generatedAt $generatedAt when sourceDate is $sourceDate",
    async ({ sourceDate, generatedAt, stale }) => {
      vi.spyOn(Date, "now").mockReturnValue(
        Date.parse("2026-10-19T13:04:00.000Z"),
      );
      vi.stubGlobal("fetch", mockResponse(makeResponse(1, { sourceDate, generatedAt })));
      renderOwnershipTrends();

      await screen.findByRole("table", { name: "Top Risers" });
      expect(Boolean(screen.queryByText("Ownership movement may be stale."))).toBe(stale);
      expect(screen.getByText(/Yahoo! data date unavailable/)).toBeTruthy();
    },
  );

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

  it("switches the narrow presentation without resetting the page or requesting more data", async () => {
    const fetchMock = mockResponse(makeResponse(1, { totalRisers: 20 }));
    vi.stubGlobal("fetch", fetchMock);
    renderOwnershipTrends();

    fireEvent.click(await screen.findByRole("button", { name: /next/i }));
    const risers = await screen.findByRole("table", { name: "Top Risers" });
    expect(within(risers).getByRole("rowheader", { name: "11" })).toBeTruthy();
    const fallers = screen.getByRole("button", { name: "Fallers" });
    fireEvent.click(fallers);
    expect(fallers.getAttribute("aria-pressed")).toBe("true");

    await waitFor(() => {
      expect(document.activeElement?.id).toBe("fallers-heading");
    });
    expect(screen.getByText("Page 2")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
