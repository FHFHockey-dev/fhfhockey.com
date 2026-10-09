import type { SVGProps } from "react";

const paths = {
  home: "m3 10 9-7 9 7v11h-6v-7H9v7H3Z",
  calendar: "M4 5h16v16H4ZM8 3v4m8-4v4M4 10h16M8 14h2m4 0h2m-8 3h2m4 0h2",
  stats: "M4 13h4v8H4Zm6-9h4v17h-4Zm6 5h4v12h-4Z",
  trend: "M3 19 9 13l4 3 8-11m-6 0h6v6",
  activity: "M2 12h5l3-8 4 16 3-8h5",
  lines: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",
  grid: "M3 3h7v7H3Zm11 0h7v7h-7ZM3 14h7v7H3Zm11 0h7v7h-7Z",
  draft: "M7 3h10v4H7ZM5 5H3v16h18V5h-2M7 12h10M7 16h7",
  network:
    "M10 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm10 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM10 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM9 8l5 3m0 2-5 3",
  clock: "M12 8v5l3 2M9 2h6m-3 0v3m8 9a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z",
  shield: "m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Zm-4 9 3 3 5-6",
  article: "M5 3h9l5 5v13H5Zm9 0v6h5M8 13h8m-8 4h8",
  mic: "M9 5a3 3 0 0 1 6 0v7a3 3 0 0 1-6 0ZM5 10v2a7 7 0 0 0 14 0v-2m-7 9v3m-4 0h8",
  tools:
    "M14 4a6 6 0 0 0-7 7L2 17a3 3 0 0 0 5 4l6-7a6 6 0 0 0 7-7l-4 4-3-3 4-4Z",
  community: "M21 11a8 8 0 0 1-8 8H7l-5 3 1-6a8 8 0 0 1-1-5 9 9 0 0 1 19 0Z",
  search: "M16 16l5 5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z",
  heart: "M20 5c-3-3-7-1-8 1-1-2-5-4-8-1-4 4 1 9 8 15 7-6 12-11 8-15Z",
  menu: "M3 5h18M3 12h18M3 19h18",
  close: "m5 5 14 14M19 5 5 19",
  chevron: "m6 9 6 6 6-6",
  account: "M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4 21v-3a8 8 0 0 1 16 0v3Z",
} as const;

export type NavigationIconName = keyof typeof paths;

export default function NavigationIcon({
  name,
  ...props
}: SVGProps<SVGSVGElement> & { name: NavigationIconName }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d={paths[name]} />
    </svg>
  );
}
