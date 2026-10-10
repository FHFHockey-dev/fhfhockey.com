import React, { createElement } from "react";
import type { Team } from "lib/NHL/types";
export const abbreviations = "ANA BOS BUF CAR CBJ CGY CHI COL DAL DET EDM FLA LAK MIN MTL NJD NSH NYI NYR OTT PHI PIT SEA SJS STL TBL TOR UTA VAN VGK WPG WSH".split(" ");
export const teams: Record<number, Team> = Object.fromEntries(Array.from({ length: 32 }, (_, index) => {
  const id = index + 1;
  return [id, { id, name: `Fixture Team ${String(id).padStart(2, "0")}`, abbreviation: abbreviations[index], logo: `/teamLogos/${abbreviations[index]}.png` }];
}));
export const useTeamsMap = () => teams;
export function Link({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  return createElement("a", { ...props, href }, children);
}
export function Image({ src, alt, width, height, priority: _priority, ...props }: React.ImgHTMLAttributes<HTMLImageElement> & { priority?: boolean }) {
  return createElement("img", { ...props, src, alt, width: width ?? 24, height: height ?? 24 });
}
