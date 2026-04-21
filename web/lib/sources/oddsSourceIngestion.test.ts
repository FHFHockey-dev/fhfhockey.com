import { describe, expect, it } from "vitest";

import {
  buildOddsTeamDirectory,
  getOddsSourceContract,
  normalizeNhlScheduleOdds,
  normalizeTheOddsApiFeaturedOdds,
  normalizeTheOddsApiPropOdds
} from "./oddsSourceIngestion";

const teams = buildOddsTeamDirectory([
  {
    id: 14,
    name: "Tampa Bay Lightning",
    abbreviation: "TBL",
    logo: "/teamLogos/TBL.png"
  },
  {
    id: 8,
    name: "Montréal Canadiens",
    abbreviation: "MTL",
    logo: "/teamLogos/MTL.png"
  }
]);

const scheduledGames = [
  {
    id: 2026020001,
    date: "2026-04-21",
    homeTeamId: 14,
    awayTeamId: 8
  }
];

describe("oddsSourceIngestion", () => {
  it("defines the launch odds source contract around ParlayAPI with NHL fallback", () => {
    expect(getOddsSourceContract()).toMatchObject({
      primaryProvider: "parlayapi",
      fallbackProvider: "nhl-schedule",
      featuredMarkets: ["h2h", "spreads", "totals"]
    });
  });

  it("normalizes ParlayAPI featured game markets into market price rows", () => {
    const normalized = normalizeTheOddsApiFeaturedOdds({
      snapshotDate: "2026-04-21",
      provider: "parlayapi",
      featuredGames: [
        {
          id: "event-1",
          home_team: "Tampa Bay Lightning",
          away_team: "Montréal Canadiens",
          bookmakers: [
            {
              key: "draftkings",
              last_update: "2026-04-21T14:00:00.000Z",
              markets: [
                {
                  key: "h2h",
                  outcomes: [
                    { name: "Tampa Bay Lightning", price: -155 },
                    { name: "Montréal Canadiens", price: 130 }
                  ]
                },
                {
                  key: "spreads",
                  outcomes: [
                    { name: "Tampa Bay Lightning", price: 105, point: -1.5 },
                    { name: "Montréal Canadiens", price: -125, point: 1.5 }
                  ]
                },
                {
                  key: "totals",
                  outcomes: [
                    { name: "Over", price: -110, point: 6.5 },
                    { name: "Under", price: -110, point: 6.5 }
                  ]
                }
              ]
            }
          ]
        }
      ],
      scheduledGames,
      teams
    });

    expect(normalized.matchedEvents.get(2026020001)).toBe("event-1");
    expect(normalized.rows).toHaveLength(6);
    expect(normalized.rows[0]).toMatchObject({
      game_id: 2026020001,
      market_type: "h2h",
      sportsbook_key: "draftkings",
      outcome_key: "team:TBL",
      price_american: -155,
      source_rank: 1
    });
    expect(normalized.provenanceRows[0]?.source_name).toBe("parlayapi");
    expect(normalized.provenanceRows).toHaveLength(1);
  });

  it("normalizes ParlayAPI player props into prop market rows", () => {
    const normalized = normalizeTheOddsApiPropOdds({
      snapshotDate: "2026-04-21",
      provider: "parlayapi",
      localGame: scheduledGames[0],
      eventOdds: {
        id: "event-1",
        bookmakers: [
          {
            key: "fanduel",
            last_update: "2026-04-21T14:05:00.000Z",
            markets: [
              {
                key: "player_shots_on_goal",
                outcomes: [
                  {
                    name: "Over",
                    description: "Brayden Point",
                    price: -140,
                    point: 2.5
                  },
                  {
                    name: "Under",
                    description: "Brayden Point",
                    price: 112,
                    point: 2.5
                  }
                ]
              }
            ]
          }
        ]
      },
      teams,
      rosterByTeam: new Map([
        [
          14,
          [
            {
              playerId: 8478010,
              fullName: "Brayden Point",
              lastName: "Point",
              teamId: 14
            }
          ]
        ],
        [8, []]
      ])
    });

    expect(normalized.rows).toHaveLength(2);
    expect(normalized.rows[0]).toMatchObject({
      player_id: 8478010,
      market_type: "player_shots_on_goal",
      sportsbook_key: "fanduel",
      outcome_key: "over",
      line_value: 2.5
    });
    expect(normalized.provenanceRows[0]?.source_name).toBe("parlayapi");
    expect(normalized.provenanceRows).toHaveLength(1);
  });

  it("normalizes NHL schedule odds as fallback moneyline rows", () => {
    const normalized = normalizeNhlScheduleOdds({
      snapshotDate: "2026-04-21",
      scheduledGames,
      scheduleDaily: {
        oddsPartners: [{ partnerId: 1, name: "BetMGM" }],
        gameWeek: [
          {
            date: "2026-04-21",
            games: [
              {
                id: 2026020001,
                homeTeam: {
                  id: 14,
                  abbrev: "TBL",
                  odds: [{ providerId: 1, value: "-150" }]
                },
                awayTeam: {
                  id: 8,
                  abbrev: "MTL",
                  odds: [{ providerId: 1, value: "+130" }]
                }
              }
            ]
          }
        ]
      }
    });

    expect(normalized.rows).toHaveLength(2);
    expect(normalized.rows[0]).toMatchObject({
      game_id: 2026020001,
      market_type: "h2h",
      sportsbook_key: "betmgm",
      source_rank: 2
    });
    expect(normalized.provenanceRows).toHaveLength(1);
  });
});
