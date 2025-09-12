// Utility helpers for image asset paths and logo mapping
// Centralizing here allows future sprite/CDN optimization.

export const getTeamLogoSvg = (abbrev: string) =>
  `https://assets.nhle.com/logos/nhl/svg/${abbrev}_light.svg`;

export const fallbackNHLLogo =
  "https://assets.nhle.com/logos/nhl/svg/NHL_light.svg";
