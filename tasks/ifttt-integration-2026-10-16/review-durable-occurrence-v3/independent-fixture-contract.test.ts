// @vitest-environment node
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
const fixtures = JSON.parse(readFileSync(join(__dirname, "cases.json"), "utf8"));

describe("independent corrected game fixture contract", () => {
  it.each(fixtures.positiveCases)("$id keeps all supplied scope dates consistent with its explicit source applicability", (c: any) => {
    for (const r of c.records) {
      const declared = r.interpretation.scope.date;
      console.log("fixture dates", JSON.stringify({ id: c.id, record: r.recordId, declared, applicability: r.sourceApplicability.date, effectiveAt: r.time.effectiveAt }));
      if (declared !== undefined) expect(declared).toBe(r.sourceApplicability.date);
      const eastern = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(r.time.effectiveAt));
      expect(eastern).toBe(r.sourceApplicability.date);
    }
  });
  it("has authentic complete-text digests and causal clocks for the new positive fixtures", () => {
    for (const c of fixtures.positiveCases) for (const r of c.records) {
      expect(createHash("sha256").update(r.sourceText.text).digest("hex")).toBe(r.sourceText.sha256);
      expect(Date.parse(r.time.originalPublishedAt)).toBeLessThanOrEqual(Date.parse(r.time.receivedAt));
      expect(Date.parse(r.time.receivedAt)).toBeLessThanOrEqual(Date.parse(r.time.interpretedAt));
      expect(Date.parse(r.time.interpretedAt)).toBeLessThanOrEqual(Date.parse(c.steps.find((s: any) => s.asOf).asOf));
      expect(Date.parse(r.time.effectiveAt)).toBeLessThan(Date.parse(r.time.validUntil));
    }
  });
});
