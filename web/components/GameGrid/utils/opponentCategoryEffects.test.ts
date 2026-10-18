import { describe, expect, it } from "vitest";
import {
  assessOpponentFactor,
  findDoubleCountedEffects,
  getOpponentViewDirections,
  OPPONENT_CATEGORY_EFFECTS
} from "./opponentCategoryEffects";

describe("category-specific opponent effects", () => {
  it("keeps the released skater coloring and splits the goalie view", () => {
    expect(getOpponentViewDirections("skater")).toEqual({
      avgXgf: "asc", avgXga: "desc", avgGoalFor: "asc", avgGoalAgainst: "desc",
      avgSf: "asc", avgSa: "desc", avgWinPct: "asc"
    });
    expect(getOpponentViewDirections("goalie")).toEqual({
      avgXgf: "asc", avgXga: "desc", avgGoalFor: "asc", avgGoalAgainst: "desc",
      avgSf: "asc", avgSa: null, avgWinPct: "asc"
    });
  });

  it("has no universal sign: opponent shot volume reverses between categories", () => {
    const sfSign = (role: "skater" | "goalie", category: string) =>
      OPPONENT_CATEGORY_EFFECTS[role][category].inputs.find(({ metric }) => metric === "avgSf")?.favorable;
    expect(sfSign("skater", "SOG")).toBe("asc");
    expect(sfSign("skater", "BLK")).toBe("desc");
    expect(sfSign("goalie", "GA")).toBe("asc");
    expect(sfSign("goalie", "SV")).toBe("desc");
  });

  it("leaves categories without a qualified input empty instead of borrowing a sign", () => {
    for (const category of ["PPP", "HIT", "PIM"]) expect(OPPONENT_CATEGORY_EFFECTS.skater[category].inputs).toEqual([]);
    expect(OPPONENT_CATEGORY_EFFECTS.goalie["SV%"].inputs).toEqual([]);
  });

  it("rejects existing team-strength inputs and cross-role categories as category factors", () => {
    expect(assessOpponentFactor({ role: "skater", category: "G", source: "win_odds", value: 1.1 }).status).toBe("rejected");
    expect(assessOpponentFactor({ role: "goalie", category: "GA", source: "standings_pts_pct", value: 0.9 }).status).toBe("rejected");
    expect(assessOpponentFactor({ role: "goalie", category: "BLK", source: "qualified_model", value: 1 }).status).toBe("rejected");
    expect(assessOpponentFactor({ role: "skater", category: "SOG", source: "qualified_model", value: null }).status).toBe("unavailable");
    expect(assessOpponentFactor({ role: "skater", category: "SOG", source: "qualified_model", value: 0 }).status).toBe("unavailable");
    expect(assessOpponentFactor({ role: "skater", category: "SOG", source: "qualified_model", value: 1.08 }).status).toBe("qualified");
  });

  it("finds an effect applied by more than one layer", () => {
    expect(findDoubleCountedEffects([
      { layer: "forge_forecast", effects: ["opponent", "venue", "rest"] },
      { layer: "game_grid_category_factor", effects: ["opponent"] },
      { layer: "week_score", effects: ["contest_outcome", "contest_outcome"] }
    ])).toEqual([{ effect: "opponent", layers: ["forge_forecast", "game_grid_category_factor"] }]);
    expect(findDoubleCountedEffects([{ layer: "forge_forecast", effects: ["opponent"] }])).toEqual([]);
  });
});
