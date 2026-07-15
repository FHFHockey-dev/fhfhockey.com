import { describe, expect, it } from "vitest";

import { buildRosterImpactFeatures } from "./rosterImpact";

describe("buildRosterImpactFeatures", () => {
  it("weights projected skaters by historical TOI and ignores same-day ratings", () => {
    const result = buildRosterImpactFeatures({
      teamId: 1,
      sourceAsOfDate: "2026-01-10",
      projectedSkaterIds: [10, 11],
      currentRosterRows: [{ playerId: 12, teamId: 1 }],
      offenseRows: [
        { player_id: 10, team_id: 1, snapshot_date: "2026-01-09", rating_raw: 2, sample_toi_seconds: 100, components: { shrinkage: 0.5 } },
        { player_id: 11, team_id: 1, snapshot_date: "2026-01-09", rating_raw: 1, sample_toi_seconds: 300, components: { shrinkage: 0.5 } },
        { player_id: 10, team_id: 1, snapshot_date: "2026-01-10", rating_raw: 99, sample_toi_seconds: 100 },
      ],
      defenseRows: [
        { player_id: 10, team_id: 1, snapshot_date: "2026-01-09", rating_raw: -1, sample_toi_seconds: 100 },
        { player_id: 11, team_id: 1, snapshot_date: "2026-01-09", rating_raw: 1, sample_toi_seconds: 100 },
      ],
      goalieRows: [],
      specialTeamsContext: 0.4,
    });

    expect(result).toMatchObject({
      source: "projected_lineup",
      playerCount: 2,
      offenseCoverage: 1,
      defenseCoverage: 1,
      skaterOffenseImpact: 1.25,
      skaterOffensePer60OnlyImpact: 2.5,
      skaterDefenseImpact: 0,
      specialTeamsContext: 0.4,
      fallbackDerived: false,
    });
  });

  it("falls back truthfully to current roster and reports partial coverage", () => {
    const result = buildRosterImpactFeatures({
      teamId: 2,
      sourceAsOfDate: "2026-01-10",
      projectedSkaterIds: [],
      currentRosterRows: [
        { playerId: 20, teamId: 2 },
        { playerId: 21, teamId: 2 },
      ],
      offenseRows: [
        { player_id: 20, team_id: 2, snapshot_date: "2026-01-08", rating_raw: 0.5, sample_toi_seconds: 50 },
      ],
      defenseRows: [],
      goalieRows: [
        { player_id: 21, team_id: 2, snapshot_date: "2026-01-08", rating_raw: 0.8, sample_toi_seconds: 20 },
      ],
      specialTeamsContext: null,
    });

    expect(result).toMatchObject({
      source: "current_roster",
      playerCount: 2,
      offenseCoverage: 0.5,
      defenseCoverage: 0,
      goalieCoverage: 1,
      goalieImpact: 0.8,
      fallbackDerived: true,
    });
  });
});
