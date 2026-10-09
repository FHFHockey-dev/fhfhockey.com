import type { FantraxPlayerInfo } from "./client";

type Team = { id: number; abbreviation: string };
type Alias = { fhfh_player_id: number; normalized_alias: string };
type Identity = {
  id: number;
  canonical_name: string;
  canonical_position: string | null;
  current_nhl_team_id: number | null;
  nhl_player_id: number | null;
};

const POSITIONS: Record<string, string> = {
  C: "C", LW: "L", RW: "R", D: "D", G: "G",
};

export function fantraxPlayerName(player: FantraxPlayerInfo): string | null {
  const parts = player.name.split(",");
  if (parts.length !== 2 || !parts[0].trim() || !parts[1].trim()) return null;
  return `${parts[1].trim()} ${parts[0].trim()}`.replace(/\s+/g, " ");
}

function key(name: string, teamId: number, position: string) {
  return `${normalizeName(name)}\0${teamId}\0${position}`;
}

export function normalizeName(name: string) {
  return name.normalize("NFKD").replace(/\p{M}/gu, "")
    .replace(/[’‘]/g, "'").toLocaleLowerCase("en-US").trim().replace(/\s+/g, " ");
}

/** Prefer exact name, team, and position; use unique verified aliases when provider metadata differs. */
export function matchFantraxPlayerIds(
  playerIds: string[],
  catalog: Record<string, FantraxPlayerInfo>,
  teams: Team[],
  identities: Identity[],
  aliases: Alias[],
) {
  const teamByAbbreviation = new Map<string, number[]>();
  for (const team of teams) {
    teamByAbbreviation.set(team.abbreviation, [...(teamByAbbreviation.get(team.abbreviation) ?? []), team.id]);
  }
  const identityById = new Map(identities.filter((identity) => identity.nhl_player_id != null)
    .map((identity) => [identity.id, identity]));
  const identitiesByName = new Map<string, Identity[]>();
  const catalogNameUse = new Map<string, number>();
  const catalogStrictUse = new Map<string, number>();
  for (const [id, player] of Object.entries(catalog)) {
    if (player.fantraxId !== id) continue;
    const name = fantraxPlayerName(player);
    if (!name) continue;
    const normalized = normalizeName(name);
    catalogNameUse.set(normalized, (catalogNameUse.get(normalized) ?? 0) + 1);
    const strict = `${normalized}\0${player.team ?? ""}\0${player.position}`;
    catalogStrictUse.set(strict, (catalogStrictUse.get(strict) ?? 0) + 1);
  }
  for (const alias of aliases) {
    const identity = identityById.get(alias.fhfh_player_id);
    if (!identity) continue;
    const name = normalizeName(alias.normalized_alias);
    const matches = identitiesByName.get(name) ?? [];
    if (!matches.some((candidate) => candidate.id === identity.id)) {
      identitiesByName.set(name, [...matches, identity]);
    }
  }
  const identitiesByKey = new Map<string, Identity[]>();
  for (const identity of identities) {
    if (!identity.canonical_position || identity.current_nhl_team_id == null || identity.nhl_player_id == null) continue;
    const identityKey = key(identity.canonical_name, identity.current_nhl_team_id, identity.canonical_position);
    identitiesByKey.set(identityKey, [...(identitiesByKey.get(identityKey) ?? []), identity]);
  }
  for (const alias of aliases) {
    const identity = identityById.get(alias.fhfh_player_id);
    if (!identity?.canonical_position || identity.current_nhl_team_id == null) continue;
    const identityKey = key(alias.normalized_alias, identity.current_nhl_team_id, identity.canonical_position);
    const matches = identitiesByKey.get(identityKey) ?? [];
    if (!matches.some((candidate) => candidate.id === identity.id)) identitiesByKey.set(identityKey, [...matches, identity]);
  }
  const candidates = new Map<string, Identity>();
  const identityUse = new Map<number, number>();
  for (const playerId of new Set(playerIds)) {
    const player = catalog[playerId];
    if (!player || player.fantraxId !== playerId) continue;
    const name = fantraxPlayerName(player);
    const teamIds = player.team ? teamByAbbreviation.get(player.team) ?? [] : [];
    const position = POSITIONS[player.position];
    if (!name) continue;
    const exactMatches = position ? teamIds.flatMap((teamId) => identitiesByKey.get(key(name, teamId, position)) ?? []) : [];
    const uniqueExact = [...new Map(exactMatches.map((identity) => [identity.id, identity])).values()];
    const nameMatches = identitiesByName.get(normalizeName(name)) ?? [];
    const strict = `${normalizeName(name)}\0${player.team ?? ""}\0${player.position}`;
    const identity = uniqueExact.length === 1 && catalogStrictUse.get(strict) === 1 ? uniqueExact[0]
      : nameMatches.length === 1 && catalogNameUse.get(normalizeName(name)) === 1 ? nameMatches[0]
        : null;
    if (!identity) continue;
    candidates.set(playerId, identity);
    identityUse.set(identity.id, (identityUse.get(identity.id) ?? 0) + 1);
  }
  return new Map([...candidates].filter(([, identity]) => identityUse.get(identity.id) === 1));
}
