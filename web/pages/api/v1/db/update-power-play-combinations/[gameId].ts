import { withCronJobAudit } from "lib/cron/withCronJobAudit";
import adminOnly from "utils/adminOnlyMiddleware";
import { SupabaseType } from "lib/supabase/client";
import {
  fetchTOIRawData,
  getKey,
  getTOIData,
  sortByPPTOI,
  TOIData
} from "components/LinemateMatrix";
import { getAvg } from "components/LinemateMatrix/utilities";
import getPowerPlayBlocks from "utils/getPowerPlayBlocks";
import { buildPowerPlayCombinationRows } from "lib/supabase/Upserts/powerPlayCombinationMetrics";

type ToiRawData = Awaited<ReturnType<typeof fetchTOIRawData>>;

// A team on the power play has at least four skaters on the ice, so far fewer than that means its shifts are incomplete.
const MIN_SKATERS_PER_PP_SECOND = 3;
// On four real games, 143 of 144 skaters' shifts summed to their boxscore time to the second.
const SHIFT_TOI_TOLERANCE_SECONDS = 2;

type PowerPlayCombinationUpdateSummary = {
  gameId: number;
  rowCount: number;
  teamCount: number;
  shiftSource: string;
  /** Stored rows of players with no PP time this run, kept because nothing proves the player had none. */
  keptUnproven: number;
};

/**
 * The stored players a run may remove. The boxscore has to show that a player's shifts are all there before their
 * lack of PP time means anything, so a player with an even-strength shift and a missing PP shift keeps their row.
 *  - Played: shift time must match boxscore time within the tolerance.
 *  - Did not play: absent from the boxscore or 0 TOI, with no shift time saying otherwise.
 * If the boxscore is unreadable for any player or team, nothing is proven.
 */
function getProvenNoPpPlayerIds(
  rawData: ToiRawData,
  candidateIds: number[]
): number[] {
  const [, { rostersMap, teams }] = rawData;
  const roster = Object.values(rostersMap);
  const boxscoreReadable =
    teams.every((team) => roster.some((player) => player.teamId === team.id)) &&
    roster.length > 0 &&
    roster.every((player) => /^\d+:\d{2}$/.test(player.toi ?? ""));
  if (!boxscoreReadable) return [];

  const shiftSecondsByPlayerId = new Map<number, number>();
  for (const shift of getShiftRows(rawData) as Array<{
    playerId?: number;
    duration?: string | null;
  }>) {
    if (!shift.playerId) continue;
    shiftSecondsByPlayerId.set(
      shift.playerId,
      (shiftSecondsByPlayerId.get(shift.playerId) ?? 0) +
        parseClockToSeconds(shift.duration ?? "00:00")
    );
  }

  return candidateIds.filter((playerId) => {
    const boxscoreToi = rostersMap[playerId]?.toi;
    const boxscoreSeconds = boxscoreToi ? parseClockToSeconds(boxscoreToi) : 0;
    const shiftSeconds = shiftSecondsByPlayerId.get(playerId) ?? 0;
    return boxscoreSeconds === 0
      ? shiftSeconds === 0
      : Math.abs(shiftSeconds - boxscoreSeconds) <= SHIFT_TOI_TOLERANCE_SECONDS;
  });
}

function getShiftRows(rawData: ToiRawData): unknown[] {
  const rows = rawData[0]?.data;
  return Array.isArray(rows) ? rows : [];
}

async function fetchTOIRawDataForPowerPlayCombinations(
  gameId: number
): Promise<{ rawData: ToiRawData; shiftSource: string }> {
  const rawData = await fetchTOIRawData(gameId);
  if (getShiftRows(rawData).length > 0) {
    return { rawData, shiftSource: "json-api" };
  }

  const { fetchNhlApiRawGamePayloads } = await import(
    "lib/supabase/Upserts/nhlRawGamecenter.mjs"
  );
  const fallbackPayload = await fetchNhlApiRawGamePayloads(gameId);
  const shiftcharts = fallbackPayload?.payloads?.shiftcharts;
  const fallbackRows = Array.isArray(shiftcharts?.data)
    ? shiftcharts.data
    : [];

  if (fallbackRows.length === 0) {
    return {
      rawData,
      shiftSource: shiftcharts?.source ?? "json-api-empty"
    };
  }

  return {
    rawData: [{ data: fallbackRows }, rawData[1], rawData[2]] as ToiRawData,
    shiftSource: shiftcharts?.source ?? "fallback"
  };
}

export default adminOnly(withCronJobAudit(async (req, res) => {
  const { supabase } = req;
  const gameId = Number(req.query.gameId);
  if (!gameId) {
    return res.status(400).json({
      message: "Invalid game id",
      success: false
    });
  }

  try {
    const { keptUnproven } = await updatePowerPlayCombinations(gameId, supabase);
    res.json({
      message:
        "Successfully updated the power play combinations for game " + gameId,
      success: true,
      keptUnproven
    });
  } catch (e: any) {
    res.status(400).json({
      message: "Failed to update the power play combinations. " + e.message,
      success: false
    });
  }
}));

export async function updatePowerPlayCombinations(
  gameId: number,
  supabase: SupabaseType
): Promise<PowerPlayCombinationUpdateSummary> {
  const { rawData, shiftSource } =
    await fetchTOIRawDataForPowerPlayCombinations(gameId);
  // @ts-ignore
  const { toi, teams } = getTOIData(rawData, "pp-toi");
  const [, , { plays }] = rawData;
  const ppBlocks = getPowerPlayBlocks(plays);
  const teamPpToiByTeamId = ppBlocks.reduce<Record<number, number>>(
    (acc, block) => {
      const startSeconds = parseClockToSeconds(block.start.timeInPeriod);
      const endSeconds = parseClockToSeconds(block.end.timeInPeriod);
      const duration =
        block.start.period === block.end.period
          ? endSeconds - startSeconds
          : (20 * 60 - startSeconds) + endSeconds;
      acc[block.teamId] = (acc[block.teamId] ?? 0) + Math.max(duration, 0);
      return acc;
    },
    {}
  );

  const rows: Array<{
    gameId: number;
    unit: number;
    PPTOI: number;
    percentageOfPP: number;
    pp_unit_usage_index: number;
    pp_unit_relative_toi: number;
    pp_vs_unit_avg: number;
    pp_share_of_team: number | null;
    playerId: number;
  }> = [];

  const playerSecondsByTeamId: Record<number, number> = {};

  teams.forEach((team) => {
    const toiData = toi[team.id] ?? [];
    const table: Record<string, TOIData> = {};
    toiData.forEach((item) => {
      const key = getKey(item.p1.id, item.p2.id);
      table[key] = item;
    });
    const sortedRoster = sortByPPTOI(table);
    // group by power play unit
    const unit1 = sortedRoster.slice(0, 5); // Players 0 to 4
    const unit2 = sortedRoster.slice(5, 10); // Players 5 to 9
    const unit3 = sortedRoster.slice(10); // Players 10 and onward
    const units = [unit1, unit2, unit3];
    units.forEach((unit, i) => {
      if (!unit.length) return;
      const unitId = i + 1;
      const avgPPTOI = getAvg(unit, table);
      const unitRows = buildPowerPlayCombinationRows({
        gameId,
        unit: unitId,
        players: unit.map((player) => ({
          playerId: player.id,
          toiSeconds: table[getKey(player.id, player.id)].toi
        })),
        avgUnitToiSeconds: avgPPTOI,
        teamPpToiSeconds: teamPpToiByTeamId[team.id] ?? null
      });
      rows.push(...unitRows);
      playerSecondsByTeamId[team.id] =
        (playerSecondsByTeamId[team.id] ?? 0) +
        unitRows.reduce((sum, row) => sum + row.PPTOI, 0);
    });
  });

  if (getShiftRows(rawData).length === 0) {
    throw new Error("No power play combinations found");
  }
  // A team with no power play needs no rows, but one with PP time must show players on the ice for it. This catches a
  // grossly incomplete feed before any write. It cannot prove a feed complete, so the delete below has its own rule.
  const incompleteTeamIds = Object.entries(teamPpToiByTeamId)
    .filter(
      ([teamId, ppSeconds]) =>
        (playerSecondsByTeamId[Number(teamId)] ?? 0) <
        ppSeconds * MIN_SKATERS_PER_PP_SECOND
    )
    .map(([teamId]) => teamId);
  if (incompleteTeamIds.length > 0) {
    throw new Error(
      `Incomplete shift data for game ${gameId}: team(s) ${incompleteTeamIds.join(", ")} have PP time without enough players on the ice. Stored rows were kept.`
    );
  }
  console.log("[updatePowerPlayCombinations] summary", {
    gameId,
    rowCount: rows.length,
    teamCount: teams.length,
    shiftSource
  });

  if (rows.length > 0) {
    await supabase.from("powerPlayCombinations").upsert(rows).throwOnError();
  }
  // The key is game and player, so a player who no longer has PP time would otherwise keep their old row.
  const writtenPlayerIds = new Set(rows.map((row) => row.playerId));
  const { data: storedRows } = await supabase
    .from("powerPlayCombinations")
    .select("playerId")
    .eq("gameId", gameId)
    .throwOnError();
  const candidateIds = (storedRows ?? [])
    .map((row) => row.playerId)
    .filter((playerId) => !writtenPlayerIds.has(playerId));
  const provenNoPpPlayerIds = getProvenNoPpPlayerIds(rawData, candidateIds);
  if (provenNoPpPlayerIds.length > 0) {
    await supabase
      .from("powerPlayCombinations")
      .delete()
      .eq("gameId", gameId)
      .in("playerId", provenNoPpPlayerIds)
      .throwOnError();
  }
  return {
    gameId,
    rowCount: rows.length,
    teamCount: teams.length,
    shiftSource,
    keptUnproven: candidateIds.length - provenNoPpPlayerIds.length
  };
}

function parseClockToSeconds(clock: string): number {
  const [minutes, seconds] = clock.split(":").map(Number);
  return minutes * 60 + seconds;
}
