import type { ProcessedPlayer } from "hooks/useProcessedProjectionsData";
import { normalizeName } from "lib/integrations/fantrax/playerIdentity";

export type FantraxDisplayPlayer = {
  name: string;
  team: string | null;
  position: string;
  eligiblePositions: string[] | null;
  adp: number | null;
};

const POSITIONS = new Set(["C", "LW", "RW", "D", "G"]);

export function fantraxEligiblePositions(value: unknown): string[] | null {
  if (typeof value !== "string") return null;
  return value.split(",").map((position) => position.trim())
    .filter((position) => POSITIONS.has(position));
}

/** Only unique names can safely inherit public Fantrax display metadata. */
export function applyFantraxDisplay(players: ProcessedPlayer[], catalog: FantraxDisplayPlayer[] | null) {
  const byName = new Map<string, FantraxDisplayPlayer | null>();
  for (const row of catalog ?? []) {
    const name = normalizeName(row.name);
    byName.set(name, byName.has(name) ? null : row);
  }
  const localNameCount = new Map<string, number>();
  for (const player of players) {
    const name = normalizeName(player.fullName);
    localNameCount.set(name, (localNameCount.get(name) ?? 0) + 1);
  }
  return players.map((player) => {
    const name = normalizeName(player.fullName);
    const row = localNameCount.get(name) === 1 ? byName.get(name) : null;
    const position = row && POSITIONS.has(row.position) ? row.position : null;
    return {
      ...player,
      // Existing dashboard math consumes this shared ADP slot; its source is Fantrax here.
      yahooAvgPick: row?.adp ?? null,
      yahooAvgRound: null,
      yahooPctDrafted: null,
      fantraxMetadataMatched: Boolean(row),
      ...(row ? { fullName: row.name } : {}),
      ...(row?.team ? { displayTeam: row.team } : {}),
      ...(position ? { displayPosition: position, eligiblePositions: row?.eligiblePositions?.length ? row.eligiblePositions : [position] } : {}),
    };
  });
}
