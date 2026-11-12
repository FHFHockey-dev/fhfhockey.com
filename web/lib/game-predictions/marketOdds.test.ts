import { describe, expect, it } from "vitest";

import {
  marketWinProbabilityForGame,
  parseNhlScheduleOddsPrice,
  selectMarketWinProbability,
} from "./marketOdds";

const partners = [
  { partnerId: 8, name: "Sportradar Book" },
  { partnerId: 9, name: "DraftKings" },
];

// Hand-computed proportional de-vig of one book's pair.
function proportional(awayImplied: number, homeImplied: number) {
  const total = awayImplied + homeImplied;
  return { away: awayImplied / total, home: homeImplied / total };
}

describe("parseNhlScheduleOddsPrice (declared NHL schedule format)", () => {
  it("reads signed integers as American odds", () => {
    expect(parseNhlScheduleOddsPrice("+150")).toMatchObject({
      format: "american",
      impliedProbability: 100 / 250,
    });
    expect(parseNhlScheduleOddsPrice("-180")?.impliedProbability).toBeCloseTo(
      180 / 280,
      12,
    );
    expect(parseNhlScheduleOddsPrice(-180)?.format).toBe("american");
  });

  it("reads unsigned values with a decimal point above 1 as decimal odds", () => {
    expect(parseNhlScheduleOddsPrice("2.50")).toMatchObject({
      format: "decimal",
      impliedProbability: 0.4,
    });
  });

  it("treats an unsigned integer such as \"150\" as ambiguous", () => {
    expect(parseNhlScheduleOddsPrice("150")).toBeNull();
    expect(parseNhlScheduleOddsPrice(150)).toBeNull();
  });

  it("rejects malformed and out-of-range prices", () => {
    for (const value of ["+50", "-99", "1.00", "0.80", "+1.5", "abc", "", null, undefined]) {
      expect(parseNhlScheduleOddsPrice(value)).toBeNull();
    }
  });
});

describe("selectMarketWinProbability (same-book pairing)", () => {
  it("is unavailable when each side is priced by a different book", () => {
    const result = selectMarketWinProbability({
      awayOffers: [{ providerId: 9, value: "+120" }],
      homeOffers: [{ providerId: 8, value: "-140" }],
      oddsPartners: partners,
    });
    expect(result).toEqual({ status: "unavailable", reason: "no_same_book_pair" });
  });

  it("falls from an invalid preferred offer to a complete pair from another book", () => {
    const result = selectMarketWinProbability({
      awayOffers: [
        { providerId: 9, value: "150" },
        { providerId: 8, value: "+120" },
      ],
      homeOffers: [
        { providerId: 9, value: "-140" },
        { providerId: 8, value: "-140" },
      ],
      oddsPartners: partners,
    });
    const expected = proportional(100 / 220, 140 / 240);
    expect(result.status).toBe("available");
    if (result.status !== "available") return;
    expect(result.providerId).toBe(8);
    expect(result.partnerName).toBe("Sportradar Book");
    expect(result.awayProbability).toBeCloseTo(expected.away, 12);
    expect(result.homeProbability).toBeCloseTo(expected.home, 12);
  });

  it("skips a preferred book whose implied sum is outside the sanity band", () => {
    const result = selectMarketWinProbability({
      awayOffers: [
        { providerId: 9, value: "+500" },
        { providerId: 8, value: "+120" },
      ],
      homeOffers: [
        { providerId: 9, value: "+500" },
        { providerId: 8, value: "-140" },
      ],
      oddsPartners: partners,
    });
    expect(result.status === "available" && result.providerId).toBe(8);
  });

  it("is unavailable when one side has no offer", () => {
    expect(
      selectMarketWinProbability({
        awayOffers: [{ providerId: 9, value: "+120" }],
        homeOffers: [],
        oddsPartners: partners,
      }),
    ).toEqual({ status: "unavailable", reason: "no_same_book_pair" });
  });

  it("is unavailable when both prices are ambiguous unsigned integers", () => {
    expect(
      selectMarketWinProbability({
        awayOffers: [{ providerId: 9, value: "150" }],
        homeOffers: [{ providerId: 9, value: "170" }],
        oddsPartners: partners,
      }).status,
    ).toBe("unavailable");
  });

  it("de-vigs an American pair proportionally within one book", () => {
    const result = selectMarketWinProbability({
      awayOffers: [{ providerId: 9, value: "+120" }],
      homeOffers: [{ providerId: 9, value: "-135" }],
      oddsPartners: partners,
    });
    const expected = proportional(100 / 220, 135 / 235);
    expect(result).toMatchObject({
      status: "available",
      providerId: 9,
      partnerName: "DraftKings",
      method: "proportional",
      awayPercent: 44,
      homePercent: 56,
      favourite: "home",
    });
    if (result.status !== "available") return;
    expect(result.awayProbability).toBeCloseTo(expected.away, 12);
    expect(result.homeProbability).toBeCloseTo(expected.home, 12);
    expect(result.overround).toBeCloseTo(100 / 220 + 135 / 235 - 1, 12);
  });

  it("de-vigs a decimal pair proportionally within one book", () => {
    const result = selectMarketWinProbability({
      awayOffers: [{ providerId: 9, value: "2.20" }],
      homeOffers: [{ providerId: 9, value: "1.70" }],
      oddsPartners: partners,
    });
    const expected = proportional(1 / 2.2, 1 / 1.7);
    expect(result.status).toBe("available");
    if (result.status !== "available") return;
    expect(result.awayProbability).toBeCloseTo(expected.away, 12);
    expect(result.homeProbability).toBeCloseTo(expected.home, 12);
  });

  it("uses the lowest provider id when neither preferred book is complete, regardless of offer order", () => {
    const awayOffers = [
      { providerId: 12, value: "+130" },
      { providerId: 5, value: "+110" },
    ];
    const homeOffers = [
      { providerId: 5, value: "-130" },
      { providerId: 12, value: "-150" },
    ];
    const forward = selectMarketWinProbability({ awayOffers, homeOffers });
    const reversed = selectMarketWinProbability({
      awayOffers: [...awayOffers].reverse(),
      homeOffers: [...homeOffers].reverse(),
    });
    expect(forward).toEqual(reversed);
    expect(forward.status === "available" && forward.providerId).toBe(5);
    expect(forward.status === "available" && forward.partnerName).toBe(
      "Sportsbook 5",
    );
  });

  it("skips a book that lists two different prices for one side", () => {
    const result = selectMarketWinProbability({
      awayOffers: [
        { providerId: 9, value: "+120" },
        { providerId: 9, value: "+140" },
        { providerId: 8, value: "+125" },
      ],
      homeOffers: [
        { providerId: 9, value: "-140" },
        { providerId: 8, value: "-145" },
      ],
    });
    expect(result.status === "available" && result.providerId).toBe(8);
  });

  it("shows an exactly even market as 50/50 with no favourite", () => {
    const result = selectMarketWinProbability({
      awayOffers: [{ providerId: 9, value: "-110" }],
      homeOffers: [{ providerId: 9, value: "-110" }],
    });
    expect(result).toMatchObject({
      status: "available",
      awayPercent: 50,
      homePercent: 50,
      favourite: "even",
    });
  });
});

describe("marketWinProbabilityForGame", () => {
  const schedule = (gameState?: string) => ({
    gameWeek: [
      { games: [] },
      {
        games: [
          {
            id: 2026020001,
            gameState,
            awayTeam: { odds: [{ providerId: 9, value: "+120" }] },
            homeTeam: { odds: [{ providerId: 9, value: "-135" }] },
          },
        ],
      },
    ],
    oddsPartners: partners,
  });

  it("finds the game on any day of the schedule week", () => {
    expect(marketWinProbabilityForGame(schedule("FUT"), 2026020001).status).toBe(
      "available",
    );
  });

  it("treats odds for a game that has started as stale", () => {
    expect(marketWinProbabilityForGame(schedule("LIVE"), 2026020001)).toEqual({
      status: "unavailable",
      reason: "game_started",
    });
    expect(marketWinProbabilityForGame(schedule("OFF"), 2026020001).status).toBe(
      "unavailable",
    );
  });

  it("is unavailable when the game is not in the schedule", () => {
    expect(marketWinProbabilityForGame(schedule("FUT"), 1)).toEqual({
      status: "unavailable",
      reason: "game_not_found",
    });
  });
});
