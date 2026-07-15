import { describe, expect, it } from "vitest";

import {
  DRAFT_RANKING_CSV_COLUMNS,
  DRAFT_RANKING_EXPORT_SCHEMA_VERSION,
  draftRankingExportFilename,
  serializeDraftRankingCsv,
  type DraftRankingExportDocument,
} from "./export";

function document(): DraftRankingExportDocument {
  return {
    schemaVersion: DRAFT_RANKING_EXPORT_SCHEMA_VERSION,
    exportedAt: "2026-07-15T12:00:00.000Z",
    ranking: {
      id: "11111111-1111-4111-8111-111111111111",
      name: "My Rankings",
      status: "active",
      version: 7,
      targetSeason: 20262027,
      scoringProfile: { format: "points, custom" },
      schemaVersion: 1,
      seedRevision: "yahoo-2025-v1",
      seedProvenance: null,
    },
    options: {
      includeCandidates: true,
      includeWatchlist: true,
      includeEventSummary: false,
      privateComparisonEvidenceIncluded: false,
    },
    top250: [
      {
        rank: 1,
        listState: "top_250",
        fhfhPlayerId: 9320,
        nhlPlayerId: 8478402,
        playerName: 'Connor "McDavid", C',
        organization: "Edmonton Oilers",
        position: "C",
        identityStatus: "active_nhl",
        yahooEligibility: "verified",
        priorYahooAdp: 1.3,
        adpState: "numeric",
        communityRank: 1,
        communityConfidence: "market prior",
        projectionFptsPerGame: null,
        tier: "S",
        notes: "First line\nuntouchable",
        watchlisted: false,
        updatedAt: "2026-07-15T11:00:00.000Z",
      },
    ],
    candidates: [],
    watchlist: [],
    eventSummary: null,
  };
}

describe("Draft Ranking export contract", () => {
  it("keeps the approved CSV column order and RFC-compatible escaping", () => {
    const csv = serializeDraftRankingCsv(document());
    const [header, row] = csv.split("\r\n");
    expect(header).toBe(DRAFT_RANKING_CSV_COLUMNS.join(","));
    expect(row).toContain('"{\"\"format\"\":\"\"points, custom\"\"}"');
    expect(row).toContain('"Connor ""McDavid"", C"');
    expect(csv).toContain('"First line\nuntouchable"');
  });

  it("round-trips versioned JSON without private comparison evidence", () => {
    const parsed = JSON.parse(JSON.stringify(document()));
    expect(parsed.schemaVersion).toBe("fhfh-draft-ranking-v1");
    expect(parsed.options.privateComparisonEvidenceIncluded).toBe(false);
    expect(parsed.top250[0]).toMatchObject({
      fhfhPlayerId: 9320,
      nhlPlayerId: 8478402,
      adpState: "numeric",
    });
    expect(JSON.stringify(parsed)).not.toContain("comparisonId");
  });

  it("uses a stable season-aware filename", () => {
    expect(draftRankingExportFilename(20262027, "json")).toBe(
      "fhfh-draft-rankings-2026-2027.json",
    );
  });
});
