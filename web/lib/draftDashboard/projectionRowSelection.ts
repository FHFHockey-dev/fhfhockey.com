import type { ProjectionSourceConfig } from "lib/projectionsConfig/projectionSourcesConfig";
import { teamsInfo } from "lib/teamsInfo";

function finiteNumber(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function normalizedTeamToken(value: unknown) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

const TEAM_ABBREVIATION_BY_ALIAS = new Map<string, string>();
for (const [abbreviation, team] of Object.entries(teamsInfo)) {
  for (const alias of [
    abbreviation,
    team.abbrev,
    team.name,
    team.shortName,
    team.location,
    team.nstAbbr
  ]) {
    const token = normalizedTeamToken(alias);
    if (token) TEAM_ABBREVIATION_BY_ALIAS.set(token, abbreviation);
  }
}

export function normalizeProjectionTeam(value: unknown) {
  const token = normalizedTeamToken(value);
  return TEAM_ABBREVIATION_BY_ALIAS.get(token) ?? token;
}

export function selectProjectionRowForPlayer<T extends Record<string, any>>({
  rows,
  source,
  playerId,
  currentTeam
}: {
  rows: T[];
  source: ProjectionSourceConfig;
  playerId: number;
  currentTeam?: string | null;
}): T | null {
  const matches = rows.filter(
    (row) => Number(row[source.primaryPlayerIdKey]) === playerId
  );
  if (matches.length <= 1) return matches[0] ?? null;

  const normalizedTeam = normalizeProjectionTeam(currentTeam) || null;
  const teamMatches =
    normalizedTeam && source.teamKey
      ? matches.filter(
          (row) =>
            normalizeProjectionTeam(row[source.teamKey!]) === normalizedTeam
        )
      : [];
  const candidates = teamMatches.length ? teamMatches : matches;
  const gamesPlayedColumn = source.statMappings.find(
    (mapping) => mapping.key === "GAMES_PLAYED"
  )?.dbColumnName;

  return [...candidates].sort((left, right) => {
    if (gamesPlayedColumn) {
      const leftGames = finiteNumber(left[gamesPlayedColumn]) ?? -1;
      const rightGames = finiteNumber(right[gamesPlayedColumn]) ?? -1;
      if (leftGames !== rightGames) return rightGames - leftGames;
    }
    const leftTeam = source.teamKey ? String(left[source.teamKey] ?? "") : "";
    const rightTeam = source.teamKey ? String(right[source.teamKey] ?? "") : "";
    const teamOrder = leftTeam.localeCompare(rightTeam);
    if (teamOrder) return teamOrder;
    return JSON.stringify(left).localeCompare(JSON.stringify(right));
  })[0];
}
