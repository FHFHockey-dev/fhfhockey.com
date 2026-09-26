import type { ProcessedPlayer } from "hooks/useProcessedProjectionsData";
import { normalizeName } from "lib/integrations/fantrax/playerIdentity";

export type FantraxDisplayPlayer = {
  id: string;
  name: string;
  team: string | null;
  position: string;
  eligiblePositions: string[] | null;
  adp: number | null;
};

const POSITIONS = new Set(["C", "LW", "RW", "D", "G"]);

// Verified against Fantrax's NHL player catalog. These NHL players have a different
// Fantrax name or share a name with another player; never guess from a fuzzy name.
export const FANTRAX_IDENTITY_EXCEPTIONS: Record<number, { id: string; name: string; position: string }> = {
  8474578: { id: "016g3", name: "Erik Karlsson", position: "D" },
  8475158: { id: "01f6d", name: "Ryan OReilly", position: "C" },
  8475690: { id: "01uor", name: "Christopher Tanev", position: "D" },
  8475755: { id: "01zun", name: "Alex Petrovic", position: "D" },
  8476473: { id: "02azm", name: "Connor Murphy", position: "D" },
  8476979: { id: "02nqk", name: "Erik Gustafsson", position: "D" },
  8477070: { id: "03kij", name: "Liam OBrien", position: "LW" },
  8477992: { id: "03eb6", name: "Jonas Johansson", position: "G" },
  8478427: { id: "03rmx", name: "Sebastian Aho", position: "C" },
  8478435: { id: "03rfo", name: "Daniel Vladar", position: "G" },
  8478470: { id: "03rfp", name: "Sam Montembeault", position: "G" },
  8478851: { id: "03rgk", name: "Alex Carrier", position: "D" },
  8479591: { id: "042xv", name: "Mikey Eyssimont", position: "RW" },
  8480012: { id: "048x9", name: "Elias Pettersson", position: "C" },
  8480281: { id: "04f26", name: "Alexei Toropchenko", position: "LW" },
  8480426: { id: "04z51", name: "Charle-Edouard DAstous", position: "D" },
  8480762: { id: "04nwz", name: "Eric Robinson", position: "LW" },
  8480817: { id: "04qve", name: "KAndre Miller", position: "D" },
  8480870: { id: "04ajl", name: "Benoit-Olivier Groulx", position: "C" },
  8481186: { id: "04sxj", name: "Logan OConnor", position: "RW" },
  8481559: { id: "04bdb", name: "Jack Hughes", position: "C" },
  8481582: { id: "04zo3", name: "Nick Robertson", position: "LW" },
  8481716: { id: "050rc", name: "Dmitry Voronkov", position: "LW" },
  8481719: { id: "051ug", name: "Maxwell Crozier", position: "D" },
  8482076: { id: "059mt", name: "Nicolas Daws", position: "G" },
  8482737: { id: "05gd9", name: "Zack Bolduc", position: "RW" },
  8482742: { id: "058vh", name: "Zachary LHeureux", position: "LW" },
  8483678: { id: "060v8", name: "Elias Pettersson", position: "D" },
  8484223: { id: "067xz", name: "Axel Sandin Pellikka", position: "D" },
  8484428: { id: "05u64", name: "Charles-Alexis Legault", position: "D" },
  8485414: { id: "06snb", name: "Benjamin Kindel", position: "RW" },
  8485702: { id: "06imq", name: "Maxim Shabanov", position: "RW" },
};

export function fantraxEligiblePositions(value: unknown): string[] | null {
  if (typeof value !== "string") return null;
  return value.split(",").map((position) => position.trim())
    .filter((position) => POSITIONS.has(position));
}

/** Only unique names can safely inherit public Fantrax display metadata. */
export function applyFantraxDisplay(players: ProcessedPlayer[], catalog: FantraxDisplayPlayer[] | null) {
  const byName = new Map<string, FantraxDisplayPlayer | null>();
  const byId = new Map<string, FantraxDisplayPlayer | null>();
  for (const row of catalog ?? []) {
    const name = normalizeName(row.name);
    byName.set(name, byName.has(name) ? null : row);
    byId.set(row.id, byId.has(row.id) ? null : row);
  }
  const localNameCount = new Map<string, number>();
  for (const player of players) {
    const name = normalizeName(player.fullName);
    localNameCount.set(name, (localNameCount.get(name) ?? 0) + 1);
  }
  return players.map((player) => {
    const name = normalizeName(player.fullName);
    const exception = FANTRAX_IDENTITY_EXCEPTIONS[player.playerId];
    const exceptionRow = exception ? byId.get(exception.id) : null;
    const row = exceptionRow && exception && normalizeName(exceptionRow.name) === normalizeName(exception.name)
      && exceptionRow.position === exception.position ? exceptionRow
      : !exception && localNameCount.get(name) === 1 ? byName.get(name) : null;
    const position = row && POSITIONS.has(row.position) ? row.position : null;
    return {
      ...player,
      // Existing dashboard math consumes this shared ADP slot; its source is Fantrax here.
      yahooAvgPick: row?.adp ?? null,
      yahooAvgRound: null,
      yahooPctDrafted: null,
      fantraxMetadataMatched: Boolean(row),
      ...(row ? { fullName: row.name } : {}),
      ...(row ? { displayTeam: row.team } : {}),
      ...(position ? { displayPosition: position, eligiblePositions: row?.eligiblePositions?.length ? row.eligiblePositions : [position] } : {}),
    };
  });
}
