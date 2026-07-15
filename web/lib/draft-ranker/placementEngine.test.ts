import { describe, expect, it } from "vitest";

import {
  answerPlacementEngine,
  initialPlacementInterval,
  startPlacementEngine,
  type PlacementEntry,
} from "./placementEngine";

const entries: PlacementEntry[] = Array.from({ length: 313 }, (_, index) => ({
  playerId: index + 1000,
  rank: index + 1,
}));

describe("deterministic assisted-placement engine", () => {
  it("maps every approved rough range to bounded insertion ranks", () => {
    expect(initialPlacementInterval("top_50", 313)).toEqual([1, 50]);
    expect(initialPlacementInterval("51_100", 313)).toEqual([51, 100]);
    expect(initialPlacementInterval("201_250", 313)).toEqual([201, 250]);
    expect(initialPlacementInterval("outside_250", 313)).toEqual([251, 314]);
    expect(initialPlacementInterval("unsure", 313)).toEqual([1, 314]);
  });

  it("uses deterministic midpoint anchors and narrows toward the user preference", () => {
    let state = startPlacementEngine("101_150", entries);
    expect(state.issuedAnchors[0]).toMatchObject({ rank: 125, mode: "narrow" });

    state = answerPlacementEngine(state, entries, "anchor_over_target");
    expect(state.intervalLow).toBe(126);
    expect(state.issuedAnchors.at(-1)).toMatchObject({ rank: 138 });

    state = answerPlacementEngine(state, entries, "target_over_anchor");
    expect(state.intervalHigh).toBe(138);
  });

  it("turns too-close into local validation and produces a plausible result", () => {
    let state = startPlacementEngine("151_200", entries);
    state = answerPlacementEngine(state, entries, "too_close");
    expect(state.intervalHigh - state.intervalLow).toBeLessThanOrEqual(1);

    while (!state.ready) {
      const anchor = state.issuedAnchors.at(-1)!;
      const outcome =
        anchor.expectedOutcome ??
        (anchor.rank < state.intervalLow
          ? "anchor_over_target"
          : "target_over_anchor");
      state = answerPlacementEngine(state, entries, outcome);
    }
    expect(state.completionReason).toBe("validated_interval");
    expect(state.suggestedRank).toBeGreaterThanOrEqual(175);
    expect(state.plausibleLow).not.toBeNull();
  });

  it("forces explicit rank 250 and 251 evidence near the cutoff", () => {
    let state = startPlacementEngine("201_250", entries);
    while (state.intervalHigh - state.intervalLow > 1) {
      state = answerPlacementEngine(state, entries, "anchor_over_target");
    }
    while (!state.ready) {
      const anchor = state.issuedAnchors.at(-1)!;
      state = answerPlacementEngine(
        state,
        entries,
        anchor.expectedOutcome ?? "target_over_anchor",
      );
    }
    const comparedRanks = state.answers.map((answer) => answer.anchorRank);
    expect(comparedRanks).toContain(250);
    expect(comparedRanks).toContain(251);
  });

  it("retries one contradiction and broadens uncertainty when it persists", () => {
    let state = startPlacementEngine("top_50", entries);
    state = answerPlacementEngine(state, entries, "too_close");
    const validation = state.issuedAnchors.at(-1)!;
    expect(validation.expectedOutcome).toBeTruthy();
    const contrary =
      validation.expectedOutcome === "target_over_anchor"
        ? "anchor_over_target"
        : "target_over_anchor";
    state = answerPlacementEngine(state, entries, contrary);
    expect(state.issuedAnchors.at(-1)?.mode).toBe("contradiction_retry");
    state = answerPlacementEngine(state, entries, contrary);
    expect(state.ready).toBe(true);
    expect(state.completionReason).toBe("unresolved_contradiction");
    expect(state.confidence).toBe("developing");
    expect(state.plausibleHigh! - state.plausibleLow!).toBeGreaterThan(1);
  });

  it("never exceeds the approved ordinary comparison cap", () => {
    let state = startPlacementEngine("unsure", entries);
    while (!state.ready) {
      state = answerPlacementEngine(state, entries, "skip");
    }
    expect(state.questionCount).toBeLessThanOrEqual(12);
    expect(state.completionReason).toMatch(/comparison_cap|anchor_exhausted/);
  });
});
