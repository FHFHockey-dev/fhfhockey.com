import { describe, expect, it } from "vitest";
import {
  calculateWeightedProjection,
  getEffectiveSourceShares,
  normalizeSourceWeights
} from "./sourceWeights";
import { rankProjectionPlayers } from "./sourceRankImpact";

describe("projection source weights", () => {
  it("normalizes arbitrary selected scalar weights into effective shares", () => {
    const controls = {
      a: { isSelected: true, weight: 2 },
      b: { isSelected: true, weight: 0.5 },
      c: { isSelected: false, weight: 2 }
    };
    expect(getEffectiveSourceShares(controls)).toEqual({ a: 0.8, b: 0.2, c: 0 });
    expect(normalizeSourceWeights(controls)).toEqual({
      a: { isSelected: true, weight: 0.8 },
      b: { isSelected: true, weight: 0.2 },
      c: { isSelected: false, weight: 2 }
    });
  });

  it("returns zero shares and a null projection for a zero-sum selection", () => {
    const controls = {
      a: { isSelected: true, weight: 0 },
      b: { isSelected: false, weight: 1 }
    };
    expect(getEffectiveSourceShares(controls)).toEqual({ a: 0, b: 0 });
    expect(normalizeSourceWeights(controls)).toBe(controls);
    expect(calculateWeightedProjection([{ value: 20, weight: 0 }])).toBeNull();
  });

  it("renormalizes around missing values without fabricating zero", () => {
    expect(
      calculateWeightedProjection([
        { value: 10, weight: 1 },
        { value: 30, weight: 3 },
        { value: null, weight: 10 }
      ])
    ).toBe(25);
  });

  it("recalculates the downstream projection when effective weights change", () => {
    const values = [10, 30];
    const equal = calculateWeightedProjection([
      { value: values[0], weight: 1 },
      { value: values[1], weight: 1 }
    ]);
    const weighted = calculateWeightedProjection([
      { value: values[0], weight: 0.25 },
      { value: values[1], weight: 0.75 }
    ]);

    expect(equal).toBe(20);
    expect(weighted).toBe(25);
  });

  it("keeps representative cached source-weight math within 200ms", () => {
    const playerCount = 1000;
    const statCount = 24;
    const sourceCount = 8;
    const started = performance.now();
    const players = Array.from({ length: playerCount }, (_, playerIndex) => {
      let projected = 0;
      for (let statIndex = 0; statIndex < statCount; statIndex += 1) {
        projected +=
          calculateWeightedProjection(
            Array.from({ length: sourceCount }, (_, sourceIndex) => ({
              value: playerIndex + statIndex + sourceIndex / 10,
              weight: sourceIndex + 1
            }))
          ) || 0;
      }
      return {
        playerId: String(playerIndex),
        displayPosition: playerIndex % 12 === 0 ? "G" : "C",
        fantasyPoints: { projected }
      };
    });
    rankProjectionPlayers(players);
    const elapsedMs = performance.now() - started;

    console.info(
      `[A-DRAFT source-weight benchmark] ${playerCount} players x ${statCount} stats x ${sourceCount} sources: ${elapsedMs.toFixed(2)}ms`
    );
    expect(elapsedMs).toBeLessThan(200);
  });
});
