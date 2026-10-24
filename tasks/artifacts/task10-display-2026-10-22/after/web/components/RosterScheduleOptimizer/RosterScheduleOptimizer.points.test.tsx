import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultWorkspace, writeWorkspace } from "lib/rosterScheduleOptimizer/workspace";
import type { PlanningData, PlanningPlayer, StatLine } from "lib/rosterScheduleOptimizer/planningTypes";
import { currentRsoUsePolicy } from "lib/player-forecasts/rsoUsePolicy";
import RosterScheduleOptimizer from "./RosterScheduleOptimizer";

vi.mock("contexts/AuthProviderContext", () => ({ useAuth: () => ({ user: null, teams: [] }) }));
vi.mock("lib/supabase/client", () => ({ default: { auth: { getSession: async () => ({ data: { session: null } }) } } }));
vi.mock("components/RosterScheduleOptimizer/canonicalSchedule", async original => ({
  ...await original<typeof import("./canonicalSchedule")>(),
  useCanonicalSchedule: () => ({ games: [], teams: [], complete: false, error: "Offline calendar fixture" }),
}));

afterEach(() => { cleanup(); localStorage.clear(); vi.unstubAllGlobals(); vi.useRealTimers(); vi.restoreAllMocks(); });

const now = "2026-10-22T12:00:00.000Z";
type Scenario = { goalie?: boolean; stats: StatLine; conditional?: StatLine; probability?: number | null; native?: boolean };
async function mount(scenario: Scenario) {
  vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date(now)); vi.stubGlobal("Worker", undefined);
  const workspace = defaultWorkspace(new Date(now));
  const revision = scenario.native ? "unreviewed-native:fixture" : "forge-daily-bridge-v1:display-fixture";
  const player: PlanningPlayer = { id: "7", nhlId: 77, nhlTeamId: 1, rosterRevision: "roster-a", name: "Synthetic player",
    teamAbbreviation: "MIN", eligiblePositions: [scenario.goalie ? "G" : "C"], playerClass: scenario.goalie ? "goalie" : "skater",
    eligibilityVerified: true, availability: "rostered", ownership: null, canDrop: true, holdValue: null, reserveEligibility: [] };
  const game = { id: "30", date: "2026-10-23", startsAt: "2026-10-23T20:00:00Z", teamAbbreviation: "MIN",
    opponent: "TOR", home: true, status: "scheduled" as const, scheduleRevision: "schedule-a" };
  const data: PlanningData = { players: [player], games: [game], forecasts: [], baselineSources: [], participationSources: [],
    evidence: { schedule: { source: "synthetic complete schedule", asOf: now, seasonId: 20262027, completeness: "complete", limitations: [] },
      forecasts: { source: "synthetic forecast", asOf: now, seasonId: 20262027, completeness: "complete", limitations: [] } },
    forecastManifest: { version: "planning-forecasts-v1", id: "display-read", seasonId: 20262027, asOf: now,
      scheduleRevision: "schedule-a", rosterRevision: "roster-a", issuedRevisionIds: [revision], baselineChecksum: null,
      requiredOpportunities: 1, forecastedOpportunities: 1, exclusionCounts: {},
      rsoUsePolicy: { version: "rso-target-use-v1", revision: currentRsoUsePolicy().revision, bridgeRevisionIds: scenario.native ? [] : [revision] } } };
  const wire = { version: "forge-daily-bridge-wire-v1", seasonId: 20262027, limitations: ["Synthetic display fixture"],
    runs: [[revision, revision, scenario.native ? "unreviewed-native" : "forge-daily-bridge-v1:fixture", now, now]],
    rows: [["7", "30", 0, "2026-10-24T00:00:00Z", scenario.stats, scenario.probability ?? null, false, scenario.conditional ?? null]] };
  workspace.context = { provider: "manual", seasonId: 20262027, leagueId: "fixture-league", teamId: "fixture-team",
    startDate: game.date, endDate: game.date, timeZone: "UTC", asOf: now };
  workspace.roster = [{ playerId: player.id, position: "active" }]; workspace.manualPlayers = [player];
  workspace.rules = { ...workspace.rules, lineupMode: "daily", rosterSlots: scenario.goalie ? { G: 1 } : { C: 1 },
    acquisitionTiming: "same_day", acquisitionCost: 1,
    periods: [{ id: "p", start: now, end: "2026-10-25T00:00:00Z", remaining: 2, source: "manager" }],
    scoring: { mode: "points", weights: scenario.goalie ? { SAVES_GOALIE: 0.2 } : { GOALS: 3, ASSISTS: 2 }, categories: [] } };
  workspace.lockedAssignments = [{ date: game.date, playerId: player.id, slotId: scenario.goalie ? "G#1" : "C#1", source: "manager" }];
  writeWorkspace(localStorage, workspace);
  const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.endsWith("/access")) return { ok: true, json: async () => ({ data: { eligible: false, capabilities: [] } }) } as Response;
    if (url.includes("/workspace?")) return { ok: true, json: async () => ({ data: null }) } as Response;
    if (!url.startsWith("/api/v1/roster-schedule-optimizer/data?")) throw new Error(`Unexpected offline fixture path: ${url}`);
    return { ok: true, json: async () => ({ success: true, data: structuredClone(data), bridgeForecasts: structuredClone(wire),
      read: { nonce: (init?.headers as Record<string, string>)["X-RSO-Read-Nonce"], evaluatedAt: now } }) } as Response;
  });
  vi.stubGlobal("fetch", fetcher);
  render(<RosterScheduleOptimizer />);
  fireEvent.click(screen.getByRole("button", { name: "By position" }));
  const cell = await screen.findByRole("button", { name: `Synthetic player, ${scenario.goalie ? "G" : "C"}, ${game.date}` });
  await waitFor(() => expect(within(cell).getByLabelText(/Expected fantasy points:/)).toBeTruthy());
  return { cell: within(cell), fetcher };
}

describe("RSO live grid points callback", () => {
  it("renders complete FP from the current admitted read", async () => {
    const { cell, fetcher } = await mount({ stats: { GOALS: 1, ASSISTS: 2 } });
    expect(cell.getByLabelText("Expected fantasy points: 7.0")).toBeTruthy();
    expect(fetcher.mock.calls.filter(([url]) => url.includes("/data?"))).toHaveLength(1);
  });

  it("renders unavailable FP for a missing weighted key instead of the known subtotal", async () => {
    const { cell } = await mount({ stats: { GOALS: 1 } });
    expect(cell.getByLabelText("Expected fantasy points: unavailable").textContent).toBe("—");
    expect(cell.queryByText("3.0")).toBeNull();
  });

  it("renders goalie expected and if-starts FP with distinct semantics", async () => {
    const { cell } = await mount({ goalie: true, stats: { SAVES_GOALIE: 11.55 }, conditional: { SAVES_GOALIE: 21 }, probability: 0.55 });
    expect(cell.getByLabelText("Expected fantasy points: 2.3").textContent).toBe("2.3 expected");
    expect(cell.getByLabelText("Fantasy points if starts: 4.2").textContent).toBe("4.2 if starts");
  });

  it.each([0, null])("does not invent an if-starts estimate at start probability %s", async probability => {
    const { cell } = await mount({ goalie: true, stats: { SAVES_GOALIE: 0 }, probability });
    expect(cell.getByLabelText("Fantasy points if starts: unavailable").textContent).toBe("— if starts");
    expect(cell.queryByText(/NaN|Infinity/)).toBeNull();
  });

  it("does not admit numeric native forecasts without target review", async () => {
    const { cell } = await mount({ goalie: true, stats: { SAVES_GOALIE: 11.55 }, conditional: { SAVES_GOALIE: 21 }, probability: 0.55, native: true });
    expect(cell.getByLabelText("Expected fantasy points: unavailable")).toBeTruthy();
    expect(cell.getByLabelText("Fantasy points if starts: unavailable")).toBeTruthy();
    expect(cell.queryByText("2.3 expected")).toBeNull();
    expect(cell.queryByText("4.2 if starts")).toBeNull();
  });
});
