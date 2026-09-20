import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import OpponentGamelog from "./OpponentGamelog";

const { fetchSchedule } = vi.hoisted(() => ({ fetchSchedule: vi.fn() }));
vi.mock("lib/cors-fetch", () => ({ default: fetchSchedule }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const game = (id: number, extra: Record<string, unknown> = {}) => ({
  id, season: 20252026, gameType: 2, gameDate: `2026-01-0${id}`,
  startTimeUTC: `2026-01-0${id}T23:00:00Z`, gameState: "FUT", gameScheduleState: "OK",
  homeTeam: { id: 1, abbrev: "NJD", score: 3 }, awayTeam: { id: 2, abbrev: "NYI", score: 2 }, ...extra
});
function mount(games: ReturnType<typeof game>[]) {
  fetchSchedule.mockResolvedValue({ ok: true, json: async () => ({ games }) });
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <OpponentGamelog teamId={1} seasonId={20252026} />
  </QueryClientProvider>);
}
describe("opponent team schedule", () => {
  beforeEach(() => fetchSchedule.mockReset());
  it("orders and deduplicates games, excluding unrelated teams and seasons", async () => {
    const { container } = mount([game(3), game(1, { gameState: "OFF" }), game(3), game(2),
      game(4, { season: 20242025 }), game(5, { homeTeam: { id: 3 }, awayTeam: { id: 4 } })]);
    const table = await screen.findByRole("table");
    expect(within(table).getAllByRole("row")).toHaveLength(4);
    const rows = container.querySelectorAll("tbody tr");
    expect(rows[0].textContent).toContain("W 3-2");
    expect(rows[1].getAttribute("aria-current")).toBe("true");
  });
  it("never highlights a completed final game as upcoming", async () => {
    const { container } = mount([game(1, { gameState: "FINAL", gameOutcome: { lastPeriodType: "OT" } })]);
    await screen.findByText("W 3-2 (OT)");
    expect(container.querySelector("[aria-current]")).toBeNull();
  });
  it("skips postponed games when choosing the next game", async () => {
    const { container } = mount([game(1, { gameScheduleState: "PPD" }), game(2)]);
    await screen.findByText("Postponed");
    expect(container.querySelector("tbody tr")?.getAttribute("aria-current")).toBeNull();
    expect(container.querySelectorAll("tbody tr")[1].getAttribute("aria-current")).toBe("true");
  });
  it("shows away perspective, shootout result and live scores", async () => {
    mount([game(1, { homeTeam: { id: 2, abbrev: "NYI", score: 3 }, awayTeam: { id: 1, abbrev: "NJD", score: 2 }, gameState: "OFF", gameOutcome: { lastPeriodType: "SO" } }), game(2, { gameState: "LIVE" })]);
    await screen.findByText("L 2-3 (SO)");
    expect(screen.getByText("@ NYI")).toBeTruthy();
    expect(screen.getByText("Live 3-2")).toBeTruthy();
  });
  it("uses the same local timezone for date and start time across UTC midnight", async () => {
    const options = Intl.DateTimeFormat().resolvedOptions();
    vi.spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions").mockReturnValue({ ...options, timeZone: "America/Los_Angeles" });
    mount([game(1, { startTimeUTC: "2026-01-02T03:00:00Z" })]);
    await screen.findByText("7:00 PM");
    expect(screen.getByText("Thu, Jan 1")).toBeTruthy();
  });
  it("does not crash on an invalid start time", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mount([game(1, { startTimeUTC: "invalid" })]);
    await screen.findByText("Time TBD");
    expect(screen.getByText("Date TBD")).toBeTruthy();
  });
  it("shows an explicit empty state", async () => {
    mount([]);
    await screen.findByText("No schedule data available for this team and season.");
  });

  it("shares team/season requests and refetches when team context changes", async () => {
    fetchSchedule.mockResolvedValue({ ok: true, json: async () => ({ games: [game(1)] }) });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const view = (teamId: number) => <QueryClientProvider client={client}>
      <OpponentGamelog teamId={teamId} seasonId={20252026} />
      <OpponentGamelog teamId={teamId} seasonId={20252026} />
    </QueryClientProvider>;
    const { rerender } = render(view(1));
    await screen.findAllByRole("table");
    expect(fetchSchedule).toHaveBeenCalledTimes(1);
    rerender(view(2));
    await screen.findAllByRole("table");
    expect(fetchSchedule).toHaveBeenCalledTimes(2);
    expect(fetchSchedule).toHaveBeenLastCalledWith(expect.stringContaining("/NYI/20252026"));
  });

  it("surfaces a failed schedule request", async () => {
    fetchSchedule.mockResolvedValue({ ok: false, status: 503 });
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <OpponentGamelog teamId={1} seasonId={20252026} />
    </QueryClientProvider>);
    await screen.findByText("Failed to load game log.");
  });
});
