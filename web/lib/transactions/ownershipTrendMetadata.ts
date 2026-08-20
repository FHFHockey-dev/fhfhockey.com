type MetadataRecord = Record<string, unknown>;

const POSITION_VALUE_KEYS = [
  "position",
  "code",
  "abbreviation",
  "abbr",
  "displayPosition",
  "display_position",
  "name",
] as const;

const TEAM_VALUE_KEYS = [
  "abbreviation",
  "abbrev",
  "code",
  "teamAbbrev",
  "team_abbrev",
  "editorial_team_abbreviation",
  "name",
] as const;

const TEAM_NAME_KEYS = [
  "fullName",
  "full_name",
  "teamFullName",
  "team_full_name",
  "editorial_team_full_name",
  "name",
] as const;

function isMetadataRecord(value: unknown): value is MetadataRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function collectMetadataText(
  value: unknown,
  objectKeys: readonly string[],
): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((entry) => collectMetadataText(entry, objectKeys));
  }

  if (typeof value === "string" || typeof value === "number") {
    const text = String(value).trim();
    return text && text.toLowerCase() !== "[object object]" ? [text] : [];
  }

  if (!isMetadataRecord(value)) return [];

  for (const key of objectKeys) {
    if (!(key in value)) continue;
    const resolved = collectMetadataText(value[key], objectKeys);
    if (resolved.length) return resolved;
  }

  return [];
}

function splitPositionText(value: string): string[] {
  return value
    .split(/[,/|]+/)
    .flatMap((part) => {
      const trimmed = part.trim();
      const whitespaceTokens = trimmed.split(/\s+/);
      return whitespaceTokens.length > 1 &&
        whitespaceTokens.every((token) => /^[A-Z]{1,3}$/i.test(token))
        ? whitespaceTokens
        : [trimmed];
    })
    .map((position) => position.trim().toUpperCase())
    .filter(
      (position) =>
        Boolean(position) && position.toLowerCase() !== "[object object]",
    );
}

export function normalizeTrendPositions(value: unknown): string[] {
  const seen = new Set<string>();

  return collectMetadataText(value, POSITION_VALUE_KEYS)
    .flatMap(splitPositionText)
    .filter((position) => {
      if (seen.has(position)) return false;
      seen.add(position);
      return true;
    });
}

export function normalizeTrendTeamAbbreviation(
  value: unknown,
): string | null {
  const team = collectMetadataText(value, TEAM_VALUE_KEYS)[0]?.trim();
  if (!team) return null;
  return /^\S{2,5}$/.test(team) ? team.toUpperCase() : team;
}

export function normalizeTrendTeamName(value: unknown): string | null {
  return collectMetadataText(value, TEAM_NAME_KEYS)[0]?.trim() || null;
}

export function formatTrendPlayerMetadata(input: {
  teamAbbrev?: unknown;
  teamFullName?: unknown;
  eligiblePositions?: unknown;
  displayPosition?: unknown;
}) {
  const team =
    normalizeTrendTeamAbbreviation(input.teamAbbrev) ??
    normalizeTrendTeamName(input.teamFullName) ??
    "—";
  const eligiblePositions = normalizeTrendPositions(input.eligiblePositions);
  const positions = eligiblePositions.length
    ? eligiblePositions
    : normalizeTrendPositions(input.displayPosition);
  const eligibility = positions.join(", ") || "—";

  return {
    team,
    eligibility,
    label: `${team} · ${eligibility}`,
  };
}
