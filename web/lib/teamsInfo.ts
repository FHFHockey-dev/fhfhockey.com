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
    lightColor?: string;
    darkColor?: string;
    alt: string;
    franchiseId: number;
    nstAbbr: string;
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
    lightColor: "#f03554", // Lighter Red
    darkColor: "#670919", // Darker Red
    alt: "#670919", // White
    franchiseId: 23,
    nstAbbr: "N.J",
    id: 1
  },
  NYI: {
    name: "New York Islanders",
    shortName: "Islanders",
    primaryColor: "#003087", // Blue
    secondaryColor: "#000000", // White
    jersey: "#FC4C02", // Orange
    accent: "#FFFFFF", // Black
    lightColor: "#1f5fd5", // Lighter Blue
    darkColor: "#08265f", // Darker Blue
    alt: "#08265f",
    franchiseId: 22,
    nstAbbr: "NYI",
    id: 2
  },
  NYR: {
    name: "New York Rangers",
    shortName: "Rangers",
    primaryColor: "#0038A8", // Blue
    secondaryColor: "#FFFFFF", // White
    jersey: "#CE1126", // Red
    accent: "#A2AAAD", // Silver
    lightColor: "#255ed0", // Lighter Blue
    darkColor: "#001d5c", // Darker Blue
    alt: "#255ed0",
    franchiseId: 10,
    nstAbbr: "NYR",
    id: 3
  },
  PHI: {
    name: "Philadelphia Flyers",
    shortName: "Flyers",
    primaryColor: "#cf3308",
    secondaryColor: "#FFFFFF",
    jersey: "#000000",
    accent: "#FFFFFF",
    lightColor: "#ef794b", // Lighter Orange
    darkColor: "#b7340d", // Darker Orange
    alt: "#b7340d",
    franchiseId: 16,
    nstAbbr: "PHI",
    id: 4
  },
  PIT: {
    name: "Pittsburgh Penguins",
    shortName: "Penguins",
    primaryColor: "#000000", // Black
    secondaryColor: "#FFB81C", // Gold
    jersey: "#FFFFFF", // White
    accent: "#ffa200", // Gold
    lightColor: "#ffc852", // Lighter Yellow
    darkColor: "#ffa200", // Darker
    alt: "#FFFFFF",
    franchiseId: 17,
    nstAbbr: "PIT",
    id: 5
  },
  BOS: {
    name: "Boston Bruins",
    shortName: "Bruins",
    primaryColor: "#000000", // black
    secondaryColor: "#ffc64d", // yellow
    jersey: "#FFFFFF", // white
    accent: "#FFB81C", // gold
    lightColor: "#dfc16c", // Lighter Yellow
    darkColor: "#e19a01", // Darker Yellow
    alt: "#202020", // charcoal
    franchiseId: 6,
    nstAbbr: "BOS",
    id: 6
  },
  BUF: {
    name: "Buffalo Sabres",
    shortName: "Sabres",
    primaryColor: "#02235e", // blue
    secondaryColor: "#FFB81C", // gold
    jersey: "#FFFFFF", // white
    accent: "#ADAFAA", // silver
    lightColor: "#2762c7", // Lighter Blue
    darkColor: "#072f6f", // Darker Blue
    alt: "#2762c7",
    franchiseId: 19,
    nstAbbr: "BUF",
    id: 7
  },
  MTL: {
    name: "Montréal Canadiens",
    shortName: "Canadiens",
    primaryColor: "#001E62", // Blue
    secondaryColor: "#6CACE4", // light blue
    jersey: "#A6192E", // Red
    accent: "#FFFFFF", // White
    lightColor: "#1f5fd5", // Lighter Blue
    darkColor: "#08265f", // Darker Blue
    alt: "#1f5fd5", // White
    franchiseId: 1,
    nstAbbr: "MTL",
    id: 8
  },
  OTT: {
    name: "Ottawa Senators",
    shortName: "Senators",
    primaryColor: "#000000", // Black
    secondaryColor: "#a20620", // Red
    jersey: "#B9975B", // Gold
    accent: "#FFFFFF", // White
    lightColor: "#ec2b4b", // Red
    darkColor: "#931523", // Darker Red
    alt: "#B9975B",
    franchiseId: 30,
    nstAbbr: "OTT",
    id: 9
  },
  TOR: {
    name: "Toronto Maple Leafs",
    shortName: "Maple Leafs",
    primaryColor: "#00205B", // Blue
    secondaryColor: "#FFFFFF", // White
    jersey: "#A2AAAD", // Silver
    accent: "#ffffff", // White
    alt: "#080a91", // White
    lightColor: "#3478f6", // Lighter Blue
    darkColor: "#080a91", // Darker Blue
    franchiseId: 5,
    nstAbbr: "TOR",
    id: 10
  },
  CAR: {
    name: "Carolina Hurricanes",
    shortName: "Hurricanes",
    primaryColor: "#000000", // Black
    secondaryColor: "#b10018", // Red
    jersey: "#A4A9AD", // Silver
    accent: "#FFFFFF", // White
    alt: "#e92549", // White
    lightColor: "#e92549", // Lighter Red
    darkColor: "#8a0113", // Darker Red
    franchiseId: 26,
    nstAbbr: "CAR",
    id: 12
  },
  FLA: {
    name: "Florida Panthers",
    shortName: "Panthers",
    primaryColor: "#041E42", // Blue
    secondaryColor: "#b9975B", // Gold
    jersey: "#c8102e", // Red
    accent: "#FFFFFF", // White
    lightColor: "#ea304f", // Lighter red
    darkColor: "#6a0415", // Darker red
    alt: "#000000",
    franchiseId: 33,
    nstAbbr: "FLA",
    id: 13
  },
  TBL: {
    name: "Tampa Bay Lightning",
    shortName: "Lightning",
    primaryColor: "#00205B",
    secondaryColor: "#FFFFFF",
    jersey: "#A2AAAD",
    accent: "#000000",
    lightColor: "#3478f6", // Lighter Blue
    darkColor: "#1b1d7e", // Darker Blue
    alt: "#3478f6",
    franchiseId: 31,
    nstAbbr: "T.B",
    id: 14
  },
  WSH: {
    name: "Washington Capitals",
    shortName: "Capitals",
    primaryColor: "#041E42", // Blue
    secondaryColor: "#C8102E", // Red
    jersey: "#FFFFFF", // White
    accent: "#A2AAAD", // Silver
    lightColor: "#103a75", // Lighter Blue
    darkColor: "#011f4a", // Darker Blue
    alt: "#103a75",
    franchiseId: 24,
    nstAbbr: "WSH",
    id: 15
  },
  CHI: {
    name: "Chicago Blackhawks",
    shortName: "Blackhawks",
    primaryColor: "#a20620", // Red
    secondaryColor: "#000000", // Black
    jersey: "#FFFFFF", // White
    accent: "#CC8A00", // Yellow
    alt: "#00833E", // Green
    lightColor: "#d72d49", // Lighter Red
    darkColor: "#6c0415", // Darker Red
    franchiseId: 11,
    nstAbbr: "CHI",
    id: 16
  },
  DET: {
    name: "Detroit Red Wings",
    shortName: "Red Wings",
    primaryColor: "#a20620", // Red
    secondaryColor: "#FFFFFF", // White
    jersey: "#8D9093", // Silver
    accent: "#DDCBA4", // Tan
    alt: "#d72d49",
    lightColor: "#d72d49", // Lighter Red
    darkColor: "#6c0415", // Darker Red
    franchiseId: 12,
    nstAbbr: "DET",
    id: 17
  },
  NSH: {
    name: "Nashville Predators",
    shortName: "Predators",
    primaryColor: "#041e42", // Blue
    secondaryColor: "#FFb81c", // Gold
    jersey: "#FFFFFF", // White
    accent: "#A2AAAD", // Silver
    lightColor: "#efbe53", // Lighter gold
    darkColor: "#da9501", // Darker gold
    alt: "#da9501",
    franchiseId: 34,
    nstAbbr: "NSH",
    id: 18
  },
  STL: {
    name: "St. Louis Blues",
    shortName: "Blues",
    primaryColor: "#041E42", // Blue
    secondaryColor: "#FCB514", // Yellow
    jersey: "#1749a8", // Blue
    accent: "#FFFFFF", // White
    lightColor: "#3478f6", // Lighter Blue
    darkColor: "#1b1d7e", // Darker Blue
    alt: "#3478f6",
    franchiseId: 18,
    nstAbbr: "STL",
    id: 19
  },
  CGY: {
    name: "Calgary Flames",
    shortName: "Flames",
    primaryColor: "#8a0113", // Red
    secondaryColor: "#FAAF19", // Yellow
    jersey: "#FFFFFF", // White
    accent: "#000000", // Black
    alt: "#d72d49", // White
    lightColor: "#d72d49", // Lighter Red
    darkColor: "#6c0415", // Darker Red
    franchiseId: 21,
    nstAbbr: "CGY",
    id: 20
  },
  COL: {
    name: "Colorado Avalanche",
    shortName: "Avalanche",
    primaryColor: "#041e42", // Blue
    secondaryColor: "#902647", // Burgundy
    jersey: "#236192", // Blue
    accent: "#FFFFFF", // White
    lightColor: "#3478f6", // Lighter Blue
    darkColor: "#1b1d7e", // Darker Blue
    alt: "#3478f6",
    franchiseId: 27,
    nstAbbr: "COL",
    id: 21
  },
  EDM: {
    name: "Edmonton Oilers",
    shortName: "Oilers",
    primaryColor: "#041E42", // Blue
    secondaryColor: "#FC4C02", // Orange
    jersey: "#FFFFFF", // White
    accent: "#A2AAAD", // Silver
    alt: "#1953bf",
    lightColor: "#1953bf", // Lighter Blue
    darkColor: "#1b1d7e", // Darker Blue
    franchiseId: 25,
    nstAbbr: "EDM",
    id: 22
  },
  VAN: {
    name: "Vancouver Canucks",
    shortName: "Canucks",
    primaryColor: "#00205B", // Blue
    secondaryColor: "#00843D", // Green
    jersey: "#ffffff", // White
    accent: "#041C2C", // Navy
    alt: "#259358", // White
    lightColor: "#259358", // Lighter green
    darkColor: "#024421", // Darker green
    franchiseId: 20,
    nstAbbr: "VAN",
    id: 23
  },
  ANA: {
    name: "Anaheim Ducks",
    shortName: "Ducks",
    primaryColor: "#af4d35", // Orange
    secondaryColor: "#89734C", // Gold
    jersey: "#010101", // black
    accent: "#ffffff", // White
    alt: "#ec623c", // White
    lightColor: "#ec623c", // Lighter orange
    darkColor: "#992809", // Darker orange
    franchiseId: 32,
    nstAbbr: "ANA",
    id: 24
  },
  DAL: {
    name: "Dallas Stars",
    shortName: "Stars",
    primaryColor: "#000000", // Black
    secondaryColor: "#44D62C", // Green
    jersey: "#006847", // Green
    accent: "#FFFFFF", // White
    lightColor: "#65ed50", // Lighter green
    darkColor: "#116704", // Darker green
    alt: "#65ed50",
    franchiseId: 15,
    nstAbbr: "DAL",
    id: 25
  },
  LAK: {
    name: "Los Angeles Kings",
    shortName: "Kings",
    primaryColor: "#000000", // Black
    secondaryColor: "#A2AAAD", // Silver
    jersey: "#FFFFFF", // White
    accent: "#bac8cd", // Silver
    lightColor: "#bac8cd", // Lighter silver
    darkColor: "#656768", // Darker Black
    alt: "#656768",
    franchiseId: 14,
    nstAbbr: "L.A",
    id: 26
  },
  SJS: {
    name: "San Jose Sharks",
    shortName: "Sharks",
    primaryColor: "#006D75", // Teal
    secondaryColor: "#000000", // Black
    jersey: "#FFFFFF", // White
    accent: "#EA7200", // Orange
    lightColor: "#1a8d96", // Lighter teal
    darkColor: "#015156", // Darker teal
    alt: "#1a8d96",
    franchiseId: 29,
    nstAbbr: "S.J",
    id: 28
  },
  CBJ: {
    name: "Columbus Blue Jackets",
    shortName: "Blue Jackets",
    primaryColor: "#002654", // Blue
    secondaryColor: "#7DA1C4", // Light Blue
    jersey: "#ffffff", // White
    accent: "#c8102e", // Red
    lightColor: "#1756a3", // Lighter Blue
    darkColor: "#001835", // Darker Blue
    alt: "#1756a3",
    franchiseId: 36,
    nstAbbr: "CBJ",
    id: 29
  },
  MIN: {
    name: "Minnesota Wild",
    shortName: "Wild",
    primaryColor: "#154734", // Green
    secondaryColor: "#DDCBA4", // Tan
    jersey: "#A6192E", // Red
    accent: "#FFFFFF", // White
    alt: "#24694f",
    lightColor: "#24694f", // Lighter green
    darkColor: "#0b2e21", // Darker green
    franchiseId: 37,
    nstAbbr: "MIN",
    id: 30
  },
  WPG: {
    name: "Winnipeg Jets",
    shortName: "Jets",
    primaryColor: "#041E42", // Blue
    secondaryColor: "#A2AAAD", // Silver
    jersey: "#004C97", // Blue
    accent: "#55565A", // Grey
    lightColor: "#1953bf", // Lighter Blue
    darkColor: "#1b1d7e", // Darker Blue
    alt: "#1953bf",
    franchiseId: 35,
    nstAbbr: "WPG",
    id: 52
  },
  ARI: {
    name: "Arizona Coyotes",
    shortName: "Coyotes",
    primaryColor: "#8C2633", // Red
    secondaryColor: "#DDCBA4", // Tan
    jersey: "#ffffff", // White
    accent: "#A9431E", // Brick Red
    alt: "#5F259F", // Purple
    lightColor: "#d72d49", // Lighter Red
    darkColor: "#6c0415", // Darker Red
    franchiseId: 28,
    nstAbbr: "ARI",
    id: 53
  },
  VGK: {
    name: "Vegas Golden Knights",
    shortName: "Knights",
    primaryColor: "#24292c", // Grey
    secondaryColor: "#B4975A", // Gold
    jersey: "#8d0519", // Red
    accent: "#000000", // Black
    lightColor: "#696e72", // Lighter Grey
    darkColor: "#0f1112", // Darker Grey
    alt: "#696e72",
    franchiseId: 38,
    nstAbbr: "VGK",
    id: 54
  },
  SEA: {
    name: "Seattle Kraken",
    shortName: "Kraken",
    primaryColor: "#001628", // Blue
    secondaryColor: "#68A2B9", // Light Blue
    jersey: "#99D9D9", // Light Blue
    accent: "#E9072B", // Red
    lightColor: "#6bcdf4", // Lighter Blue
    darkColor: "#4592b0", // Darker Blue
    alt: "#6bcdf4",
    franchiseId: 39,
    nstAbbr: "SEA",
    id: 55
  },
  UTA: {
    name: "Utah Mammoth",
    shortName: "Mammoth",
    primaryColor: "#010101", // Black
    secondaryColor: "#69B3E7", // Light Blue
    jersey: "#FFFFFF", // White
    accent: "#47a4c9", // Light Blue
    lightColor: "#67bdfb", // Lighter Blue
    darkColor: "#47a4c9", // Darker Blue
    alt: "#67bdfb",
    franchiseId: 40,
    nstAbbr: "UTA",
    id: 68 // Updated to new NHL team ID so schedules match
  }
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
  "Utah Mammoth": "UTA",
  "Utah Utah HC": "UTA" // Natural Stat Trick uses "Utah Utah HC" for some reason
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

export const getTeamAbbreviationById = (teamId: number): string | undefined => {
  const entry = Object.entries(teamsInfo).find(
    ([, team]) => team.id === teamId
  );
  return entry ? entry[0] : undefined;
};
