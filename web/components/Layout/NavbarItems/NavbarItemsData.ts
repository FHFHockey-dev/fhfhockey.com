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
  { type: "link", label: "Home", href: "/" },
  {
    type: "link",
    label: "Underlying Stats",
    href: "/underlying-stats",
  },
  { type: "link", label: "Game Grid", href: "/game-grid" },
  {
    type: "category",
    label: "Tools",
    items: [
      { type: "link", label: "Stats", href: "/stats" },
      { type: "link", label: "Trends", href: "/trends" },
      { type: "link", label: "NHL Predictions", href: "/nhl-predictions" },
      { type: "link", label: "Lines", href: "/lines" },
      { type: "link", label: "Line Combo Matrix", href: "/drm" },
      { type: "link", label: "Splits", href: "/splits" },
      {
        type: "link",
        label: "Draft Dashboard",
        href: "/draft-dashboard",
      },
    ],
  },
  {
    type: "category",
    label: "Charts",
    items: [
      { type: "link", label: "Start Chart", href: "/start-chart" },
      { type: "link", label: "WiGO", href: "/wigoCharts" },
      { type: "link", label: "Shift Chart", href: "/shiftChart" },
    ],
  },
  {
    type: "category",
    label: "Variance",
    items: [
      { type: "link", label: "Skaters", href: "/variance/skaters" },
      { type: "link", label: "Goalies", href: "/variance/goalies" },
    ],
  },
  { type: "link", label: "Blog", href: "/blog" },
  { type: "link", label: "Podcast", href: "/podfeed" },
];

export default ITEMS_DATA;
