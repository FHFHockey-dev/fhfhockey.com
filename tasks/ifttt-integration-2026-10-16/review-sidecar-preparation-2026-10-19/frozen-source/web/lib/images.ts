// Utility helpers for image asset paths and logo mapping
// Centralizing here allows future sprite/CDN optimization.

export const getTeamLogoSvg = (abbrev: string) =>
  `https://assets.nhle.com/logos/nhl/svg/${abbrev}_light.svg`;

export const fallbackTeamLogo = "/teamLogos/FHFH.png";

export const playerHeadshotPlaceholder = "/pictures/player-placeholder.jpg";

const trustedPlayerHeadshotHosts = new Set([
  "assets.nhle.com",
  "cms.nhl.bamgrid.com",
  "nhl.bamcontent.com",
]);

export const getLocalTeamLogoPath = (
  abbreviation: string | null | undefined,
) => {
  const normalized = abbreviation?.trim().toUpperCase();
  return normalized && /^[A-Z0-9]{2,4}$/.test(normalized)
    ? `/teamLogos/${normalized}.png`
    : fallbackTeamLogo;
};

function normalizePlayerHeadshotSource(source: string | null | undefined) {
  const trimmed = source?.trim();
  if (!trimmed) return null;

  if (
    trimmed.startsWith("/") &&
    !trimmed.startsWith("//") &&
    !trimmed.includes("\\")
  ) {
    return trimmed;
  }

  try {
    const url = new URL(trimmed);
    if (
      url.protocol === "https:" &&
      trustedPlayerHeadshotHosts.has(url.hostname)
    ) {
      return url.toString();
    }
  } catch {
    // Invalid or relative non-root sources fall through to the official fallback.
  }

  return null;
}

export function buildPlayerHeadshotSources(
  imageUrl: string | null | undefined,
  playerId: number,
): string[] {
  const primarySource = normalizePlayerHeadshotSource(imageUrl);
  const sources = [
    primarySource === playerHeadshotPlaceholder ? null : primarySource,
  ];

  if (Number.isSafeInteger(playerId) && playerId > 0) {
    sources.push(
      `https://cms.nhl.bamgrid.com/images/headshots/current/168x168/${playerId}.jpg`,
    );
  }

  sources.push(playerHeadshotPlaceholder);

  return sources.filter(
    (source, index, candidates): source is string =>
      Boolean(source) && candidates.indexOf(source) === index,
  );
}

export const fallbackNHLLogo =
  "https://assets.nhle.com/logos/nhl/svg/NHL_light.svg";
