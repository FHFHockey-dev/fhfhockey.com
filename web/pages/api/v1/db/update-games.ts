import { get } from "lib/NHL/base";
import { getCurrentSeason } from "lib/NHL/server";
import supabase from "lib/supabase";
import adminOnly from "utils/adminOnlyMiddleware";

export default adminOnly(async (req, res) => {
  const { supabase } = req;
  try {
    const season = await getCurrentSeason();
    const teams = (await getAllTeams(season.seasonId)) ?? [];
    const tasks = teams.map(async (abbreviation) => {
      const games = await getGamesByTeam(abbreviation, season.seasonId);
      return games;
    });
    let games = (await Promise.all(tasks)).flat(1);
    const gamesMap: any = {};
    games.forEach((game) => {
      gamesMap[game.id] = game;
    });

    games = Object.values(gamesMap);

    await supabase
      .from("games")
      .upsert(
        games.map((game: any) => ({
          id: game.id,
          date: game.gameDate,
          seasonId: season.seasonId,
          startTime: game.startTimeUTC,
          type: game.gameType,
          homeTeamId: game.homeTeam.id,
          awayTeamId: game.awayTeam.id,
        }))
      )
      .throwOnError();

    res.status(200).json({
      message:
        "Successfully updated the games table. " +
        `${games.length} games in ${season.seasonId}.`,
      success: true,
    });
  } catch (e: any) {
    res.status(400).json({
      message: e.message,
      success: false,
    });
  }
});

async function getGamesByTeam(abbreviation: string, season: number) {
  const { games } = await get(
    `/club-schedule-season/${abbreviation}/${season}`
  );

  return games;
}

async function getAllTeams(season: number): Promise<string[]> {
  const { data: teamIds } = await supabase
    .from("team_season")
    .select("teamId")
    .eq("seasonId", season)
    .throwOnError();
  const { data: abbreviations } = await supabase
    .from("teams")
    .select("abbreviation")
    .in("id", teamIds?.map(({ teamId }) => teamId) ?? [])
    .throwOnError();

  return abbreviations?.map(({ abbreviation }) => abbreviation) ?? [];
}
