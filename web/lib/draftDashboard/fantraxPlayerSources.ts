import type { ProcessedPlayer } from "hooks/useProcessedProjectionsData";
import { canonicalScheduleTeam } from "./scheduleMetrics";

export type FantraxPlayerRow = {
  name: string;
  team: string | null;
  positions: string[];
  adp: number | null;
};

const normalizedName = (name: string, lastFirst: boolean) => {
  const parts = lastFirst ? name.split(",") : [];
  const full = parts.length === 2 ? `${parts[1]} ${parts[0]}` : name;
  return full.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]/g, "");
};

export function applyFantraxPlayerSources(
  players: readonly ProcessedPlayer[],
  fantraxRows: readonly FantraxPlayerRow[],
  adpSource: "yahoo" | "fantrax",
  positionSource: "yahoo" | "fantrax",
): ProcessedPlayer[] {
  if (adpSource === "yahoo" && positionSource === "yahoo") return [...players];
  const byName = new Map<string, FantraxPlayerRow | null>();
  const byNameAndTeam = new Map<string, FantraxPlayerRow | null>();
  for (const row of fantraxRows) {
    const name = normalizedName(row.name, true);
    const team = canonicalScheduleTeam(row.team);
    byName.set(name, byName.has(name) ? null : row);
    const key = `${name}:${team}`;
    byNameAndTeam.set(key, byNameAndTeam.has(key) ? null : row);
  }
  return players.map((player) => {
    const name = normalizedName(player.fullName, false);
    const exact = byNameAndTeam.get(`${name}:${canonicalScheduleTeam(player.displayTeam)}`);
    const row = exact ?? byName.get(name);
    if (!row) return {
      ...player,
      ...(adpSource === "fantrax" ? { yahooAvgPick: null } : {}),
      ...(positionSource === "fantrax" ? { displayPosition: null, eligiblePositions: [] } : {}),
    };
    const positions = row.positions.map((position) => position.toUpperCase().trim()).filter(Boolean);
    return {
      ...player,
      ...(adpSource === "fantrax" ? { yahooAvgPick: row.adp } : {}),
      ...(positionSource === "fantrax" ? { displayPosition: positions.join(", ") || null, eligiblePositions: positions } : {}),
    };
  });
}
