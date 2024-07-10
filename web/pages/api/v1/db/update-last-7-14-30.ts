import { NextApiRequest, NextApiResponse } from "next";
import supabase from "lib/supabase";
import Fetch from "lib/cors-fetch";
import { format, parseISO, addDays, isBefore } from "date-fns";
import { getCurrentSeason } from "lib/NHL/server";
import {
  lastPerSummarySkaterStat,
  lastPerSkatersBio,
  lastPerRealtimeSkaterStat,
  lastPerFaceoffSkaterStat,
  lastPerFaceOffWinLossSkaterStat,
  lastPerGoalsForAgainstSkaterStat,
  lastPerPenaltySkaterStat,
  lastPerPenaltyKillSkaterStat,
  lastPerPowerPlaySkaterStat,
  lastPerPuckPossessionSkaterStat,
  lastPerSatCountSkaterStat,
  lastPerSatPercentageSkaterStat,
  lastPerScoringRatesSkaterStat,
  lastPerScoringCountsSkaterStat,
  lastPerShotTypeSkaterStat,
  lastPerToiSkaterStat,
} from "lib/NHL/types";

// Define the structure of the NHL API response for skater stats
interface NHLApiResponse {
  data:
    | lastPerSummarySkaterStat[]
    | lastPerSkatersBio[]
    | lastPerRealtimeSkaterStat[]
    | lastPerFaceoffSkaterStat[]
    | lastPerFaceOffWinLossSkaterStat[]
    | lastPerGoalsForAgainstSkaterStat[]
    | lastPerPenaltySkaterStat[]
    | lastPerPenaltyKillSkaterStat[]
    | lastPerPowerPlaySkaterStat[]
    | lastPerPuckPossessionSkaterStat[]
    | lastPerSatCountSkaterStat[]
    | lastPerSatPercentageSkaterStat[]
    | lastPerScoringRatesSkaterStat[]
    | lastPerScoringCountsSkaterStat[]
    | lastPerShotTypeSkaterStat[]
    | lastPerToiSkaterStat[];
}

// Function to fetch data from the NHL API
async function fetchNHLApiData(urls: string[]): Promise<NHLApiResponse[]> {
  return Promise.all(urls.map((url) => Fetch(url).then((res) => res.json())));
}

// Function to fetch all skater data for a specific date
async function fetchAllDataForDate(formattedDate: string, limit: number) {
  let start = 0;
  let moreDataAvailable = true;
  const allStats: { [key: string]: any[] } = {
    skaterStats: [],
    skatersBio: [],
    miscSkaterStats: [],
    faceOffStats: [],
    faceoffWinLossStats: [],
    goalsForAgainstStats: [],
    penaltiesStats: [],
    penaltyKillStats: [],
    powerPlayStats: [],
    puckPossessionStats: [],
    satCountsStats: [],
    satPercentagesStats: [],
    scoringRatesStats: [],
    scoringPerGameStats: [],
    shotTypeStats: [],
    timeOnIceStats: [],
  };

  const endpoints = [
    "skater/summary",
    "skater/bios",
    "skater/realtime",
    "skater/faceoffpercentages",
    "skater/faceoffwins",
    "skater/goalsForAgainst",
    "skater/penalties",
    "skater/penaltykill",
    "skater/powerplay",
    "skater/puckPossessions",
    "skater/summaryshooting",
    "skater/percentages",
    "skater/scoringRates",
    "skater/scoringpergame",
    "skater/shottype",
    "skater/timeonice",
  ];

  while (moreDataAvailable) {
    const urls = endpoints.map(
      (endpoint) =>
        `https://api.nhle.com/stats/rest/en/${endpoint}?isAggregate=false&isGame=true&start=${start}&limit=100&cayenneExp=gameDate%3C=%22${formattedDate}%2023%3A59%3A59%22%20and%20gameDate%3E=%22${formattedDate}%22`
    );

    const responses = await fetchNHLApiData(urls);

    responses.forEach((response, index) => {
      const key = Object.keys(allStats)[index];
      allStats[key] = allStats[key].concat(response.data);
    });

    moreDataAvailable = responses.some(
      (response) => response.data.length === limit
    );
    start += limit;
  }

  return allStats;
}

// Function to upsert skater stats into the Supabase database
async function upsertSkaterStats(stats: any, date: string) {
  for (const stat of stats.skaterStats) {
    const existingRecord = await supabase
      .from("wgo_skater_stats_last_30")
      .select("*")
      .eq("player_id", stat.playerId)
      .single();

    const bioStats = stats.skatersBio.find(
      (aStat: any) => aStat.playerId === stat.playerId
    );
    const miscStats = stats.miscSkaterStats.find(
      (aStat: any) => aStat.playerId === stat.playerId
    );
    const faceOffStat = stats.faceOffStats.find(
      (aStat: any) => aStat.playerId === stat.playerId
    );
    const faceoffWinLossStat = stats.faceoffWinLossStats.find(
      (aStat: any) => aStat.playerId === stat.playerId
    );
    const goalsForAgainstStat = stats.goalsForAgainstStats.find(
      (aStat: any) => aStat.playerId === stat.playerId
    );
    const penaltiesStat = stats.penaltiesStats.find(
      (aStat: any) => aStat.playerId === stat.playerId
    );
    const penaltyKillStat = stats.penaltyKillStats.find(
      (aStat: any) => aStat.playerId === stat.playerId
    );
    const powerPlayStat = stats.powerPlayStats.find(
      (aStat: any) => aStat.playerId === stat.playerId
    );
    const puckPossessionStat = stats.puckPossessionStats.find(
      (aStat: any) => aStat.playerId === stat.playerId
    );
    const satCountsStat = stats.satCountsStats.find(
      (aStat: any) => aStat.playerId === stat.playerId
    );
    const satPercentagesStat = stats.satPercentagesStats.find(
      (aStat: any) => aStat.playerId === stat.playerId
    );
    const scoringRatesStat = stats.scoringRatesStats.find(
      (aStat: any) => aStat.playerId === stat.playerId
    );
    const scoringPerGameStat = stats.scoringPerGameStats.find(
      (aStat: any) => aStat.playerId === stat.playerId
    );
    const shotTypeStat = stats.shotTypeStats.find(
      (aStat: any) => aStat.playerId === stat.playerId
    );
    const timeOnIceStat = stats.timeOnIceStats.find(
      (aStat: any) => aStat.playerId === stat.playerId
    );

    const mergedData = {
      ...existingRecord,
      ...stat,
      player_id: stat.playerId,
      player_name: stat.skaterFullName,
      date,
      shoots_catches: stat.shootsCatches,
      position_code: stat.positionCode,
      games_played: stat.gamesPlayed,
      points: stat.points,
      points_per_game: stat.pointsPerGame,
      goals: stat.goals,
      assists: stat.assists,
      shots: stat.shots,
      shooting_percentage: stat.shootingPct,
      plus_minus: stat.plusMinus,
      ot_goals: stat.otGoals,
      gw_goals: stat.gameWinningGoals,
      fow_percentage: stat.faceoffWinPct,
      toi_per_game: stat.timeOnIcePerGame,
      birth_date: bioStats?.birthDate,
      current_team_abbreviation: bioStats?.currentTeamAbbrev,
      current_team_name: bioStats?.currentTeamName,
      birth_city: bioStats?.birthCity,
      birth_country: bioStats?.birthCountryCode,
      height: bioStats?.height,
      weight: bioStats?.weight,
      draft_year: bioStats?.draftYear,
      draft_round: bioStats?.draftRound,
      draft_overall: bioStats?.draftOverall,
      first_season_for_game_type: bioStats?.firstSeasonForGameType,
      nationality_code: bioStats?.nationalityCode,
      blocked_shots: miscStats?.blockedShots,
      blocks_per_60: miscStats?.blockedShotsPer60,
      empty_net_assists: miscStats?.emptyNetAssists,
      empty_net_goals: miscStats?.emptyNetGoals,
      empty_net_points: miscStats?.emptyNetPoints,
      first_goals: miscStats?.firstGoals,
      giveaways: miscStats?.giveaways,
      giveaways_per_60: miscStats?.giveawaysPer60,
      hits: miscStats?.hits,
      hits_per_60: miscStats?.hitsPer60,
      missed_shot_crossbar: miscStats?.missedShotCrossbar,
      missed_shot_goal_post: miscStats?.missedShotGoalpost,
      missed_shot_over_net: miscStats?.missedShotOverNet,
      missed_shot_short_side: miscStats?.missedShotShort,
      missed_shot_wide_of_net: miscStats?.missedShotWideOfNet,
      missed_shots: miscStats?.missedShots,
      takeaways: miscStats?.takeaways,
      takeaways_per_60: miscStats?.takeawaysPer60,
      d_zone_fo_percentage: faceOffStat?.defensiveZoneFaceoffPct,
      d_zone_faceoffs: faceOffStat?.defensiveZoneFaceoffs,
      n_zone_fo_percentage: faceOffStat?.neutralZoneFaceoffPct,
      n_zone_faceoffs: faceOffStat?.neutralZoneFaceoffs,
      o_zone_fo_percentage: faceOffStat?.offensiveZoneFaceoffPct,
      o_zone_faceoffs: faceOffStat?.offensiveZoneFaceoffs,
      faceoff_wins: faceoffWinLossStat?.faceoffWins,
      faceoff_win_pct: faceoffWinLossStat?.faceoffWinPct,
      faceoff_losses: faceoffWinLossStat?.faceoffLosses,
      goals_against: goalsForAgainstStat?.goalsAgainst,
      goals_for: goalsForAgainstStat?.goalsFor,
      penalties_drawn: penaltiesStat?.penaltiesDrawn,
      penalties_drawn_per_60: penaltiesStat?.penaltiesDrawnPer60,
      penalties_taken: penaltiesStat?.penaltiesTaken,
      penalties_taken_per_60: penaltiesStat?.penaltiesTakenPer60,
      shots_against: penaltyKillStat?.pkShotsAgainst,
      pk_save_percentage: penaltyKillStat?.pkSavePct,
      pk_save_percentage_expected: penaltyKillStat?.pkSavePctExpected,
      pk_sh_goals: penaltyKillStat?.pkShGoals,
      sh_assists: penaltyKillStat?.pkShAssists,
      sh_points: penaltyKillStat?.pkShPoints,
      sh_shots: penaltyKillStat?.pkShShots,
      sh_time_on_ice: penaltyKillStat?.pkTimeOnIce,
      sh_time_on_ice_per_game: penaltyKillStat?.pkTimeOnIcePerGame,
      pp_shots: powerPlayStat?.ppShots,
      pp_assists: powerPlayStat?.ppAssists,
      pp_points: powerPlayStat?.ppPoints,
      pp_sh_goals: powerPlayStat?.ppShGoals,
      pp_time_on_ice: powerPlayStat?.ppTimeOnIce,
      pp_time_on_ice_per_game: powerPlayStat?.ppTimeOnIcePerGame,
      pp_shot_attempts: powerPlayStat?.ppShotAttempts,
      sa_fenwick: puckPossessionStat?.satCounts,
      sa_fenwick_per_60: puckPossessionStat?.satCountsPer60,
      sa_corsi: puckPossessionStat?.satPercentages,
      sa_corsi_per_60: puckPossessionStat?.satPercentagesPer60,
      sa_scoring_chances: puckPossessionStat?.scoringChancesFor,
      sa_scoring_chances_per_60: puckPossessionStat?.scoringChancesForPer60,
      sa_high_danger_chances: puckPossessionStat?.highDangerScoringChancesFor,
      sa_high_danger_chances_per_60:
        puckPossessionStat?.highDangerScoringChancesForPer60,
      shots_on_goal: satCountsStat?.shotsOnGoal,
      shot_attempts: satCountsStat?.shotAttempts,
      shot_attempts_per_60: satCountsStat?.shotAttemptsPer60,
      scoring_chances: satPercentagesStat?.scoringChances,
      scoring_chances_per_60: satPercentagesStat?.scoringChancesPer60,
      scoring_rate: scoringRatesStat?.scoringRates,
      scoring_rates_per_60: scoringRatesStat?.scoringRatesPer60,
      scoring_per_game: scoringPerGameStat?.scoringPerGame,
      sh_crossbar: shotTypeStat?.missedShotCrossbar,
      sh_goal_post: shotTypeStat?.missedShotGoalPost,
      sh_over_net: shotTypeStat?.missedShotOverNet,
      sh_short_side: shotTypeStat?.missedShotShort,
      sh_wide_of_net: shotTypeStat?.missedShotWideOfNet,
      shot_type: shotTypeStat?.shotType,
    };

    await supabase
      .from("wgo_skater_stats_last_30")
      .upsert(mergedData, { onConflict: "player_id, date" });
  }
}

// Main handler for the API endpoint
const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res
        .status(400)
        .json({ error: "startDate and endDate are required." });
    }

    const currentSeason = await getCurrentSeason();

    const formattedStartDate = format(
      parseISO(startDate as string),
      "yyyy-MM-dd"
    );
    const formattedEndDate = format(parseISO(endDate as string), "yyyy-MM-dd");
    const limit = 100;

    if (
      isBefore(
        parseISO(startDate as string),
        parseISO(currentSeason.regularSeasonStartDate)
      )
    ) {
      return res.status(400).json({
        error: `startDate cannot be before the regular season start date of ${currentSeason.regularSeasonStartDate}.`,
      });
    }

    let currentDate = parseISO(formattedStartDate);

    while (
      isBefore(currentDate, parseISO(formattedEndDate)) ||
      format(currentDate, "yyyy-MM-dd") === formattedEndDate
    ) {
      const formattedDate = format(currentDate, "yyyy-MM-dd");
      const skaterStats = await fetchAllDataForDate(formattedDate, limit);
      await upsertSkaterStats(skaterStats, formattedDate);
      currentDate = addDays(currentDate, 1);
    }

    res.status(200).json({ message: "Data fetched and stored successfully." });
  } catch (error) {
    console.error("Error in handler:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export default handler;
