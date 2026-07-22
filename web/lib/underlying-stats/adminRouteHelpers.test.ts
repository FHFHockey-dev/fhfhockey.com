import { beforeEach, describe, expect, it, vi } from "vitest";

const { ingestNhlApiRawGamesBestEffortMock } = vi.hoisted(() => ({
  ingestNhlApiRawGamesBestEffortMock: vi.fn(),
}));

vi.mock("lib/supabase/server", () => ({
  default: {},
}));

vi.mock("lib/supabase/Upserts/nhlRawGamecenter.mjs", () => ({
  ingestNhlApiRawGamesBestEffort: ingestNhlApiRawGamesBestEffortMock,
}));

import { runRawIngestAndRefreshBatches } from "./adminRouteHelpers";

describe("runRawIngestAndRefreshBatches", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("excludes exact replays and endpoint observations from raw write telemetry", async () => {
    ingestNhlApiRawGamesBestEffortMock.mockResolvedValue({
      results: [
        {
          gameId: 2025021184,
          rosterCount: 10,
          eventCount: 20,
          shiftCount: 30,
          rawEndpointsStored: 4,
          idempotent: true,
        },
        {
          gameId: 2025021196,
          rosterCount: 40,
          eventCount: 50,
          shiftCount: 60,
          rawEndpointsStored: 4,
          idempotent: false,
        },
      ],
      failures: [],
    });
    const refreshSummaries = vi.fn().mockResolvedValue({ rowsUpserted: 2 });

    const result = await runRawIngestAndRefreshBatches({
      gameIdBatches: [[2025021184, 2025021196]],
      seasonId: 20252026,
      requestedGameType: 2,
      shouldWarmLandingCache: false,
      refreshSummaries,
    });

    expect(result.rawRowsUpserted).toBe(150);
    expect(result.summaryRowsUpserted).toBe(2);
    expect(refreshSummaries).toHaveBeenCalledWith({
      gameIds: [2025021184, 2025021196],
      seasonId: 20252026,
      requestedGameType: 2,
      shouldWarmLandingCache: false,
    });
  });
});
