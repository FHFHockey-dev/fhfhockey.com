import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { candidatePlanMetrics, type CandidatePlanOptions } from "lib/rosterScheduleOptimizer/candidatePlanMetrics";
import type { PlanIntent, PlanningSnapshot } from "lib/rosterScheduleOptimizer/planningTypes";
import { defaultWorkspace } from "lib/rosterScheduleOptimizer/workspace";
import CandidateBrowser from "./CandidateBrowser";

type Packet = { snapshot: PlanningSnapshot; intent: PlanIntent; candidateOptions?: CandidatePlanOptions };
// Exercise the real hook/message/solver/UI path in isolation; browser Worker packaging is outside this test.
class LocalCandidateWorker {
  static instances: LocalCandidateWorker[] = [];
  onmessage: ((event: { data: { metrics?: ReturnType<typeof candidatePlanMetrics>; error?: string } }) => void) | null = null;
  onerror: (() => void) | null = null;
  stopped = false;
  postMessage = vi.fn((packet: Packet) => {
    const copied = structuredClone(packet);
    queueMicrotask(() => {
      if (this.stopped) return;
      try { this.onmessage?.({ data: { metrics: candidatePlanMetrics(copied.snapshot, copied.intent, copied.candidateOptions) } }); }
      catch { this.onmessage?.({ data: { error: "Candidate comparisons could not complete." } }); }
    });
  });
  terminate() { this.stopped = true; }
  constructor() { LocalCandidateWorker.instances.push(this); }
}

beforeEach(() => {
  vi.stubGlobal("Worker", LocalCandidateWorker);
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Unexpected network request"); }));
  for (const method of ["getItem", "setItem", "removeItem", "clear"] as const) {
    vi.spyOn(Storage.prototype, method).mockImplementation(() => { throw new Error("Unexpected storage interaction"); });
  }
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); LocalCandidateWorker.instances = []; });

function fixture() {
  const workspace = defaultWorkspace(new Date("2026-10-04T12:00:00Z"));
  const snapshot: PlanningSnapshot = { id: "automatic-ui-fixture", context: { ...workspace.context,
    startDate: "2026-10-05", endDate: "2026-10-06", timeZone: "UTC" },
    players: ["a", "b", "c", "d"].map((id, index) => ({ id, nhlId: index + 1,
      name: id === "c" ? "Zulu schedule gain" : id === "d" ? "Alpha crowded date" : `Original ${id}`,
      teamAbbreviation: id.toUpperCase(), eligiblePositions: ["C"], eligibilityVerified: true, playerClass: "skater",
      availability: index < 2 ? "rostered" : "free_agent", ownership: null, canDrop: true, holdValue: null, reserveEligibility: [] })),
    roster: [{ playerId: "a", position: "active" }, { playerId: "b", position: "bench" }],
    games: ["a", "b", "c", "d"].map(id => { const date = id === "c" ? "2026-10-05" : "2026-10-06";
      return { id, date, startsAt: `${date}T20:00:00Z`, teamAbbreviation: id.toUpperCase(), opponent: "X", home: true, status: "scheduled" }; }),
    forecasts: [], rules: { ...workspace.rules, rosterSlots: { C: 1, BN: 1 }, acquisitionTiming: "same_day", acquisitionCost: 1,
      periods: [{ id: "week", start: "2026-10-04T00:00:00Z", end: "2026-10-08T00:00:00Z", remaining: 1, source: "manager" }],
      scoring: { mode: "points", weights: { GOALS: 1 }, categories: [] } }, lockedAssignments: [], realized: {}, opponent: null,
    evidence: { schedule: { source: "Synthetic complete schedule", asOf: workspace.context.asOf,
      seasonId: workspace.context.seasonId, completeness: "complete", limitations: [] } } };
  return { snapshot, players: snapshot.players, rosterIds: new Set(["a", "b"]), intent: workspace.intent, fits: [], manual: true,
    select: vi.fn(), add: vi.fn(), selectPlan: vi.fn(), canSelectPlan: true, markAvailable: vi.fn() };
}

function expectNoExternalInteractions() {
  expect(fetch).not.toHaveBeenCalled();
  for (const method of ["getItem", "setItem", "removeItem", "clear"] as const) expect(Storage.prototype[method]).not.toHaveBeenCalled();
}

it("carries the652known197unknown pool through the worker and keeps browsing separate from the40candidate search", async () => {
  const props = fixture(), template = props.snapshot.players[2];
  const known = Array.from({ length: 652 }, (_, index) => ({ ...template, id: `known-${String(index).padStart(3, "0")}`,
    nhlId: 10000 + index, name: `Zulu Known ${String(index).padStart(3, "0")}` }));
  const unknown = Array.from({ length: 197 }, (_, index) => ({ ...template, id: `0-unknown-${String(index).padStart(3, "0")}`,
    nhlId: 20000 + index, name: `Alpha Unknown ${index}`, eligibilityVerified: false, availability: "unknown" as const }));
  props.players = [...props.players.slice(0, 2), ...unknown, ...known]; props.snapshot.players = props.players;
  props.snapshot.rules.acquisitionTiming = "unknown"; props.snapshot.rules.acquisitionCost = null; props.snapshot.rules.periods = [];
  props.snapshot.evidence.schedule!.completeness = "partial";
  props.intent = { ...props.intent, alternativeCount: 5 };
  const before = JSON.stringify({ snapshot: props.snapshot, intent: props.intent });
  render(<CandidateBrowser {...props} />);
  const reasons = () => within(screen.getByRole("list", { name: "Why some players aren't ranked" }));
  await screen.findByText("Why some players aren't ranked");
  expect(reasons().getByText("197 players are missing league positions or availability, so they can't be ranked.")).toBeTruthy();
  expect(screen.getAllByRole("article").map(row => row.getAttribute("data-rso-candidate-id"))).toEqual(known.slice(0, 5).map(row => row.id));
  fireEvent.click(screen.getByText("Find & filter"));
  fireEvent.change(screen.getByRole("searchbox", { name: "Find candidate" }), { target: { value: "Zulu Known 651" } });
  expect(reasons().queryByText(/missing league positions/)).toBeNull();
  expect(reasons().getByText(/1 player wasn't compared automatically/)).toBeTruthy();
  expect(LocalCandidateWorker.instances).toHaveLength(1);
  expect(LocalCandidateWorker.instances[0].postMessage).toHaveBeenCalledTimes(1);
  expect(LocalCandidateWorker.instances[0].postMessage.mock.calls[0][0].snapshot.players).toHaveLength(851);
  fireEvent.click(screen.getByRole("button", { name: "Compare this player" }));
  await waitFor(() => expect(reasons().queryByText(/wasn't compared automatically/)).toBeNull());
  expect(LocalCandidateWorker.instances).toHaveLength(2);
  expect(LocalCandidateWorker.instances[1].postMessage.mock.calls[0][0].candidateOptions).toEqual({ requestedPlayerIds: ["known-651"] });
  expect(screen.queryByRole("button", { name: "Compare this player" })).toBeNull();
  expect(props.add).not.toHaveBeenCalled(); expect(props.selectPlan).not.toHaveBeenCalled();
  expect(JSON.stringify({ snapshot: props.snapshot, intent: props.intent })).toBe(before);
  expectNoExternalInteractions();
});

it("automatically renders full-roster schedule-only swaps before any plan selection, ordered by net AGP", async () => {
  const props = fixture();
  const before = JSON.stringify({ snapshot: props.snapshot, intent: props.intent });
  render(<CandidateBrowser {...props} />);
  await screen.findAllByLabelText(/^Result /);
  const cards = screen.getAllByRole("article");
  expect(cards.map(card => card.getAttribute("data-rso-candidate-id"))).toEqual(["c", "d"]);
  expect(within(cards[0]).getByLabelText("Net plan comparison").textContent).toBe("—Net Pts+1Net AGP");
  expect(within(cards[1]).getByLabelText("Net plan comparison").textContent).toBe("—Net Pts0Net AGP");
  expect(within(cards[0]).getByText("DROP")).toBeTruthy();
  expect(LocalCandidateWorker.instances).toHaveLength(1);
  expect(LocalCandidateWorker.instances[0].postMessage.mock.calls[0][0].intent.steps).toEqual([]);
  expect(props.add).not.toHaveBeenCalled();
  expect(props.selectPlan).not.toHaveBeenCalled();
  expect(JSON.stringify({ snapshot: props.snapshot, intent: props.intent })).toBe(before);
  expectNoExternalInteractions();
});

it("says no adds remain, not that rankings are loading, when the period's add budget is spent (VORP S4)", async () => {
  const props = fixture(); props.snapshot.rules.periods = [{ ...props.snapshot.rules.periods[0], remaining: 0 }];
  render(<CandidateBrowser {...props} />);
  await screen.findByText("Why some players aren't ranked");
  expect(screen.getByRole("status").textContent).toBe("No adds remain this period; adds return when the period resets.");
  expect(screen.queryAllByLabelText(/^Result /)).toHaveLength(0);
  expectNoExternalInteractions();
});

it("renders actual no-proposal timing diagnostics through the real solver instead of requesting a selected plan", async () => {
  const props = fixture(); props.snapshot.rules.acquisitionTiming = "unknown";
  const before = JSON.stringify({ snapshot: props.snapshot, intent: props.intent });
  render(<CandidateBrowser {...props} />);
  await screen.findByText("Why some players aren't ranked");
  expect(screen.getByRole("status").textContent).toBe("Rankings appear once projections and schedules load.");
  expect(screen.getByText("Your league's add rules (timing or moves left) aren't set yet.")).toBeTruthy();
  expect(screen.getByText("No legal add/drop was found for your roster this week.")).toBeTruthy();
  expect(screen.queryAllByLabelText(/^Result /)).toHaveLength(0);
  expect(props.add).not.toHaveBeenCalled();
  expect(props.selectPlan).not.toHaveBeenCalled();
  expect(JSON.stringify({ snapshot: props.snapshot, intent: props.intent })).toBe(before);
  expectNoExternalInteractions();
});
