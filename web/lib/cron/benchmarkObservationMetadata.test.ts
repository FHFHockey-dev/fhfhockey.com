import { describe, expect, it } from "vitest";

import {
  getBenchmarkObservationMetadata,
  getTouchedSystemsForJob
} from "lib/cron/benchmarkObservationMetadata";

describe("benchmarkObservationMetadata", () => {
  it("captures touched systems and caution policy for direct NST jobs", () => {
    expect(
      getBenchmarkObservationMetadata({
        name: "update-nst-gamelog",
        method: "GET",
        executionShape: "HTTP route",
        notes: []
      })
    ).toMatchObject({
      canRunLocally: true,
      localRunPolicy: "caution",
      touchedSystems: expect.arrayContaining(["supabase", "nst", "external_api"])
    });
  });

  it("marks side-effect jobs as local skip candidates", () => {
    expect(
      getBenchmarkObservationMetadata({
        name: "sync-yahoo-players-to-sheet",
        method: "GET",
        executionShape: "HTTP route",
        notes: []
      })
    ).toMatchObject({
      canRunLocally: false,
      localRunPolicy: "skip",
      touchedSystems: expect.arrayContaining(["google_sheets", "yahoo_api"])
    });
  });

  it("captures SQL/materialized-view touches for SQL-only jobs", () => {
    expect(
      getTouchedSystemsForJob({
        name: "daily-refresh-player-unified-matview",
        method: "SQL"
      })
    ).toEqual(
      expect.arrayContaining(["supabase", "local_database_functions", "materialized_view"])
    );
  });
});
