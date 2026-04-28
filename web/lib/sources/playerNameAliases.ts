import type { RosterNameEntry } from "lib/sources/lineupSourceIngestion";

export type PlayerNameAliasRow = {
  alias: string;
  player_id: number;
  team_id: number | null;
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

  for (const alias of args.aliases) {
    if (alias.team_id != null && alias.team_id !== args.teamId) continue;
    aliasesByPlayerId.set(alias.player_id, [
      ...(aliasesByPlayerId.get(alias.player_id) ?? []),
      alias.alias
    ]);
  }

  return args.rosterEntries.map((entry) => ({
    ...entry,
    aliases: [...(entry.aliases ?? []), ...(aliasesByPlayerId.get(entry.playerId) ?? [])]
  }));
}
