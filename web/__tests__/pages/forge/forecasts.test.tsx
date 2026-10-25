import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import ForgeForecastsPage from "pages/forge/forecasts";
import { buildGameExpectations, type GameExpectationScope } from "lib/player-forecasts/gameExpectations";
import { buildGameExpectationView } from "lib/player-forecasts/gameExpectationView";
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
beforeEach(() => { vi.restoreAllMocks(); vi.spyOn(Date, "now").mockReturnValue(now.getTime()); });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });
describe("FORGE forecast page synthetic API readback", () => {
  it("shows a conditional-only head immediately without multiplying it into next-N totals", async () => {
    const data = payload(), player = data.players[0];
    data.scope.games = 3; player.requestedGames = 3;
    const target = player.games[0].targets.SHOTS_ON_GOAL;
    target.methodVersions = ["current-season-sog-appearance-mean-v1"];
    target.sources[0].methodVersion = "current-season-sog-appearance-mean-v1";
    player.games[0].limitations = ["SOG support: 2 positive-minute appearances; dates 2026-10-08, 2026-10-10.",
      "Original conditional forecast generated: 2026-10-15T09:10:00Z; calibration unavailable."];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true, data: buildGameExpectationView(data) }) }));
    render(<ForgeForecastsPage />); fireEvent.click(screen.getByRole("button", { name: "Load released forecasts" }));
    const conditional = await screen.findByRole("table", { name: "Conditional category values for admitted games" });
    expect(within(conditional).getAllByRole("row")).toHaveLength(2);
    expect(within(conditional).getByText("4")).toBeTruthy();
    expect(within(conditional).getByText("Per positive-minute appearance")).toBeTruthy();
    expect(within(conditional).queryByText("12")).toBeNull();
    expect(within(screen.getByRole("table", { name: /Expected totals/ })).queryByText("4")).toBeNull();
    const details = screen.getByText("Synthetic Baseline Skater · game values and sources").closest("details")!;
    details.open = true; fireEvent(details, new Event("toggle"));
    expect(await screen.findByText(/SOG support: 2 positive-minute appearances/)).toBeTruthy();
    expect(screen.getByText(/Contribution issued: 2026-10-15T09:10:00Z/)).toBeTruthy();
    expect(screen.getByText(/Appearance probability: Unavailable/)).toBeTruthy();
  });
  it("labels explicit modeled participation independently of source means and confirmation", async () => {
    const data = payload(), game = data.players[0].games[0], target = game.targets.SHOTS_ON_GOAL;
    target.participation = { revisionId: "synthetic-model-receipt", probability: 0.5, basis: "appearance",
      cutoffAt: "2026-10-15T10:00:00Z", issuedAt: "2026-10-15T11:00:00Z", expiresAt: "2026-10-15T18:00:00Z",
      model: { version: "skater-participation-frequency-v1", event: "positive_minutes", calibration: "unavailable",
        probabilityStatus: "uncalibrated_model", inputHash: "a".repeat(64), evidenceHashes: ["b".repeat(64)],
        sampleSize: 2, limitations: ["Synthetic engineering only."] } };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true, data: buildGameExpectationView(data) }) }));
    render(<ForgeForecastsPage />); fireEvent.click(screen.getByRole("button", { name: "Load released forecasts" }));
    await screen.findByText("Synthetic Baseline Skater", { selector: "a" });
    const details = screen.getByText("Synthetic Baseline Skater · game values and sources").closest("details")!;
    details.open = true; fireEvent(details, new Event("toggle"));
    expect(await screen.findByText(/Participation model estimate · calibration unavailable · 2 eligible games/)).toBeTruthy();
    expect(screen.queryByText(/Confirmed appearance/)).toBeNull();
  });
  it("loads only on request and displays conditional lineage without inventing appearances or totals", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true, data: buildGameExpectationView(payload()) }) });
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
    expect(screen.getByText("Power-play role: Unavailable. Current role evidence is unavailable.")).toBeTruthy();
    expect(screen.getByText("Appearance probability: Unavailable", { exact: false })).toBeTruthy();
    expect(screen.getByRole("heading", { name: /TOR at MIN/ })).toBeTruthy();
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ cache: "no-store" });
  });
  it("requests next-N and selected-week modes explicitly, without multiplying any page value", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true, data: buildGameExpectationView(payload()) }) });
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
    const fetchMock = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, data: buildGameExpectationView(empty) }) })
      .mockResolvedValueOnce({ ok: false, json: async () => ({ success: false, error: "Released forecasts are temporarily unavailable." }) });
    vi.stubGlobal("fetch", fetchMock); render(<ForgeForecastsPage />);
    fireEvent.click(screen.getByRole("button", { name: "Load released forecasts" }));
    await screen.findByText(/No released category values/);
    fireEvent.click(screen.getByRole("button", { name: "Load released forecasts" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Released forecasts are temporarily unavailable.");
    expect(screen.queryByRole("table")).toBeNull();
  });
  it.each(["target", "independent start"])("invalidates expired %s evidence and recovers only after loading a fresh revision", async kind => {
    vi.useFakeTimers(); vi.setSystemTime(now);
    const original = payload();
    if (kind === "target") original.players[0].games[0].targets.SHOTS_ON_GOAL.expiresAt = "2026-10-15T12:00:01Z";
    else original.players[0].games[0].startParticipation = { revisionId: "synthetic-start", basis: "start", probability: 0.25,
      cutoffAt: "2026-10-15T10:00:00Z", issuedAt: "2026-10-15T11:00:00Z", expiresAt: "2026-10-15T12:00:01Z" };
    const fresh = payload(); fresh.manifestId = "fresh-revision";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, data: buildGameExpectationView(original) }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, data: buildGameExpectationView(fresh) }) }));
    render(<ForgeForecastsPage />);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Load released forecasts" })));
    expect(screen.getByRole("table", { name: "Conditional category values for admitted games" })).toBeTruthy();
    await act(async () => vi.advanceTimersByTimeAsync(1000));
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.getByRole("alert").textContent).toContain("expired");
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Load released forecasts" })));
    expect(screen.getByRole("table", { name: "Conditional category values for admitted games" })).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });
  it("withholds an already expired participation receipt even when contribution clocks are fresh", async () => {
    const original = payload(), target = original.players[0].games[0].targets.SHOTS_ON_GOAL;
    target.participation = { revisionId: "expired-participation", probability: 0.5, basis: "appearance",
      cutoffAt: "2026-10-15T09:00:00Z", issuedAt: "2026-10-15T10:00:00Z", expiresAt: now.toISOString() };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true, data: buildGameExpectationView(original) }) }));
    render(<ForgeForecastsPage />);
    fireEvent.click(screen.getByRole("button", { name: "Load released forecasts" }));
    expect((await screen.findByRole("alert")).textContent).toContain("expired");
    expect(screen.queryByRole("table")).toBeNull();
  });
  it("keeps a fresh revision usable when an unavailable target retains an expired original receipt", async () => {
    const fresh = payload();
    fresh.players[0].games[0].targets.GOALS.expiresAt = "2026-10-15T11:00:00Z";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true, data: buildGameExpectationView(fresh) }) }));
    render(<ForgeForecastsPage />);
    fireEvent.click(screen.getByRole("button", { name: "Load released forecasts" }));
    expect(await screen.findByRole("table", { name: "Conditional category values for admitted games" })).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });
  it("offers a 20-team-game horizon", () => {
    render(<ForgeForecastsPage />);
    expect(screen.getByRole("option", { name: "20" })).toBeTruthy();
  });
  it("keeps calendar controls usable when the date field is cleared", () => {
    render(<ForgeForecastsPage />);
    fireEvent.change(screen.getByLabelText("Window"), { target: { value: "calendar" } });
    fireEvent.change(screen.getByLabelText("From (UTC)"), { target: { value: "" } });
    expect((screen.getByLabelText("From (UTC)") as HTMLInputElement).value).toBe("");
    expect(screen.getByRole("button", { name: "Load released forecasts" })).toBeTruthy();
  });
});
