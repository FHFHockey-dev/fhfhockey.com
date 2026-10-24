import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
type Control = { mode: "current" | "reject" | "replay" | "revoked" | "expired" };
type Scenario = { weights?: Record<string, number>; control?: Control; goalie?: boolean; stats: StatLine; conditional?: StatLine; probability?: number | null; native?: boolean };
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
    scoring: { mode: "points", weights: scenario.weights ?? (scenario.goalie ? { SAVES_GOALIE: 0.2 } : { GOALS: 3, ASSISTS: 2 }), categories: [] } };
  workspace.lockedAssignments = [{ date: game.date, playerId: player.id, slotId: scenario.goalie ? "G#1" : "C#1", source: "manager" }];
  writeWorkspace(localStorage, workspace);
  let savedBody: unknown;
  const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.endsWith("/access")) return { ok: true, json: async () => ({ data: { eligible: false, capabilities: [] } }) } as Response;
    if (url.includes("/workspace?")) return { ok: true, json: async () => ({ data: null }) } as Response;
    if (!url.startsWith("/api/v1/roster-schedule-optimizer/data?")) throw new Error(`Unexpected offline fixture path: ${url}`);
    if (scenario.control?.mode === "reject") throw new Error("synthetic rejected refresh");
    let body = { success: true, data: structuredClone(data), bridgeForecasts: structuredClone(wire),
      read: { nonce: (init?.headers as Record<string, string>)["X-RSO-Read-Nonce"], evaluatedAt: now } };
    if (scenario.control?.mode === "revoked") body.data.forecastManifest!.rsoUsePolicy!.bridgeRevisionIds = [];
    if (scenario.control?.mode === "expired") body.bridgeForecasts.rows[0][3] = "2026-10-22T11:00:00Z";
    const responseBody = scenario.control?.mode === "replay" ? savedBody : body;
    savedBody ??= structuredClone(body);
    return { ok: true, json: async () => structuredClone(responseBody) } as Response;
  });
  vi.stubGlobal("fetch", fetcher);
  render(<RosterScheduleOptimizer />);
  fireEvent.click(screen.getByRole("button", { name: "By position" }));
  const cell = await screen.findByRole("button", { name: `Synthetic player, ${scenario.goalie ? "G" : "C"}, ${game.date}` });
  await waitFor(() => expect(within(cell).getByLabelText(/Expected fantasy points:/)).toBeTruthy());
  return { cell: within(cell), fetcher, data, wire, workspace };
}


const skaterKeys = ["GOALS", "ASSISTS", "POINTS", "PLUS_MINUS", "PENALTY_MINUTES", "PP_GOALS", "PP_ASSISTS", "PP_POINTS",
  "SH_GOALS", "SH_ASSISTS", "SH_POINTS", "GAME_WINNING_GOALS", "SHOTS_ON_GOAL", "FACEOFFS_WON", "FACEOFFS_LOST", "HITS", "BLOCKED_SHOTS"];
const goalieKeys = ["WINS_GOALIE", "LOSSES_GOALIE", "GOALS_AGAINST_GOALIE", "SHOTS_AGAINST_GOALIE", "SAVES_GOALIE", "SHUTOUTS_GOALIE", "GAMES_STARTED"];
const map = (keys: string[], value: number) => Object.fromEntries(keys.map(key => [key, value]));

describe("independent combined actual UI scoring", () => {
  it.each([...skaterKeys.map(key => [false, key] as const), ...goalieKeys.map(key => [true, key] as const)])(
    "withholds full FP when weighted goalie=%s key=%s is absent", async (goalie, key) => {
      const keys = goalie ? goalieKeys : skaterKeys;
      const stats = map(keys, 1); delete stats[key];
      const { cell } = await mount({ goalie, stats, weights: map(keys, 2), probability: 0.5, conditional: map(keys, 3) });
      expect(cell.getByLabelText("Expected fantasy points: unavailable")).toBeTruthy();
      expect(cell.getByLabelText(/Expected fantasy points:/).getAttribute("data-tier")).toBeNull();
    });
  it.each([false, true])("preserves all observed zeros for goalie=%s", async goalie => {
    const keys = goalie ? goalieKeys : skaterKeys;
    const { cell } = await mount({ goalie, stats: map(keys, 0), conditional: map(keys, 0), weights: map(keys, 2), probability: 0 });
    expect(cell.getByLabelText("Expected fantasy points: 0.0")).toBeTruthy();
    if (goalie) expect(cell.getByLabelText("Fantasy points if starts: 0.0")).toBeTruthy();
  });
  it.each([false, true])("sums every supplied category including negative weights for goalie=%s", async goalie => {
    const keys = goalie ? goalieKeys : skaterKeys;
    const weights = Object.fromEntries(keys.map((key, index) => [key, index % 2 ? -1 : 2]));
    const expected = Object.values(weights).reduce((a, b) => a + b, 0);
    const { cell } = await mount({ goalie, stats: map(keys, 1), conditional: map(keys, 3), weights, probability: 0.5 });
    expect(cell.getByLabelText(`Expected fantasy points: ${expected.toFixed(1)}`)).toBeTruthy();
    if (goalie) expect(cell.getByLabelText(`Fantasy points if starts: ${(expected * 3).toFixed(1)}`)).toBeTruthy();
  });
  it.each([0, null, 0.5])("does not divide known conditional means again at start probability %s", async probability => {
    const { cell } = await mount({ goalie: true, stats: { SAVES_GOALIE: 0 }, conditional: { SAVES_GOALIE: 21 }, probability });
    expect(cell.getByLabelText("Expected fantasy points: 0.0")).toBeTruthy();
    expect(cell.getByLabelText("Fantasy points if starts: 4.2")).toBeTruthy();
  });
  it("withholds a partial conditional total while preserving the complete unconditional total", async () => {
    const { cell } = await mount({ goalie: true, stats: { SAVES_GOALIE: 10, WINS_GOALIE: 0.5 },
      conditional: { SAVES_GOALIE: 20 }, probability: 0.5, weights: { SAVES_GOALIE: 0.2, WINS_GOALIE: 3 } });
    expect(cell.getByLabelText("Expected fantasy points: 3.5")).toBeTruthy();
    expect(cell.getByLabelText("Fantasy points if starts: unavailable")).toBeTruthy();
  });
  it.each(["reject", "replay", "revoked", "expired"] as const)("removes displayed numbers and fails closed after %s refresh", async mode => {
    const control: Control = { mode: "current" };
    const { cell, fetcher } = await mount({ goalie: true, stats: { SAVES_GOALIE: 11.55 }, conditional: { SAVES_GOALIE: 21 }, probability: 0.55, control });
    expect(cell.getByLabelText("Expected fantasy points: 2.3")).toBeTruthy();
    let online = true;
    vi.spyOn(navigator, "onLine", "get").mockImplementation(() => online);
    online = false;
    act(() => window.dispatchEvent(new Event("offline")));
    expect(screen.queryByLabelText("Expected fantasy points: 2.3")).toBeNull();
    expect(screen.queryByLabelText("Fantasy points if starts: 4.2")).toBeNull();
    await waitFor(() => expect(screen.getByRole("button", { name: "Synthetic player, G, 2026-10-23" })).toBeTruthy());
    control.mode = mode; online = true;
    act(() => window.dispatchEvent(new Event("online")));
    await waitFor(() => expect(fetcher.mock.calls.filter(([url]) => url.includes("/data?"))).toHaveLength(2));
    await waitFor(() => expect(screen.getByLabelText("Expected fantasy points: unavailable")).toBeTruthy());
    expect(screen.getByLabelText("Fantasy points if starts: unavailable")).toBeTruthy();
    expect(screen.queryByLabelText("Expected fantasy points: 2.3")).toBeNull();
    expect(screen.queryByLabelText("Fantasy points if starts: 4.2")).toBeNull();
  });
});

it.each(goalieKeys)("does not require goalie-only weighted %s to complete a skater game", async key => {
  const { cell } = await mount({ stats: { GOALS: 1, ASSISTS: 2 }, weights: { GOALS: 3, ASSISTS: 2, [key]: -2 } });
  expect(cell.getByLabelText("Expected fantasy points: 7.0")).toBeTruthy();
});
