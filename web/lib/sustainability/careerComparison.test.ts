import { describe, expect, it } from "vitest";

import { compareWindowToCareer } from "./careerComparison";

// BC W1-9 D12: /charts current-vs-career colours account for sample size.
describe("compareWindowToCareer", () => {
  const career = { numerator: 100, denominator: 1000 }; // 10% S%

  it("a doubled S% on 10 shots is within the usual range (the old +2-point rule called it red)", () => {
    // P(X >= 2 | n = 10, p ~ .10) = .26: not unusual.
    expect(compareWindowToCareer("S%", { numerator: 2, denominator: 10 }, career).status).toBe(
      "neutral"
    );
  });

  it("an extreme S% stretch is above the range", () => {
    expect(compareWindowToCareer("S%", { numerator: 15, denominator: 50 }, career).status).toBe(
      "hot"
    );
  });

  it("a shot rate far below career is below the range", () => {
    // Career 10 SOG/60 over 14,400 minutes; 2 shots in 60 minutes.
    const result = compareWindowToCareer(
      "SOG/60",
      { numerator: 2, denominator: 60 },
      { numerator: 2400, denominator: 14_400 }
    );
    expect(result.status).toBe("cold");
  });

  it("xS% uses the labelled continuous range", () => {
    const result = compareWindowToCareer(
      "xS%",
      { numerator: 1.2, denominator: 20 },
      { numerator: 90, denominator: 1500 }
    );
    expect(result.status).toBe("neutral");
    expect(result.range).toMatchObject({ family: "negative_binomial_continuous" });
  });

  it("missing, empty or out-of-domain samples are insufficient, never blue", () => {
    expect(compareWindowToCareer("S%", { numerator: 0, denominator: 0 }, career).status).toBe(
      "insufficient"
    );
    expect(compareWindowToCareer("S%", { numerator: 1, denominator: 4 }, null).status).toBe(
      "insufficient"
    );
    expect(
      compareWindowToCareer("IPP", { numerator: 3, denominator: 2 }, career).status
    ).toBe("insufficient");
    expect(compareWindowToCareer("oZS%", undefined, career).status).toBe("insufficient");
  });
});
