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
  { type: "link", label: "Dashboard", href: "/" },
  { type: "link", label: "Players", href: "/stats" },
  { type: "link", label: "Teams", href: "/stats" },
  {
    type: "category",
    label: "Tools",
    items: [
      { type: "link", label: "Game Grid", href: "/game-grid" },
      { type: "link", label: "Stats", href: "/stats" },
      { type: "link", label: "Trends", href: "/trends" },
      { type: "link", label: "NHL Predictions", href: "/nhl-predictions" },
      { type: "link", label: "Lines", href: "/lines" },
      { type: "link", label: "Line Combo Matrix", href: "/drm" },
      { type: "link", label: "Splits", href: "/splits" },
      {
        type: "link",
        label: "Draft Dashboard",
        href: "/draft-dashboard"
      }
    ]
  },
  {
    type: "link",
    label: "Analytics",
    href: "/underlying-stats"
  },
  { type: "link", label: "Projections", href: "/projections" },
  { type: "link", label: "News", href: "/news" },
  {
    type: "link",
    label: "Podcast",
    href: "/podfeed"
  }
];

export default ITEMS_DATA;
