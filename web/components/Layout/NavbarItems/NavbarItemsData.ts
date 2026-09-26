import type { NavigationIconName } from "../NavigationIcon";

export type NavbarItemLink = {
  type: "link";
  label: string;
  href: string;
  icon: NavigationIconName;
  description: string;
};

export type NavigationGroup = { label: string; items: NavbarItemLink[] };
export type NavbarItemCategory = {
  type: "category";
  id: "analytics" | "tools" | "community";
  label: string;
  icon: NavigationIconName;
  description: string;
  groups: NavigationGroup[];
};
export type NavbarItem = NavbarItemLink | NavbarItemCategory;

export const SUPPORT_URL = "https://www.buymeacoffee.com/tjsusername";

export const NAVIGATION_LINKS = {
  home: {
    type: "link",
    label: "Home",
    href: "/",
    icon: "home",
    description: "Five Hole Fantasy Hockey",
  },
  underlying: {
    type: "link",
    label: "Underlying Stats",
    href: "/underlying-stats",
    icon: "activity",
    description: "Examine performance beneath results",
  },
  gameGrid: {
    type: "link",
    label: "Game Grid",
    href: "/game-grid",
    icon: "calendar",
    description: "Explore the weekly schedule",
  },
  stats: {
    type: "link",
    label: "Stats",
    href: "/stats",
    icon: "stats",
    description: "Explore player statistics",
  },
  trends: {
    type: "link",
    label: "Trends",
    href: "/trends",
    icon: "trend",
    description: "Follow recent performance",
  },
  predictions: {
    type: "link",
    label: "NHL Predictions",
    href: "/nhl-predictions",
    icon: "trend",
    description: "Explore game predictions",
  },
  lines: {
    type: "link",
    label: "Line Combinations",
    href: "/lines",
    icon: "lines",
    description: "Review team lines",
  },
  matrix: {
    type: "link",
    label: "Line Combo Matrix",
    href: "/drm",
    icon: "grid",
    description: "Compare lines across dates",
  },
  splits: {
    type: "link",
    label: "Splits",
    href: "/splits",
    icon: "grid",
    description: "Compare performance by context",
  },
  draft: {
    type: "link",
    label: "Draft Dashboard",
    href: "/draft-dashboard",
    icon: "draft",
    description: "Open your draft workspace",
  },
  optimizer: {
    type: "link",
    label: "Roster Schedule Optimizer",
    href: "/roster-schedule-optimizer",
    icon: "calendar",
    description: "Plan roster schedules",
  },
  start: {
    type: "link",
    label: "Start Chart",
    href: "/start-chart",
    icon: "stats",
    description: "Review starter probabilities",
  },
  wigo: {
    type: "link",
    label: "WiGO Charts",
    href: "/wigoCharts",
    icon: "network",
    description: "Explore player combinations",
  },
  shift: {
    type: "link",
    label: "Shift Chart",
    href: "/shiftChart",
    icon: "clock",
    description: "Inspect shift usage",
  },
  skaters: {
    type: "link",
    label: "Variance Skaters",
    href: "/variance/skaters",
    icon: "trend",
    description: "Explore skater variance",
  },
  goalies: {
    type: "link",
    label: "Variance Goalies",
    href: "/variance/goalies",
    icon: "shield",
    description: "Explore goalie variance",
  },
  blog: {
    type: "link",
    label: "Blog",
    href: "/blog",
    icon: "article",
    description: "Read fantasy hockey articles",
  },
  podcast: {
    type: "link",
    label: "Podcast",
    href: "/podfeed",
    icon: "mic",
    description: "Listen to Five Hole Fantasy Hockey",
  },
} satisfies Record<string, NavbarItemLink>;

const links = NAVIGATION_LINKS;

export const MOBILE_NAVIGATION_GROUPS: NavbarItemCategory[] = [
  {
    type: "category",
    id: "analytics",
    label: "Analytics",
    icon: "stats",
    description: "Stats, trends & variance",
    groups: [
      {
        label: "Player analysis",
        items: [links.stats, links.underlying, links.trends, links.splits],
      },
      { label: "Variance", items: [links.skaters, links.goalies] },
    ],
  },
  {
    type: "category",
    id: "tools",
    label: "Tools",
    icon: "tools",
    description: "Game Grid, lines, draft & more",
    groups: [
      {
        label: "Schedule & lineup",
        items: [links.gameGrid, links.start, links.optimizer],
      },
      {
        label: "Lines & deployment",
        items: [links.lines, links.matrix, links.wigo, links.shift],
      },
      { label: "Draft & predictions", items: [links.draft, links.predictions] },
    ],
  },
  {
    type: "category",
    id: "community",
    label: "Community",
    icon: "community",
    description: "Blog, podcast & social",
    groups: [{ label: "Read & listen", items: [links.blog, links.podcast] }],
  },
];

// These destinations remain standalone on desktop, never duplicated in a dropdown.
const desktopStandalone = new Set<string>([
  links.gameGrid.href,
  links.underlying.href,
  links.blog.href,
]);
const desktopGroups = MOBILE_NAVIGATION_GROUPS.map((category) => ({
  ...category,
  groups: category.groups.map((group) => ({
    ...group,
    items: group.items.filter((item) => !desktopStandalone.has(item.href)),
  })),
}));

const ITEMS_DATA: NavbarItem[] = [
  links.home,
  links.gameGrid,
  links.underlying,
  desktopGroups[0],
  desktopGroups[1],
  links.blog,
  desktopGroups[2],
];

export function isNavigationLinkActive(pathname: string, href: string) {
  return pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));
}

export default ITEMS_DATA;
