import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
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

const makeResponse = (count = 6) => ({
  success: true,
  windowDays: 3,
  generatedAt: new Date().toISOString(),
  page: 1,
  pageSize: 10,
  offset: 0,
  totalRisers: count,
  totalFallers: count,
  risers: Array.from({ length: count }, (_, index) =>
    makePlayer("rise", index + 1),
  ),
  fallers: Array.from({ length: count }, (_, index) =>
    makePlayer("fall", index + 1),
  ),
});

const mockResponse = (body: ReturnType<typeof makeResponse>) =>
  vi.fn().mockResolvedValue({
    ok: true,
    text: async () => JSON.stringify(body),
  });

describe("TransactionTrends", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders stacked five-player mobile riser and faller panels", async () => {
    vi.stubGlobal("fetch", mockResponse(makeResponse()));
    const { container } = render(<TransactionTrends />);

    expect(await screen.findByText("Top Risers (3D)")).toBeTruthy();
    expect(screen.getByText("Top Fallers (3D)")).toBeTruthy();

    const risers = container.querySelector("#mobile-risers-panel");
    const fallers = container.querySelector("#mobile-fallers-panel");

    expect(risers?.querySelectorAll("li")).toHaveLength(5);
    expect(fallers?.querySelectorAll("li")).toHaveLength(5);
    expect(risers?.querySelectorAll("svg")).toHaveLength(5);
    expect(fallers?.querySelectorAll("svg")).toHaveLength(5);
    expect(risers?.textContent).toContain("21%");
    expect(risers?.textContent).toContain("Own");
    expect(risers?.querySelector("[aria-label^='Up']")).toBeTruthy();
    expect(fallers?.querySelector("[aria-label^='Down']")).toBeTruthy();
    expect(
      screen.getByRole("link", { name: /view all/i }).getAttribute("href"),
    ).toBe("/trends");
  });

  it("keeps filters authoritative and updates the selected-window copy", async () => {
    const fetchMock = mockResponse(makeResponse());
    vi.stubGlobal("fetch", fetchMock);
    render(<TransactionTrends />);

    await screen.findByText("Top Risers (3D)");
    const goalieFilter = screen.getByRole("button", { name: "G" });
    fireEvent.click(goalieFilter);
    expect(goalieFilter.className).toContain("active");

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(([url]) => String(url).includes("pos=G")),
      ).toBe(true);
    });

    const oneDayFilter = screen.getByRole("button", { name: "1D" });
    fireEvent.click(oneDayFilter);
    expect(oneDayFilter.className).toContain("active");
    expect(
      screen.getByText("Ownership movement over the last day."),
    ).toBeTruthy();

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(([url]) => String(url).includes("window=1")),
      ).toBe(true);
    });

    const fallersNav = screen.getByRole("button", { name: "Fallers" });
    fireEvent.click(fallersNav);
    expect(fallersNav.getAttribute("aria-pressed")).toBe("true");
    expect(document.activeElement?.id).toBe("mobile-fallers-heading");
  });

  it("preserves controls and a compact deliberate no-data state", async () => {
    vi.stubGlobal("fetch", mockResponse(makeResponse(0)));
    const { container } = render(<TransactionTrends />);

    expect(
      await screen.findByText("No ownership movement is available right now."),
    ).toBeTruthy();
    expect(screen.getByRole("group", { name: /position filter/i })).toBeTruthy();
    expect(screen.getByRole("group", { name: /time windows/i })).toBeTruthy();
    expect(screen.getByRole("link", { name: /view all/i })).toBeTruthy();
    expect(container.querySelector("#mobile-risers-panel")).toBeNull();
    expect(container.querySelector("#mobile-fallers-panel")).toBeNull();
    expect(screen.queryByText(/sparkline shows/i)).toBeNull();
  });
});
