import { describe, expect, it } from "vitest";

import {
  buildShooterGoalieHandednessMatchup,
  normalizeShootsCatchesValue,
} from "./handedness";

describe("handedness", () => {
  it("normalizes shoots_catches values into L/R hands", () => {
    expect(normalizeShootsCatchesValue("L")).toBe("L");
    expect(normalizeShootsCatchesValue("r")).toBe("R");
    expect(normalizeShootsCatchesValue("Left")).toBe("L");
    expect(normalizeShootsCatchesValue("RIGHT")).toBe("R");
    expect(normalizeShootsCatchesValue("")).toBeNull();
    expect(normalizeShootsCatchesValue("unknown")).toBeNull();
    expect(normalizeShootsCatchesValue(null)).toBeNull();
  });

  it("builds shooter vs goalie hand matchup categories", () => {
    expect(buildShooterGoalieHandednessMatchup("L", "L")).toBe("same-hand");
    expect(buildShooterGoalieHandednessMatchup("L", "R")).toBe("opposite-hand");
    expect(buildShooterGoalieHandednessMatchup(null, "R")).toBeNull();
  });
});
