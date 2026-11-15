import { describe, expect, it, vi } from "vitest";

import {
  RankingPublicationTableMissingError,
  fetchPublicationMarker,
  isMissingPublicationTableError,
  publicationCompletionBlockers,
  upsertPublicationMarkers,
} from "./rankingPublications";

describe("rankingPublications", () => {
  it("recognises an undeployed marker table", () => {
    expect(isMissingPublicationTableError({ code: "PGRST205", message: "x" })).toBe(true);
    expect(isMissingPublicationTableError({ code: "42P01", message: "x" })).toBe(true);
    expect(isMissingPublicationTableError({ message: 'relation "public.ranking_publications" does not exist' })).toBe(true);
    expect(isMissingPublicationTableError({ code: "57014", message: "statement timeout" })).toBe(false);
    expect(isMissingPublicationTableError(null)).toBe(false);
  });

  it("is complete only when the database count and the population both match", () => {
    expect(publicationCompletionBlockers({ expectedRows: 10, dbWrittenRows: 10, expectedEntities: 2, writtenEntities: 2 })).toEqual([]);
    expect(publicationCompletionBlockers({ expectedRows: 10, dbWrittenRows: 9, expectedEntities: 2, writtenEntities: 2 })).toHaveLength(1);
    expect(publicationCompletionBlockers({ expectedRows: 10, dbWrittenRows: null, expectedEntities: 2, writtenEntities: 2 })).toHaveLength(1);
    expect(publicationCompletionBlockers({ expectedRows: 10, dbWrittenRows: 10, expectedEntities: 3, writtenEntities: 2 })).toHaveLength(1);
    expect(publicationCompletionBlockers({ expectedRows: 0, dbWrittenRows: 0, expectedEntities: 0, writtenEntities: 0 })).toHaveLength(1);
  });

  it("upserts markers on the full publication key and stamps updated_at", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    await upsertPublicationMarkers({ from: vi.fn(() => ({ upsert })) } as any, [{ surface: "entity_metric_rankings" } as any]);
    expect(upsert.mock.calls[0]?.[1]).toEqual({
      onConflict: "surface,season_id,snapshot_date,strength_state,window_type,window_size,peer_group_type,peer_group_key",
    });
    expect(upsert.mock.calls[0]?.[0][0].updated_at).toEqual(expect.any(String));
  });

  it("turns a missing table into a typed error on write and read", async () => {
    const missing = { code: "PGRST205", message: "Could not find the table" };
    const upsert = vi.fn().mockResolvedValue({ error: missing });
    await expect(upsertPublicationMarkers({ from: () => ({ upsert }) } as any, [{} as any]))
      .rejects.toBeInstanceOf(RankingPublicationTableMissingError);
    const query: any = { select: () => query, eq: () => query, limit: async () => ({ data: null, error: missing }) };
    await expect(fetchPublicationMarker({ from: () => query } as any, {} as any))
      .rejects.toBeInstanceOf(RankingPublicationTableMissingError);
  });
});
