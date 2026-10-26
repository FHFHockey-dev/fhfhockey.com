import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { PlanIntent, PlanningData, PlanningSnapshot, PlanningWorkspace } from "lib/rosterScheduleOptimizer/planningTypes";
import { executeRosterPlanning } from "lib/rosterScheduleOptimizer/executionAdapter";
import { currentRsoUsePolicy } from "lib/player-forecasts/rsoUsePolicy";
import { defaultWorkspace, readWorkspace, readWorkspaceHistory, writeWorkspace } from "lib/rosterScheduleOptimizer/workspace";

const auth = vi.hoisted(() => ({ user: null as { id: string } | null }));
vi.mock("contexts/AuthProviderContext", () => ({ useAuth: () => auth }));
vi.mock("lib/supabase/client", () => ({ default: {
  auth: { getSession: async () => ({ data: { session: auth.user ? { access_token: "synthetic-test-token" } : null } }) },
  from: () => ({ select: () => ({ eq: async () => ({ data: [] }) }) }),
} }));
vi.mock("components/RosterScheduleOptimizer/canonicalSchedule", async original => ({
  ...await original<typeof import("components/RosterScheduleOptimizer/canonicalSchedule")>(),
  useCanonicalSchedule: () => ({ games: [], teams: [], complete: false, error: "Synthetic calendar only" }),
}));
import RosterScheduleOptimizer from "components/RosterScheduleOptimizer/RosterScheduleOptimizer";

const scrollDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollIntoView");
type Packet = { snapshot: PlanningSnapshot; intent: PlanIntent; options?: Parameters<typeof executeRosterPlanning>[2];
  candidateOptions?: Parameters<typeof executeRosterPlanning>[3] };
// Runs the real worker body: one current read feeds the plan and its candidate comparisons.
class LocalPlanningWorker {
  static packets: Array<{ packet: Packet }> = [];
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: (() => void) | null = null;
  stopped = false;
  constructor(private url: URL) {}
  postMessage(packet: Packet) {
    const copied = structuredClone(packet);
    LocalPlanningWorker.packets.push({ packet: copied });
    void executeRosterPlanning(copied.snapshot, copied.intent, copied.options, copied.candidateOptions)
      .then(result => { if (!this.stopped) this.onmessage?.({ data: structuredClone(result) }); });
  }
  terminate() { this.stopped = true; }
}
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-10-04T12:00:00Z"));
  vi.stubGlobal("Worker", LocalPlanningWorker);
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { callback(0); return 0; });
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
});
afterEach(() => {
  cleanup(); window.localStorage.clear(); window.sessionStorage.clear(); auth.user = null;
  if (scrollDescriptor) Object.defineProperty(HTMLElement.prototype, "scrollIntoView", scrollDescriptor);
  else Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
  LocalPlanningWorker.packets = []; vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals();
});

function fixture(provider: "manual" | "yahoo") {
  auth.user = provider === "yahoo" ? { id: "synthetic-rules-manager" } : null;
  const workspace = defaultWorkspace();
  workspace.context = { ...workspace.context, provider, leagueId: "fixture-league", teamId: "fixture-team",
    startDate: "2026-10-05", endDate: "2026-10-06", timeZone: "America/New_York" };
  const players = ["a", "b", "c"].map((id, index) => ({ id, nhlId: index + 1, nhlTeamId: index + 1,
    rosterRevision: `fixture-roster-${id}`, name: id === "c" ? "Candidate schedule gain" : `Original ${id}`,
    teamAbbreviation: id.toUpperCase(), eligiblePositions: ["C"], eligibilityVerified: true, playerClass: "skater" as const,
    availability: index < 2 ? "rostered" as const : "free_agent" as const, ownership: null, canDrop: true, holdValue: null, reserveEligibility: [] }));
  workspace.roster = [{ playerId: "a", position: "active" }, { playerId: "b", position: "bench" }];
  workspace.manualPlayers = players; workspace.intent.protectedPlayerIds = ["a"];
  workspace.rules = { ...workspace.rules, rosterSlots: { C: 1, BN: 1 }, acquisitionCost: provider === "yahoo" ? 2 : null,
    scoring: { mode: "points", weights: { GOALS: 3 }, categories: [] } };
  const data: PlanningData = { players, games: players.map(player => { const date = player.id === "c" ? "2026-10-05" : "2026-10-06";
    return { id: `game-${player.id}`, date, startsAt: `${date}T20:00:00Z`, teamAbbreviation: player.teamAbbreviation, opponent: "X", home: true, status: "scheduled" }; }),
    forecasts: [], evidence: { schedule: { source: "Complete synthetic schedule", asOf: workspace.context.asOf,
      seasonId: workspace.context.seasonId, completeness: "complete", limitations: [] } },
    forecastManifest: { version: "planning-forecasts-v1", id: "current-read", seasonId: workspace.context.seasonId, asOf: workspace.context.asOf,
      scheduleRevision: "schedule", rosterRevision: "roster", issuedRevisionIds: [], baselineChecksum: null,
      requiredOpportunities: 3, forecastedOpportunities: 0, exclusionCounts: {},
      rsoUsePolicy: { version: "rso-target-use-v1", revision: currentRsoUsePolicy().revision, bridgeRevisionIds: [] } } };
  const snapshot: PlanningSnapshot = { ...data, id: "yahoo:synthetic-rules", context: workspace.context, roster: workspace.roster,
    rules: workspace.rules, lockedAssignments: [], realized: {}, opponent: null };
  const response = (body: unknown) => Promise.resolve({ ok: true, status: 200, json: async () => structuredClone(body) });
  const fetch = vi.fn((url: string, init?: RequestInit) => {
    if (url.includes("/data?")) return response({ success: true, data, read: {
      nonce: (init?.headers as Record<string, string>)["X-RSO-Read-Nonce"], evaluatedAt: workspace.context.asOf } });
    if (url.endsWith("/access")) return response({ data: { eligible: provider === "yahoo", capabilities: provider === "yahoo" ? ["rso_sync"] : [] } });
    if (url.includes("/workspace?") && !init?.method) return response({ data: null });
    if (provider === "yahoo" && url.endsWith("/provider") && init?.method === "POST") return response({ success: true, snapshot,
      capabilities: { roster: true, availability: true, rules: false, acquisitions: false, limitations: [] } });
    throw new Error(`Unexpected synthetic request ${url}`);
  });
  vi.stubGlobal("fetch", fetch); writeWorkspace(window.localStorage, workspace, [], auth.user?.id ?? null);
  return { workspace, snapshot, fetch };
}
function saved(context: PlanningWorkspace["context"]) { return readWorkspace(window.localStorage, context, auth.user?.id ?? null)!; }
function candidate() { return document.querySelector<HTMLElement>('[data-rso-candidate-id="c"]')!; }

it.each(["manual", "yahoo"] as const)("collects only missing %s acquisition rules and automatically compares an empty plan after workspace reopen", async provider => {
  const state = fixture(provider), originalIntent = structuredClone(state.workspace.intent), originalRules = structuredClone(state.workspace.rules);
  const first = render(<RosterScheduleOptimizer />);
  await waitFor(() => expect(candidate()).toBeTruthy());
  // Missing add timing is explained once, in plain words, in the panel's "Why some players aren't ranked" list.
  await waitFor(() => expect(within(screen.getByRole("list", { name: "Why some players aren't ranked" })).getByText("Your league's add rules (timing or moves left) aren't set yet.")).toBeTruthy());
  const initialEvaluations = LocalPlanningWorker.packets.length;
  const initialRequests = state.fetch.mock.calls.length;
  if (provider === "manual") fireEvent.click(screen.getByRole("button", { name: /^League settings/ }));
  else {
    // Existing planner messages point to this disclosure; keep that entry actionable too.
    fireEvent.click(screen.getByText("Scoring, budgets, and lock windows", { selector: "summary" }));
    fireEvent.click(screen.getByRole("button", { name: "Review acquisition rules" }));
  }
  // One existing entry point must expose the missing timing, counting cost and allowance controls together.
  const timing = screen.getByRole("combobox", { name: "Acquisition timing" });
  if (provider === "yahoo") expect(document.activeElement).toBe(timing);
  const cost = screen.getByRole("spinbutton", { name: "Acquisition cost" });
  const addPeriod = screen.getByRole("button", { name: "Add acquisition period" });
  for (const control of [timing, cost, addPeriod]) for (let parent = control.parentElement; parent; parent = parent.parentElement) {
    if (parent.tagName === "DETAILS") expect((parent as HTMLDetailsElement).open, `${control.tagName} remains inside a closed disclosure`).toBe(true);
  }
  expect(timing).toHaveProperty("value", "unknown"); expect(cost).toHaveProperty("value", provider === "yahoo" ? "2" : "");
  expect(saved(state.workspace.context).rules.periods).toEqual([]);
  fireEvent.change(timing, { target: { value: "next_day" } });
  if (provider === "manual") fireEvent.change(cost, { target: { value: "2" } });
  expect(saved(state.workspace.context).rules.periods).toEqual([]);
  const fillPeriod = (index: number, start: string, end: string, remaining: string) => {
    fireEvent.click(addPeriod);
    const row = screen.getAllByLabelText("Period")[index].closest("div")!;
    expect(within(row).getByLabelText("Moves left")).toHaveProperty("value", "");
    fireEvent.change(within(row).getByLabelText("Start"), { target: { value: start } });
    fireEvent.change(within(row).getByLabelText("End"), { target: { value: end } });
    fireEvent.change(within(row).getByLabelText("Moves left"), { target: { value: remaining } });
  };
  fillPeriod(0, "2026-10-04", "2026-10-05", "2");
  fillPeriod(1, "2026-10-06", "2026-10-07", "4");
  await waitFor(() => expect(within(candidate()).getByLabelText("Net plan comparison").textContent).toBe("—Net Pts+1Net AGP"));
  const persisted = saved(state.workspace.context);
  expect(persisted.managerRuleOverrides).toMatchObject({ acquisitionTiming: "next_day", ...(provider === "manual" ? { acquisitionCost: 2 } : {}), periods: [
    { start: "2026-10-04T04:00:00.000Z", end: "2026-10-06T04:00:00.000Z", remaining: 2, source: "manager" },
    { start: "2026-10-06T04:00:00.000Z", end: "2026-10-08T04:00:00.000Z", remaining: 4, source: "manager" },
  ] });
  expect(persisted.rules.rosterSlots).toEqual(originalRules.rosterSlots); expect(persisted.rules.scoring).toEqual(originalRules.scoring);
  if (provider === "yahoo") expect(persisted.managerRuleOverrides).not.toHaveProperty("acquisitionCost");
  expect(persisted.intent).toEqual(originalIntent); expect(readWorkspaceHistory(window.localStorage, persisted, auth.user?.id ?? null).length).toBeGreaterThan(0);
  expect(LocalPlanningWorker.packets.length).toBeGreaterThan(initialEvaluations);
  expect(LocalPlanningWorker.packets.every(row => row.packet.intent.steps.length === 0)).toBe(true);
  expect(state.fetch.mock.calls.some(([, init]) => init?.method === "PUT")).toBe(false);
  // Rule edits send nothing; each re-plan makes only its own current-read GET.
  expect(state.fetch.mock.calls.slice(initialRequests).every(([url, init]) => url.includes("/data?") && init?.method === "GET")).toBe(true);
  first.unmount();
  render(<RosterScheduleOptimizer />);
  await waitFor(() => expect(candidate() && within(candidate()).getByLabelText("Net plan comparison").textContent).toBe("—Net Pts+1Net AGP"));
  expect(saved(state.workspace.context).managerRuleOverrides).toEqual(persisted.managerRuleOverrides);
  expect(saved(state.workspace.context).intent).toEqual(originalIntent);
  expect(LocalPlanningWorker.packets.every(row => row.packet.intent.steps.length === 0)).toBe(true);
});

it.each(["manual", "yahoo"] as const)("saves and reopens explicit Monday 03:00 %s periods without applying drafts or supplying unknown future allowances", async provider => {
  const state = fixture(provider), originalIntent = structuredClone(state.workspace.intent);
  const first = render(<RosterScheduleOptimizer />);
  await waitFor(() => expect(candidate()).toBeTruthy());
  const initialRequests = state.fetch.mock.calls.length;
  fireEvent.click(screen.getByRole("button", { name: /^League settings/ }));
  fireEvent.click(screen.getByRole("button", { name: "Add acquisition period" }));
  const before = saved(state.workspace.context).rules.periods[0];
  expect(before.remaining).toBeNull(); expect(before).not.toHaveProperty("timeZone");
  fireEvent.click(screen.getByText("Exact period times", { selector: "summary" }));
  fireEvent.change(screen.getByLabelText("Boundary time zone"), { target: { value: "America/New_York" } });
  fireEvent.change(screen.getByLabelText("Exact start"), { target: { value: "2026-10-05T03:00" } });
  fireEvent.change(screen.getByLabelText("Exact end"), { target: { value: "2026-10-12T03:00" } });
  expect(saved(state.workspace.context).rules.periods).toEqual([before]);
  fireEvent.click(screen.getByRole("button", { name: "Apply exact boundaries" }));
  const exact = { ...before, start: "2026-10-05T07:00:00.000Z", end: "2026-10-12T07:00:00.000Z", timeZone: "America/New_York", source: "manager" };
  expect(saved(state.workspace.context).rules.periods).toEqual([exact]);
  expect(saved(state.workspace.context).rules.acquisitionTiming).toBe("unknown");
  expect(saved(state.workspace.context).rules.acquisitionCost).toBe(provider === "yahoo" ? 2 : null);
  expect(screen.queryByLabelText("Start")).toBeNull(); expect(screen.queryByLabelText("End")).toBeNull();
  // A rejected draft never replaces the last valid persisted exact bounds.
  fireEvent.change(screen.getByLabelText("Exact end"), { target: { value: "2026-10-04T03:00" } });
  fireEvent.click(screen.getByRole("button", { name: "Apply exact boundaries" }));
  expect(screen.getByRole("alert").textContent).toContain("end must be after");
  expect(saved(state.workspace.context).rules.periods).toEqual([exact]);
  fireEvent.change(screen.getByLabelText("Acquisition timing"), { target: { value: "same_day" } });
  if (provider === "manual") fireEvent.change(screen.getByLabelText("Acquisition cost"), { target: { value: "1" } });
  fireEvent.change(screen.getByLabelText("Moves left"), { target: { value: "2" } });
  const persisted = saved(state.workspace.context);
  expect(persisted.rules.periods).toEqual([{ ...exact, remaining: 2 }]);
  expect(persisted.managerRuleOverrides?.periods).toEqual(persisted.rules.periods);
  expect(persisted.rules.acquisitionCost).toBe(provider === "yahoo" ? 2 : 1);
  if (provider === "yahoo") expect(persisted.managerRuleOverrides).not.toHaveProperty("acquisitionCost");
  expect(persisted.intent).toEqual(originalIntent);
  expect(readWorkspaceHistory(window.localStorage, persisted, auth.user?.id ?? null).length).toBeGreaterThan(0);
  // Rule edits send nothing; each re-plan makes only its own current-read GET.
  expect(state.fetch.mock.calls.slice(initialRequests).every(([url, init]) => url.includes("/data?") && init?.method === "GET")).toBe(true);
  expect(state.fetch.mock.calls.some(([, init]) => init?.method === "PUT")).toBe(false);
  first.unmount(); render(<RosterScheduleOptimizer />);
  await waitFor(() => expect(candidate()).toBeTruthy());
  fireEvent.click(screen.getByRole("button", { name: /^League settings/ }));
  expect(screen.getByLabelText("Exact start")).toHaveProperty("value", "2026-10-05T03:00");
  expect(screen.getByLabelText("Exact end")).toHaveProperty("value", "2026-10-12T03:00");
  expect(screen.getByLabelText("Boundary time zone")).toHaveProperty("value", "America/New_York");
  expect(screen.getByLabelText("Moves left")).toHaveProperty("value", "2");
  expect(saved(state.workspace.context).managerRuleOverrides).toEqual(persisted.managerRuleOverrides);
  expect(saved(state.workspace.context).intent).toEqual(originalIntent);
  expect(LocalPlanningWorker.packets.every(row => row.packet.intent.steps.length === 0)).toBe(true);
});
