// C:\Users\timbr\Desktop\FHFH\fhfhockey.com\web\components\GameGrid\utils\calcWinOdds.test.js

import { describe, expect, test } from "vitest";

import {
  adjustBackToBackGames,
  formatWinOdds,
  isBackToBack,
} from "./calcWinOdds";

test("format winOdds", () => {
  expect(formatWinOdds(75)).toEqual("75.0%");
  expect(formatWinOdds(25)).toEqual("25.0%");
});

describe("Back to back", () => {
  test("Back to back, begin", () => {
    const winOddsList = [3, 0.3, null, 0.3, 6.4, null, 2.7];

    expect(isBackToBack(winOddsList, 0)).toBe(false);
    expect(isBackToBack(winOddsList, 1)).toBe(true);
    expect(isBackToBack(winOddsList, 2)).toBe(false);
    expect(isBackToBack(winOddsList, 4)).toBe(true);
    expect(isBackToBack(winOddsList, 5)).toBe(false);
    expect(isBackToBack(winOddsList, 6)).toBe(false);
  });

  test("Back to back, middle", () => {
    const winOddsList = [null, 0.3, null, 0.3, 6.4, null, 2.7];

    expect(isBackToBack(winOddsList, 0)).toBe(false);
    expect(isBackToBack(winOddsList, 1)).toBe(false);
    expect(isBackToBack(winOddsList, 2)).toBe(false);
    expect(isBackToBack(winOddsList, 4)).toBe(true);
    expect(isBackToBack(winOddsList, 5)).toBe(false);
    expect(isBackToBack(winOddsList, 6)).toBe(false);
  });

  test("Back to back, end", () => {
    const winOddsList = [null, 0.3, null, 0.3, null, 1, 2.7];

    expect(isBackToBack(winOddsList, 0)).toBe(false);
    expect(isBackToBack(winOddsList, 1)).toBe(false);
    expect(isBackToBack(winOddsList, 2)).toBe(false);
    expect(isBackToBack(winOddsList, 4)).toBe(false);
    expect(isBackToBack(winOddsList, 5)).toBe(false);
    expect(isBackToBack(winOddsList, 6)).toBe(true);
  });
});

describe("Adjust back to back Win Odds", () => {
  const dilutedFactor = 0.75;
  test("No back to back games", () => {
    const expected = [
      {
        teamName: "Tampa Bay Lightning",
        Mon: {
          home: true,
          away: false,
          logo: "/teamLogos/Colorado Avalanche.png",
          opponentName: "Colorado Avalanche",
          win: true,
          loss: false,
          winOdds: 0.4683193844172209,
          offNight: true,
        },
        Wed: {
          home: true,
          away: false,
          logo: "/teamLogos/Colorado Avalanche.png",
          opponentName: "Colorado Avalanche",
          win: false,
          loss: true,
          winOdds: 0.4683193844172209,
          offNight: true,
        },
        Fri: {
          home: false,
          away: true,
          logo: "/teamLogos/Colorado Avalanche.png",
          opponentName: "Colorado Avalanche",
          win: true,
          loss: false,
          winOdds: 0.4683193844172209,
          offNight: true,
        },
        Sun: {
          home: true,
          away: false,
          logo: "/teamLogos/Colorado Avalanche.png",
          opponentName: "Colorado Avalanche",
          win: false,
          loss: true,
          winOdds: 0.4683193844172209,
          offNight: true,
        },
        totalGamesPlayed: 4,
        totalOffNights: 4,
        Tue: {
          offNight: true,
        },
        Thu: {
          offNight: true,
        },
        Sat: {
          offNight: true,
        },
      },
      {
        teamName: "Colorado Avalanche",
        Mon: {
          home: false,
          away: true,
          logo: "/teamLogos/Tampa Bay Lightning.png",
          opponentName: "Tampa Bay Lightning",
          win: false,
          loss: true,
          winOdds: 0.5275474282423047,
          offNight: true,
        },
        Wed: {
          home: false,
          away: true,
          logo: "/teamLogos/Tampa Bay Lightning.png",
          opponentName: "Tampa Bay Lightning",
          win: true,
          loss: false,
          winOdds: 0.5275474282423047,
          offNight: true,
        },
        Fri: {
          home: true,
          away: false,
          logo: "/teamLogos/Tampa Bay Lightning.png",
          opponentName: "Tampa Bay Lightning",
          win: false,
          loss: true,
          winOdds: 0.5275474282423047,
          offNight: true,
        },
        Sun: {
          home: false,
          away: true,
          logo: "/teamLogos/Tampa Bay Lightning.png",
          opponentName: "Tampa Bay Lightning",
          win: true,
          loss: false,
          winOdds: 0.5275474282423047,
          offNight: true,
        },
        totalGamesPlayed: 4,
        totalOffNights: 4,
        Tue: {
          offNight: true,
        },
        Thu: {
          offNight: true,
        },
        Sat: {
          offNight: true,
        },
      },
      {
        teamName: "New Jersey Devils",
        totalGamesPlayed: 0,
        totalOffNights: 0,
        Mon: {
          offNight: true,
        },
        Tue: {
          offNight: true,
        },
        Wed: {
          offNight: true,
        },
        Thu: {
          offNight: true,
        },
        Fri: {
          offNight: true,
        },
        Sat: {
          offNight: true,
        },
        Sun: {
          offNight: true,
        },
      },
      {
        teamName: "New York Islanders",
        totalGamesPlayed: 0,
        totalOffNights: 0,
        Mon: {
          offNight: true,
        },
        Tue: {
          offNight: true,
        },
        Wed: {
          offNight: true,
        },
        Thu: {
          offNight: true,
        },
        Fri: {
          offNight: true,
        },
        Sat: {
          offNight: true,
        },
        Sun: {
          offNight: true,
        },
      },
      {
        teamName: "New York Rangers",
        totalGamesPlayed: 0,
        totalOffNights: 0,
        Mon: {
          offNight: true,
        },
        Tue: {
          offNight: true,
        },
        Wed: {
          offNight: true,
        },
        Thu: {
          offNight: true,
        },
        Fri: {
          offNight: true,
        },
        Sat: {
          offNight: true,
        },
        Sun: {
          offNight: true,
        },
      },
      {
        teamName: "Philadelphia Flyers",
        totalGamesPlayed: 0,
        totalOffNights: 0,
        Mon: {
          offNight: true,
        },
        Tue: {
          offNight: true,
        },
        Wed: {
          offNight: true,
        },
        Thu: {
          offNight: true,
        },
        Fri: {
          offNight: true,
        },
        Sat: {
          offNight: true,
        },
        Sun: {
          offNight: true,
        },
      },
      {
        teamName: "Pittsburgh Penguins",
        totalGamesPlayed: 0,
        totalOffNights: 0,
        Mon: {
          offNight: true,
        },
        Tue: {
          offNight: true,
        },
        Wed: {
          offNight: true,
        },
        Thu: {
          offNight: true,
        },
        Fri: {
          offNight: true,
        },
        Sat: {
          offNight: true,
        },
        Sun: {
          offNight: true,
        },
      },
      {
        teamName: "Boston Bruins",
        totalGamesPlayed: 0,
        totalOffNights: 0,
        Mon: {
          offNight: true,
        },
        Tue: {
          offNight: true,
        },
        Wed: {
          offNight: true,
        },
        Thu: {
          offNight: true,
        },
        Fri: {
          offNight: true,
        },
        Sat: {
          offNight: true,
        },
        Sun: {
          offNight: true,
        },
      },
      {
        teamName: "Buffalo Sabres",
        totalGamesPlayed: 0,
        totalOffNights: 0,
        Mon: {
          offNight: true,
        },
        Tue: {
          offNight: true,
        },
        Wed: {
          offNight: true,
        },
        Thu: {
          offNight: true,
        },
        Fri: {
          offNight: true,
        },
        Sat: {
          offNight: true,
        },
        Sun: {
          offNight: true,
        },
      },
      {
        teamName: "Montréal Canadiens",
        totalGamesPlayed: 0,
        totalOffNights: 0,
        Mon: {
          offNight: true,
        },
        Tue: {
          offNight: true,
        },
        Wed: {
          offNight: true,
        },
        Thu: {
          offNight: true,
        },
        Fri: {
          offNight: true,
        },
        Sat: {
          offNight: true,
        },
        Sun: {
          offNight: true,
        },
      },
      {
        teamName: "Ottawa Senators",
        totalGamesPlayed: 0,
        totalOffNights: 0,
        Mon: {
          offNight: true,
        },
        Tue: {
          offNight: true,
        },
        Wed: {
          offNight: true,
        },
        Thu: {
          offNight: true,
        },
        Fri: {
          offNight: true,
        },
        Sat: {
          offNight: true,
        },
        Sun: {
          offNight: true,
        },
      },
      {
        teamName: "Toronto Maple Leafs",
        totalGamesPlayed: 0,
        totalOffNights: 0,
        Mon: {
          offNight: true,
        },
        Tue: {
          offNight: true,
        },
        Wed: {
          offNight: true,
        },
        Thu: {
          offNight: true,
        },
        Fri: {
          offNight: true,
        },
        Sat: {
          offNight: true,
        },
        Sun: {
          offNight: true,
        },
      },
      {
        teamName: "Carolina Hurricanes",
        totalGamesPlayed: 0,
        totalOffNights: 0,
        Mon: {
          offNight: true,
        },
        Tue: {
          offNight: true,
        },
        Wed: {
          offNight: true,
        },
        Thu: {
          offNight: true,
        },
        Fri: {
          offNight: true,
        },
        Sat: {
          offNight: true,
        },
        Sun: {
          offNight: true,
        },
      },
      {
        teamName: "Florida Panthers",
        totalGamesPlayed: 0,
        totalOffNights: 0,
        Mon: {
          offNight: true,
        },
        Tue: {
          offNight: true,
        },
        Wed: {
          offNight: true,
        },
        Thu: {
          offNight: true,
        },
        Fri: {
          offNight: true,
        },
        Sat: {
          offNight: true,
        },
        Sun: {
          offNight: true,
        },
      },
      {
        teamName: "Washington Capitals",
        totalGamesPlayed: 0,
        totalOffNights: 0,
        Mon: {
          offNight: true,
        },
        Tue: {
          offNight: true,
        },
        Wed: {
          offNight: true,
        },
        Thu: {
          offNight: true,
        },
        Fri: {
          offNight: true,
        },
        Sat: {
          offNight: true,
        },
        Sun: {
          offNight: true,
        },
      },
      {
        teamName: "Chicago Blackhawks",
        totalGamesPlayed: 0,
        totalOffNights: 0,
        Mon: {
          offNight: true,
        },
        Tue: {
          offNight: true,
        },
        Wed: {
          offNight: true,
        },
        Thu: {
          offNight: true,
        },
        Fri: {
          offNight: true,
        },
        Sat: {
          offNight: true,
        },
        Sun: {
          offNight: true,
        },
      },
      {
        teamName: "Detroit Red Wings",
        totalGamesPlayed: 0,
        totalOffNights: 0,
        Mon: {
          offNight: true,
        },
        Tue: {
          offNight: true,
        },
        Wed: {
          offNight: true,
        },
        Thu: {
          offNight: true,
        },
        Fri: {
          offNight: true,
        },
        Sat: {
          offNight: true,
        },
        Sun: {
          offNight: true,
        },
      },
      {
        teamName: "Nashville Predators",
        totalGamesPlayed: 0,
        totalOffNights: 0,
        Mon: {
          offNight: true,
        },
        Tue: {
          offNight: true,
        },
        Wed: {
          offNight: true,
        },
        Thu: {
          offNight: true,
        },
        Fri: {
          offNight: true,
        },
        Sat: {
          offNight: true,
        },
        Sun: {
          offNight: true,
        },
      },
      {
        teamName: "St. Louis Blues",
        totalGamesPlayed: 0,
        totalOffNights: 0,
        Mon: {
          offNight: true,
        },
        Tue: {
          offNight: true,
        },
        Wed: {
          offNight: true,
        },
        Thu: {
          offNight: true,
        },
        Fri: {
          offNight: true,
        },
        Sat: {
          offNight: true,
        },
        Sun: {
          offNight: true,
        },
      },
      {
        teamName: "Calgary Flames",
        totalGamesPlayed: 0,
        totalOffNights: 0,
        Mon: {
          offNight: true,
        },
        Tue: {
          offNight: true,
        },
        Wed: {
          offNight: true,
        },
        Thu: {
          offNight: true,
        },
        Fri: {
          offNight: true,
        },
        Sat: {
          offNight: true,
        },
        Sun: {
          offNight: true,
        },
      },
      {
        teamName: "Edmonton Oilers",
        totalGamesPlayed: 0,
        totalOffNights: 0,
        Mon: {
          offNight: true,
        },
        Tue: {
          offNight: true,
        },
        Wed: {
          offNight: true,
        },
        Thu: {
          offNight: true,
        },
        Fri: {
          offNight: true,
        },
        Sat: {
          offNight: true,
        },
        Sun: {
          offNight: true,
        },
      },
      {
        teamName: "Vancouver Canucks",
        totalGamesPlayed: 0,
        totalOffNights: 0,
        Mon: {
          offNight: true,
        },
        Tue: {
          offNight: true,
        },
        Wed: {
          offNight: true,
        },
        Thu: {
          offNight: true,
        },
        Fri: {
          offNight: true,
        },
        Sat: {
          offNight: true,
        },
        Sun: {
          offNight: true,
        },
      },
      {
        teamName: "Anaheim Ducks",
        totalGamesPlayed: 0,
        totalOffNights: 0,
        Mon: {
          offNight: true,
        },
        Tue: {
          offNight: true,
        },
        Wed: {
          offNight: true,
        },
        Thu: {
          offNight: true,
        },
        Fri: {
          offNight: true,
        },
        Sat: {
          offNight: true,
        },
        Sun: {
          offNight: true,
        },
      },
      {
        teamName: "Dallas Stars",
        totalGamesPlayed: 0,
        totalOffNights: 0,
        Mon: {
          offNight: true,
        },
        Tue: {
          offNight: true,
        },
        Wed: {
          offNight: true,
        },
        Thu: {
          offNight: true,
        },
        Fri: {
          offNight: true,
        },
        Sat: {
          offNight: true,
        },
        Sun: {
          offNight: true,
        },
      },
      {
        teamName: "Los Angeles Kings",
        totalGamesPlayed: 0,
        totalOffNights: 0,
        Mon: {
          offNight: true,
        },
        Tue: {
          offNight: true,
        },
        Wed: {
          offNight: true,
        },
        Thu: {
          offNight: true,
        },
        Fri: {
          offNight: true,
        },
        Sat: {
          offNight: true,
        },
        Sun: {
          offNight: true,
        },
      },
      {
        teamName: "San Jose Sharks",
        totalGamesPlayed: 0,
        totalOffNights: 0,
        Mon: {
          offNight: true,
        },
        Tue: {
          offNight: true,
        },
        Wed: {
          offNight: true,
        },
        Thu: {
          offNight: true,
        },
        Fri: {
          offNight: true,
        },
        Sat: {
          offNight: true,
        },
        Sun: {
          offNight: true,
        },
      },
      {
        teamName: "Columbus Blue Jackets",
        totalGamesPlayed: 0,
        totalOffNights: 0,
        Mon: {
          offNight: true,
        },
        Tue: {
          offNight: true,
        },
        Wed: {
          offNight: true,
        },
        Thu: {
          offNight: true,
        },
        Fri: {
          offNight: true,
        },
        Sat: {
          offNight: true,
        },
        Sun: {
          offNight: true,
        },
      },
      {
        teamName: "Minnesota Wild",
        totalGamesPlayed: 0,
        totalOffNights: 0,
        Mon: {
          offNight: true,
        },
        Tue: {
          offNight: true,
        },
        Wed: {
          offNight: true,
        },
        Thu: {
          offNight: true,
        },
        Fri: {
          offNight: true,
        },
        Sat: {
          offNight: true,
        },
        Sun: {
          offNight: true,
        },
      },
      {
        teamName: "Winnipeg Jets",
        totalGamesPlayed: 0,
        totalOffNights: 0,
        Mon: {
          offNight: true,
        },
        Tue: {
          offNight: true,
        },
        Wed: {
          offNight: true,
        },
        Thu: {
          offNight: true,
        },
        Fri: {
          offNight: true,
        },
        Sat: {
          offNight: true,
        },
        Sun: {
          offNight: true,
        },
      },
      {
        teamName: "Arizona Coyotes",
        totalGamesPlayed: 0,
        totalOffNights: 0,
        Mon: {
          offNight: true,
        },
        Tue: {
          offNight: true,
        },
        Wed: {
          offNight: true,
        },
        Thu: {
          offNight: true,
        },
        Fri: {
          offNight: true,
        },
        Sat: {
          offNight: true,
        },
        Sun: {
          offNight: true,
        },
      },
      {
        teamName: "Vegas Golden Knights",
        totalGamesPlayed: 0,
        totalOffNights: 0,
        Mon: {
          offNight: true,
        },
        Tue: {
          offNight: true,
        },
        Wed: {
          offNight: true,
        },
        Thu: {
          offNight: true,
        },
        Fri: {
          offNight: true,
        },
        Sat: {
          offNight: true,
        },
        Sun: {
          offNight: true,
        },
      },
      {
        teamName: "Seattle Kraken",
        totalGamesPlayed: 0,
        totalOffNights: 0,
        Mon: {
          offNight: true,
        },
        Tue: {
          offNight: true,
        },
        Wed: {
          offNight: true,
        },
        Thu: {
          offNight: true,
        },
        Fri: {
          offNight: true,
        },
        Sat: {
          offNight: true,
        },
        Sun: {
          offNight: true,
        },
      },
    ];
    const copy = [...expected];
    adjustBackToBackGames(copy);
    expect(copy).toEqual(expected);
  });

  test("Have back to back games, but opponent does not play a 2d back to back game", () => {
    // startDate=2022-04-25&endDate=2022-05-01
    const original = [
      {
        teamName: "Seattle Kraken",
        Tue: {
          home: false,
          away: true,
          logo: "/teamLogos/Vancouver Canucks.png",
          opponentName: "Vancouver Canucks",
          win: false,
          loss: true,
          winOdds: 0.3420747153571749,
        },
        Wed: {
          home: true,
          away: false,
          logo: "/teamLogos/Los Angeles Kings.png",
          opponentName: "Los Angeles Kings",
          win: false,
          loss: true,
          winOdds: 0.20536098451382614, // temporarily hack, to be fixed
          offNight: true,
        },
        Fri: {
          home: true,
          away: false,
          logo: "/teamLogos/San Jose Sharks.png",
          opponentName: "San Jose Sharks",
          win: true,
          loss: false,
          winOdds: 0.465235081403653,
        },
        Sun: {
          home: false,
          away: true,
          logo: "/teamLogos/Winnipeg Jets.png",
          opponentName: "Winnipeg Jets",
          win: false,
          loss: true,
          winOdds: 0.3709074291312576,
          offNight: true,
        },
        totalGamesPlayed: 4,
        totalOffNights: 2,
        Mon: {
          offNight: true,
        },
        Sat: {
          offNight: true,
        },
      },
      {
        teamName: "Los Angeles Kings",
        Wed: {
          home: false,
          away: true,
          logo: "/teamLogos/Seattle Kraken.png",
          opponentName: "Seattle Kraken",
          win: true,
          loss: false,
          winOdds: 0.6329889986809478,
          offNight: true,
        },
        Thu: {
          home: false,
          away: true,
          logo: "/teamLogos/Vancouver Canucks.png",
          opponentName: "Vancouver Canucks",
          win: false,
          loss: true,
          winOdds: 0.2683926775876456, // temporarily hack, to be fixed
        },
        totalGamesPlayed: 2,
        totalOffNights: 1,
        Mon: {
          offNight: true,
        },
        Sat: {
          offNight: true,
        },
        Sun: {
          offNight: true,
        },
      },
    ];

    const expected = [
      {
        teamName: "Seattle Kraken",
        Tue: {
          home: false,
          away: true,
          logo: "/teamLogos/Vancouver Canucks.png",
          opponentName: "Vancouver Canucks",
          win: false,
          loss: true,
          winOdds: 0.3420747153571749,
        },
        Wed: {
          home: true,
          away: false,
          logo: "/teamLogos/Los Angeles Kings.png",
          opponentName: "Los Angeles Kings",
          win: false,
          loss: true,
          winOdds: 0.27381464601843486 * dilutedFactor,
          offNight: true,
        },
        Fri: {
          home: true,
          away: false,
          logo: "/teamLogos/San Jose Sharks.png",
          opponentName: "San Jose Sharks",
          win: true,
          loss: false,
          winOdds: 0.465235081403653,
        },
        Sun: {
          home: false,
          away: true,
          logo: "/teamLogos/Winnipeg Jets.png",
          opponentName: "Winnipeg Jets",
          win: false,
          loss: true,
          winOdds: 0.3709074291312576,
          offNight: true,
        },
        totalGamesPlayed: 4,
        totalOffNights: 2,
        Mon: {
          offNight: true,
        },
        Sat: {
          offNight: true,
        },
      },
      {
        teamName: "Los Angeles Kings",
        Wed: {
          home: false,
          away: true,
          logo: "/teamLogos/Seattle Kraken.png",
          opponentName: "Seattle Kraken",
          win: true,
          loss: false,
          winOdds: 0.6329889986809478,
          offNight: true,
        },
        Thu: {
          home: false,
          away: true,
          logo: "/teamLogos/Vancouver Canucks.png",
          opponentName: "Vancouver Canucks",
          win: false,
          loss: true,
          winOdds: 0.35785690345019416 * dilutedFactor,
        },
        totalGamesPlayed: 2,
        totalOffNights: 1,
        Mon: {
          offNight: true,
        },
        Sat: {
          offNight: true,
        },
        Sun: {
          offNight: true,
        },
      },
    ];
    adjustBackToBackGames(original, dilutedFactor);
    expect(original).toEqual(expected);
  });

  test("Have back to back games, both teams are playing the 2d back to back game", () => {
    const original = [
      {
        teamName: "Arizona Coyotes",
        Tue: {
          home: false,
          away: true,
          logo: "/teamLogos/Minnesota Wild.png",
          opponentName: "Minnesota Wild",
          win: true,
          loss: false,
          winOdds: 0.21957800857083876,
        },
        Wed: {
          home: false,
          away: true,
          logo: "/teamLogos/Dallas Stars.png",
          opponentName: "Dallas Stars",
          win: true,
          loss: false,
          winOdds: 0.33625388899287834,
          offNight: true,
        },
        Fri: {
          home: true,
          away: false,
          logo: "/teamLogos/Nashville Predators.png",
          opponentName: "Nashville Predators",
          win: true,
          loss: false,
          winOdds: 0.290253598668656,
        },
        totalGamesPlayed: 3,
        totalOffNights: 1,
        Mon: {
          offNight: true,
        },
        Sat: {
          offNight: true,
        },
        Sun: {
          offNight: true,
        },
      },
      {
        teamName: "Dallas Stars",
        Tue: {
          home: true,
          away: false,
          logo: "/teamLogos/Vegas Golden Knights.png",
          opponentName: "Vegas Golden Knights",
          win: true,
          loss: false,
          winOdds: 0.44467090564095196,
        },
        Wed: {
          home: true,
          away: false,
          logo: "/teamLogos/Arizona Coyotes.png",
          opponentName: "Arizona Coyotes",
          win: false,
          loss: true,
          winOdds: 0.6605566804220405,
          offNight: true,
        },
        Fri: {
          home: true,
          away: false,
          logo: "/teamLogos/Anaheim Ducks.png",
          opponentName: "Anaheim Ducks",
          win: true,
          loss: false,
          winOdds: 0.548777006107547,
        },
        totalGamesPlayed: 3,
        totalOffNights: 1,
        Mon: {
          offNight: true,
        },
        Sat: {
          offNight: true,
        },
        Sun: {
          offNight: true,
        },
      },
    ];

    const expected = [
      {
        teamName: "Arizona Coyotes",
        Tue: {
          home: false,
          away: true,
          logo: "/teamLogos/Minnesota Wild.png",
          opponentName: "Minnesota Wild",
          win: true,
          loss: false,
          winOdds: 0.21957800857083876,
        },
        Wed: {
          home: false,
          away: true,
          logo: "/teamLogos/Dallas Stars.png",
          opponentName: "Dallas Stars",
          win: true,
          loss: false,
          winOdds: 0.33625388899287834,
          offNight: true,
        },
        Fri: {
          home: true,
          away: false,
          logo: "/teamLogos/Nashville Predators.png",
          opponentName: "Nashville Predators",
          win: true,
          loss: false,
          winOdds: 0.290253598668656,
        },
        totalGamesPlayed: 3,
        totalOffNights: 1,
        Mon: {
          offNight: true,
        },
        Sat: {
          offNight: true,
        },
        Sun: {
          offNight: true,
        },
      },
      {
        teamName: "Dallas Stars",
        Tue: {
          home: true,
          away: false,
          logo: "/teamLogos/Vegas Golden Knights.png",
          opponentName: "Vegas Golden Knights",
          win: true,
          loss: false,
          winOdds: 0.44467090564095196,
        },
        Wed: {
          home: true,
          away: false,
          logo: "/teamLogos/Arizona Coyotes.png",
          opponentName: "Arizona Coyotes",
          win: false,
          loss: true,
          winOdds: 0.6605566804220405,
          offNight: true,
        },
        Fri: {
          home: true,
          away: false,
          logo: "/teamLogos/Anaheim Ducks.png",
          opponentName: "Anaheim Ducks",
          win: true,
          loss: false,
          winOdds: 0.548777006107547,
        },
        totalGamesPlayed: 3,
        totalOffNights: 1,
        Mon: {
          offNight: true,
        },
        Sat: {
          offNight: true,
        },
        Sun: {
          offNight: true,
        },
      },
    ];

    adjustBackToBackGames(original, dilutedFactor);
    expect(original).toEqual(expected);
  });
});
