type Color = {
  primary: string;
  secondary: string;
  jersey: string;
};

const TEAM_COLORS: { [teamName: string]: Color } = {
  "Nashville Predators": {
    primary: "#041e42",
    secondary: "#FFb81c",
    jersey: "#FFFFFF"
  },
  "Anaheim Ducks": {
    primary: "#000000",
    secondary: "#c3a776",
    jersey: "#FC4C02"
  },
  "Arizona Coyotes": {
    primary: "#6f263d",
    secondary: "#ddcba4",
    jersey: "#ffffff"
  },
  "Boston Bruins": {
    primary: "#000000",
    secondary: "#FFB81C",
    jersey: "#FFFFFF"
  },
  "Buffalo Sabres": {
    primary: "#02235e",
    secondary: "#FFB81C",
    jersey: "#FFFFFF"
  },
  "Carolina Hurricanes": {
    primary: "#000000",
    secondary: "#c8102e",
    jersey: "#a2aaad"
  },
  "Calgary Flames": {
    primary: "#a20620",
    secondary: "#F1BE48",
    jersey: "#FFFFFF"
  },
  "Chicago Blackhawks": {
    primary: "#a20620",
    secondary: "#000000",
    jersey: "#ffffff"
  },
  "Colorado Avalanche": {
    primary: "#041e42",
    secondary: "#883d54",
    jersey: "#a2aaad"
  },
  "Columbus Blue Jackets": {
    primary: "#041E42",
    secondary: "#c8102e",
    jersey: "#ffffff"
  },
  "Dallas Stars": {
    primary: "#000000",
    secondary: "#44D62C",
    jersey: "#44d62c"
  },
  "Detroit Red Wings": {
    primary: "#a20620",
    secondary: "#FFFFFF",
    jersey: "#FFFFFF"
  },
  "Edmonton Oilers": {
    primary: "#041E42",
    secondary: "#FC4C02",
    jersey: "#FC4C02"
  },
  "Florida Panthers": {
    primary: "#041e42",
    secondary: "#b9975B",
    jersey: "#c8102e"
  },
  "Los Angeles Kings": {
    primary: "#000000",
    secondary: "#A2AAAD",
    jersey: "#FFFFFF"
  },

  "Minnesota Wild": {
    primary: "#154734",
    secondary: "#DDCBA4",
    jersey: "#A6192E"
  },
  "Montréal Canadiens": {
    primary: "#001E62",
    secondary: "#A6192E",
    jersey: "#FFFFFF"
  },
  "New Jersey Devils": {
    primary: "#000000",
    secondary: "#154734",
    jersey: "#a20620"
  },
  "New York Islanders": {
    primary: "#003087",
    secondary: "#FC4C02",
    jersey: "#FFFFFF"
  },
  "New York Rangers": {
    primary: "#0033A0",
    secondary: "#a20620",
    jersey: "#ffffff"
  },
  "Ottawa Senators": {
    primary: "#000000",
    secondary: "#a20620",
    jersey: "#B9975B"
  },
  "Philadelphia Flyers": {
    primary: "#000000",
    secondary: "#FA4616",
    jersey: "#FFFFFF"
  },
  "Pittsburgh Penguins": {
    primary: "#000000",
    secondary: "#FFB81C",
    jersey: "#FFFFFF"
  },
  "San Jose Sharks": {
    primary: "#006272",
    secondary: "#000000",
    jersey: "#FFFFFF"
  },
  "Seattle Kraken": {
    primary: "#051C2C",
    secondary: "#6BA4B8",
    jersey: "#9CDBD9"
  },
  "St. Louis Blues": {
    primary: "#003087",
    secondary: "#FFB81C",
    jersey: "#C8102E"
  },
  "Tampa Bay Lightning": {
    primary: "#00205B", // dark blue #00205B
    secondary: "#FFFFFF", // white #FFFFFF
    jersey: "#000000" // black #000000
  },
  "Toronto Maple Leafs": {
    primary: "#00205B",
    secondary: "#FFFFFF",
    jersey: "#00205B"
  },
  "Vancouver Canucks": {
    primary: "#00205B",
    secondary: "#00843D",
    jersey: "#ffffff"
  },
  "Vegas Golden Knights": {
    primary: "#333F48",
    secondary: "#B9975B",
    jersey: "#C8102E"
  },
  "Washington Capitals": {
    primary: "#041E42",
    secondary: "#C8102E",
    jersey: "#FFFFFF"
  },
  "Winnipeg Jets": {
    primary: "#041E42",
    secondary: "#A2AAAD",
    jersey: "#004C97"
  }
};

export const DEFAULT_COLOR: Color = {
  primary: "#041E42",
  secondary: "#FC4C02",
  jersey: "#B9975B"
};

export default TEAM_COLORS;
