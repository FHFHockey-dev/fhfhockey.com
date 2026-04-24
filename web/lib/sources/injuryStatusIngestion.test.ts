import { describe, expect, it } from "vitest";

import {
  buildTeamStatusDirectory,
  detectReturningStatusRows,
  mapPlayerStatusRowsToHomepageRows,
  normalizeBellMediaInjuryRows,
  normalizeGameDayTweetsNewsStatusRows,
  parseGameDayTweetsNewsPage,
  selectCurrentPlayerStatusRows,
  toGameDayTweetsNewsProvenanceRows,
  toInjurySourceProvenanceRows
} from "./injuryStatusIngestion";

describe("injuryStatusIngestion", () => {
  it("normalizes Bell Media injuries into canonical player/team rows", () => {
    const rows = normalizeBellMediaInjuryRows({
      rawTeams: [
        {
          competitor: { shortName: "Tampa Bay" },
          playerInjuries: [
            {
              date: "2026-04-21",
              status: "Out",
              description: "Upper body",
              player: { displayName: "Andrei Vasilevskiy" }
            }
          ]
        }
      ],
      snapshotDate: "2026-04-21",
      observedAt: "2026-04-21T12:00:00.000Z",
      directory: buildTeamStatusDirectory(),
      rosterByTeam: new Map([
        [
          14,
          [
            {
              playerId: 7,
              fullName: "Andrei Vasilevskiy",
              lastName: "Vasilevskiy",
              teamId: 14
            }
          ]
        ]
      ])
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      player_id: 7,
      team_id: 14,
      team_abbreviation: "TBL",
      status_state: "injured",
      raw_status: "Out",
      status_detail: "Upper body"
    });
  });

  it("creates returning rows for players no longer on the injury feed", () => {
    const rows = detectReturningStatusRows({
      snapshotDate: "2026-04-22",
      observedAt: "2026-04-22T12:00:00.000Z",
      latestStatuses: [
        {
          player_id: 7,
          player_name: "Andrei Vasilevskiy",
          team_id: 14,
          team_abbreviation: "TBL",
          status_state: "injured",
          raw_status: "Out"
        }
      ],
      currentInjuredRows: []
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      player_id: 7,
      status_state: "returning",
      raw_status: "Returning"
    });
    expect(rows[0].status_expires_at).toContain("2026-04-29");
  });

  it("parses GameDayTweets news into injury and return status candidates", () => {
    const items = parseGameDayTweetsNewsPage({
      html: `
        <body>
          <blockquote class="tweet">
            <a class="handle" href="https://twitter.com/HabsPR">@HabsPR</a>
            Samuel Montembeault will play tonight.
            <a href="https://twitter.com/GameDayNewsNHL/status/1">Apr 22, 2026</a>
          </blockquote>
          <blockquote class="tweet">
            <a class="handle" href="https://twitter.com/HabsPR">@HabsPR</a>
            Brendan Gallagher confirmed out with a lower-body injury.
            <a href="https://twitter.com/GameDayNewsNHL/status/2">Apr 22, 2026</a>
          </blockquote>
        </body>
      `,
      sourceUrl: "https://www.gamedaytweets.com/news",
      rosterEntries: [
        {
          playerId: 20,
          fullName: "Samuel Montembeault",
          lastName: "Montembeault",
          teamId: 8
        },
        {
          playerId: 21,
          fullName: "Brendan Gallagher",
          lastName: "Gallagher",
          teamId: 8
        }
      ],
      directory: buildTeamStatusDirectory()
    });

    const rows = normalizeGameDayTweetsNewsStatusRows({
      items,
      snapshotDate: "2026-04-22",
      observedAt: "2026-04-22T12:00:00.000Z"
    });

    expect(items).toHaveLength(2);
    expect(rows).toHaveLength(2);
    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          player_id: 20,
          status_state: "returning",
          source_name: "gamedaytweets-news"
        }),
        expect.objectContaining({
          player_id: 21,
          status_state: "injured",
          source_name: "gamedaytweets-news"
        })
      ])
    );
  });

  it("maps returning rows into homepage-friendly display copy", () => {
    expect(
      mapPlayerStatusRowsToHomepageRows([
        {
          snapshot_date: "2026-04-22",
          player_id: 7,
          player_name: "Andrei Vasilevskiy",
          team_abbreviation: "TBL",
          status_state: "returning",
          raw_status: "Out",
          status_detail: null
        }
      ])
    ).toEqual([
      {
        date: "2026-04-22",
        team: "TBL",
        player: {
          id: 7,
          displayName: "Andrei Vasilevskiy"
        },
        status: "Returning",
        description: "No longer listed on the injury report.",
        statusState: "returning"
      }
    ]);
  });

  it("writes injury provenance rows with a non-game sentinel id", () => {
    const rows = toInjurySourceProvenanceRows(
      [
        {
          capture_key: "2026-04-22:14:7:injured:bell-tsn",
          snapshot_date: "2026-04-22",
          observed_at: "2026-04-22T12:00:00.000Z",
          player_id: 7,
          player_name: "Andrei Vasilevskiy",
          team_id: 14,
          team_abbreviation: "TBL",
          status_state: "injured",
          raw_status: "Out",
          status_detail: "Upper body",
          source_name: "bell-tsn",
          source_url:
            "https://stats.sports.bellmedia.ca/sports/hockey/leagues/nhl/playerInjuries?brand=tsn&type=json",
          source_rank: 1,
          status_expires_at: null,
          metadata: {},
          updated_at: "2026-04-22T12:00:00.000Z"
        }
      ],
      new Map([[14, 2025020001]])
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      entity_id: 7,
      source_type: "injury",
      game_id: 2025020001
    });
  });

  it("writes GameDayTweets news provenance rows for matched players", () => {
    const rows = toGameDayTweetsNewsProvenanceRows(
      [
        {
          classification: "transaction",
          playerId: 20,
          playerName: "Samuel Montembeault",
          teamId: 8,
          teamAbbreviation: "MTL",
          sourceHandle: "https://twitter.com/HabsPR",
          sourceUrl: "https://www.gamedaytweets.com/news",
          tweetUrl: "https://twitter.com/GameDayNewsNHL/status/1",
          postedLabel: "Apr 22, 2026",
          text: "Samuel Montembeault was recalled from Laval."
        }
      ],
      "2026-04-22",
      "2026-04-22T12:00:00.000Z",
      new Map([[8, 2025020002]])
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      entity_id: 20,
      source_type: "news",
      source_name: "gamedaytweets-news",
      game_id: 2025020002
    });
  });

  it("prefers the freshest non-expired injury status at the best source rank", () => {
    const rows = selectCurrentPlayerStatusRows({
      now: "2026-04-21T18:00:00.000Z",
      rows: [
        {
          snapshot_date: "2026-04-21",
          observed_at: "2026-04-21T16:00:00.000Z",
          player_id: 7,
          player_name: "Andrei Vasilevskiy",
          team_id: 14,
          team_abbreviation: "TBL",
          status_state: "returning",
          raw_status: "Returning",
          status_detail: "No longer listed on the injury report.",
          source_name: "backup-source",
          source_url: null,
          source_rank: 2,
          status_expires_at: "2026-04-28T16:00:00.000Z",
          updated_at: "2026-04-21T16:00:00.000Z"
        },
        {
          snapshot_date: "2026-04-21",
          observed_at: "2026-04-21T15:00:00.000Z",
          player_id: 7,
          player_name: "Andrei Vasilevskiy",
          team_id: 14,
          team_abbreviation: "TBL",
          status_state: "injured",
          raw_status: "Out",
          status_detail: "Upper body",
          source_name: "bell-tsn",
          source_url: null,
          source_rank: 1,
          status_expires_at: null,
          updated_at: "2026-04-21T15:00:00.000Z"
        },
        {
          snapshot_date: "2026-04-20",
          observed_at: "2026-04-20T15:00:00.000Z",
          player_id: 9,
          player_name: "Expired Player",
          team_id: 14,
          team_abbreviation: "TBL",
          status_state: "returning",
          raw_status: "Returning",
          status_detail: "Expired row",
          source_name: "bell-tsn",
          source_url: null,
          source_rank: 1,
          status_expires_at: "2026-04-21T12:00:00.000Z",
          updated_at: "2026-04-20T15:00:00.000Z"
        }
      ]
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      player_id: 7,
      status_state: "injured",
      source_rank: 1
    });
  });
});
