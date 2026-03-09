import { describe, expect, it } from "vitest";

import {
  normalizeGameDate,
  normalizeSustainabilityDate,
  parseSustainabilityDateParam
} from "./dates";

describe("sustainability date helpers", () => {
  it("keeps YYYY-MM-DD inputs unchanged", () => {
    expect(normalizeSustainabilityDate("2026-03-08")).toBe("2026-03-08");
  });

  it("normalizes timestamp-like values to ISO dates", () => {
    expect(normalizeSustainabilityDate("2026-03-08T15:42:10Z")).toBe(
      "2026-03-08"
    );
  });

  it("falls back when the date param is invalid", () => {
    expect(parseSustainabilityDateParam("not-a-date", "2026-01-01")).toBe(
      "2026-01-01"
    );
  });

  it("prefers WGO date and falls back to NST date_scraped", () => {
    expect(
      normalizeGameDate({
        date: "2026-02-10T00:00:00Z",
        date_scraped: "2026-02-11"
      })
    ).toBe("2026-02-10");

    expect(
      normalizeGameDate({
        date: null,
        date_scraped: "2026-02-11T08:30:00Z"
      })
    ).toBe("2026-02-11");
  });
});
