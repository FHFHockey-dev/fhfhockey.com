"use strict";

const BASE_WRITER_TEAMS = Object.freeze({
  NJD: Object.freeze({ name: "New Jersey Devils", franchiseId: 23, id: 1 }),
  NYI: Object.freeze({ name: "New York Islanders", franchiseId: 22, id: 2 }),
  NYR: Object.freeze({ name: "New York Rangers", franchiseId: 10, id: 3 }),
  PHI: Object.freeze({ name: "Philadelphia Flyers", franchiseId: 16, id: 4 }),
  PIT: Object.freeze({ name: "Pittsburgh Penguins", franchiseId: 17, id: 5 }),
  BOS: Object.freeze({ name: "Boston Bruins", franchiseId: 6, id: 6 }),
  BUF: Object.freeze({ name: "Buffalo Sabres", franchiseId: 19, id: 7 }),
  MTL: Object.freeze({ name: "Montréal Canadiens", franchiseId: 1, id: 8 }),
  OTT: Object.freeze({ name: "Ottawa Senators", franchiseId: 30, id: 9 }),
  TOR: Object.freeze({ name: "Toronto Maple Leafs", franchiseId: 5, id: 10 }),
  CAR: Object.freeze({ name: "Carolina Hurricanes", franchiseId: 26, id: 12 }),
  FLA: Object.freeze({ name: "Florida Panthers", franchiseId: 33, id: 13 }),
  TBL: Object.freeze({ name: "Tampa Bay Lightning", franchiseId: 31, id: 14 }),
  WSH: Object.freeze({ name: "Washington Capitals", franchiseId: 24, id: 15 }),
  CHI: Object.freeze({ name: "Chicago Blackhawks", franchiseId: 11, id: 16 }),
  DET: Object.freeze({ name: "Detroit Red Wings", franchiseId: 12, id: 17 }),
  NSH: Object.freeze({ name: "Nashville Predators", franchiseId: 34, id: 18 }),
  STL: Object.freeze({ name: "St. Louis Blues", franchiseId: 18, id: 19 }),
  CGY: Object.freeze({ name: "Calgary Flames", franchiseId: 21, id: 20 }),
  COL: Object.freeze({ name: "Colorado Avalanche", franchiseId: 27, id: 21 }),
  EDM: Object.freeze({ name: "Edmonton Oilers", franchiseId: 25, id: 22 }),
  VAN: Object.freeze({ name: "Vancouver Canucks", franchiseId: 20, id: 23 }),
  ANA: Object.freeze({ name: "Anaheim Ducks", franchiseId: 32, id: 24 }),
  DAL: Object.freeze({ name: "Dallas Stars", franchiseId: 15, id: 25 }),
  LAK: Object.freeze({ name: "Los Angeles Kings", franchiseId: 14, id: 26 }),
  SJS: Object.freeze({ name: "San Jose Sharks", franchiseId: 29, id: 28 }),
  CBJ: Object.freeze({
    name: "Columbus Blue Jackets",
    franchiseId: 36,
    id: 29,
  }),
  MIN: Object.freeze({ name: "Minnesota Wild", franchiseId: 37, id: 30 }),
  WPG: Object.freeze({ name: "Winnipeg Jets", franchiseId: 35, id: 52 }),
  VGK: Object.freeze({ name: "Vegas Golden Knights", franchiseId: 38, id: 54 }),
  SEA: Object.freeze({ name: "Seattle Kraken", franchiseId: 39, id: 55 }),
});

function normalizeSeasonId(seasonId) {
  if (
    typeof seasonId !== "string" &&
    (typeof seasonId !== "number" || !Number.isSafeInteger(seasonId))
  ) {
    throw new TypeError("seasonId must be an eight-digit NHL season ID.");
  }

  const value = String(seasonId);
  if (!/^\d{8}$/.test(value)) {
    throw new TypeError("seasonId must be an eight-digit NHL season ID.");
  }

  const numericSeasonId = Number(value);
  if (
    !Number.isSafeInteger(numericSeasonId) ||
    String(numericSeasonId) !== value
  ) {
    throw new TypeError("seasonId must be a canonical NHL season ID.");
  }

  const startYear = Number(value.slice(0, 4));
  const endYear = Number(value.slice(4));
  if (endYear !== startYear + 1) {
    throw new TypeError("seasonId must contain consecutive years.");
  }

  return numericSeasonId;
}

function createSeasonAwareWriterTeams(seasonId) {
  const normalizedSeasonId = normalizeSeasonId(seasonId);
  const teams = Object.fromEntries(
    Object.entries(BASE_WRITER_TEAMS).map(([abbreviation, team]) => [
      abbreviation,
      Object.freeze({ ...team }),
    ]),
  );

  // Earlier relocation-era attribution remains explicitly owned by B-CLEAN NEW 107.
  if (normalizedSeasonId <= 20232024) {
    teams.ARI = Object.freeze({
      name: "Arizona Coyotes",
      franchiseId: 28,
      id: 53,
    });
  } else if (normalizedSeasonId === 20242025) {
    teams.UTA = Object.freeze({
      name: "Utah Hockey Club",
      franchiseId: 40,
      id: 59,
    });
  } else {
    teams.UTA = Object.freeze({
      name: "Utah Mammoth",
      franchiseId: 40,
      id: 68,
    });
  }

  return Object.freeze(teams);
}

module.exports = { createSeasonAwareWriterTeams };
