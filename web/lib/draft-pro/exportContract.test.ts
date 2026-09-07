import { describe, expect, it } from "vitest";
import { draftProExportInputSchema, formatDraftProExportCsv } from "./exportContract";

const input = {
  season: "20262027",
  sourceWeights: { projections: 0.7 },
  scoring: { G: 3 },
  rows: [{ playerId: 1, fullName: "  =SUM(A1:A2)", team: "A, B\nC", projected: 12.5 }],
};

describe("Draft Pro export contract", () => {
  it("preserves numeric cells and neutralizes formula-like text with CSV quoting", () => {
    const parsed = draftProExportInputSchema.parse(input);
    const csv = formatDraftProExportCsv(parsed);
    expect(csv).toContain("'  =SUM(A1:A2)");
    expect(csv).toContain('"A, B\nC"');
    expect(csv).toContain(",12.5\r\n");
  });

  it("includes season, source weights, and scoring provenance", () => {
    const csv = formatDraftProExportCsv(draftProExportInputSchema.parse(input));
    expect(csv).toContain("projectionSeason,sourceWeights,scoring");
    expect(csv).toContain("\r\n20262027,");
    expect(csv).toContain(',"{""projections"":0.7}"');
  });

  it("rejects oversized row and column bounds", () => {
    expect(() => draftProExportInputSchema.parse({ ...input, rows: Array.from({ length: 5001 }, () => ({})) })).toThrow();
    expect(() => draftProExportInputSchema.parse({ ...input, rows: [{ ...Object.fromEntries(Array.from({ length: 78 }, (_, index) => [`stat${index}`, index])) }] })).toThrow();
  });
});
