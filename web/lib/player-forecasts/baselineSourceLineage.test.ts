import { describe, expect, it } from "vitest";
import { baselineSkaterTargets } from "./baselineSourceLineage";

describe("boxscore skater targets", () => {
  it("reads faceoffs as won/taken: lost = taken − won (L15 ticket, W2-7 D10)", () => {
    // 6 won of 9 taken: 3 lost, FO% 6/9. Reading taken as lost would give 6/(6+9).
    expect(baselineSkaterTargets({ faceoffs: "6/9" })).toMatchObject({ FACEOFFS_WON: 6, FACEOFFS_LOST: 3 });
  });

  it("keeps missing (L1: stored null) and impossible faceoff pairs unknown", () => {
    for (const faceoffs of [null, undefined, "", "7/5", "x/9"]) {
      expect(baselineSkaterTargets({ faceoffs })).toMatchObject({ FACEOFFS_WON: null, FACEOFFS_LOST: null });
    }
  });
});
