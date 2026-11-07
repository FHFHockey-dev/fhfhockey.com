import type { RosterNameEntry } from "lib/sources/lineupSourceIngestion";
import { positionGroupSlotRole } from "lib/sources/playerIdentity";

export type PlayerNameAliasRow = {
  alias: string;
  player_id: number;
  team_id: number | null;
  /** F, D or G: the alias applies only in that kind of slot. Null applies everywhere. */
  position_group?: string | null;
};

export function normalizePlayerNameAlias(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/[^a-zA-Z0-9#@.' -]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function buildUnresolvedPlayerNameDedupeKey(args: {
  source: string;
  tweetId: string | null;
  teamId: number | null;
  normalizedName: string;
}): string {
  return [
    args.source,
    args.tweetId ?? "no-tweet",
    args.teamId ?? "no-team",
    args.normalizedName
  ].join(":");
}

export function mergePlayerNameAliasesIntoRoster(args: {
  rosterEntries: RosterNameEntry[];
  aliases: PlayerNameAliasRow[];
  teamId: number;
}): RosterNameEntry[] {
  const aliasesByPlayerId = new Map<number, string[]>();
  const roleAliasesByPlayerId = new Map<number, NonNullable<RosterNameEntry["roleAliases"]>>();

  for (const alias of args.aliases) {
    if (alias.team_id != null && alias.team_id !== args.teamId) continue;
    if (alias.position_group) {
      const role = positionGroupSlotRole(alias.position_group);
      if (!role) continue;
      roleAliasesByPlayerId.set(alias.player_id, [
        ...(roleAliasesByPlayerId.get(alias.player_id) ?? []),
        { alias: alias.alias, role }
      ]);
      continue;
    }
    aliasesByPlayerId.set(alias.player_id, [
      ...(aliasesByPlayerId.get(alias.player_id) ?? []),
      alias.alias
    ]);
  }

  return args.rosterEntries.map((entry) => {
    const roleAliases = roleAliasesByPlayerId.get(entry.playerId);
    return {
      ...entry,
      aliases: [...(entry.aliases ?? []), ...(aliasesByPlayerId.get(entry.playerId) ?? [])],
      ...(roleAliases ? { roleAliases: [...(entry.roleAliases ?? []), ...roleAliases] } : {})
    };
  });
}
