import type { NextApiRequest, NextApiResponse } from "next";
import supabase from "lib/supabase/server";
import { restGet } from "lib/NHL/base";
import { getCurrentSeason } from "lib/NHL/server";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    // fetch all teams
    const { data: teams } = await restGet("/team");
    const { error } = await supabase.from("teams").upsert(
      teams.map((team) => ({
        id: team.id,
        name: team.fullName,
        abbreviation: team.triCode,
      }))
    );
    if (error) throw error;

    // fetch teams participated in the current season
    const seasonId = (await getCurrentSeason()).seasonId;
    const { data: currentSeasonTeams } = await restGet(
      `/team/summary?cayenneExp=seasonId=${seasonId}`
    );
    const currentSeasonTeamIds = new Set(
      currentSeasonTeams.map((team) => team.teamId)
    );
    const { error: team_seasonError } = await supabase
      .from("team_season")
      .upsert(
        [...currentSeasonTeamIds].map((id) => ({ teamId: id, seasonId }))
      );
    if (team_seasonError) throw team_seasonError;

    res.status(200).end("successfully updated the teams table");
  } catch (e: any) {
    res.status(400).end(e.message);
  }
}
