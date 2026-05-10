import { describe, expect, it } from "vitest";

import {
  SUSTAINABILITY_SCORE_MODEL_VERSION,
  SUSTAINABILITY_TREND_BAND_MODEL_VERSION,
  buildSustainabilityConfigHash,
} from "./runtimeContract";

describe("sustainability runtime contract", () => {
  it("publishes stable model versions and order-insensitive config hashes", () => {
    expect(SUSTAINABILITY_SCORE_MODEL_VERSION).toBe("sustainability_score_v2");
    expect(SUSTAINABILITY_TREND_BAND_MODEL_VERSION).toBe(
      "sustainability_trend_bands_v2",
    );
    expect(buildSustainabilityConfigHash({ b: 2, a: 1 })).toBe(
      buildSustainabilityConfigHash({ a: 1, b: 2 }),
    );
    expect(buildSustainabilityConfigHash({ a: 1 })).not.toBe(
      buildSustainabilityConfigHash({ a: 2 }),
    );
  });
});
