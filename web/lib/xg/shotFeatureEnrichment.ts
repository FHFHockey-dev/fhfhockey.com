import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../supabase/database-generated.types";
import type { NhlShotFeatureRow } from "../supabase/Upserts/nhlShotFeatureBuilder";
import { buildShiftStintsByGameId } from "./deploymentContext";
import { buildDeploymentContextForShot } from "./deploymentContext";
import {
  buildShooterGoalieHandednessMatchup,
  normalizeShootsCatchesValue,
  type NormalizedHandedness,
} from "./handedness";
import {
  buildShooterPositionGroup,
  normalizeRosterPosition,
  type NormalizedRosterPosition,
} from "./rosterPosition";

type PlayerStatsUnifiedRow = Database["public"]["Views"]["player_stats_unified"]["Row"];
type GoalieStatsUnifiedRow = Database["public"]["Views"]["goalie_stats_unified"]["Row"];
type PlayerRow = Database["public"]["Tables"]["players"]["Row"];
type ShiftRow = Database["public"]["Tables"]["nhl_api_shift_rows"]["Row"];

type TrainingContextMaps = {
  shooterHandednessByPlayerId: ReadonlyMap<number, NormalizedHandedness>;
  goalieCatchHandByPlayerId: ReadonlyMap<number, NormalizedHandedness>;
  rosterPositionByPlayerId: ReadonlyMap<number, NormalizedRosterPosition>;
};

function chunkNumbers(values: number[], size: number): number[][] {
  const chunks: number[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

function uniqueIntegerIds(values: Array<number | null | undefined>): number[] {
  return Array.from(
    new Set(
      values.filter((value): value is number => Number.isInteger(value))
    )
  );
}

async function fetchShooterHandednessMap(
  client: SupabaseClient<Database>,
  playerIds: number[],
  seasonId: number
): Promise<Map<number, NormalizedHandedness>> {
  const handednessByPlayerId = new Map<number, NormalizedHandedness>();

  for (const chunk of chunkNumbers(playerIds, 200)) {
    const { data, error } = await client
      .from("player_stats_unified")
      .select("player_id, shoots_catches, date")
      .in("player_id", chunk)
      .eq("season_id", seasonId)
      .order("player_id", { ascending: true })
      .order("date", { ascending: false, nullsFirst: false });

    if (error) throw error;

    for (const row of (data ?? []) as Pick<
      PlayerStatsUnifiedRow,
      "player_id" | "shoots_catches" | "date"
    >[]) {
      const playerId = row.player_id;
      if (typeof playerId !== "number" || handednessByPlayerId.has(playerId)) continue;

      const handedness = normalizeShootsCatchesValue(row.shoots_catches);
      if (handedness != null) handednessByPlayerId.set(playerId, handedness);
    }
  }

  return handednessByPlayerId;
}

async function fetchGoalieCatchHandMap(
  client: SupabaseClient<Database>,
  playerIds: number[],
  seasonId: number
): Promise<Map<number, NormalizedHandedness>> {
  const catchHandByPlayerId = new Map<number, NormalizedHandedness>();

  for (const chunk of chunkNumbers(playerIds, 200)) {
    const { data, error } = await client
      .from("goalie_stats_unified")
      .select("player_id, shoots_catches, date")
      .in("player_id", chunk)
      .eq("season_id", seasonId)
      .order("player_id", { ascending: true })
      .order("date", { ascending: false, nullsFirst: false });

    if (error) throw error;

    for (const row of (data ?? []) as Pick<
      GoalieStatsUnifiedRow,
      "player_id" | "shoots_catches" | "date"
    >[]) {
      const playerId = row.player_id;
      if (typeof playerId !== "number" || catchHandByPlayerId.has(playerId)) continue;

      const catchHand = normalizeShootsCatchesValue(row.shoots_catches);
      if (catchHand != null) catchHandByPlayerId.set(playerId, catchHand);
    }
  }

  return catchHandByPlayerId;
}

async function fetchRosterPositionMap(
  client: SupabaseClient<Database>,
  playerIds: number[]
): Promise<Map<number, NormalizedRosterPosition>> {
  const positionByPlayerId = new Map<number, NormalizedRosterPosition>();

  for (const chunk of chunkNumbers(playerIds, 200)) {
    const { data, error } = await client
      .from("players")
      .select("id, position")
      .in("id", chunk);

    if (error) throw error;

    for (const row of (data ?? []) as Pick<PlayerRow, "id" | "position">[]) {
      const playerId = row.id;
      if (typeof playerId !== "number") continue;

      const position = normalizeRosterPosition(row.position);
      if (position != null) positionByPlayerId.set(playerId, position);
    }
  }

  return positionByPlayerId;
}

export function enrichShotRowsWithTrainingContextMaps(
  shotRows: NhlShotFeatureRow[],
  shiftRows: ShiftRow[],
  maps: TrainingContextMaps
): NhlShotFeatureRow[] {
  const stintsByGameId = buildShiftStintsByGameId(shiftRows);

  return shotRows.map((row) => {
    const shooterRosterPosition =
      row.shooterPlayerId == null
        ? null
        : maps.rosterPositionByPlayerId.get(row.shooterPlayerId) ?? null;
    const shooterPositionGroup = buildShooterPositionGroup(shooterRosterPosition);
    const shooterHandedness =
      row.shooterPlayerId == null
        ? null
        : maps.shooterHandednessByPlayerId.get(row.shooterPlayerId) ?? null;
    const goalieCatchHand =
      row.goalieInNetId == null
        ? null
        : maps.goalieCatchHandByPlayerId.get(row.goalieInNetId) ?? null;

    return {
      ...row,
      shooterRosterPosition,
      shooterPositionGroup,
      isDefensemanShooter:
        shooterRosterPosition == null ? null : shooterRosterPosition === "D",
      shooterHandedness,
      goalieCatchHand,
      shooterGoalieHandednessMatchup: buildShooterGoalieHandednessMatchup(
        shooterHandedness,
        goalieCatchHand
      ),
      ...buildDeploymentContextForShot(
        row,
        stintsByGameId.get(row.gameId) ?? [],
        maps.rosterPositionByPlayerId
      ),
    };
  });
}

export async function enrichShotRowsWithPersistedTrainingContext(args: {
  supabase: SupabaseClient<Database>;
  shotRows: NhlShotFeatureRow[];
  shiftRows: ShiftRow[];
  seasonId: number;
}): Promise<NhlShotFeatureRow[]> {
  if (args.shotRows.length === 0) return [];

  const shooterIds = uniqueIntegerIds(args.shotRows.map((row) => row.shooterPlayerId));
  const goalieIds = uniqueIntegerIds(args.shotRows.map((row) => row.goalieInNetId));
  const onIcePlayerIds = uniqueIntegerIds(args.shiftRows.map((row) => row.player_id));
  const rosterIds = Array.from(new Set([...shooterIds, ...onIcePlayerIds]));

  const [
    shooterHandednessByPlayerId,
    goalieCatchHandByPlayerId,
    rosterPositionByPlayerId,
  ] = await Promise.all([
    shooterIds.length
      ? fetchShooterHandednessMap(args.supabase, shooterIds, args.seasonId)
      : Promise.resolve(new Map<number, NormalizedHandedness>()),
    goalieIds.length
      ? fetchGoalieCatchHandMap(args.supabase, goalieIds, args.seasonId)
      : Promise.resolve(new Map<number, NormalizedHandedness>()),
    rosterIds.length
      ? fetchRosterPositionMap(args.supabase, rosterIds)
      : Promise.resolve(new Map<number, NormalizedRosterPosition>()),
  ]);

  return enrichShotRowsWithTrainingContextMaps(args.shotRows, args.shiftRows, {
    shooterHandednessByPlayerId,
    goalieCatchHandByPlayerId,
    rosterPositionByPlayerId,
  });
}
