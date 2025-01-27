// lib/teamsInfo.ts

// import { useTeamsMap } from "hooks/useTeams";

// /**
//  * Retrieves the team abbreviation given a team ID.
//  * @param teamId - The unique identifier for the team.
//  * @returns The team abbreviation if found, otherwise undefined.
//  */
// export const getTeamAbbreviation = (teamId: number): string | undefined => {
//   const teamsMap = useTeamsMap();
//   return teamsMap[teamId]?.abbreviation;
// };

export const teamsInfo: {
  [key: string]: {
    name: string;
    shortName: string;
    primaryColor: string;
    secondaryColor: string;
    jersey: string;
    accent: string;
    alt: string;
    franchiseId: number;
    id: number;
  };
} = {
  NJD: {
    name: "New Jersey Devils",
    shortName: "Devils",
    primaryColor: "#000000", // Black
    secondaryColor: "#a20620", // Red
    jersey: "#FFFFFF", // White
    accent: "#154734", // Green
    alt: "#FFFFFF", // White
    franchiseId: 23,
    id: 1,
  },
  NYI: {
    name: "New York Islanders",
    shortName: "Islanders",
    primaryColor: "#003087",
    secondaryColor: "#FFFFFF",
    jersey: "#FC4C02",
    accent: "#000000",
    alt: "#FFFFFF",
    franchiseId: 22,
    id: 2,
  },
  NYR: {
    name: "New York Rangers",
    shortName: "Rangers",
    primaryColor: "#0038A8",
    secondaryColor: "#FFFFFF",
    jersey: "#CE1126",
    accent: "#A2AAAD",
    alt: "#FFFFFF",
    franchiseId: 10,
    id: 3,
  },
  PHI: {
    name: "Philadelphia Flyers",
    shortName: "Flyers",
    primaryColor: "#cf3308",
    secondaryColor: "#FFFFFF",
    jersey: "#000000",
    accent: "#FFFFFF",
    alt: "#FFFFFF",
    franchiseId: 16,
    id: 4,
  },
  PIT: {
    name: "Pittsburgh Penguins",
    shortName: "Penguins",
    primaryColor: "#000000",
    secondaryColor: "#FFB81C",
    jersey: "#FFFFFF",
    accent: "#FFB81C",
    alt: "#FFFFFF",
    franchiseId: 17,
    id: 5,
  },
  BOS: {
    name: "Boston Bruins",
    shortName: "Bruins",
    primaryColor: "#000000",
    secondaryColor: "#FFB81C",
    jersey: "#FFFFFF",
    accent: "#FFB81C",
    alt: "#FFFFFF",
    franchiseId: 6,
    id: 6,
  },
  BUF: {
    name: "Buffalo Sabres",
    shortName: "Sabres",
    primaryColor: "#02235e",
    secondaryColor: "#FFB81C",
    jersey: "#FFFFFF",
    accent: "#ADAFAA",
    alt: "#FFFFFF",
    franchiseId: 19,
    id: 7,
  },
  MTL: {
    name: "Montréal Canadiens",
    shortName: "Canadiens",
    primaryColor: "#001E62",
    secondaryColor: "#6CACE4",
    jersey: "#A6192E",
    accent: "#FFFFFF",
    alt: "#FFFFFF",
    franchiseId: 1,
    id: 8,
  },
  OTT: {
    name: "Ottawa Senators",
    shortName: "Senators",
    primaryColor: "#000000",
    secondaryColor: "#a20620",
    jersey: "#B9975B",
    accent: "#FFFFFF",
    alt: "#B9975B",
    franchiseId: 30,
    id: 9,
  },
  TOR: {
    name: "Toronto Maple Leafs",
    shortName: "Maple Leafs",
    primaryColor: "#00205B",
    secondaryColor: "#FFFFFF",
    jersey: "#A2AAAD",
    accent: "#ffffff",
    alt: "#FFFFFF",
    franchiseId: 5,
    id: 10,
  },
  CAR: {
    name: "Carolina Hurricanes",
    shortName: "Hurricanes",
    primaryColor: "#000000",
    secondaryColor: "#b10018",
    jersey: "#A4A9AD",
    accent: "#FFFFFF",
    alt: "#FFFFFF",
    franchiseId: 26,
    id: 12,
  },
  FLA: {
    name: "Florida Panthers",
    shortName: "Panthers",
    primaryColor: "#041E42",
    secondaryColor: "#b9975B",
    jersey: "#c8102e",
    accent: "#FFFFFF",
    alt: "#000000",
    franchiseId: 33,
    id: 13,
  },
  TBL: {
    name: "Tampa Bay Lightning",
    shortName: "Lightning",
    primaryColor: "#00205B",
    secondaryColor: "#FFFFFF",
    jersey: "#A2AAAD",
    accent: "#000000",
    alt: "#",
    franchiseId: 31,
    id: 14,
  },
  WSH: {
    name: "Washington Capitals",
    shortName: "Capitals",
    primaryColor: "#041E42",
    secondaryColor: "#C8102E",
    jersey: "#FFFFFF",
    accent: "#A2AAAD",
    alt: "#",
    franchiseId: 24,
    id: 15,
  },
  CHI: {
    name: "Chicago Blackhawks",
    shortName: "Blackhawks",
    primaryColor: "#a20620",
    secondaryColor: "#000000",
    jersey: "#FFFFFF",
    accent: "#CC8A00",
    alt: "#00833E",
    franchiseId: 11,
    id: 16,
  },
  DET: {
    name: "Detroit Red Wings",
    shortName: "Red Wings",
    primaryColor: "#a20620",
    secondaryColor: "#FFFFFF",
    jersey: "#8D9093",
    accent: "#DDCBA4",
    alt: "#",
    franchiseId: 12,
    id: 17,
  },
  NSH: {
    name: "Nashville Predators",
    shortName: "Predators",
    primaryColor: "#041e42",
    secondaryColor: "#FFb81c",
    jersey: "#FFFFFF",
    accent: "#A2AAAD",
    alt: "#",
    franchiseId: 34,
    id: 18,
  },
  STL: {
    name: "St. Louis Blues",
    shortName: "Blues",
    primaryColor: "#041E42",
    secondaryColor: "#FCB514",
    jersey: "#1749a8",
    accent: "#FFFFFF",
    alt: "#",
    franchiseId: 18,
    id: 19,
  },
  CGY: {
    name: "Calgary Flames",
    shortName: "Flames",
    primaryColor: "#8a0113",
    secondaryColor: "#FAAF19",
    jersey: "#FFFFFF",
    accent: "#000000",
    alt: "#ffffff",
    franchiseId: 21,
    id: 20,
  },
  COL: {
    name: "Colorado Avalanche",
    shortName: "Avalanche",
    primaryColor: "#041e42",
    secondaryColor: "#902647",
    jersey: "#236192",
    accent: "#FFFFFF",
    alt: "#",
    franchiseId: 27,
    id: 21,
  },
  EDM: {
    name: "Edmonton Oilers",
    shortName: "Oilers",
    primaryColor: "#041E42",
    secondaryColor: "#FC4C02",
    jersey: "#FFFFFF",
    accent: "#A2AAAD",
    alt: "#",
    franchiseId: 25,
    id: 22,
  },
  VAN: {
    name: "Vancouver Canucks",
    shortName: "Canucks",
    primaryColor: "#00205B",
    secondaryColor: "#00843D",
    jersey: "#ffffff",
    accent: "#041C2C",
    alt: "#",
    franchiseId: 20,
    id: 23,
  },
  ANA: {
    name: "Anaheim Ducks",
    shortName: "Ducks",
    primaryColor: "#010101", // Black
    secondaryColor: "#B9975B", // Gold
    jersey: "#FC4C02", // Orange
    accent: "#ffffff", // White
    alt: "#FFFFFF", // White
    franchiseId: 32,
    id: 24,
  },
  DAL: {
    name: "Dallas Stars",
    shortName: "Stars",
    primaryColor: "#000000",
    secondaryColor: "#44D62C",
    jersey: "#006847",
    accent: "#FFFFFF",
    alt: "#",
    franchiseId: 15,
    id: 25,
  },
  LAK: {
    name: "Los Angeles Kings",
    shortName: "Kings",
    primaryColor: "#000000",
    secondaryColor: "#A2AAAD",
    jersey: "#FFFFFF",
    accent: "#A2AAAD",
    alt: "#",
    franchiseId: 14,
    id: 26,
  },
  SJS: {
    name: "San Jose Sharks",
    shortName: "Sharks",
    primaryColor: "#006D75",
    secondaryColor: "#000000",
    jersey: "#FFFFFF",
    accent: "#EA7200",
    alt: "#",
    franchiseId: 29,
    id: 28,
  },
  CBJ: {
    name: "Columbus Blue Jackets",
    shortName: "Blue Jackets",
    primaryColor: "#002654",
    secondaryColor: "#7DA1C4",
    jersey: "#ffffff",
    accent: "#c8102e",
    alt: "#",
    franchiseId: 36,
    id: 29,
  },
  MIN: {
    name: "Minnesota Wild",
    shortName: "Wild",
    primaryColor: "#154734",
    secondaryColor: "#DDCBA4",
    jersey: "#A6192E",
    accent: "#FFFFFF",
    alt: "#",
    franchiseId: 37,
    id: 30,
  },
  WPG: {
    name: "Winnipeg Jets",
    shortName: "Jets",
    primaryColor: "#041E42",
    secondaryColor: "#A2AAAD",
    jersey: "#004C97",
    accent: "#55565A",
    alt: "#",
    franchiseId: 35,
    id: 52,
  },
  ARI: {
    name: "Arizona Coyotes",
    shortName: "Coyotes",
    primaryColor: "#8C2633",
    secondaryColor: "#DDCBA4",
    jersey: "#ffffff",
    accent: "#A9431E",
    alt: "#5F259F",
    franchiseId: 28,
    id: 53,
  },
  VGK: {
    name: "Vegas Golden Knights",
    shortName: "Knights",
    primaryColor: "#24292c",
    secondaryColor: "#B4975A",
    jersey: "#8d0519",
    accent: "#000000",
    alt: "#",
    franchiseId: 38,
    id: 54,
  },
  SEA: {
    name: "Seattle Kraken",
    shortName: "Kraken",
    primaryColor: "#001628",
    secondaryColor: "#68A2B9",
    jersey: "#99D9D9",
    accent: "#E9072B",
    alt: "#",
    franchiseId: 39,
    id: 55,
  },
  UTA: {
    name: "Utah Hockey Club",
    shortName: "Utah HC",
    primaryColor: "#010101",
    secondaryColor: "#69B3E7",
    jersey: "#FFFFFF",
    accent: "#69b3e7",
    alt: "#FFFFFF",
    franchiseId: 40,
    id: 59,
  },
};

// Create a mapping from team names to abbreviations
export const teamNameToAbbreviationMap: { [name: string]: string } = {
  "New Jersey Devils": "NJD",
  "New York Islanders": "NYI",
  "New York Rangers": "NYR",
  "Philadelphia Flyers": "PHI",
  "Pittsburgh Penguins": "PIT",
  "Boston Bruins": "BOS",
  "Buffalo Sabres": "BUF",
  "Montréal Canadiens": "MTL",
  "Montreal Canadiens": "MTL", // NST has no accent
  "Ottawa Senators": "OTT",
  "Toronto Maple Leafs": "TOR",
  "Carolina Hurricanes": "CAR",
  "Florida Panthers": "FLA",
  "Tampa Bay Lightning": "TBL",
  "Washington Capitals": "WSH",
  "Chicago Blackhawks": "CHI",
  "Detroit Red Wings": "DET",
  "Nashville Predators": "NSH",
  "St. Louis Blues": "STL",
  "St Louis Blues": "STL", // NST has no punctuation
  "Calgary Flames": "CGY",
  "Colorado Avalanche": "COL",
  "Edmonton Oilers": "EDM",
  "Vancouver Canucks": "VAN",
  "Anaheim Ducks": "ANA",
  "Dallas Stars": "DAL",
  "Los Angeles Kings": "LAK",
  "San Jose Sharks": "SJS",
  "Columbus Blue Jackets": "CBJ",
  "Minnesota Wild": "MIN",
  "Winnipeg Jets": "WPG",
  "Arizona Coyotes": "ARI",
  "Vegas Golden Knights": "VGK",
  "Seattle Kraken": "SEA",
  "Utah Hockey Club": "UTA",
  "Utah Utah HC": "UTA", // Natural Stat Trick uses "Utah Utah HC" for some reason
};

// Helper function to get team info by team_id
export const getTeamInfoById = (
  teamId: number
):
  | {
      name: string;
      shortName: string;
      primaryColor: string;
      secondaryColor: string;
      jersey: string;
      accent: string;
      alt: string;
      franchiseId: number;
      id: number;
    }
  | undefined => {
  return Object.values(teamsInfo).find((team) => team.id === teamId);
};
