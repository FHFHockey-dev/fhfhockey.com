import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import ForgeForecastsPage from "pages/forge/forecasts";
import { buildGameExpectations, type GameExpectationScope } from "lib/player-forecasts/gameExpectations";
import type { PlanningData } from "lib/rosterScheduleOptimizer/planningTypes";
vi.mock("next/head", () => ({ default: () => null }));
const now = new Date("2026-10-15T12:00:00Z");
const scope: GameExpectationScope = { seasonId: 20262027, startDate: "2026-10-15", endDate: "2026-10-18", timeZone: "UTC", mode: "next_n", games: 1 };
function payload() {
  const fixture: PlanningData = { players: [{ id: "7", nhlId: 77, nhlTeamId: 1, rosterRevision: "roster-a", name: "Synthetic Baseline Skater",
    teamAbbreviation: "MIN", eligiblePositions: ["LW"], playerClass: "skater", availability: "unknown", ownership: null,
    canDrop: null, holdValue: null, reserveEligibility: [] }], games: [{ id: "30", date: "2026-10-16", startsAt: "2026-10-16T23:00:00Z",
    teamAbbreviation: "MIN", opponent: "TOR", home: true, status: "scheduled", scheduleRevision: "schedule-a" }], forecasts: [],
    baselineSources: [{ playerId: 7, nhlPlayerId: 77, teamId: 1, seasonId: 20262027, kind: "baseline", sourceId: "native-synthetic-receipt",
      policyVersion: "native-rate-test-v1", released: true, allowedUses: { assignment: false, totals: false, comparison: false, conditionalTieBreak: true },
      rosterRevision: "roster-a", scheduleRevision: "catalog-schedule", targetKey: "SHOTS_ON_GOAL", mean: 4,
      unit: "count", basis: "per_appearance", participationIntegrated: false, sourceWatermark: "synthetic-input",
      cutoffAt: "2026-10-15T09:00:00Z", issuedAt: "2026-10-15T09:10:00Z", expiresAt: "2026-10-18T12:00:00Z" }],
    evidence: { schedule: { source: "synthetic", asOf: now.toISOString(), seasonId: 20262027, completeness: "complete", limitations: [] } } };
  return buildGameExpectations(fixture, scope, now);
}
beforeEach(() => vi.restoreAllMocks());
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
describe("FORGE forecast page synthetic API readback", () => {
  it("loads only on request and displays conditional lineage without inventing appearances or totals", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true, data: payload() }) });
    vi.stubGlobal("fetch", fetchMock); render(<ForgeForecastsPage />);
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Load released forecasts" }));
    await screen.findByText("Synthetic Baseline Skater", { selector: "a" });
    const totals = screen.getByRole("table", { name: /Expected totals/ });
    expect(within(totals).queryByText("4")).toBeNull();
    expect(screen.queryByText("4 (per appearance; conditional ability only)")).toBeNull();
    const details = screen.getByText("Synthetic Baseline Skater · game values and sources").closest("details")!;
    details.open = true; fireEvent(details, new Event("toggle"));
    expect(await screen.findByText("4 (per appearance; conditional ability only)")).toBeTruthy();
    expect(screen.getByText("Issued: 2026-10-15T09:10:00Z", { exact: false })).toBeTruthy();
    expect(screen.getByText("Sources: native-synthetic-receipt")).toBeTruthy();
    expect(screen.getByText("Appearance probability: Unavailable", { exact: false })).toBeTruthy();
    expect(screen.getByText(/TOR at MIN/)).toBeTruthy();
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ cache: "no-store" });
  });
  it("requests next-N and selected-week modes explicitly, without multiplying any page value", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true, data: payload() }) });
    vi.stubGlobal("fetch", fetchMock); render(<ForgeForecastsPage />);
    fireEvent.change(screen.getByLabelText("From (UTC)"), { target: { value: "2026-10-15" } });
    fireEvent.change(screen.getByLabelText("Team games"), { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: "Load released forecasts" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(String(fetchMock.mock.calls[0][0])).toContain("games=3");
    await screen.findByText("Synthetic Baseline Skater", { selector: "a" });
    fireEvent.change(screen.getByLabelText("Window"), { target: { value: "calendar" } });
    fireEvent.change(screen.getByLabelText("Through (UTC)"), { target: { value: "2026-10-18" } });
    fireEvent.click(screen.getByRole("button", { name: "Load released forecasts" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(String(fetchMock.mock.calls[1][0])).toContain("endDate=2026-10-18&mode=calendar");
  });
  it("renders unavailable coverage and retryable read errors without fabricated rows", async () => {
    const empty = { ...payload(), players: [] };
    const fetchMock = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, data: empty }) })
      .mockResolvedValueOnce({ ok: false, json: async () => ({ success: false, error: "Released forecasts are temporarily unavailable." }) });
    vi.stubGlobal("fetch", fetchMock); render(<ForgeForecastsPage />);
    fireEvent.click(screen.getByRole("button", { name: "Load released forecasts" }));
    await screen.findByText(/No released category values/);
    fireEvent.click(screen.getByRole("button", { name: "Load released forecasts" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Released forecasts are temporarily unavailable.");
    expect(screen.queryByRole("table")).toBeNull();
  });
  it("keeps calendar controls usable when the date field is cleared", () => {
    render(<ForgeForecastsPage />);
    fireEvent.change(screen.getByLabelText("Window"), { target: { value: "calendar" } });
    fireEvent.change(screen.getByLabelText("From (UTC)"), { target: { value: "" } });
    expect((screen.getByLabelText("From (UTC)") as HTMLInputElement).value).toBe("");
    expect(screen.getByRole("button", { name: "Load released forecasts" })).toBeTruthy();
  });
});
