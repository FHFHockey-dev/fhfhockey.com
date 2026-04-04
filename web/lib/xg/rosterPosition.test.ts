import { describe, expect, it } from "vitest";

import {
  buildShooterPositionGroup,
  normalizeRosterPosition,
} from "./rosterPosition";

describe("rosterPosition", () => {
  it("normalizes stable NHL roster position codes", () => {
    expect(normalizeRosterPosition("L")).toBe("L");
    expect(normalizeRosterPosition("r")).toBe("R");
    expect(normalizeRosterPosition("C")).toBe("C");
    expect(normalizeRosterPosition("D")).toBe("D");
    expect(normalizeRosterPosition("G")).toBe("G");
    expect(normalizeRosterPosition("LW")).toBeNull();
    expect(normalizeRosterPosition(null)).toBeNull();
  });

  it("maps roster positions into coarse shooter groups", () => {
    expect(buildShooterPositionGroup("L")).toBe("forward");
    expect(buildShooterPositionGroup("C")).toBe("forward");
    expect(buildShooterPositionGroup("D")).toBe("defense");
    expect(buildShooterPositionGroup("G")).toBe("goalie");
    expect(buildShooterPositionGroup(null)).toBeNull();
  });
});
