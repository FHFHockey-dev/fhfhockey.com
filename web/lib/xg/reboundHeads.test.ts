import { describe, expect, it } from "vitest";
import { buildReboundHeadOutputs } from "./reboundHeads";

describe("rebound heads", () => {
  it("keeps creation, danger, freeze/control, and second-chance xG distinct", () => {
    const rows = buildReboundHeadOutputs([{ gameId: 1, eventId: 2, reboundCreationProbability: 0.4, conditionalDangerProbability: 0.5, goalieFreezeProbability: null, conditionalSecondChanceXg: 0.3 }]);
    expect(rows.map((row) => [row.head, row.value, row.status])).toEqual([
      ["rebound_creation", 0.4, "approved_model"],
      ["rebound_danger", 0.2, "candidate_contract"],
      ["goalie_freeze_control", null, "unavailable"],
      ["second_chance_xg", 0.12, "candidate_contract"],
    ]);
  });
});

