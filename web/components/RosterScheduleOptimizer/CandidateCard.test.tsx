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

const swap = { name: "Preview swap: add Available Wing, drop drop" };

describe("complete acquisition card presentation", () => {
  it("keeps conditional status visible and previews the exact compared steps", () => {
    render(<CandidateCard {...props} />);
    expect(screen.getByText("Recheck availability before claiming")).toBeTruthy();
    expect(screen.getByText("DROP")).toBeTruthy();
    expect(screen.getByText("Waivers")).toBeTruthy();
    expect(screen.getByText("+4")).toBeTruthy();
    expect(screen.getByText("+1 active game, +4 projected points")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", swap));
    expect(props.selectPlan).toHaveBeenLastCalledWith(plan.steps);
  });
  it("describes the dropped player from the supplied player pool", () => {
    const dropped: PlanningPlayer = { ...player, id: "drop", name: "Rostered Center", teamAbbreviation: "BOS", eligiblePositions: ["C"] };
    render(<CandidateCard {...props} players={[player, dropped]} />);
    expect(screen.getByRole("button", { name: "Rostered Center" })).toBeTruthy();
    expect(screen.getByText("BOS · C")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Preview swap: add Available Wing, drop Rostered Center" })).toBeTruthy();
  });
  it("omits an unranked ordinal, metrics and diagnostic prose for a discovery row", () => {
    render(<CandidateCard {...props} rank={null} plan={undefined} upcomingGames={3} />);
    expect(screen.queryAllByLabelText(/^Result /)).toHaveLength(0);
    expect(screen.queryByLabelText("Net plan comparison")).toBeNull();
    expect(screen.getByText("3 upcoming games")).toBeTruthy();
    expect(screen.queryByText(/unavailable/)).toBeNull();
  });
  it.each(["filtered", "not_selected", "no_proposals", "rejected", "partial"] as const)("offers comparison only for %s outside the automatic set", status => {
    const diagnostic: CandidateDiagnostic = { playerId: player.id, status, stopReason: "exhausted", generated: 3, skipped: 1,
      evaluated: 2, illegal: 2, unverifiedBudget: 0, retained: 0, reasons: ["Drop conflicts with locked assignment for drop."] };
    const selectPlan = vi.fn(), add = vi.fn(), compare = vi.fn();
    render(<CandidateCard {...props} rank={null} plan={undefined} diagnostic={diagnostic} selectPlan={selectPlan} add={add} compare={compare} />);
    const request = screen.queryByRole("button", { name: "Compare this player" });
    expect(Boolean(request)).toBe(status === "not_selected");
    if (request) { fireEvent.click(request); expect(compare).toHaveBeenCalledExactlyOnceWith(player.id); }
    expect(screen.queryByText(/Generated 3 options/)).toBeNull();
    expect(screen.queryAllByLabelText(/^Result /)).toHaveLength(0);
    expect(selectPlan).not.toHaveBeenCalled();
    expect(add).not.toHaveBeenCalled();
  });
  it("shows a dash with a tooltip instead of zero for missing numbers and disables unsupported drop advice", () => {
    render(<CandidateCard {...props} plan={{ ...plan, netPoints: null }} />);
    const dash = screen.getByText("—", { selector: "strong" });
    expect(dash.getAttribute("title")).toBe("Not enough projection data yet");
    expect(screen.queryByText(/unavailable/)).toBeNull();
    expect((screen.getByRole("button", swap) as HTMLButtonElement).disabled).toBe(true);
  });
  it("shows only a Hot or Cold form chip", () => {
    render(<CandidateCard {...props} player={{ ...player, form: { label: "Scoring cold", games: 5, points: 0, includedInForecast: null } }} />);
    expect(screen.getByText("Cold")).toBeTruthy();
    expect(screen.queryByText(/forecast inclusion/)).toBeNull();
  });
  it("allows a category drop plan without a points utility", () => {
    const selectPlan = vi.fn();
    render(<CandidateCard {...props} categories plan={{ ...plan, netPoints: null, categoryComparisonVerified: true }} selectPlan={selectPlan} />);
    fireEvent.click(screen.getByRole("button", swap));
    expect(selectPlan).toHaveBeenCalledWith(plan.steps);
  });
  it("allows an explicitly verified zero-AGP category comparison for manager choice", () => {
    const selectPlan = vi.fn();
    render(<CandidateCard {...props} categories plan={{ ...plan, netAGP: 0, netPoints: null,
      categoryComparisonVerified: true }} selectPlan={selectPlan} />);
    expect(selectPlan).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", swap));
    expect(selectPlan).toHaveBeenCalledWith(plan.steps);
  });
  it.each([undefined, false])("withholds category selection without verified comparison (%s)", categoryComparisonVerified => {
    const selectPlan = vi.fn();
    render(<CandidateCard {...props} categories plan={{ ...plan, netAGP: 0, netPoints: null,
      categoryComparisonVerified }} selectPlan={selectPlan} />);
    fireEvent.click(screen.getByRole("button", swap));
    expect(selectPlan).not.toHaveBeenCalled();
    expect(screen.getByText("No gain this week")).toBeTruthy();
  });
  it("retains AGP/points tradeoffs and reserve prerequisites", () => {
    render(<CandidateCard {...props} plan={{ ...plan, netPoints: -3, steps: [
      { id: "reserve", type: "reserve", playerId: "injured", reservePosition: "IR", at: plan.steps[0].at, effectiveAt: plan.steps[0].at, conditional: false, dependsOn: [] },
      ...plan.steps,
    ] }} />);
    expect(screen.getByText("-3")).toBeTruthy();
    expect(screen.getByText("Move injured to IR first")).toBeTruthy();
    expect((screen.getByRole("button", swap) as HTMLButtonElement).disabled).toBe(false);
  });
});
