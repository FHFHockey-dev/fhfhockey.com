import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import StreamingItinerary, { STREAMING_PLAN_OPEN_KEY } from "components/RosterScheduleOptimizer/StreamingItinerary";
import type { PlanEvaluation, PlanStep, StreamingChain, StreamingLeg, StreamingPlan } from "lib/rosterScheduleOptimizer/planningTypes";
import type { StreamingAlternative } from "lib/rosterScheduleOptimizer/streamingChain";

afterEach(() => { cleanup(); window.localStorage.clear(); });
// Synthetic players: Monday's drop candidate, then one streamer per window of TJ's example week.
const names: Record<string, string> = { drop: "Idle Center", lak: "Monday Stream", phi: "Tue-Wed Stream", njd: "Tue-Wed Backup",
  wpg: "Thu-Fri Stream", edm: "Weekend Stream", ott: "Weekend Backup" };
const teams: Record<string, string> = { lak: "LAK", phi: "PHI", njd: "NJD", wpg: "WPG", edm: "EDM", ott: "OTT" };
const days = ["2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31", "2026-11-01"];
const option = (playerId: string, gameDates: string[], points: number, recent: number | null = null) =>
  ({ playerId, games: gameDates.length, gameDates, points, recentPointsPerGame: recent, recentGames: recent === null ? null : 5 });
function leg(index: number, playerId: string, dropPlayerId: string, start: number, end: number, options: StreamingLeg["options"]): StreamingLeg {
  const own = options.find(item => item.playerId === playerId)!;
  const step: PlanStep = { id: `stream:0:${index}:${playerId}`, type: "add", playerId, dropPlayerId, at: `${days[start]}T04:00:00.000Z`,
    effectiveAt: `${days[start]}T04:00:00.000Z`, conditional: true, dependsOn: index ? [`stream:0:${index - 1}:x`] : [] };
  return { spot: 0, step, actionDate: days[start], startDate: days[start], endDate: days[end], playerId, dropPlayerId,
    games: own.games, gameDates: own.gameDates, points: own.points, options };
}
const legs = [
  leg(0, "lak", "drop", 0, 0, [option("lak", [days[0]], 1.1)]),
  leg(1, "phi", "lak", 1, 2, [option("phi", [days[1], days[2]], 3.2), option("njd", [days[1], days[2]], 2.4)]),
  leg(2, "wpg", "phi", 3, 4, [option("wpg", [days[3], days[4]], 4)]),
  leg(3, "edm", "wpg", 5, 6, [option("edm", [days[5], days[6]], 3.04, 2), option("ott", [days[5], days[6]], 3, 0.4)]),
];
const chain: StreamingChain = { spots: 1, legs, steps: legs.map(item => item.step), evaluation: {} as PlanEvaluation,
  netGames: 7, netPoints: 11.34, addsUsed: 4, addsAvailable: 4 };
const plan: StreamingPlan = { policyVersion: "rso-stream-v1", recommended: 1, chains: [chain], limitations: [] };
const props = { dates: days, today: days[0], nameOf: (id: string) => names[id] ?? id, teamOf: (id: string) => teams[id] ?? null, selectDisabled: null };

describe("Streaming itinerary", () => {
  it("lists ADD or HOLD for every day with adds used and running AGP", () => {
    render(<StreamingItinerary {...props} plan={plan} onSelect={vi.fn()} />);
    const region = screen.getByRole("region", { name: "Streaming plan" });
    expect(screen.getByLabelText("Streaming totals").textContent).toBe("Adds 4/4 · +7 AGP · +11.3 proj FPts");
    const rows = within(region).getAllByRole("listitem").filter(item => item.parentElement?.tagName === "OL" && item.querySelector("strong"));
    expect(rows.map(row => row.querySelector("p")?.textContent)).toEqual([
      "ADD Monday Stream (LAK) · DROP Idle Center",
      "ADD Tue-Wed Stream (PHI) · DROP Monday Stream (LAK)",
      "HOLD Tue-Wed Stream (PHI) · plays",
      "ADD Thu-Fri Stream (WPG) · DROP Tue-Wed Stream (PHI)",
      "HOLD Thu-Fri Stream (WPG) · plays",
      "ADD Weekend Stream (EDM) · DROP Thu-Fri Stream (WPG)",
      "HOLD Weekend Stream (EDM) · plays",
    ]);
    expect(within(rows[1]).getByText(/^2\/4 adds · \+3 AGP/)).toBeTruthy();
    expect(within(rows[5]).getByText(/^4\/4 adds · \+7 AGP/)).toBeTruthy();
    // Options are ranked by projection; last-10 FPts/G is shown beside them.
    const weekend = within(rows[5]).getByRole("list", { name: /Options for/ });
    expect(within(weekend).getAllByRole("button").map(button => button.textContent)).toEqual([
      "Weekend Stream (EDM)2 GP · 3.0 proj FPts · 2 FPts/G (last 5)", "Weekend Backup (OTT)2 GP · 3 proj FPts · 0.4 FPts/G (last 5)"]);
  });

  it("swaps a step's player, re-links the next drop and selects the edited chain", () => {
    const onSelect = vi.fn();
    render(<StreamingItinerary {...props} plan={plan} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: /Tue-Wed Backup \(NJD\)/ }));
    expect(screen.getByRole("button", { name: /Tue-Wed Backup \(NJD\)/ }).getAttribute("aria-pressed")).toBe("true");
    expect([...document.querySelectorAll("p")].map(row => row.textContent)).toContain("ADD Thu-Fri Stream (WPG) · DROP Tue-Wed Backup (NJD)");
    expect(screen.getByLabelText("Streaming totals").textContent).toBe("Adds 4/4 · +7 AGP · +10.5 proj FPts (estimate after swaps)");
    fireEvent.click(screen.getByRole("button", { name: "Use this streaming plan" }));
    const steps: PlanStep[] = onSelect.mock.calls[0][0];
    expect(steps.map(step => [step.playerId, step.dropPlayerId])).toEqual([["lak", "drop"], ["njd", "lak"], ["wpg", "njd"], ["edm", "wpg"]]);
    expect(steps[2].dependsOn).toEqual([steps[1].id]);
  });

  it("shows goalie-minimum progress and what meeting it costs against a chain that misses it", () => {
    const goalie = (projected: number, risk: boolean) => ({ goalie: { projected, risk, credited: 1, confirmed: 0, required: 3 } }) as PlanEvaluation;
    const meetsChain: StreamingChain = { ...chain, netGames: 3, netPoints: 3.6, evaluation: goalie(3.2, false) };
    const missesChain: StreamingChain = { ...chain, netGames: 4, netPoints: 7.04, evaluation: goalie(2, true) };
    render(<StreamingItinerary {...props} plan={{ ...plan, chains: [meetsChain, missesChain], goalieMinimum: { required: 3, baseline: 2, met: false, cover: true } }} onSelect={vi.fn()} />);
    const group = screen.getByRole("group", { name: "Stream spots" });
    expect(within(group).getAllByRole("button").map(button => button.textContent)).toEqual(["One spot · +3 AGP · meets G min · suggested", "One spot · +4 AGP · misses G min"]);
    expect(screen.getByLabelText("Goalie minimum").textContent).toBe("Goalie starts 2/3 → 3.2/3 with this plan · meets the minimum");
    expect(screen.getByText("Meeting it costs 1 AGP versus the one-spot plan (+4 AGP), which misses it.")).toBeTruthy();
    fireEvent.click(within(group).getByRole("button", { name: /\+4 AGP/ }));
    expect(screen.getByLabelText("Goalie minimum").textContent).toBe("Goalie starts 2/3 → 2/3 with this plan · misses the minimum");
    expect(screen.getByText("The one-spot plan (+3 AGP) meets it instead.")).toBeTruthy();
  });

  it("labels a waiver claim with its clearance day and that it may fail", () => {
    const waiverLeg: StreamingLeg = { ...legs[2], options: [{ ...legs[2].options[0], waiverClearsOn: days[2] }, option("njd", [days[3], days[4]], 2.4)] };
    render(<StreamingItinerary {...props} plan={{ ...plan, chains: [{ ...chain, legs: [legs[0], legs[1], waiverLeg, legs[3]] }] }} onSelect={vi.fn()} />);
    expect([...document.querySelectorAll("p")].map(row => row.textContent)).toContain("ADD Thu-Fri Stream (WPG) · DROP Tue-Wed Stream (PHI) · waiver claim, clears Wed, Oct 28");
    expect(screen.getByText(/^3\/4 adds .* · the claim may fail$/)).toBeTruthy();
    expect(within(screen.getByRole("list", { name: "Options for Thu, Oct 29" })).getAllByRole("button").map(button => button.textContent))
      .toEqual(["Thu-Fri Stream (WPG)Waivers · 2 GP · 4 proj FPts", "Tue-Wed Backup (NJD)2 GP · 2.4 proj FPts"]);
  });

  it("shows the blended net that ranks the chain beside projected totals", () => {
    render(<StreamingItinerary {...props} plan={{ ...plan, chains: [{ ...chain, netScore: 9.8 }] }} onSelect={vi.fn()} />);
    expect(screen.getByLabelText("Streaming totals").textContent).toBe("Adds 4/4 · +7 AGP · +11.3 proj FPts · +9.8 blended FPts");
  });

  it("marks an accepted goalie risk without a tradeoff note", () => {
    const evaluation = { goalie: { projected: 2, risk: true, credited: 1, confirmed: 0, required: 3 } } as PlanEvaluation;
    render(<StreamingItinerary {...props} plan={{ ...plan, chains: [{ ...chain, evaluation }], goalieMinimum: { required: 3, baseline: 2, met: false, cover: false } }} onSelect={vi.fn()} />);
    expect(screen.getByLabelText("Goalie minimum").textContent).toBe("Goalie starts 2/3 → 2/3 with this plan · misses the minimum (risk accepted)");
    expect(screen.queryByText(/Meeting it costs|meets it instead/)).toBeNull();
  });

  it("offers the one-spot chain beside a suggested two-spot split and explains a blocked select", () => {
    const two: StreamingChain = { ...chain, spots: 2, netGames: 9, legs: [...legs.slice(0, 2), { ...legs[2], spot: 1, dropPlayerId: "drop" }] };
    render(<StreamingItinerary {...props} selectDisabled="Saved inputs are read-only." plan={{ ...plan, recommended: 2, chains: [two, chain] }} onSelect={vi.fn()} />);
    const group = screen.getByRole("group", { name: "Stream spots" });
    expect(within(group).getAllByRole("button").map(button => button.textContent)).toEqual(["Two spots · +9 AGP · suggested", "One spot · +7 AGP"]);
    const spotTwo = () => [...document.querySelectorAll("p")].filter(row => row.textContent?.startsWith("Spot 2: "));
    expect(spotTwo().map(row => row.textContent)).toContain("Spot 2: ADD Thu-Fri Stream (WPG) · DROP Idle Center");
    fireEvent.click(within(group).getByRole("button", { name: "One spot · +7 AGP" }));
    expect(spotTwo()).toEqual([]);
    expect((screen.getByRole("button", { name: "Use this streaming plan" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("Saved inputs are read-only.")).toBeTruthy();
  });

  it("lists another first drop's chain after the offered ones as an alternative, never suggested", () => {
    const other = leg(0, "lak", "spare", 0, 0, [option("lak", [days[0]], 1.1)]);
    const alternative: StreamingAlternative = { ...chain, legs: [other, ...legs.slice(1)], steps: [other.step, ...legs.slice(1).map(item => item.step)], netGames: 5, netPoints: 9, wins: ["games"] };
    const onSelect = vi.fn();
    render(<StreamingItinerary {...props} nameOf={(id: string) => id === "spare" ? "Spare Wing" : names[id] ?? id}
      plan={{ ...plan, alternatives: [alternative], alternativesTruncated: 0 }} onSelect={onSelect} />);
    const group = screen.getByRole("group", { name: "Stream spots" });
    expect(within(group).getAllByRole("button").map(button => button.textContent)).toEqual([
      "One spot · +7 AGP · suggested", "Alternative · most starts · drop Spare Wing · +5 AGP"]);
    expect(screen.queryByText(/^Alternative with a different first drop/)).toBeNull();
    fireEvent.click(within(group).getByRole("button", { name: "Alternative · most starts · drop Spare Wing · +5 AGP" }));
    expect(screen.getByText(/^Alternative with a different first drop, not the suggested plan/)).toBeTruthy();
    expect(screen.getByLabelText("Streaming totals").textContent).toBe("Adds 4/4 · +5 AGP · +9 proj FPts");
    fireEvent.click(screen.getByRole("button", { name: "Use this streaming plan" }));
    expect(onSelect.mock.calls[0][0][0]).toMatchObject({ playerId: "lak", dropPlayerId: "spare" });
  });

  it("names the goal each alternative wins and shows a points alternative's FPts (VORP S4)", () => {
    const other = leg(0, "lak", "spare", 0, 0, [option("lak", [days[0]], 1.1)]), spare = leg(0, "lak", "idle2", 0, 0, [option("lak", [days[0]], 1.1)]);
    const base: StreamingChain = { ...chain, legs: [other, ...legs.slice(1)], steps: [other.step, ...legs.slice(1).map(item => item.step)] };
    const games: StreamingAlternative = { ...base, netGames: 6, netPoints: 4, wins: ["games"] };
    const points: StreamingAlternative = { ...base, legs: [spare, ...legs.slice(1)], netGames: 3, netPoints: 9.5, wins: ["points", "games"] };
    render(<StreamingItinerary {...props} nameOf={(id: string) => id === "spare" ? "Spare Wing" : id === "idle2" ? "Idle Two" : names[id] ?? id}
      plan={{ ...plan, alternatives: [games, points], alternativesTruncated: 0 }} onSelect={vi.fn()} />);
    const group = screen.getByRole("group", { name: "Stream spots" });
    expect(within(group).getAllByRole("button").map(button => button.textContent)).toEqual([
      "One spot · +7 AGP · suggested", "Alternative · most starts · drop Spare Wing · +6 AGP", "Alternative · best points, most starts · drop Idle Two · +3 AGP · +9.5 FPts"]);
    fireEvent.click(within(group).getAllByRole("button")[1]);
    expect(screen.getByText("Alternative with a different first drop, not the suggested plan. Of the other first drops, it is the best for starts. Its totals are its own checked plan.")).toBeTruthy();
    fireEvent.click(within(group).getAllByRole("button")[2]);
    expect(screen.getByText(/it is the best for points and starts\. Its totals/)).toBeTruthy();
    expect(screen.getByLabelText("Streaming totals").textContent).toBe("Adds 4/4 · +3 AGP · +9.5 proj FPts");
  });

  it("collapses and expands from its header and remembers the choice in this browser", () => {
    const view = render(<StreamingItinerary {...props} plan={plan} onSelect={vi.fn()} />);
    const toggle = () => screen.getByRole("button", { name: "Streaming plan" });
    expect(toggle().getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByLabelText("Streaming totals")).toBeTruthy();
    fireEvent.click(toggle());
    expect(toggle().getAttribute("aria-expanded")).toBe("false");
    expect(document.getElementById(toggle().getAttribute("aria-controls")!)!.hidden).toBe(true);
    expect(screen.queryByLabelText("Streaming totals")).toBeNull();
    expect(window.localStorage.getItem(STREAMING_PLAN_OPEN_KEY)).toBe("0");
    view.unmount();
    render(<StreamingItinerary {...props} plan={plan} onSelect={vi.fn()} />);
    expect(toggle().getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(toggle());
    expect(toggle().getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByLabelText("Streaming totals")).toBeTruthy();
    expect(window.localStorage.getItem(STREAMING_PLAN_OPEN_KEY)).toBe("1");
  });

  it("starts collapsed when the page asks (desktop) until the manager's stored choice says otherwise", () => {
    window.localStorage.removeItem(STREAMING_PLAN_OPEN_KEY);
    const view = render(<StreamingItinerary {...props} plan={plan} onSelect={vi.fn()} defaultOpen={false} />);
    const toggle = () => screen.getByRole("button", { name: "Streaming plan" });
    expect(toggle().getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByLabelText("Streaming totals")).toBeNull();
    view.unmount();
    window.localStorage.setItem(STREAMING_PLAN_OPEN_KEY, "1");
    render(<StreamingItinerary {...props} plan={plan} onSelect={vi.fn()} defaultOpen={false} />);
    expect(toggle().getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByLabelText("Streaming totals")).toBeTruthy();
  });

  it("stays usable when browser storage throws", () => {
    const failing = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    render(<StreamingItinerary {...props} plan={plan} onSelect={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Streaming plan" }));
    expect(screen.getByRole("button", { name: "Streaming plan" }).getAttribute("aria-expanded")).toBe("false");
    failing.mockRestore(); vi.restoreAllMocks();
  });

  it("lists the days before the plan start greyed and unplanned", () => {
    render(<StreamingItinerary {...props} today={days[1]} from={days[3]} through={days[6]} plan={plan} onSelect={vi.fn()} />);
    const rows = within(screen.getByRole("region", { name: "Streaming plan" })).getAllByRole("listitem")
      .filter(item => item.parentElement?.tagName === "OL" && item.querySelector("strong"));
    expect(rows).toHaveLength(6); // Tuesday (today) through Sunday.
    expect(rows.slice(0, 2).map(row => row.querySelector("p")?.textContent)).toEqual(["Not planned · before the plan start", "Not planned · before the plan start"]);
    expect(rows[2].querySelector("p")?.textContent).toBe("ADD Thu-Fri Stream (WPG) · DROP Tue-Wed Stream (PHI)");
  });
});
