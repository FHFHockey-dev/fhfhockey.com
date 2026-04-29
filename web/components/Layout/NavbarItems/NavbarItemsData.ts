// web/components/Layout/NavbarItems/NavbarItemsData.ts

export type NavbarItem = NavbarItemLink | NavbarItemCategory;

export type NavbarItemLink = {
  type: "link";
  label: string;
  href: string;
  accent?: "yellow";
};

export type NavbarItemCategory = {
  type: "category";
  label: string; // navbar label text.
  items: NavbarItem[]; // Array of navbar items.
};

const ITEMS_DATA: NavbarItem[] = [
  { type: "link", label: "HOME", href: "/" },
  {
    type: "link",
    label: "UNDERLYING STATS",
    href: "/underlying-stats",
    accent: "yellow"
  },
  { type: "link", label: "GAME GRID", href: "/game-grid" },
  {
    type: "category",
    label: "TOOLS",
    items: [
      { type: "link", label: "STATS", href: "/stats" },
      { type: "link", label: "TRENDS", href: "/trends" },
      { type: "link", label: "NHL PREDICTIONS", href: "/nhl-predictions" },
      { type: "link", label: "LINES", href: "/lines" },
      { type: "link", label: "LINE COMBO MATRIX", href: "/drm" },
      { type: "link", label: "SPLITS", href: "/splits" },
      {
        type: "link",
        label: "DRAFT DASHBOARD",
        href: "/draft-dashboard"
      }
    ]
  },
  {
    type: "category",
    label: "CHARTS",
    items: [
      { type: "link", label: "START CHART", href: "/start-chart" },
      { type: "link", label: "WiGO", href: "/wigoCharts" },
      { type: "link", label: "SHIFT CHART", href: "/shiftChart" }
    ]
  },
  {
    type: "category",
    label: "VARIANCE",
    items: [
      { type: "link", label: "SKATERS", href: "/variance/skaters" },
      { type: "link", label: "GOALIES", href: "/variance/goalies" }
    ]
  },
  { type: "link", label: "BLOG", href: "/blog" },
  {
    type: "link",
    label: "PODCAST",
    href: "/podfeed"
  }
];

export default ITEMS_DATA;
