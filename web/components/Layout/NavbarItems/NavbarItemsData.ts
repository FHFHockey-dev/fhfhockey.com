// web/components/Layout/NavbarItems/NavbarItemsData.ts

export type NavbarItem = NavbarItemLink | NavbarItemCategory;

export type NavbarItemLink = {
  type: "link";
  label: string;
  href: string;
};

export type NavbarItemCategory = {
  type: "category";
  label: string; // navbar label text.
  items: NavbarItem[]; // Array of navbar items.
};

const ITEMS_DATA: NavbarItem[] = [
  { type: "link", label: "HOME", href: "/" },
  { type: "link", label: "PODCAST", href: "/podfeed" },
  {
    type: "category",
    label: "TOOLS",
    items: [
      { type: "link", label: "GAME GRID", href: "/game-grid" },
      { type: "link", label: "LINES", href: "/lines" },
      { type: "link", label: "STATS", href: "/stats" },
      { type: "link", label: "PLAYER CARDS", href: "/charts" },
      { type: "link", label: "SHIFT CHART", href: "/shiftChart" },
      //{ type: "link", label: "TEAM STATS", href: "/teamStats" },

      // Hidden until finished
      // { type: "link", label: "SHOT MAP", href: "/shotMap" },
      // { type: "link", label: "GOALIES", href: "/goalies" },
      { type: "link", label: "LINE COMBO MATRIX", href: "/drm" },
      // { type: "link", label: "GOALIES", href: "/goalieShareChart" },
      // { type: "link", label: "WGO CHARTS", href: "/wigoCharts" },
      // { type: "link", label: "SUSTAINABILITY", href: "/sustainabilityTool" },
      // { type: "link", label: "BLSH", href: "/buyLowSellHigh" },
    ],
  },
  {
    type: "category",
    label: "MORE",
    items: [{ type: "link", label: "BLOG", href: "/blog" }],
  },
];

export default ITEMS_DATA;
