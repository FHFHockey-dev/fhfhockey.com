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

type PowerPlayCombinationUpdateSummary = {
  gameId: number;
  rowCount: number;
  teamCount: number;
  shiftSource: string;
};

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

export default withCronJobAudit(adminOnly(async (req, res) => {
  const { supabase } = req;
  const gameId = Number(req.query.gameId);
  if (!gameId) {
    return res.status(400).json({
      message: "Invalid game id",
      success: false
    });
  }

  try {
    await updatePowerPlayCombinations(gameId, supabase);
    res.json({
      message:
        "Successfully updated the power play combinations for game " + gameId,
      success: true
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
    });
  });

  if (rows.length === 0) {
    throw new Error("No power play combinations found");
  }
  console.log("[updatePowerPlayCombinations] summary", {
    gameId,
    rowCount: rows.length,
    teamCount: teams.length,
    shiftSource
  });

  await supabase.from("powerPlayCombinations").upsert(rows).throwOnError();
  return {
    gameId,
    rowCount: rows.length,
    teamCount: teams.length,
    shiftSource
  };
}

function parseClockToSeconds(clock: string): number {
  const [minutes, seconds] = clock.split(":").map(Number);
  return minutes * 60 + seconds;
}
