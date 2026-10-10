import React, { createElement } from "react";
import type { Team } from "lib/NHL/types";
const logo = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="24" height="24"%3E%3Crect width="24" height="24" rx="6" fill="%232d9cdb"/%3E%3C/svg%3E';
export const teams: Record<number, Team> = Object.fromEntries(Array.from({ length: 32 }, (_, index) => {
  const id = index + 1;
  return [id, { id, name: `Fixture Team ${String(id).padStart(2, "0")}`, abbreviation: `F${id}`, logo }];
}));
export const useTeamsMap = () => teams;
export function Link({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  return createElement("a", { ...props, href }, children);
}
export function Image({ alt, width, height, className }: { alt: string; width?: number; height?: number; className?: string }) {
  return createElement("img", { src: logo, alt, width: width ?? 24, height: height ?? 24, className });
}
