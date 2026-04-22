import { describe, expect, it } from "vitest";

import {
  buildEdgeGoalieDetailRow,
  buildEdgeSkaterShotLocationRows
} from "./edgeIngestion";

describe("edgeIngestion", () => {
  it("builds goalie detail rows with canonical metadata", () => {
    const row = buildEdgeGoalieDetailRow({
      snapshotDate: "2026-04-22",
      seasonId: 20252026,
      gameType: 2,
      payload: {
        player: {
          id: 8475883,
          firstName: { default: "Frederik" },
          lastName: { default: "Andersen" },
          slug: "frederik-andersen-8475883",
          position: "G",
          sweaterNumber: 31,
          team: {
            id: 12,
            abbrev: "CAR",
            slug: "carolina-hurricanes-12",
            commonName: { default: "Hurricanes" },
            placeNameWithPreposition: { default: "Carolina" }
          }
        },
        seasonsWithEdgeStats: [20252026],
        stats: {}
      }
    });

    expect(row).toMatchObject({
      snapshot_date: "2026-04-22",
      season_id: 20252026,
      game_type: 2,
      entity_type: "goalie",
      entity_id: 8475883,
      entity_slug: "frederik-andersen-8475883",
      entity_name: "Frederik Andersen",
      team_id: 12,
      team_abbreviation: "CAR",
      endpoint_family: "goalie-detail"
    });
    expect(row.metadata).toMatchObject({
      playerPosition: "G",
      sweaterNumber: 31,
      teamName: "Carolina Hurricanes"
    });
  });

  it("derives missing leaderboard ids from the NHL Edge slug", () => {
    const rows = buildEdgeSkaterShotLocationRows({
      snapshotDate: "2026-04-22",
      seasonId: 20252026,
      gameType: 2,
      variant: "goals",
      payload: [
        {
          player: {
            firstName: { default: "Connor" },
            lastName: { default: "McDavid" },
            slug: "connor-mcdavid-8478402",
            position: "C",
            sweaterNumber: 97,
            team: {
              abbrev: "EDM",
              slug: "edmonton-oilers-22",
              commonName: { default: "Oilers" },
              placeNameWithPreposition: { default: "Edmonton" }
            }
          },
          all: 48,
          highDanger: 26,
          midRange: 9,
          longRange: 1
        }
      ]
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      entity_id: 8478402,
      entity_slug: "connor-mcdavid-8478402",
      team_id: 22,
      team_abbreviation: "EDM",
      endpoint_family: "skater-shot-location-top-10",
      endpoint_variant: "goals",
      rank_order: 1
    });
  });
});

