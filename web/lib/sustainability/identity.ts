import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "lib/supabase/database-generated.types";

type WgoPlayerRow =
  Database["public"]["Tables"]["wgo_skater_stats"]["Row"];
type PlayerRow = Database["public"]["Tables"]["players"]["Row"];

export const WGO_PLAYER_ID_CROSSWALK: Record<number, number> = {};

export const KNOWN_WGO_NAME_VARIANTS: Record<number, string> = {
  8478438: "Tommy Novak",
  8480796: "Martin Fehervary",
  8484958: "Maksim Tsyplakov",
  8477919: "Frederick Gaudreau",
  8476994: "Vinnie Hinostroza",
  8480813: "Joe Veleno",
  8482691: "Aatu Raty"
};

export function normalizePlayerName(value: string | null | undefined): string {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export type WgoPlayerAlignmentReport = {
  sampledRows: number;
  distinctIds: number;
  missingPlayerIds: Array<{ playerId: number; wgoName: string | null }>;
  nameVariants: Array<{
    playerId: number;
    wgoName: string | null;
    playerName: string | null;
  }>;
  requiresIdCrosswalk: boolean;
};

export async function validateWgoPlayerIdAlignment(
  supabase: SupabaseClient<Database>,
  sampleLimit = 1000
): Promise<WgoPlayerAlignmentReport> {
  const { data: wgoRows, error: wgoError } = await supabase
    .from("wgo_skater_stats")
    .select("player_id, player_name, date")
    .not("player_id", "is", null)
    .order("date", { ascending: false })
    .limit(sampleLimit);

  if (wgoError) throw wgoError;

  const latestById = new Map<number, string | null>();
  for (const row of (wgoRows ?? []) as Pick<
    WgoPlayerRow,
    "player_id" | "player_name"
  >[]) {
    const canonicalId = WGO_PLAYER_ID_CROSSWALK[Number(row.player_id)] ?? Number(row.player_id);
    if (!latestById.has(canonicalId)) {
      latestById.set(canonicalId, row.player_name ?? null);
    }
  }

  const playerIds = Array.from(latestById.keys());
  if (!playerIds.length) {
    return {
      sampledRows: 0,
      distinctIds: 0,
      missingPlayerIds: [],
      nameVariants: [],
      requiresIdCrosswalk: false
    };
  }

  const { data: playerRows, error: playerError } = await supabase
    .from("players")
    .select("id, fullName")
    .in("id", playerIds);

  if (playerError) throw playerError;

  const playerMap = new Map<number, string | null>();
  for (const row of (playerRows ?? []) as Pick<PlayerRow, "id" | "fullName">[]) {
    playerMap.set(Number(row.id), row.fullName ?? null);
  }

  const missingPlayerIds: WgoPlayerAlignmentReport["missingPlayerIds"] = [];
  const nameVariants: WgoPlayerAlignmentReport["nameVariants"] = [];

  for (const playerId of playerIds) {
    const wgoName = latestById.get(playerId) ?? null;
    const playerName = playerMap.get(playerId) ?? null;
    if (!playerName) {
      missingPlayerIds.push({ playerId, wgoName });
      continue;
    }

    const canonicalWgoName = KNOWN_WGO_NAME_VARIANTS[playerId] ?? wgoName;
    if (
      normalizePlayerName(canonicalWgoName) !== normalizePlayerName(playerName)
    ) {
      nameVariants.push({
        playerId,
        wgoName,
        playerName
      });
    }
  }

  return {
    sampledRows: (wgoRows ?? []).length,
    distinctIds: playerIds.length,
    missingPlayerIds,
    nameVariants,
    requiresIdCrosswalk: missingPlayerIds.length > 0
  };
}
