import { describe, expect, it } from "vitest";
import type { ProjectionSourceConfig } from "lib/projectionsConfig/projectionSourcesConfig";
import { buildProjectionInclusionDiagnostics } from "./projectionInclusionDiagnostics";

const source: ProjectionSourceConfig = {
  id: "source-a",
  displayName: "Source A",
  tableName: "source_a",
  playerType: "skater",
  primaryPlayerIdKey: "player_id",
  originalPlayerNameKey: "Player_Name",
  statMappings: []
};

describe("projection inclusion diagnostics", () => {
  it("accounts for raw, invalid, duplicate, normalized, and missing IDs", () => {
    const diagnostics = buildProjectionInclusionDiagnostics(
      [source],
      {
        "source-a": {
          config: source,
          data: [
            { player_id: 1, Player_Name: "One" },
            { player_id: 1, Player_Name: "One duplicate" },
            { player_id: 2, Player_Name: "Two" },
            { player_id: null, Player_Name: "Needs review" }
          ]
        }
      },
      [1]
    );

    expect(diagnostics).toMatchObject({
      rawRows: 4,
      validIdRows: 3,
      invalidIdRows: 1,
      uniqueSourcePlayerIds: 2,
      duplicateIdRows: 1,
      processedPlayers: 1,
      sourceIdsMissingFromProcessed: 1,
      missingProcessedIdSamples: [2]
    });
    expect(diagnostics.invalidIdentitySamples).toEqual([
      { sourceId: "source-a", name: "Needs review", rawId: null }
    ]);
  });

  it("keeps per-source duplicate accounting independent", () => {
    const sourceB = { ...source, id: "source-b", tableName: "source_b" };
    const diagnostics = buildProjectionInclusionDiagnostics(
      [source, sourceB],
      {
        "source-a": { config: source, data: [{ player_id: 1 }] },
        "source-b": {
          config: sourceB,
          data: [{ player_id: 1 }, { player_id: 1 }]
        }
      },
      [1]
    );

    expect(diagnostics.uniqueSourcePlayerIds).toBe(1);
    expect(diagnostics.bySource["source-a"].duplicateIdRows).toBe(0);
    expect(diagnostics.bySource["source-b"].duplicateIdRows).toBe(1);
  });
});
