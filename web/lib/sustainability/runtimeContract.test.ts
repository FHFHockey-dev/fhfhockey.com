import { describe, expect, it } from "vitest";

import {
  SUSTAINABILITY_SCORE_MODEL_VERSION,
  SUSTAINABILITY_SCORE_CONFIG_HASH,
  SUSTAINABILITY_EXACT_SCORE_PROBABILITY_THRESHOLDS,
  SUSTAINABILITY_SCORE_PRECISION,
  SUSTAINABILITY_SCORE_WINDOW_CODES,
  SUSTAINABILITY_SCORE_PROVENANCE_VERSION,
  SUSTAINABILITY_TREND_BAND_MODEL_VERSION,
  buildSustainabilityConfigHash,
} from "./runtimeContract";

describe("sustainability runtime contract", () => {
  it("publishes stable model versions and order-insensitive config hashes", () => {
    expect(SUSTAINABILITY_SCORE_MODEL_VERSION).toBe("sustainability_score_v2");
    expect(SUSTAINABILITY_SCORE_CONFIG_HASH).toBe("fnv1a_91691726");
    expect(SUSTAINABILITY_SCORE_PRECISION).toBe(2);
    expect(SUSTAINABILITY_EXACT_SCORE_PROBABILITY_THRESHOLDS).toEqual({
      lower: 0.005,
      upper: 0.995,
    });
    expect(SUSTAINABILITY_SCORE_WINDOW_CODES).toEqual([
      "l3",
      "l5",
      "l10",
      "l20",
    ]);
    expect(SUSTAINABILITY_SCORE_PROVENANCE_VERSION).toBe(
      "sustainability_score_provenance_v2",
    );
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
