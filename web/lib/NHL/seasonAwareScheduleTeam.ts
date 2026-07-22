import writerTeamsModule from "./seasonAwareWriterTeams.cjs";
import { teamsInfo } from "lib/teamsInfo";

type WriterTeam = Readonly<{
  name: string;
  franchiseId: number;
  id: number;
}>;

type WriterTeamsModule = {
  createSeasonAwareWriterTeams: (
    seasonId: number,
  ) => Readonly<Record<string, WriterTeam>>;
};

const { createSeasonAwareWriterTeams } = writerTeamsModule as WriterTeamsModule;
const relocatedUtahIdentityBySeason = new Map<
  number,
  ScheduleTeamIdentity | null
>();

export type ScheduleTeamIdentity = Readonly<{
  id: number;
  abbreviation: string;
  name: string;
}>;

export type ScheduleTeamSelection = Readonly<{
  source: ScheduleTeamIdentity;
}>;

export type ProjectionTeamIdentity = Readonly<{
  source: ScheduleTeamIdentity;
  canonical: ScheduleTeamIdentity;
}>;

function parseScheduleTeamIdentity(
  value: unknown,
): ScheduleTeamIdentity | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;
  if (
    !Number.isSafeInteger(candidate.id) ||
    Number(candidate.id) <= 0 ||
    typeof candidate.abbreviation !== "string" ||
    candidate.abbreviation.length === 0 ||
    typeof candidate.name !== "string" ||
    candidate.name.length === 0
  ) {
    return null;
  }
  return {
    id: Number(candidate.id),
    abbreviation: candidate.abbreviation,
    name: candidate.name,
  };
}

function isExactTeamIdentity(
  actual: ScheduleTeamIdentity,
  expected: ScheduleTeamIdentity,
): boolean {
  return (
    actual.id === expected.id &&
    actual.abbreviation === expected.abbreviation &&
    actual.name === expected.name
  );
}

function isValidSeasonId(seasonId: number): boolean {
  const seasonText = String(seasonId);
  const startYear = Number(seasonText.slice(0, 4));
  const endYear = Number(seasonText.slice(4));
  return (
    Number.isSafeInteger(seasonId) &&
    /^\d{8}$/.test(seasonText) &&
    endYear === startYear + 1
  );
}

function getCurrentIdentity(abbreviation: string): ScheduleTeamIdentity | null {
  if (!Object.prototype.hasOwnProperty.call(teamsInfo, abbreviation)) {
    return null;
  }

  const team = teamsInfo[abbreviation];
  return {
    id: team.id,
    abbreviation: team.abbrev,
    name: team.name,
  };
}

function getRelocatedUtahIdentity(
  seasonId: number,
): ScheduleTeamIdentity | null {
  if (!isValidSeasonId(seasonId)) return null;

  // Broader pre-2023 relocation history remains owned by B-CLEAN NEW 107.
  if (seasonId < 20232024) return null;

  const cached = relocatedUtahIdentityBySeason.get(seasonId);
  if (cached !== undefined) return cached;

  const catalog = createSeasonAwareWriterTeams(seasonId);
  const abbreviation = seasonId === 20232024 ? "ARI" : "UTA";
  const team = catalog[abbreviation];
  if (!team) {
    relocatedUtahIdentityBySeason.set(seasonId, null);
    return null;
  }

  const identity = { id: team.id, abbreviation, name: team.name };
  relocatedUtahIdentityBySeason.set(seasonId, identity);
  return identity;
}

export function resolveScheduleTeamSelection(
  abbreviation: string,
  teamId: number,
  seasonId: number,
): ScheduleTeamSelection | null {
  if (!isValidSeasonId(seasonId)) return null;

  const current = getCurrentIdentity(abbreviation);
  if (current?.id !== teamId) return null;
  if (abbreviation !== "UTA") return { source: current };

  const source = getRelocatedUtahIdentity(seasonId);
  return source ? { source } : null;
}

export function resolveScheduleGameTeamIdentity(
  teamId: number,
  seasonId: number,
): ScheduleTeamIdentity | null {
  if (!isValidSeasonId(seasonId)) return null;

  const relocated = getRelocatedUtahIdentity(seasonId);
  if (relocated?.id === teamId) return relocated;
  if (teamId === 53 || teamId === 59 || teamId === 68) return null;

  const current = Object.values(teamsInfo).find((team) => team.id === teamId);
  return current
    ? {
        id: current.id,
        abbreviation: current.abbrev,
        name: current.name,
      }
    : null;
}

export function resolveCanonicalTeamIdentityForSource(
  sourceIdentity: unknown,
): ScheduleTeamIdentity | null {
  const source = parseScheduleTeamIdentity(sourceIdentity);
  if (!source) return null;

  const relocatedSeasonBySourceId: Readonly<Record<number, number>> = {
    53: 20232024,
    59: 20242025,
    68: 20252026,
  };
  const relocatedSeason = relocatedSeasonBySourceId[source.id];
  if (relocatedSeason !== undefined) {
    const expectedSource = resolveScheduleGameTeamIdentity(
      source.id,
      relocatedSeason,
    );
    if (!expectedSource || !isExactTeamIdentity(source, expectedSource)) {
      return null;
    }
    return getCurrentIdentity("UTA");
  }

  const current = getCurrentIdentity(source.abbreviation);
  return current && isExactTeamIdentity(source, current) ? current : null;
}

export function validateProjectionTeamIdentity(
  value: unknown,
): ProjectionTeamIdentity | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;
  const source = parseScheduleTeamIdentity(candidate.source);
  const canonical = parseScheduleTeamIdentity(candidate.canonical);
  if (!source || !canonical) return null;

  const expectedCanonical = resolveCanonicalTeamIdentityForSource(source);
  return expectedCanonical && isExactTeamIdentity(canonical, expectedCanonical)
    ? { source, canonical }
    : null;
}

export function validateProjectionTeamIdentityForSeason(
  value: unknown,
  seasonId: number,
): ProjectionTeamIdentity | null {
  const identity = validateProjectionTeamIdentity(value);
  if (!identity) return null;

  const expectedSource = resolveScheduleGameTeamIdentity(
    identity.source.id,
    seasonId,
  );
  return expectedSource && isExactTeamIdentity(identity.source, expectedSource)
    ? identity
    : null;
}

export function resolveProjectionTeamIdentity(
  teamId: unknown,
  joinedTeam: unknown,
  seasonId: number,
): ProjectionTeamIdentity | null {
  if (!Number.isSafeInteger(teamId) || Number(teamId) <= 0) return null;
  if (
    !joinedTeam ||
    typeof joinedTeam !== "object" ||
    Array.isArray(joinedTeam)
  ) {
    return null;
  }

  const joined = joinedTeam as Record<string, unknown>;
  const source = resolveScheduleGameTeamIdentity(Number(teamId), seasonId);
  if (
    !source ||
    joined.id !== source.id ||
    joined.abbreviation !== source.abbreviation ||
    joined.name !== source.name
  ) {
    return null;
  }

  const canonical = resolveCanonicalTeamIdentityForSource(source);
  return canonical
    ? validateProjectionTeamIdentity({ source, canonical })
    : null;
}
