import { describe, expect, it } from "vitest";
import { ratioCategoriesWorse } from "./pointsComparison";
import type { PlanEvaluation, PlanningSnapshot } from "./planningTypes";

// Decision 51: synthetic goalie categories only.
const rules = { rules: { scoring: { mode: "categories", weights: {}, categories: [
  { key: "WINS_GOALIE", direction: "higher" },
  { key: "GOALS_AGAINST_AVERAGE", direction: "lower", numerator: "GOALS_AGAINST_GOALIE", denominator: "GOALIE_MINUTES" },
  { key: "SAVE_PERCENTAGE", direction: "higher", numerator: "SAVES_GOALIE", denominator: "SHOTS_AGAINST_GOALIE" }] } } } as unknown as Pick<PlanningSnapshot, "rules">;
const results = (wins: number, gaa: number | null, sv: number | null) => ({ categoryResults: [
  { key: "WINS_GOALIE", own: wins }, { key: "GOALS_AGAINST_AVERAGE", own: gaa }, { key: "SAVE_PERCENTAGE", own: sv }] } as unknown as PlanEvaluation);

describe("ratioCategoriesWorse (decision 51)", () => {
  const hold = results(2, 2.5, 0.91);
  it("flags any worse ratio by its direction, with no threshold, and ignores counting categories", () => {
    expect(ratioCategoriesWorse(rules, results(3, 2.5001, 0.91), hold)).toEqual(["GOALS_AGAINST_AVERAGE"]);
    expect(ratioCategoriesWorse(rules, results(3, 2.4, 0.9099), hold)).toEqual(["SAVE_PERCENTAGE"]);
    expect(ratioCategoriesWorse(rules, results(1, 2.4, 0.92), hold)).toEqual([]);
  });
  it("treats an unknown ratio as not shown to be kept", () => {
    expect(ratioCategoriesWorse(rules, results(3, null, 0.92), hold)).toEqual(["GOALS_AGAINST_AVERAGE"]);
  });
});
