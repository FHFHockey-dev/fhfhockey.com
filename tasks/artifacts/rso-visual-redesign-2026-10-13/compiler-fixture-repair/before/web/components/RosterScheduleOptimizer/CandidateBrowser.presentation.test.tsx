import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import CandidateBrowser from "./CandidateBrowser";
import { defaultWorkspace } from "lib/rosterScheduleOptimizer/workspace";
import type { PlanningPlayer, PlanningSnapshot } from "lib/rosterScheduleOptimizer/planningTypes";
import type { CandidateComparison } from "lib/rosterScheduleOptimizer/candidatePlanMetrics";

const fixture = vi.hoisted(() => ({ candidates: undefined as CandidateComparison[] | undefined }));
vi.mock("hooks/useCandidateMetrics", () => ({ useCandidateMetrics: () => ({ metrics: fixture.candidates ? { candidates: fixture.candidates } : undefined, loading: false, error: null }) }));
afterEach(() => { cleanup(); fixture.candidates = undefined; });
it("starts with individual cards and respects the selected result count when filtering and expanding", () => {
  const workspace = defaultWorkspace();
  const players: PlanningPlayer[] = Array.from({ length: 12 }, (_, index) => ({ id: String(index), name: `Candidate ${index}`,
    teamAbbreviation: "CAR", eligiblePositions: ["C"], playerClass: "skater", availability: "free_agent", ownership: null,
    canDrop: true, holdValue: null, reserveEligibility: [] }));
  const snapshot: PlanningSnapshot = { id: "presentation", context: workspace.context, rules: workspace.rules, games: [], players,
    roster: [], lockedAssignments: [], forecasts: [], realized: {}, opponent: null, evidence: {} };
  const props = { players, rosterIds: new Set<string>(), snapshot,
    intent: { ...workspace.intent, alternativeCount: 5 as const }, fits: [], manual: true, select: vi.fn(), add: vi.fn(), markAvailable: vi.fn() };
  const view = render(<CandidateBrowser {...props} />);
  expect(screen.getAllByRole("article")).toHaveLength(5);
  fireEvent.click(screen.getByRole("button", { name: "Show more players" }));
  expect(screen.getAllByRole("article")).toHaveLength(10);
  fireEvent.click(screen.getByText("Find & filter"));
  fireEvent.change(screen.getByRole("searchbox", { name: "Find candidate" }), { target: { value: "Candidate 11" } });
  expect(screen.getAllByRole("article")).toHaveLength(1);
  fireEvent.change(screen.getByRole("searchbox", { name: "Find candidate" }), { target: { value: "" } });
  expect(screen.getAllByRole("article")).toHaveLength(5);
  view.rerender(<CandidateBrowser {...props} intent={{ ...props.intent, alternativeCount: 10 }} />);
  expect(screen.getAllByRole("article")).toHaveLength(10);
});

it.each([6, 3])("shares one display budget across %i supported and unavailable points candidates", count => {
  const workspace = defaultWorkspace();
  const players: PlanningPlayer[] = Array.from({ length: count * 2 }, (_, index) => ({ id: String(index),
    name: index < count ? `Supported ${index}` : `Unavailable ${index - count}`,
    teamAbbreviation: index < count ? "CAR" : "BOS", eligiblePositions: [index < count ? "C" : "RW"],
    playerClass: "skater", availability: "free_agent", ownership: null, canDrop: true, holdValue: null, reserveEligibility: [] }));
  fixture.candidates = players.map((player, index) => ({ playerId: player.id, complete: true,
    plans: [{ objective: "outcome", steps: [], netAGP: index < count ? 1 : count * 2 - index,
      netPoints: index < count ? 2 - index : null, dropped: [], displacedPlayerIds: [] }] }));
  const props = { players: [...players].reverse(), rosterIds: new Set<string>(), snapshot: null,
    intent: { ...workspace.intent, alternativeCount: 5 as const }, fits: [], manual: true, select: vi.fn(), add: vi.fn(), markAvailable: vi.fn() };
  const view = render(<CandidateBrowser {...props} />);
  const ids = () => screen.getAllByRole("article").map(article => article.getAttribute("data-rso-candidate-id"));
  expect(ids()).toEqual(players.slice(0, 5).map(player => player.id));
  fireEvent.click(screen.getByRole("button", { name: "Show more players" }));
  expect(ids()).toEqual(players.slice(0, 10).map(player => player.id));
  expect(screen.getByRole("heading", { name: "Net AGP · points unavailable" })).toBeTruthy();
  for (const article of screen.getAllByRole("article").slice(count)) {
    expect(within(article).getByText("unavailable")).toBeTruthy();
    expect(within(article).getByText(/Missing comparison evidence/)).toBeTruthy();
  }
  if (count === 6) {
    expect(screen.getByLabelText("Result 10")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Show more players" }));
    expect(ids()).toEqual(players.map(player => player.id));
  }
  expect(screen.queryByRole("button", { name: "Show more players" })).toBeNull();
  view.rerender(<CandidateBrowser {...props} intent={{ ...props.intent, alternativeCount: 10 }} />);
  expect(ids()).toEqual(players.slice(0, 10).map(player => player.id));
  view.rerender(<CandidateBrowser {...props} />);
  expect(ids()).toEqual(players.slice(0, 5).map(player => player.id));

  fireEvent.click(screen.getByRole("button", { name: "Show more players" }));
  fireEvent.click(screen.getByText("Find & filter"));
  fireEvent.change(screen.getByRole("combobox", { name: "Team" }), { target: { value: "BOS" } });
  expect(ids()).toEqual(players.slice(count, count + 5).map(player => player.id));
  fireEvent.change(screen.getByRole("combobox", { name: "Team" }), { target: { value: "" } });
  expect(ids()).toEqual(players.slice(0, 5).map(player => player.id));
  fireEvent.click(screen.getByRole("button", { name: "Show more players" }));
  fireEvent.change(screen.getByRole("combobox", { name: "Position" }), { target: { value: "RW" } });
  expect(ids()).toEqual(players.slice(count, count + 5).map(player => player.id));
  fireEvent.change(screen.getByRole("combobox", { name: "Position" }), { target: { value: "" } });
  expect(ids()).toEqual(players.slice(0, 5).map(player => player.id));
  fireEvent.click(screen.getByRole("button", { name: "Show more players" }));
  fireEvent.change(screen.getByRole("searchbox", { name: "Find candidate" }), { target: { value: "Unavailable 2" } });
  expect(ids()).toEqual([String(count + 2)]);
  fireEvent.change(screen.getByRole("searchbox", { name: "Find candidate" }), { target: { value: "" } });
  expect(ids()).toEqual(players.slice(0, 5).map(player => player.id));
});
