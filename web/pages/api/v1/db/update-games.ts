import { get } from "lib/NHL/base";
import { getCurrentSeason } from "lib/NHL/server";
import supabase from "lib/supabase";
import adminOnly from "utils/adminOnlyMiddleware";

export default adminOnly(async (req, res) => {
  const { supabase } = req;
  let season = { seasonId: 0 };
  if (req.query.seasonId) {
    const seasonId = Number(req.query.seasonId);
    season.seasonId = seasonId;
  } else {
    season = await getCurrentSeason();
  }
  try {
    const teams = (await getAllTeams(season.seasonId)) ?? [];
    const tasks = teams.map(async (team) => {
      const games = await getGamesByTeam(team.abbreviation, season.seasonId);
      return games;
    });
    let games = (await Promise.all(tasks)).flat(1);
    const gamesMap: any = {};
    games.forEach((game) => {
      gamesMap[game.id] = game;
    });

    games = Object.values(gamesMap);
    // filter out games played by non-nhl teams
    const teamIds = new Set(teams.map((team) => team.id));
    games = games.filter(
      (game) => teamIds.has(game.homeTeam.id) && teamIds.has(game.awayTeam.id)
    );

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
    console.error(e);
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

async function getAllTeams(
  season: number
): Promise<{ abbreviation: string; id: number }[]> {
  const { data: teamIds } = await supabase
    .from("team_season")
    .select("teamId")
    .eq("seasonId", season)
    .throwOnError();
  const { data } = await supabase
    .from("teams")
    .select("id, abbreviation")
    .in("id", teamIds?.map(({ teamId }) => teamId) ?? [])
    .throwOnError();

  return data!;
}
