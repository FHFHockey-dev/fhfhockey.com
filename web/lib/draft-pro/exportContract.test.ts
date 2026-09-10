import { describe, expect, it } from "vitest";
import { draftProExportInputSchema, formatDraftProExportCsv } from "./exportContract";

const input = {
  season: "20262027",
  leagueType: "categories" as const,
  sourceWeights: { projections: 0.7 },
  scoring: { G: 3 },
  goalieScoring: { W: 4 },
  adjustments: { prorate84: true },
  rows: [{ playerId: 1, fullName: "  =SUM(A1:A2)", team: "A, B\nC", projected: 12.5 }],
};

describe("Draft Pro export contract", () => {
  it("refuses to format a LineupExperts blend", () => {
    expect(() => formatDraftProExportCsv({ ...input, sourceWeights: { source: 1, lineupexperts_skaters: 1 } })).toThrow(/LineupExperts/);
  });
  it("preserves numeric cells and neutralizes formula-like text with CSV quoting", () => {
    const parsed = draftProExportInputSchema.parse(input);
    const csv = formatDraftProExportCsv(parsed);
    expect(csv).toContain("'  =SUM(A1:A2)");
    expect(csv).toContain('"A, B\nC"');
    expect(csv).toContain(",12.5\r\n");
  });

  it("includes season, source weights, and scoring provenance", () => {
    const csv = formatDraftProExportCsv(draftProExportInputSchema.parse(input));
    expect(csv).toContain("projectionSeason,leagueType,sourceWeights,scoring,goalieScoring,adjustments");
    expect(csv).toContain("\r\n20262027,categories,");
    expect(csv).toContain(',"{""projections"":0.7}"');
    expect(csv.split("\r\n").filter(Boolean)).toHaveLength(2);
  });

  it("rejects oversized row and column bounds", () => {
    expect(() => draftProExportInputSchema.parse({ ...input, rows: Array.from({ length: 5001 }, () => ({})) })).toThrow();
    expect(() => draftProExportInputSchema.parse({ ...input, rows: [{ ...Object.fromEntries(Array.from({ length: 75 }, (_, index) => [`stat${index}`, index])) }] })).toThrow();
    expect(() => draftProExportInputSchema.parse({ ...input, sourceWeights: { ["x".repeat(65)]: 1 } })).toThrow();
    expect(() => draftProExportInputSchema.parse({ ...input, rows: [{ projectionSeason: "spoofed" }] })).toThrow();
  });
});
