export type SiteSurfaceLink = {
  href: string;
  label: string;
  description: string;
};

const GAME_GRID_HREF = "/game-grid/7-Day-Forecast";

export const HOME_SURFACE_LINKS: SiteSurfaceLink[] = [
  {
    href: "/start-chart",
    label: "Starter Board",
    description: "Move from the slate into matchup and starter context."
  },
  {
    href: GAME_GRID_HREF,
    label: "Game Grid",
    description: "Plan weekly volume and schedule convenience."
  },
  {
    href: "/trends",
    label: "Trends Dashboard",
    description: "Scan recent form, team pulse, and player movement."
  },
  {
    href: "/lines",
    label: "Lines",
    description: "Check current deployment and PP personnel."
  },
  {
    href: "/goalies",
    label: "Goalie View",
    description: "Review workload, starts, and weekly goalie context."
  }
];

export const TRENDS_SURFACE_LINKS: SiteSurfaceLink[] = [
  {
    href: "/start-chart",
    label: "Starter Board",
    description: "Carry recent-form context into start or sit decisions."
  },
  {
    href: GAME_GRID_HREF,
    label: "Game Grid",
    description: "Match trend movement against schedule density."
  },
  {
    href: "/lines",
    label: "Lines",
    description: "Confirm deployment changes behind the trend movement."
  },
  {
    href: "/goalies",
    label: "Goalie View",
    description: "Check the goalie side before locking in a call."
  }
];

export const START_CHART_SURFACE_LINKS: SiteSurfaceLink[] = [
  {
    href: "/trends",
    label: "Trends Dashboard",
    description: "Add recent-form context to the starter board."
  },
  {
    href: GAME_GRID_HREF,
    label: "Game Grid",
    description: "Compare matchup quality with the weekly schedule."
  },
  {
    href: "/lines",
    label: "Lines",
    description: "Validate deployment before acting on the matchup."
  },
  {
    href: "/goalies",
    label: "Goalie View",
    description: "Cross-check starter context against goalie workload."
  }
];

export const GOALIE_SURFACE_LINKS: SiteSurfaceLink[] = [
  {
    href: "/start-chart",
    label: "Starter Board",
    description: "Jump from weekly results into slate starter context."
  },
  {
    href: "/trends",
    label: "Trends Dashboard",
    description: "Layer team and player recent form onto goalie calls."
  },
  {
    href: GAME_GRID_HREF,
    label: "Game Grid",
    description: "Compare goalie choices against weekly game volume."
  }
];

export const GAME_GRID_SURFACE_LINKS: SiteSurfaceLink[] = [
  {
    href: "/start-chart",
    label: "Starter Board",
    description: "Carry schedule spots into matchup and starter context."
  },
  {
    href: "/trends",
    label: "Trends Dashboard",
    description: "Check recent movement before chasing schedule volume."
  },
  {
    href: "/lines",
    label: "Lines",
    description: "Confirm line and PP deployment next to the grid."
  },
  {
    href: "/goalies",
    label: "Goalie View",
    description: "Compare weekly volume plans with goalie reliability."
  }
];

export const getTeamSurfaceLinks = (
  teamAbbreviation: string
): SiteSurfaceLink[] => [
  {
    href: `/lines/${teamAbbreviation}`,
    label: "Team Lines",
    description: "Open the matching deployment and PP personnel page."
  },
  {
    href: "/start-chart",
    label: "Starter Board",
    description: "Carry team context into matchup and slate planning."
  },
  {
    href: GAME_GRID_HREF,
    label: "Game Grid",
    description: "Compare this team against the weekly schedule landscape."
  },
  {
    href: "/trends",
    label: "Trends Dashboard",
    description: "Match team context with league-wide recent movement."
  }
];

export const getLinesSurfaceLinks = (
  teamAbbreviation: string
): SiteSurfaceLink[] => [
  {
    href: `/stats/team/${teamAbbreviation}`,
    label: "Team HQ",
    description: "Return to the full team dashboard, schedule, and shot map."
  },
  {
    href: "/start-chart",
    label: "Starter Board",
    description: "Apply deployment context to matchup decisions."
  },
  {
    href: GAME_GRID_HREF,
    label: "Game Grid",
    description: "Connect line changes to weekly volume planning."
  },
  {
    href: "/trends",
    label: "Trends Dashboard",
    description: "See whether deployment changes already show up in form."
  }
];
