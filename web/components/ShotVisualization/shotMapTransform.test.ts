import { describe, expect, it } from "vitest";

import { foldShotToHalfRink, shotToHalfRinkSvg, shotToHalfRinkSvgForShot } from "./shotMapTransform";

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

describe("shot map by attack direction (hometeamdefendingside)", () => {
  // Home team 10 defends the left (-x) net, so it attacks +x; away team 20 attacks -x.
  const home = { hometeamdefendingside: "left", eventownerteamid: 10, hometeamid: 10 };
  const away = { hometeamdefendingside: "left", eventownerteamid: 20, hometeamid: 10 };

  it("matches the fold for shots taken in the attacking half", () => {
    expect(shotToHalfRinkSvgForShot({ xcoord: 70, ycoord: -20, ...home })).toEqual(shotToHalfRinkSvg(70, -20));
    expect(shotToHalfRinkSvgForShot({ xcoord: -70, ycoord: 20, ...away })).toEqual(shotToHalfRinkSvg(-70, 20));
  });

  it("keeps a shot from the team's own half in its own half instead of folding it onto the attacked end", () => {
    // A home shot from x = -30 (its own half, 30 ft from centre) while attacking +x.
    const [, svgY] = shotToHalfRinkSvgForShot({ xcoord: -30, ycoord: 0, ...home });
    expect(svgY).toBe(130); // 30 ft beyond centre ice (y = 100), away from the attacked net
    expect(shotToHalfRinkSvg(-30, 0)[1]).toBe(70); // the sign-of-x fold put it 30 ft inside the attacking half
  });

  it("uses the period's defending side, so the same spot plots once in both periods", () => {
    const period1 = shotToHalfRinkSvgForShot({ xcoord: 70, ycoord: -20, ...home });
    const period2 = shotToHalfRinkSvgForShot({ xcoord: -70, ycoord: 20, ...home, hometeamdefendingside: "right" });
    expect(period2).toEqual(period1);
  });

  it("falls back to the sign-of-x fold when the side or ids are missing", () => {
    expect(shotToHalfRinkSvgForShot({ xcoord: -30, ycoord: 5, hometeamdefendingside: null, eventownerteamid: 10, hometeamid: 10 })).toEqual(
      shotToHalfRinkSvg(-30, 5)
    );
    expect(shotToHalfRinkSvgForShot({ xcoord: -30, ycoord: 5, hometeamdefendingside: "left", eventownerteamid: 10 })).toEqual(
      shotToHalfRinkSvg(-30, 5)
    );
  });
});
