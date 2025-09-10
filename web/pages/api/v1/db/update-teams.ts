// C:\Users\timbr\OneDrive\Desktop\fhfhockey.com-3\web\pages\api\v1\db\update-teams.ts

import { restGet } from "lib/NHL/base";
import { getCurrentSeason } from "lib/NHL/server";
import adminOnly from "utils/adminOnlyMiddleware";

export default adminOnly(async function handler(req, res) {
  try {
    const { supabase } = req;
    let season = { seasonId: 0 };
    if (req.query.seasonId) {
      season.seasonId = Number(req.query.seasonId);
    } else {
      season = await getCurrentSeason();
    }
    // Optional: allow forcing specific teamIds into team_season (e.g., offseason)
    const forcedParam = (req.query.forceTeamIds as string) || "";
    const forcedTeamIds = new Set(
      forcedParam
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
        .map((s) => Number(s))
        .filter((n) => !Number.isNaN(n))
    );
    // fetch all teams
    const { data: teams } = await restGet("/team");
    const { error } = await supabase.from("teams").upsert(
      teams.map((team) => ({
        id: team.id,
        name: team.fullName,
        abbreviation: team.triCode
      }))
    );
    if (error) throw error;

    // fetch teams participated in the current season
    const seasonId = season.seasonId;
    const { data: currentSeasonTeams } = await restGet(
      `/team/summary?cayenneExp=seasonId=${seasonId}`
    );
    const currentSeasonTeamIds = new Set<number>(
      currentSeasonTeams.map((team) => team.teamId)
    );
    // Merge any forced teamIds (useful before NHL stats API returns participants)
    for (const id of forcedTeamIds) currentSeasonTeamIds.add(id);

    // Utah franchise ID hygiene: drop legacy Utah Hockey Club (59) in favor of Mammoth (68)
    // and drop ARI (53) post-relocation if present in the same season context.
    // These are no-ops if those IDs are not present.
    if (currentSeasonTeamIds.has(59)) currentSeasonTeamIds.delete(59);
    if (currentSeasonTeamIds.has(68)) currentSeasonTeamIds.delete(53);
    const { error: team_seasonError } = await supabase
      .from("team_season")
      .upsert(
        [...currentSeasonTeamIds].map((id) => ({ teamId: id, seasonId }))
      );
    if (team_seasonError) throw team_seasonError;

    // Clean up stale team_season rows for this season: remove any teamIds
    // that are no longer in the currentSeasonTeamIds set (prevents duplicates)
    const { data: existingSeasonRows, error: fetchSeasonRowsError } = await supabase
      .from("team_season")
      .select("teamId")
      .eq("seasonId", seasonId);
    if (fetchSeasonRowsError) throw fetchSeasonRowsError;
    const toDelete = (existingSeasonRows || [])
      .map((r: any) => r.teamId)
      .filter((id: number) => !currentSeasonTeamIds.has(id));
    if (toDelete.length > 0) {
      const { error: deleteErr } = await supabase
        .from("team_season")
        .delete()
        .eq("seasonId", seasonId)
        .in("teamId", toDelete);
      if (deleteErr) throw deleteErr;
    }

    res.status(200).json({
      message:
        "successfully updated the teams table " +
        "num teams: " +
        currentSeasonTeamIds.size,
      success: true
    });
  } catch (e: any) {
    res.status(400).json({ message: e.message, success: false });
  }
});
