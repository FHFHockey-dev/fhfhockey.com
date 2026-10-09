import { describe, expect, it } from "vitest";

import {
  normalizeWgoToiPerGame,
  resolveFallbackToiSeed,
  resolveRollingPlayerToiContext
} from "./rollingPlayerToiContract";

describe("rollingPlayerToiContract", () => {
  it.each([0, 2.6, 35, 120, 207, 866])("keeps strength-specific seconds without scaling or rounding: %s", (seconds) => {
    expect(normalizeWgoToiPerGame({ toiPerGame: seconds, strengthSpecific: true })).toEqual({
      seconds,
      normalization: "already_seconds",
      rejection: null
    });
  });

  it.each([null, undefined])("preserves missing strength-specific TOI: %s", (value) => {
    expect(normalizeWgoToiPerGame({ toiPerGame: value, strengthSpecific: true })).toEqual({
      seconds: null,
      normalization: "missing",
      rejection: null
    });
  });

  it.each(["", " ", NaN, Infinity, -1, 4000])("rejects invalid strength-specific TOI instead of manufacturing zero: %s", (value) => {
    expect(normalizeWgoToiPerGame({ toiPerGame: value as any, strengthSpecific: true })).toMatchObject({
      seconds: null,
      normalization: "invalid"
    });
  });

  it.each([
    [{ countsToi: 0, countsOiToi: 100, ratesToiPerGp: 200, fallbackToiSeconds: 300, wgoToiPerGame: 400 }, 0, "counts"],
    [{ countsToi: null, countsOiToi: 0, ratesToiPerGp: 200, fallbackToiSeconds: 300, wgoToiPerGame: 400 }, 0, "counts_oi"],
    [{ countsToi: null, countsOiToi: null, ratesToiPerGp: 0, fallbackToiSeconds: 300, wgoToiPerGame: 400 }, 0, "rates"],
    [{ countsToi: null, countsOiToi: null, ratesToiPerGp: null, fallbackToiSeconds: 0, wgoToiPerGame: 400 }, 0, "fallback"],
    [{ countsToi: null, countsOiToi: null, ratesToiPerGp: null, fallbackToiSeconds: null, wgoToiPerGame: 0 }, 0, "wgo"],
    [{ countsToi: null, countsOiToi: null, ratesToiPerGp: null, fallbackToiSeconds: null, wgoToiPerGame: null }, null, "none"]
  ] as const)("retains zero with normal source precedence: %s", (inputs, seconds, source) => {
    expect(resolveRollingPlayerToiContext({ ...inputs, strengthSpecific: true })).toMatchObject({
      seconds, source, rejectedCandidates: []
    });
  });

  it("rejects an invalid primary candidate before using a valid split-strength source", () => {
    expect(resolveRollingPlayerToiContext({
      countsToi: -1,
      countsOiToi: 120,
      ratesToiPerGp: 240,
      fallbackToiSeconds: 300,
      wgoToiPerGame: 400,
      strengthSpecific: true
    })).toMatchObject({
      seconds: 120,
      source: "counts_oi",
      rejectedCandidates: [{ source: "counts", reason: "non_positive" }]
    });
    expect(resolveFallbackToiSeed({
      countsToi: null,
      countsOiToi: null,
      wgoToiPerGame: 0,
      strengthSpecific: true
    })).toEqual({
      fallbackToiSeconds: 0, source: "wgo", rejections: [], wgoNormalization: "already_seconds"
    });
  });

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
