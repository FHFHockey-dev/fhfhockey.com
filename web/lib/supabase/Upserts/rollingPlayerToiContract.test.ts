import { describe, expect, it } from "vitest";

import {
  normalizeWgoToiPerGame,
  resolveFallbackToiSeed,
  resolveRollingPlayerToiContext
} from "./rollingPlayerToiContract";

describe("rollingPlayerToiContract", () => {
  it("normalizes WGO toi_per_game minutes into seconds", () => {
    expect(normalizeWgoToiPerGame({ toiPerGame: 18.5 })).toEqual({
      seconds: 1110,
      normalization: "minutes_to_seconds",
      rejection: null
    });
  });

  it("treats large WGO values as already-seconds values", () => {
    expect(normalizeWgoToiPerGame({ toiPerGame: 950 })).toEqual({
      seconds: 950,
      normalization: "already_seconds",
      rejection: null
    });
  });

  it("flags suspicious TOI values explicitly", () => {
    expect(normalizeWgoToiPerGame({ toiPerGame: "bad" as any })).toEqual({
      seconds: null,
      normalization: "invalid",
      rejection: "non_finite"
    });
    expect(normalizeWgoToiPerGame({ toiPerGame: -1 })).toEqual({
      seconds: null,
      normalization: "invalid",
      rejection: "non_positive"
    });
  });

  it("preserves fallback seed ordering while exposing rejection details", () => {
    expect(
      resolveFallbackToiSeed({
        countsToi: 0,
        countsOiToi: null,
        wgoToiPerGame: 17
      })
    ).toEqual({
      fallbackToiSeconds: 1020,
      source: "wgo",
      rejections: [{ source: "counts", reason: "non_positive" }],
      wgoNormalization: "minutes_to_seconds"
    });
  });

  it("resolves TOI context with explicit trust tier and rejected candidate tracking", () => {
    expect(
      resolveRollingPlayerToiContext({
        countsToi: null,
        countsOiToi: 0,
        ratesToiPerGp: 840,
        fallbackToiSeconds: 1020,
        wgoToiPerGame: 17
      })
    ).toEqual({
      seconds: 840,
      source: "rates",
      trustTier: "supplementary",
      rejectedCandidates: [{ source: "counts_oi", reason: "non_positive" }],
      wgoNormalization: "missing"
    });
  });
});
