// SYNTHETIC fixture (no retained roster). Objective-switch acceptance, 2026-11-15.
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as rsoPolicy from "../player-forecasts/rsoUsePolicy";
import { planRoster } from "./planning";
import { fixturePolicy, intent, scenario } from "./objectiveSwitchScenario.fixture";
import type { PlanIntent, PlanningSnapshot } from "./planningTypes";

beforeEach(() => vi.spyOn(rsoPolicy, "currentRsoUsePolicy").mockReturnValue(fixturePolicy));
const asg = (r: ReturnType<typeof planRoster>) => r.selected.assignments.map(x => `${x.date}:${x.slotId}:${x.playerId}${x.locked ? "L" : ""}`).sort();
const run = (data: PlanningSnapshot, objective: "agp" | "outcome", extra: Partial<PlanIntent> = {}) => planRoster(data, { ...intent, ...extra, objective }, { maxSteps: 0 });
describe("objective switch acceptance (SYNTHETIC fixture)", () => {
  it("Most starts and Best projected points pick different legal plans; the locked slot holds in both", () => {
    const data = scenario();
    const agp = run(data, "agp"), out = run(data, "outcome");
    expect(agp.selected.objective).toBe("agp"); expect(out.selected.objective).toBe("outcome");
    expect(agp.selected.legal && out.selected.legal).toBe(true);
    expect(asg(agp)).toEqual(["2026-10-05:C#1:aL", "2026-10-05:G#1:g", "2026-10-06:C#1:b", "2026-10-06:G#1:g"]);
    expect(asg(out)).toEqual(["2026-10-05:C#1:aL", "2026-10-06:C#1:b"]);
    expect([agp.selected.activeGames, agp.selected.projectedValue]).toEqual([4, -3]);
    expect([out.selected.activeGames, out.selected.projectedValue]).toEqual([2, 3]);
    // Both comparison rows the UI Compare strip reads.
    expect([agp.noMoveAgp.activeGames, agp.noMoveAgp.projectedValue, agp.noMoveOutcome.activeGames, agp.noMoveOutcome.projectedValue]).toEqual([4, -3, 2, 3]);
  });
  it("the lock binds: without it, both objectives start b over a on day 1", () => {
    const data = scenario(); data.lockedAssignments = [];
    for (const objective of ["agp", "outcome"] as const) expect(asg(run(data, objective))).toContain("2026-10-05:C#1:b");
  });
  it("the goalie minimum binds: accept_risk flags the outcome plan at risk; cover forces goalie starts", () => {
    const data = scenario();
    const out = run(data, "outcome");
    expect(out.selected.goalie).toMatchObject({ required: 1, risk: true, projected: 0 });
    expect(run(data, "agp").selected.goalie).toMatchObject({ required: 1, risk: false });
    const covered = run(data, "outcome", { goalieCoverage: "cover" });
    expect(covered.selected.objective).toBe("outcome");
    expect(asg(covered)).toContain("2026-10-05:G#1:g");
    expect(covered.selected.goalie.risk).toBe(false);
  });
  it("one missing projection never becomes zero", () => {
    const data = scenario();
    data.forecasts = data.forecasts.filter(row => !(row.playerId === "b" && row.gameId === "B1"));
    const agp = run(data, "agp"), out = run(data, "outcome");
    console.log("MISSING agp", JSON.stringify({ o: agp.selected.objective, a: asg(agp), gp: agp.selected.activeGames, pts: agp.selected.projectedValue, unk: agp.selected.valueUnknownPlayerIds, lim: agp.selected.limitations }));
    console.log("MISSING out", JSON.stringify({ o: out.selected.objective, a: asg(out), gp: out.selected.activeGames, pts: out.selected.projectedValue, unk: out.selected.valueUnknownPlayerIds, lim: out.selected.limitations, slim: out.search.limitations, nmO: [out.noMoveOutcome.activeGames, out.noMoveOutcome.projectedValue] }));
    // A 0-for-b reading would total -4 (agp) or 1 (outcome). Unknown must stay null, never a number.
    expect(agp.selected.projectedValue).toBeNull();
    expect(out.selected.projectedValue).toBeNull();
    expect(out.noMoveOutcome.projectedValue).not.toBe(1);
    expect([...agp.selected.limitations, ...agp.search.limitations, ...out.selected.limitations, ...out.search.limitations].join(" ")).toMatch(/forecast|projection/i);
  });
});
