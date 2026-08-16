import { describe, expect, it, vi } from "vitest";

import type { EspnLeagueSettingsV1 } from "./contracts";
import {
  espnScoringOverrideKey,
  loadEspnScoringOverride,
  saveEspnScoringOverride,
} from "./sessionOverride";

const settings: EspnLeagueSettingsV1 = {
  version: 1,
  mappingVersion: "espn-fhl-v1",
  externalLeagueKey: "fhl:2026:123456",
  espnLeagueId: "123456",
  leagueName: "Fixture League",
  seasonKey: "2026",
  leagueType: "points",
  scoringType: "H2H_POINTS",
  teamCount: 2,
  teams: [],
  skaterScoringCategories: { GOALS: 3 },
  goalieScoringCategories: { WINS_GOALIE: 4 },
  categoryWeights: {},
  rosterConfig: { C: 1, G: 1, bench: 2 },
  draftOrderType: "snake",
  draftOrder: ["1", "2"],
  draftType: "SNAKE",
  liveDraftSupported: true,
  sourceHash: "a".repeat(64),
  fetchedAt: "2026-08-14T12:00:00.000Z",
  diagnostics: { status: "supported", warnings: [], unsupported: [] },
};

describe("ESPN scoring-tool session overrides", () => {
  it("namespaces each consumer and round-trips exact imported maps", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: vi.fn((key: string) => values.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => values.set(key, value)),
    };
    const override = {
      version: 1 as const,
      namespace: "espn:league-row-1",
      externalLeagueId: "league-row-1",
      externalTeamId: "team-row-1",
      leagueName: "Fixture League",
      settings,
    };

    saveEspnScoringOverride(storage, "draft-dashboard", override);

    expect(storage.setItem).toHaveBeenCalledWith(
      "fhfh:espn:draft-dashboard:settings:v1",
      expect.any(String),
    );
    expect(loadEspnScoringOverride(storage, "draft-dashboard")).toEqual(override);
    expect(loadEspnScoringOverride(storage, "fantasy-projections")).toBeNull();
    expect(espnScoringOverrideKey("legacy-projections")).toBe(
      "fhfh:espn:legacy-projections:settings:v1",
    );
  });

  it("fails closed for stale, malformed, or non-ESPN namespaces", () => {
    for (const value of [
      "not-json",
      JSON.stringify({ version: 2 }),
      JSON.stringify({
        version: 1,
        namespace: "fantrax:league-1",
        externalLeagueId: "league-1",
        leagueName: "Wrong provider",
        settings,
      }),
      JSON.stringify({
        version: 1,
        namespace: "espn:league-1",
        externalLeagueId: "league-1",
        leagueName: "Stale mapping",
        settings: { ...settings, mappingVersion: "espn-fhl-v0" },
      }),
    ]) {
      expect(
        loadEspnScoringOverride({ getItem: () => value }, "draft-dashboard"),
      ).toBeNull();
    }
  });
});
