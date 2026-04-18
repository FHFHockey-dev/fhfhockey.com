import { withCronJobAudit } from "lib/cron/withCronJobAudit";
import { get } from "lib/NHL/base";
import { getCurrentSeason } from "lib/NHL/server";
import type { NextApiRequest, NextApiResponse } from "next";
import supabase from "lib/supabase/server";
import { fetchCurrentSeason } from "utils/fetchCurrentSeason";

import adminOnly from "utils/adminOnlyMiddleware";

export default withCronJobAudit(adminOnly(async (req, res) => {
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
    const taskResults = await Promise.allSettled(
      teams.map(async (team) => ({
        abbreviation: team.abbreviation,
        games: await getGamesByTeam(team.abbreviation, season.seasonId)
      }))
    );
    const failedTeams: Array<{ abbreviation: string; message: string }> = [];
    let games = taskResults.flatMap((result, index) => {
      const abbreviation = teams[index]?.abbreviation ?? "unknown";
      if (result.status === "fulfilled") {
        return result.value.games;
      }

      failedTeams.push({
        abbreviation,
        message: result.reason?.message ?? String(result.reason)
      });
      return [];
    });

    if (games.length === 0) {
      throw new Error(
        failedTeams.length > 0
          ? `Failed to fetch games for every team. ${failedTeams
              .map((failure) => `${failure.abbreviation}: ${failure.message}`)
              .join("; ")}`
          : "No games returned for any team."
      );
    }

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
          awayTeamId: game.awayTeam.id
        }))
      )
      .throwOnError();

    res.status(200).json({
      message:
        "Successfully updated the games table. " +
        `${games.length} games in ${season.seasonId}.`,
      success: true,
      partialFailures: failedTeams.length,
      warnings:
        failedTeams.length > 0
          ? failedTeams.map(
              (failure) => `${failure.abbreviation}: ${failure.message}`
            )
          : []
    });
  } catch (e: any) {
    console.error(e);
    res.status(400).json({
      message: e.message,
      success: false
    });
  }
}));

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
