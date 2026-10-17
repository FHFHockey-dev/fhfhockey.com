import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import CandidateCard from "./CandidateCard";
import type { CandidatePlan } from "lib/rosterScheduleOptimizer/candidatePlanMetrics";
import type { PlanningPlayer } from "lib/rosterScheduleOptimizer/planningTypes";

afterEach(cleanup);
const player: PlanningPlayer = { id: "add", name: "Available Wing", teamAbbreviation: "CAR", eligiblePositions: ["RW"],
  playerClass: "skater", availability: "waivers", ownership: null, canDrop: true, holdValue: null, reserveEligibility: [] };
const plan: CandidatePlan = { objective: "outcome", netAGP: 1, netPoints: 4,
  steps: [{ id: "swap", type: "add", playerId: "add", dropPlayerId: "drop", at: "2026-10-13T12:00:00Z", effectiveAt: "2026-10-14T12:00:00Z", conditional: true, dependsOn: [] }],
  dropped: [{ playerId: "drop", lostAGP: 1, lostPoints: 3 }], displacedPlayerIds: ["drop"] };
const props = { player, plan, rank: 1, snapshot: null, categories: false, excluded: false, manual: false,
  details: () => "Lost active contribution: 1 AGP, 3 points.", select: vi.fn(), add: vi.fn(),
  selectPlan: vi.fn(), canSelectPlan: true, markAvailable: vi.fn() };

describe("complete acquisition card presentation", () => {
  it("keeps conditional status visible and selects the exact compared steps", () => {
    render(<CandidateCard {...props} />);
    expect(screen.getByText("Conditional · recheck availability")).toBeTruthy();
    expect(screen.getByText("DROP")).toBeTruthy();
    expect(screen.getByText("+4")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Select compared plan" }));
    expect(props.selectPlan).toHaveBeenLastCalledWith(plan.steps);
    fireEvent.click(screen.getByText("Plan & tradeoffs"));
    expect(screen.getByText("Lost active contribution: 1 AGP, 3 points.")).toBeTruthy();
  });
  it("never substitutes zero for missing comparison evidence or enables unsupported drop advice", () => {
    render(<CandidateCard {...props} plan={{ ...plan, netPoints: null }} />);
    expect(screen.getByText("unavailable")).toBeTruthy();
    expect(screen.getByText(/Missing comparison evidence/)).toBeTruthy();
    expect((screen.getByRole("button", { name: "Select compared plan" }) as HTMLButtonElement).disabled).toBe(true);
  });
  it("retains AGP/points tradeoffs and reserve prerequisites", () => {
    render(<CandidateCard {...props} plan={{ ...plan, netPoints: -3, steps: [
      { id: "reserve", type: "reserve", playerId: "injured", reservePosition: "IR", at: plan.steps[0].at, effectiveAt: plan.steps[0].at, conditional: false, dependsOn: [] },
      ...plan.steps,
    ] }} />);
    expect(screen.getByText("-3")).toBeTruthy();
    expect(screen.getByText("Reserve injured in IR first")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Select compared plan" }) as HTMLButtonElement).disabled).toBe(false);
  });
});
