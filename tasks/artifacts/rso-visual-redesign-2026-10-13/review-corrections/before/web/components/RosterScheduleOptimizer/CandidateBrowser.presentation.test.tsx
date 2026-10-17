import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import CandidateBrowser from "./CandidateBrowser";
import { defaultWorkspace } from "lib/rosterScheduleOptimizer/workspace";
import type { PlanningPlayer, PlanningSnapshot } from "lib/rosterScheduleOptimizer/planningTypes";

vi.mock("hooks/useCandidateMetrics", () => ({ useCandidateMetrics: () => ({ metrics: undefined, loading: false, error: null }) }));
afterEach(cleanup);
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
