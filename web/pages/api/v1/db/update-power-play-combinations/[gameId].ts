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

export default adminOnly(async (req, res) => {
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
});

async function updatePowerPlayCombinations(
  gameId: number,
  supabase: SupabaseType
) {
  const rawData = await fetchTOIRawData(gameId);
  // @ts-ignore
  const { toi, teams } = getTOIData(rawData, "pp-toi");

  const rows: {
    gameId: number;
    unit: number;
    PPTOI: number;
    percentageOfPP: number;
    playerId: number;
  }[] = [];

  teams.forEach((team) => {
    const toiData = toi[team.id];
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
      const unitId = i + 1;
      const avgPPTOI = getAvg(unit, table);
      unit.forEach((player) => {
        const toi = table[getKey(player.id, player.id)].toi;
        const percentageOfPP = toi / avgPPTOI;
        rows.push({
          gameId,
          unit: unitId,
          PPTOI: toi,
          percentageOfPP,
          playerId: player.id
        });
      });
    });
  });

  if (rows.length === 0) {
    throw new Error("No power play combinations found");
  }
  console.log(rows);
  // upsert the data to supabase
  await supabase.from("powerPlayCombinations").upsert(rows).throwOnError();
}
