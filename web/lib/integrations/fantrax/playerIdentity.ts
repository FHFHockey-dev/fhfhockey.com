import type { FantraxPlayerInfo } from "./client";

type Team = { id: number; abbreviation: string };
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
  return `${name.normalize("NFKC").toLocaleLowerCase("en-US")}\0${teamId}\0${position}`;
}

/** A player is verified only by a unique exact name, NHL team, and position match. */
export function matchFantraxPlayerIds(
  playerIds: string[],
  catalog: Record<string, FantraxPlayerInfo>,
  teams: Team[],
  identities: Identity[],
) {
  const teamByAbbreviation = new Map<string, number[]>();
  for (const team of teams) {
    teamByAbbreviation.set(team.abbreviation, [...(teamByAbbreviation.get(team.abbreviation) ?? []), team.id]);
  }
  const identitiesByKey = new Map<string, Identity[]>();
  for (const identity of identities) {
    if (!identity.nhl_player_id || !identity.canonical_position || identity.current_nhl_team_id == null) continue;
    const identityKey = key(identity.canonical_name, identity.current_nhl_team_id, identity.canonical_position);
    identitiesByKey.set(identityKey, [...(identitiesByKey.get(identityKey) ?? []), identity]);
  }
  const candidates = new Map<string, Identity>();
  const identityUse = new Map<number, number>();
  for (const playerId of new Set(playerIds)) {
    const player = catalog[playerId];
    if (!player || player.fantraxId !== playerId) continue;
    const name = fantraxPlayerName(player);
    const teamIds = player.team ? teamByAbbreviation.get(player.team) ?? [] : [];
    const position = POSITIONS[player.position];
    if (!name || !teamIds.length || !position) continue;
    const matches = teamIds.flatMap((teamId) => identitiesByKey.get(key(name, teamId, position)) ?? []);
    if (matches.length !== 1) continue;
    candidates.set(playerId, matches[0]);
    identityUse.set(matches[0].id, (identityUse.get(matches[0].id) ?? 0) + 1);
  }
  return new Map([...candidates].filter(([, identity]) => identityUse.get(identity.id) === 1));
}
