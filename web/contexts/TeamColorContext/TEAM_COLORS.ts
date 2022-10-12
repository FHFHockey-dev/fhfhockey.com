type Color = {
  primary: string;
  secondary: string;
  jersey: string;
};

const TEAM_COLORS: { [teamName: string]: Color } = {
  "Nashville Predators": {
    primary: "#041E42",
    secondary: "#FFB81C",
    jersey: "#FFFFFF",
  },
  "Anaheim Ducks": {
    primary: "#000000",
    secondary: "#89734C",
    jersey: "#FC4C02",
  },
  "Boston Bruins": {
    primary: "#000000",
    secondary: "#FFB81C",
    jersey: "#FFFFFF",
  },
  "Buffalo Sabres": {
    primary: "#003087",
    secondary: "#FFB81C",
    jersey: "#FFFFFF",
  },
  "Calgary Flames": {
    primary: "#C8102E",
    secondary: "#F1BE48",
    jersey: "#FFFFFF",
  },
  "Chicago Blackhawks": {
    primary: "#C8102E",
    secondary: "#FFFFFF",
    jersey: "#000000",
  },
  "Colorado Avalanche": {
    primary: "#6F263D",
    secondary: "#236192",
    jersey: "#A2AAAD",
  },
  "Columbus Blue Jackets": {
    primary: "#041E42",
    secondary: "#FFFFFF",
    jersey: "#FFFFFF",
  },
  "Dallas Stars": {
    primary: "#000000",
    secondary: "#44D62C",
    jersey: "#000000",
  },
  "Detroit Red Wings": {
    primary: "#C8102E",
    secondary: "#FFFFFF",
    jersey: "#FFFFFF",
  },
  "Edmonton Oilers": {
    primary: "#041E42",
    secondary: "#FC4C02",
    jersey: "#FC4C02",
  },
  "Florida Panthers": {
    primary: "#C8102E",
    secondary: "#041E42",
    jersey: "#B9975B",
  },
  "Los Angeles Kings": {
    primary: "#000000",
    secondary: "#A2AAAD",
    jersey: "#FFFFFF",
  },

  "Minnesota Wild": {
    primary: "#154734",
    secondary: "#DDCBA4",
    jersey: "#A6192E",
  },
  // "Montreal Canadiens": {},
};

export const DEFAULT_COLOR: Color = {
  primary: "#041E42",
  secondary: "#FC4C02",
  jersey: "#B9975B",
};

export default TEAM_COLORS;
