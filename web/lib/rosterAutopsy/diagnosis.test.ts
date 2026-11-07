import { describe, expect, it } from "vitest";

import { analyzeRoster, emptyWorkspace, type ManualPlayer, type ManualWorkspace } from "./manual";
import { diagnoseRoster } from "./diagnosis";

const player = (id: string, eligibility: string, status: ManualPlayer["status"] = "bench"): ManualPlayer =>
  ({ id, name: id, team: "", eligibility, status, recent: null });
function reviewed(players: ManualPlayer[], slots: Partial<ManualWorkspace["slots"]>): ManualWorkspace {
  const workspace = emptyWorkspace();
  return { ...workspace, players, slots: { ...workspace.slots, ...slots }, rosterReviewed: true, slotsReviewed: true };
}
const diagnose = (workspace: ManualWorkspace) => diagnoseRoster(workspace, analyzeRoster(workspace));

describe("structural roster diagnosis", () => {
  it("starts with setup actions without inventing strengths or gaps", () => {
    const result = diagnose(emptyWorkspace());
    expect(result.strengths).toEqual([]);
    expect(result.weaknesses).toEqual([]);
    expect(result.actions.map(action => [action.id, action.target])).toEqual([["add-roster", "roster"], ["enter-slots", "slots"]]);
  });

  it("does not treat one C/LW player as covering two simultaneous slots", () => {
    const result = diagnose(reviewed([player("dual", "C/LW")], { C: "1", LW: "1" }));
    expect(result.strengths).toHaveLength(1);
    expect(result.strengths[0].text).toContain("1 / 1 dedicated slots filled in the simultaneous assignment");
    expect(result.weaknesses).toEqual([{ id: "simultaneous", text: "1 of 2 starting slots remain unfilled when each player is used once." }]);
    expect(result.actions.map(action => action.id)).toEqual(["simultaneous"]);
  });

  it("uses the complete matching instead of greedy eligibility counts", () => {
    const result = diagnose(reviewed([player("dual", "C/LW"), player("center", "C")], { C: "1", LW: "1" }));
    expect(result.strengths.map(finding => finding.id)).toEqual(["simultaneous", "C", "LW"]);
    expect(result.weaknesses).toEqual([]);
    expect(result.actions).toEqual([]);
  });

  it("orders confirmed dedicated gaps before whole-roster congestion, with reserves excluded", () => {
    const result = diagnose(reviewed([player("center", "C"), player("wing", "LW", "IR")], { C: "2", LW: "1" }));
    expect(result.actions.map(action => [action.id, action.target])).toEqual([["gap-C", "roster"], ["gap-LW", "roster"], ["simultaneous", "coverage"]]);
    expect(result.weaknesses.map(finding => finding.text)).toEqual([
      "C: 1 fewer eligible players than dedicated slots (1 for 2).",
      "LW: 1 fewer eligible players than dedicated slots (0 for 1).",
      "2 of 3 starting slots remain unfilled when each player is used once.",
    ]);
    expect(result.reserves).toBe(1);
  });

  it("withholds definite findings for invalid, generic, unresolved or unreviewed inputs", () => {
    const complete = reviewed([player("center", "C")], { C: "2" });
    const cases = [
      { ...complete, rosterReviewed: false },
      { ...complete, unresolved: ["Unknown player"] },
      { ...complete, players: [player("unknown", "")] },
      { ...complete, players: [player("generic", "F")] },
    ];
    for (const workspace of cases) {
      const result = diagnose(workspace);
      expect(result.strengths).toEqual([]);
      expect(result.weaknesses).toEqual([]);
      expect(result.actions.map(action => action.id)).toEqual(["review-roster"]);
    }
    const missingSlots = diagnose({ ...cases[2], slotsReviewed: false, slots: emptyWorkspace().slots });
    expect(missingSlots.actions.map(action => action.id)).toEqual(["review-roster", "enter-slots"]);
    const unreviewedSlots = diagnose({ ...complete, slotsReviewed: false });
    expect(unreviewedSlots.weaknesses).toEqual([]);
    expect(unreviewedSlots.actions.map(action => action.id)).toEqual(["review-slots"]);
  });

  it("does not invent dedicated-position findings in flex-only or no-slot positions", () => {
    const result = diagnose(reviewed([player("dual", "C/LW")], { F: "2" }));
    expect(result.strengths).toEqual([]);
    expect(result.weaknesses.map(finding => finding.id)).toEqual(["simultaneous"]);
    expect(result.actions.map(action => action.id)).toEqual(["simultaneous"]);
  });

  it("retains the existing starting-slot bound and sends invalid setup to review", () => {
    const result = diagnose(reviewed([player("center", "C")], { C: "25", LW: "16" }));
    expect(result.strengths).toEqual([]);
    expect(result.weaknesses).toEqual([]);
    expect(result.actions.map(action => action.id)).toEqual(["enter-slots"]);
  });
});
