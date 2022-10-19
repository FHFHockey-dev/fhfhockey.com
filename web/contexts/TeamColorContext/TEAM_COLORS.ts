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
    primary: "#041E42",
    secondary: "#C8102E",
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
  "Montreal Canadiens": {
    primary: "#001E62",
    secondary: "#A6192E",
    jersey: "#FFFFFF",
  },
  "Nashville Predators": {
    primary: "#FFB81C",
    secondary: "#041E42",
    jersey: "#FFFFFF",
  },
  "New Jersey Devils": {
    primary: "#000000",
    secondary: "#C8102E",
    jersey: "#154734",
  },
  "New York Islanders": {
    primary: "#003087",
    secondary: "#FC4C02",
    jersey: "#FFFFFF",
  },
  "New York Rangers": {
    primary: "#0033A0",
    secondary: "#FFFFFF",
    jersey: "#C8102E",
  },
  "Ottawa Senators": {
    primary: "#000000",
    secondary: "#C8102E",
    jersey: "#B9975B",
  },
  "Philadelphia Flyers": {
    primary: "#FA4616",
    secondary: "#000000",
    jersey: "#FFFFFF",
  },
  "Pittsburgh Penguins": {
    primary: "#000000",
    secondary: "#FFB81C",
    jersey: "#FFFFFF",
  },
  "San Jose Sharks": {
    primary: "#006272",
    secondary: "#000000",
    jersey: "#FFFFFF",
  },
  "Seattle Kraken": {
    primary: "#051C2C",
    secondary: "#6BA4B8",
    jersey: "#9CDBD9",
  },
  "St. Louis Blues": {
    primary: "#003087",
    secondary: "#FFB81C",
    jersey: "#C8102E",
  },
  "Tempa Bay Lightning": {
    primary: "#00205B",
    secondary: "#FFFFFF",
    jersey: "#000000",
  },
  "Toronto Maple Leafs": {
    primary: "#00205B",
    secondary: "#FFFFFF",
    jersey: "#00205B",
  },
  "Vancouver Canucks": {
    primary: "#00205B",
    secondary: "#FFFFFF",
    jersey: "#00843D",
  },
  "Vegas Golden Knights": {
    primary: "#333F48",
    secondary: "#B9975B",
    jersey: "#C8102E",
  },
  "Washington Capitals": {
    primary: "#041E42",
    secondary: "#C8102E",
    jersey: "#FFFFFF",
  },
  "Winnipeg Jets": {
    primary: "#041E42",
    secondary: "#A2AAAD",
    jersey: "#004C97",
  }, 
};

export const DEFAULT_COLOR: Color = {
  primary: "#041E42",
  secondary: "#FC4C02",
  jersey: "#B9975B",
};

export default TEAM_COLORS;
