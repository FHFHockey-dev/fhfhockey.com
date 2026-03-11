import { describe, expect, it } from "vitest";

import {
  canonicalOrLegacyFinite,
  canonicalOrLegacyNullable
} from "./rollingPlayerMetricCompatibility";

describe("rollingPlayerMetricCompatibility", () => {
  it("prefers canonical finite values and falls back to legacy otherwise", () => {
    expect(canonicalOrLegacyFinite(8.5, 7.2)).toBe(8.5);
    expect(canonicalOrLegacyFinite(null, 7.2)).toBe(7.2);
    expect(canonicalOrLegacyFinite(undefined, 7.2)).toBe(7.2);
    expect(canonicalOrLegacyFinite(Number.NaN, 7.2)).toBe(7.2);
  });

  it("uses nullish semantics for compatibility paths that accept canonical nulls", () => {
    expect(canonicalOrLegacyNullable(8.5, 7.2)).toBe(8.5);
    expect(canonicalOrLegacyNullable(null, 7.2)).toBe(7.2);
    expect(canonicalOrLegacyNullable(undefined, 7.2)).toBe(7.2);
  });
});
