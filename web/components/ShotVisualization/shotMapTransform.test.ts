import { describe, expect, it } from "vitest";

import { foldShotToHalfRink, shotToHalfRinkSvg } from "./shotMapTransform";

describe("shot map half-rink fold", () => {
  it("plots the same physical spot at one point whichever end the team attacks", () => {
    // (70, -20) attacking +x and (-70, 20) attacking -x are the same spot
    // relative to the attacked net (the second is the first rotated 180 deg).
    expect(shotToHalfRinkSvg(-70, 20)).toEqual(shotToHalfRinkSvg(70, -20));
    expect(shotToHalfRinkSvg(-55, -12)).toEqual(shotToHalfRinkSvg(55, 12));
  });

  it("keeps a shot from the shooter's left on the viewer's left in both periods", () => {
    // Attacking +x, the shooter's left is +y; attacking -x it is -y.
    const center = 42.5;
    const [leftAttackingPlusX] = shotToHalfRinkSvg(70, 20);
    const [leftAttackingMinusX] = shotToHalfRinkSvg(-70, -20);
    expect(leftAttackingPlusX).toBeLessThan(center);
    expect(leftAttackingMinusX).toBeLessThan(center);
    expect(leftAttackingMinusX).toBe(leftAttackingPlusX);
  });

  it("puts the attacked net near the top of the half rink", () => {
    expect(shotToHalfRinkSvg(89, 0)).toEqual([42.5, 11]);
    expect(shotToHalfRinkSvg(-89, 0)).toEqual([42.5, 11]);
  });

  it("is a rotation of one fold, not a reflection", () => {
    const [ax, ay] = foldShotToHalfRink(70, -20);
    const [bx, by] = foldShotToHalfRink(-70, 20);
    expect([ax, ay]).toEqual([bx, by]);
  });
});
