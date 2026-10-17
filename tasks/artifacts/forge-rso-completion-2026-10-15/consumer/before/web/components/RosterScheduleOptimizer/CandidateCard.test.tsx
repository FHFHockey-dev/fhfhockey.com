import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import CandidateCard from "./CandidateCard";
import type { CandidateDiagnostic, CandidatePlan } from "lib/rosterScheduleOptimizer/candidatePlanMetrics";
import type { PlanningPlayer } from "lib/rosterScheduleOptimizer/planningTypes";

afterEach(cleanup);
const player: PlanningPlayer = { id: "add", nhlId: null, name: "Available Wing", teamAbbreviation: "CAR", eligiblePositions: ["RW"],
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
  it("separates unavailable metric labels in text readback and omits an unranked ordinal", () => {
    render(<CandidateCard {...props} rank={null} plan={undefined} />);
    expect(screen.queryAllByLabelText(/^Result /)).toHaveLength(0);
    expect(screen.getByLabelText("Net plan comparison").textContent).toBe("Net points unavailable Net AGP unavailable");
    expect(screen.getByText("No candidate evaluation result is available.")).toBeTruthy();
  });
  it.each([
    ["filtered", "This player does not meet the current acquisition input checks."],
    ["not_selected", "This player is outside the bounded candidate evaluation set."],
    ["no_proposals", "No timed acquisition option could be generated from the current inputs."],
    ["rejected", "Generated options failed roster, rule or budget verification."],
    ["partial", "Search limit reached before a verified option was retained."],
  ] as const)("explains %s without an invented score or automatic selection", (status, message) => {
    const diagnostic: CandidateDiagnostic = { playerId: player.id, status, stopReason: "exhausted", generated: 3, skipped: 1,
      evaluated: 2, illegal: 2, unverifiedBudget: 0, retained: 0, reasons: ["Drop conflicts with locked assignment for drop."] };
    const selectPlan = vi.fn(), add = vi.fn();
    render(<CandidateCard {...props} rank={null} plan={undefined} diagnostic={diagnostic} selectPlan={selectPlan} add={add} />);
    expect(screen.getByText(message)).toBeTruthy();
    expect(screen.getByText(diagnostic.reasons[0])).toBeTruthy();
    expect(screen.getByText(/Generated 3 options/)).toBeTruthy();
    expect(screen.queryAllByLabelText(/^Result /)).toHaveLength(0);
    expect(selectPlan).not.toHaveBeenCalled();
    expect(add).not.toHaveBeenCalled();
  });
  it.each([
    ["loading", "Evaluating automatic acquisition options…"],
    ["error", "Automatic candidate evaluation failed. No compared result is available."],
    ["no_snapshot", "Load a planning roster and schedule to evaluate automatic acquisition options."],
  ] as const)("separates %s from rejected acquisition proposals", (evaluationState, message) => {
    render(<CandidateCard {...props} rank={null} plan={undefined} evaluationState={evaluationState} />);
    expect(screen.getByText(message)).toBeTruthy();
    expect(screen.queryByText(/Generated options failed/)).toBeNull();
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
