// web/components/Layout/NavbarItems/NavbarItemsData.ts

export type NavbarItem = NavbarItemLink | NavbarItemCategory;

export type NavbarItemLink = {
  type: "link";
  label: string;
  href: string;
  accent?: "yellow";
  mobile: {
    tier: "primary" | "secondary";
    icon: string;
    label?: string;
    order: number;
  };
};

export type NavbarItemCategory = {
  type: "category";
  label: string; // navbar label text.
  items: NavbarItem[]; // Array of navbar items.
};

const ITEMS_DATA: NavbarItem[] = [
  {
    type: "link",
    label: "Home",
    href: "/",
    mobile: { tier: "primary", icon: "/pictures/homeNavIcon.png", order: 1 },
  },
  {
    type: "link",
    label: "Underlying Stats",
    href: "/underlying-stats",
    mobile: { tier: "secondary", icon: "/pictures/ULSlogo.png", order: 1 },
  },
  {
    type: "link",
    label: "Game Grid",
    href: "/game-grid",
    mobile: { tier: "primary", icon: "/pictures/gameGrid.png", order: 3 },
  },
  {
    type: "category",
    label: "Tools",
    items: [
      {
        type: "link",
        label: "Stats",
        href: "/stats",
        mobile: { tier: "primary", icon: "/pictures/statsIcon.png", order: 2 },
      },
      {
        type: "link",
        label: "Trends",
        href: "/trends",
        mobile: {
          tier: "secondary",
          icon: "/pictures/chart-line-bar.png",
          order: 2,
        },
      },
      {
        type: "link",
        label: "NHL Predictions",
        href: "/nhl-predictions",
        mobile: {
          tier: "secondary",
          icon: "/pictures/playersTable.png",
          order: 3,
        },
      },
      {
        type: "link",
        label: "Lines",
        href: "/lines",
        mobile: {
          tier: "primary",
          icon: "/pictures/lineCombosIcon.png",
          label: "Line Combinations",
          order: 4,
        },
      },
      {
        type: "link",
        label: "Line Combo Matrix",
        href: "/drm",
        mobile: {
          tier: "primary",
          icon: "/pictures/drmIcon.png",
          label: "Date Range Line Matrix",
          order: 7,
        },
      },
      {
        type: "link",
        label: "Splits",
        href: "/splits",
        mobile: {
          tier: "secondary",
          icon: "/pictures/statsTable.png",
          order: 4,
        },
      },
      {
        type: "link",
        label: "Draft Dashboard",
        href: "/draft-dashboard",
        mobile: {
          tier: "primary",
          icon: "/pictures/playersTable.png",
          order: 7,
        },
      },
    ],
  },
  {
    type: "category",
    label: "Charts",
    items: [
      {
        type: "link",
        label: "Start Chart",
        href: "/start-chart",
        mobile: {
          tier: "secondary",
          icon: "/pictures/chart-line-up.svg",
          order: 6,
        },
      },
      {
        type: "link",
        label: "WiGO",
        href: "/wigoCharts",
        mobile: {
          tier: "primary",
          icon: "/pictures/wigoIcon.png",
          label: "WiGO Charts",
          order: 5,
        },
      },
      {
        type: "link",
        label: "Shift Chart",
        href: "/shiftChart",
        mobile: {
          tier: "primary",
          icon: "/pictures/shiftChartsIcon.png",
          order: 6,
        },
      },
    ],
  },
  {
    type: "category",
    label: "Variance",
    items: [
      {
        type: "link",
        label: "Skaters",
        href: "/variance/skaters",
        mobile: {
          tier: "secondary",
          icon: "/pictures/bar-chart.png",
          label: "Variance Skaters",
          order: 7,
        },
      },
      {
        type: "link",
        label: "Goalies",
        href: "/variance/goalies",
        mobile: {
          tier: "secondary",
          icon: "/pictures/bar-chart.png",
          label: "Variance Goalies",
          order: 8,
        },
      },
    ],
  },
  {
    type: "link",
    label: "Blog",
    href: "/blog",
    mobile: { tier: "primary", icon: "/pictures/blogIcon.png", order: 9 },
  },
  {
    type: "link",
    label: "Podcast",
    href: "/podfeed",
    mobile: { tier: "primary", icon: "/pictures/podcastIcon.png", order: 8 },
  },
];

export type MobileNavigationItem = {
  id: string;
  label: string;
  href: string;
  icon: string;
  tier: "primary" | "secondary";
  order: number;
};

function flattenLinks(items: NavbarItem[]): NavbarItemLink[] {
  return items.flatMap((item) =>
    item.type === "link" ? [item] : flattenLinks(item.items),
  );
}

export const MOBILE_NAVIGATION_ITEMS: MobileNavigationItem[] = flattenLinks(
  ITEMS_DATA,
).map((item) => ({
  id: item.href === "/" ? "home" : item.href.replace(/^\//, "").replace(/\W+/g, "-"),
  label: item.mobile.label ?? item.label,
  href: item.href,
  icon: item.mobile.icon,
  tier: item.mobile.tier,
  order: item.mobile.order,
})).sort((left, right) =>
  left.tier === right.tier
    ? left.order - right.order
    : left.tier.localeCompare(right.tier),
);

export const MOBILE_PRIMARY_NAVIGATION_ITEMS = MOBILE_NAVIGATION_ITEMS.filter(
  (item) => item.tier === "primary",
);

export const MOBILE_SECONDARY_NAVIGATION_ITEMS = MOBILE_NAVIGATION_ITEMS.filter(
  (item) => item.tier === "secondary",
);

export default ITEMS_DATA;
