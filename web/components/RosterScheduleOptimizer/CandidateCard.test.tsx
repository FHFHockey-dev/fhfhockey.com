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
  it("asks a free agent's conditional add to be rechecked before adding, not claiming", () => {
    render(<CandidateCard {...props} player={{ ...player, availability: "free_agent" }} />);
    expect(screen.getByText("Recheck availability before adding")).toBeTruthy();
    expect(screen.queryByText("Recheck availability before claiming")).toBeNull();
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

  it("cautions on dropping a widely rostered or unknown-demand player, and notes an ownership tie-break (R7)", () => {
    const busy: PlanningPlayer = { ...player, id: "drop", name: "Rostered Center", ownership: 95 };
    const { unmount } = render(<CandidateCard {...props} players={[player, busy]} />);
    expect(screen.getByText("Widely rostered: 95% of Yahoo leagues. Others may claim him quickly if dropped.")).toBeTruthy();
    unmount();
    const { unmount: second } = render(<CandidateCard {...props} players={[player, { ...busy, ownership: null }]} />);
    expect(screen.getByText("Ownership unknown. Demand from other managers isn't checked.")).toBeTruthy();
    second();
    render(<CandidateCard {...props} players={[player, { ...busy, ownership: 0 }]} />);
    expect(screen.queryByText(/Widely rostered|Ownership unknown/)).toBeNull();
    cleanup();
    const low = { ...plan, droppedOwnership: 5 }, high = { ...plan, steps: [{ ...plan.steps[0], id: "swap-2", dropPlayerId: "other" }], droppedOwnership: 95 };
    render(<CandidateCard {...props} plan={low} comparison={{ playerId: "add", plans: [high, low], complete: true }} players={[player, { ...busy, ownership: 5 }]} />);
    expect(screen.getByText("Same projected result as other options. This one drops the less-rostered player.")).toBeTruthy();
  });

  it("keeps the compact layout: one box-score line, and reasons sharing the footer row with the action", () => {
    const { container } = render(<CandidateCard {...props} player={{ ...player, lastFive: { games: 5, stats: { GOALS: 2, POINTS: 2, SHOTS_ON_GOAL: 14 } } }} />);
    const card = container.querySelector("article")!, footer = card.querySelector('[class*="footer"]')!;
    expect(footer.querySelector('[class*="notes"]')?.textContent).toContain("+1 active game, +4 projected points");
    expect(footer.querySelector("button")?.textContent).toBe("Preview swap");
    expect(card.querySelectorAll('[class*="boxScore"]')).toHaveLength(1);
    // Moves, schedule (when dated), box score and footer are the only body rows.
    expect([...card.querySelector('[class*="body"]')!.children].map(child => child.className.match(/(top|boxScore|footer)/)?.[1])).toEqual(["top", "boxScore", "footer"]);
  });

  it("shows last-5 box-score totals for a skater, unknowns as a dash", () => {
    render(<CandidateCard {...props} player={{ ...player, lastFive: { games: 5, stats: { GOALS: 2, ASSISTS: 3, POINTS: 5, SHOTS_ON_GOAL: 14, PP_POINTS: 1, HITS: null, BLOCKED_SHOTS: 4 } } }} />);
    const line = screen.getByLabelText("Last 5 games played: 2 G, 3 A, 5 PTS, 14 SOG, 1 PPP, — HIT, 4 BLK");
    expect(line.textContent).toBe("L5 GP2 G3 A5 PTS14 SOG1 PPP— HIT4 BLK");
    expect(line.getAttribute("title")).toBe("Totals over the last 5 games played");
  });

  it("shows a goalie's last games as W, GA, SV and pooled SV%, labelled by the games actually played", () => {
    render(<CandidateCard {...props} player={{ ...player, playerClass: "goalie", lastFive: { games: 3, stats: { WINS_GOALIE: 2, GOALS_AGAINST_GOALIE: 7, SAVES_GOALIE: 83, SHOTS_AGAINST_GOALIE: 90 } } }} />);
    expect(screen.getByLabelText("Last 3 games played: 2 W, 7 GA, 83 SV, .922 SV%")).toBeTruthy();
    expect(screen.getByText("L3 GP")).toBeTruthy();
  });

  it("omits the box score without recent games", () => {
    render(<CandidateCard {...props} />);
    expect(screen.queryByLabelText(/^Last \d+ games played/)).toBeNull();
  });

  it("shows line and PP chips with their date, mutes stale ones and shows nothing when unknown", () => {
    const { unmount } = render(<CandidateCard {...props} player={{ ...player, deployment: { line: "L1", powerPlayUnit: 1, asOf: "2026-10-26", stale: false } }} />);
    const line = screen.getByText("L1"), pp = screen.getByText("PP1");
    expect(line.getAttribute("title")).toBe("Lines as of Oct 26");
    expect(pp.getAttribute("aria-label")).toBe("PP1. Lines as of Oct 26");
    expect(line.getAttribute("data-stale")).toBe("false");
    unmount();
    const { unmount: second } = render(<CandidateCard {...props} player={{ ...player, deployment: { line: "D2", powerPlayUnit: null, asOf: "2026-10-12", stale: true } }} />);
    expect(screen.getByText("D2").getAttribute("data-stale")).toBe("true");
    expect(screen.getByText("D2").getAttribute("title")).toBe("Lines as of Oct 12 · may be out of date");
    expect(screen.queryByText(/^PP\d$/)).toBeNull();
    second();
    render(<CandidateCard {...props} />);
    expect(screen.queryByText(/^(L|D|PP)\d$/)).toBeNull();
    expect(screen.queryByTitle(/Lines as of/)).toBeNull();
  });

  it("lists the whole swap's per-category change on a category-league card (W12)", () => {
    const breakdown = [
      { key: "GOALS", direction: "higher" as const, ratio: false, before: 2, after: 4, delta: 2, gain: 3, sacrifice: 1, components: null, opponent: null, coverage: "known" as const, reason: null },
      { key: "SH%", direction: "higher" as const, ratio: true, before: 1 / 6, after: 0.5, delta: 1 / 3, gain: null, sacrifice: null,
        components: { numerator: { key: "GOALS", net: 2 }, denominator: { key: "SHOTS", net: -4 } }, opponent: null, coverage: "known" as const, reason: null },
      { key: "GAA", direction: "lower" as const, ratio: true, before: 4, after: 2.5, delta: -1.5, gain: null, sacrifice: null,
        components: { numerator: { key: "GOALS_AGAINST_GOALIE", net: -1 }, denominator: { key: "GOALIE_MINUTES", net: 0 } }, opponent: null, coverage: "known" as const, reason: null },
      { key: "SHOTS", direction: "higher" as const, ratio: false, before: null, after: null, delta: null, gain: null, sacrifice: null, components: null, opponent: null, coverage: "incomplete" as const, reason: "missing projection" },
    ];
    render(<CandidateCard {...props} categories plan={{ ...plan, categoryBreakdown: breakdown.map(row => ({ ...row, multiplier: row.key === "GAA" ? 60 : 1 })) }} />);
    expect(screen.getByText("GOALS +2 (+3 / −1)")).toBeTruthy();
    expect(screen.getByText("SH% +33.3 pts (pooled)")).toBeTruthy();
    expect(screen.getByText("GAA -1.50 (pooled)")).toBeTruthy();
    expect(screen.getByText("SHOTS incomplete")).toBeTruthy();
  });
});
