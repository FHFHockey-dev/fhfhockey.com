import { describe, expect, it } from "vitest";

import {
  buildEdgeGoalieDetailRow,
  buildEdgeGoalieDetailNowRow,
  buildEdgeSkaterDetailNowRow,
  buildEdgeSkaterSkatingDistanceGameRows,
  buildEdgeSkaterShotLocationRows,
  buildEdgeSkaterSupplementalDetailRow,
  buildEdgeTeamDetailNowRow
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

  it("builds skater /now rows as supporting current-state reads", () => {
    const row = buildEdgeSkaterDetailNowRow({
      snapshotDate: "2026-04-23",
      seasonId: 20252026,
      gameType: 2,
      payload: {
        player: {
          id: 8478402,
          firstName: { default: "Connor" },
          lastName: { default: "McDavid" },
          slug: "connor-mcdavid-8478402",
          position: "C",
          sweaterNumber: 97,
          team: {
            id: 22,
            abbrev: "EDM",
            slug: "edmonton-oilers-22",
            commonName: { default: "Oilers" },
            placeNameWithPreposition: { default: "Edmonton" }
          }
        }
      }
    });

    expect(row).toMatchObject({
      endpoint_family: "skater-detail-now",
      source_url: "https://api-web.nhle.com/v1/edge/skater-detail/8478402/now"
    });
    expect(row.metadata).toMatchObject({
      readMode: "now",
      playerPosition: "C"
    });
  });

  it("builds team /now rows as supporting current-state reads", () => {
    const row = buildEdgeTeamDetailNowRow({
      snapshotDate: "2026-04-23",
      seasonId: 20252026,
      gameType: 2,
      payload: {
        team: {
          id: 5,
          abbrev: "PIT",
          slug: "pittsburgh-penguins-5",
          commonName: { default: "Penguins" },
          placeNameWithPreposition: { default: "Pittsburgh" }
        }
      }
    });

    expect(row).toMatchObject({
      endpoint_family: "team-detail-now",
      source_url: "https://api-web.nhle.com/v1/edge/team-detail/5/now"
    });
    expect(row.metadata).toMatchObject({
      readMode: "now"
    });
  });

  it("builds goalie /now rows as supporting current-state reads", () => {
    const row = buildEdgeGoalieDetailNowRow({
      snapshotDate: "2026-04-23",
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
        }
      }
    });

    expect(row).toMatchObject({
      endpoint_family: "goalie-detail-now",
      source_url: "https://api-web.nhle.com/v1/edge/goalie-detail/8475883/now"
    });
    expect(row.metadata).toMatchObject({
      readMode: "now",
      playerPosition: "G"
    });
  });

  it("builds supplemental skater skating distance rows and normalizes last-10 games", () => {
    const rawRow = buildEdgeSkaterSupplementalDetailRow({
      snapshotDate: "2026-05-30",
      seasonId: 20252026,
      gameType: 2,
      playerId: 8478402,
      playerName: "Connor McDavid",
      teamId: 22,
      teamAbbreviation: "EDM",
      position: "C",
      endpointFamily: "skater-skating-distance-detail",
      payload: {
        skatingDistanceLast10: [
          {
            gameCenterLink: "/gamecenter/edm-vs-sjs/2025/04/16/2024021306",
            gameDate: "2025-04-16",
            playerOnHomeTeam: false,
            toiAll: 1051,
            distanceSkatedAll: { imperial: 3.1379, metric: 5.0499 },
            toiEven: 874,
            distanceSkatedEven: { imperial: 2.6574, metric: 4.2766 },
            toiPP: 177,
            distanceSkatedPP: { imperial: 0.4805, metric: 0.7734 },
            homeTeam: { abbrev: "SJS" },
            awayTeam: { abbrev: "EDM" }
          }
        ]
      }
    });

    expect(rawRow).toMatchObject({
      endpoint_family: "skater-skating-distance-detail",
      entity_type: "skater",
      entity_id: 8478402,
      source_url:
        "https://api-web.nhle.com/v1/edge/skater-skating-distance-detail/8478402/20252026/2"
    });

    const rows = buildEdgeSkaterSkatingDistanceGameRows([rawRow]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      snapshot_date: "2026-05-30",
      season_id: 20252026,
      game_type: 2,
      player_id: 8478402,
      player_name: "Connor McDavid",
      team_id: 22,
      team_abbreviation: "EDM",
      position: "C",
      game_id: 2024021306,
      game_date: "2025-04-16",
      player_on_home_team: false,
      home_team_abbreviation: "SJS",
      away_team_abbreviation: "EDM",
      toi_all_seconds: 1051,
      distance_skated_all_miles: 3.1379,
      distance_skated_all_km: 5.0499,
      toi_even_seconds: 874,
      distance_skated_even_miles: 2.6574,
      toi_pp_seconds: 177,
      distance_skated_pp_miles: 0.4805
    });
  });
});
