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
      // Shot Map Hidden until finished
      //{ type: "link", label: "SHOT MAP", href: "/shotMap" },
      { type: "link", label: "SHIFT CHART", href: "/shiftChart" },
      { type: "link", label: "PLAYER TRENDS", href: "/goalieTrends" },


    ],
  },
  {
    type: "category",
    label: "MORE",
    items: [{ type: "link", label: "BLOG", href: "/blog" }],
  },
];

export default ITEMS_DATA;
