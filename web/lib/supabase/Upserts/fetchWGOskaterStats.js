// lib/supabase/fetchWGOskaterData.js

// DEV NOTE
// For days that fail, those days need to be retried after the script has finished running
// maybe an array that stores the failed dates and then a loop that runs through the failed dates

require("dotenv").config({ path: "../../../.env.local" });

const { createClient } = require("@supabase/supabase-js");
const fetch = require("node-fetch");
const { parseISO, format, addDays, isBefore } = require("date-fns");

// Simplified Fetch (cors-fetch) function for Node.js that isn't imported
async function Fetch(url) {
  const response = await fetch(url);
  return response.json();
}

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLIC_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Function to get the most recent date from the database
async function getMostRecentDate() {
  const { data, error } = await supabase
    .from("wgo_skater_stats")
    .select("date")
    .order("date", { ascending: false })
    .limit(1);

  if (error) {
    console.error("Error fetching most recent date:", error);
    return null;
  }

  return data.length > 0 ? data[0].date : null;
}

async function fetchAllDataForDate(formattedDate, limit) {
  let start = 0;
  let moreDataAvailable = true;
  // Initialize arrays to store data
  let skaterStats = [];
  let bioStats = [];
  let miscSkaterStats = [];
  let faceOffStats = [];
  let faceOffWLStats = [];
  let goalsForAgainstStats = [];
  let penaltiesStats = [];
  let penaltyKillStats = [];
  let powerPlayStats = [];
  let puckPossessionStats = [];
  let satCountsStats = [];
  let satPercentagesStats = [];
  let scoringRatesStats = [];
  let scoringPerGameStats = [];
  let shotTypeStats = [];
  let timeOnIceStats = [];

  while (moreDataAvailable) {
    const skaterStatsUrl = `https://api.nhle.com/stats/rest/en/skater/summary?isAggregate=true&isGame=true&sort=%5B%7B%22property%22:%22points%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22goals%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22assists%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=${limit}&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameDate%3C=%22${formattedDate}%2023:59:59%22%20and%20gameDate%3E=%22${formattedDate}%22%20and%20gameTypeId=2`;
    const bioStatsUrl = `https://api.nhle.com/stats/rest/en/skater/bios?isAggregate=false&isGame=true&sort=%5B%7B%22property%22:%22lastName%22,%22direction%22:%22ASC_CI%22%7D,%7B%22property%22:%22skaterFullName%22,%22direction%22:%22ASC_CI%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=${limit}&cayenneExp=gameDate%3C=%22${formattedDate}%2023:59:59%22%20and%20gameDate%3E=%22${formattedDate}%22%20and%20gameTypeId=2`;
    const miscSkaterStatsUrl = `https://api.nhle.com/stats/rest/en/skater/realtime?isAggregate=true&isGame=true&sort=%5B%7B%22property%22:%22hits%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=${limit}&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameDate%3C=%22${formattedDate}%2023:59:59%22%20and%20gameDate%3E=%22${formattedDate}%22%20and%20gameTypeId=2`;
    const faceOffStatsUrl = `https://api.nhle.com/stats/rest/en/skater/faceoffpercentages?isAggregate=true&isGame=true&sort=%5B%7B%22property%22:%22totalFaceoffs%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=${limit}&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameDate%3C=%22${formattedDate}%2023:59:59%22%20and%20gameDate%3E=%22${formattedDate}%22%20and%20gameTypeId=2`;
    const faceoffWinLossUrl = `https://api.nhle.com/stats/rest/en/skater/faceoffwins?isAggregate=true&isGame=true&sort=%5B%7B%22property%22:%22totalFaceoffWins%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22faceoffWinPct%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=${limit}&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameDate%3C=%22${formattedDate}%2023:59:59%22%20and%20gameDate%3E=%22${formattedDate}%22%20and%20gameTypeId=2`;
    const goalsForAgainstUrl = `https://api.nhle.com/stats/rest/en/skater/goalsForAgainst?isAggregate=true&isGame=true&sort=%5B%7B%22property%22:%22evenStrengthGoalDifference%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=${limit}&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameDate%3C=%22${formattedDate}%2023:59:59%22%20and%20gameDate%3E=%22${formattedDate}%22%20and%20gameTypeId=2`;
    const penaltiesUrl = `https://api.nhle.com/stats/rest/en/skater/penalties?isAggregate=true&isGame=true&sort=%5B%7B%22property%22:%22penaltyMinutes%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=${limit}&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameDate%3C=%22${formattedDate}%2023:59:59%22%20and%20gameDate%3E=%22${formattedDate}%22%20and%20gameTypeId=2`;
    const penaltyKillUrl = `https://api.nhle.com/stats/rest/en/skater/penaltykill?isAggregate=true&isGame=true&sort=%5B%7B%22property%22:%22shTimeOnIce%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=${limit}&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameDate%3C=%22${formattedDate}%2023:59:59%22%20and%20gameDate%3E=%22${formattedDate}%22%20and%20gameTypeId=2`;
    const powerPlayUrl = `https://api.nhle.com/stats/rest/en/skater/powerplay?isAggregate=true&isGame=true&sort=%5B%7B%22property%22:%22ppTimeOnIce%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=${limit}&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameDate%3C=%22${formattedDate}%2023:59:59%22%20and%20gameDate%3E=%22${formattedDate}%22%20and%20gameTypeId=2`;
    const puckPossessionUrl = `https://api.nhle.com/stats/rest/en/skater/puckPossessions?isAggregate=true&isGame=true&sort=%5B%7B%22property%22:%22satPct%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=${limit}&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameDate%3C=%22${formattedDate}%2023:59:59%22%20and%20gameDate%3E=%22${formattedDate}%22%20and%20gameTypeId=2`;
    const satCountsUrl = `https://api.nhle.com/stats/rest/en/skater/summaryshooting?isAggregate=true&isGame=true&sort=%5B%7B%22property%22:%22satTotal%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22usatTotal%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=${limit}&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameDate%3C=%22${formattedDate}%2023:59:59%22%20and%20gameDate%3E=%22${formattedDate}%22%20and%20gameTypeId=2`;
    const satPercentagesUrl = `https://api.nhle.com/stats/rest/en/skater/percentages?isAggregate=true&isGame=true&sort=%5B%7B%22property%22:%22satPercentage%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=${limit}&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameDate%3C=%22${formattedDate}%2023:59:59%22%20and%20gameDate%3E=%22${formattedDate}%22%20and%20gameTypeId=2`;
    const scoringRatesUrl = `https://api.nhle.com/stats/rest/en/skater/scoringRates?isAggregate=true&isGame=true&sort=%5B%7B%22property%22:%22pointsPer605v5%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22goalsPer605v5%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=${limit}&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameDate%3C=%22${formattedDate}%2023:59:59%22%20and%20gameDate%3E=%22${formattedDate}%22%20and%20gameTypeId=2`;
    const scoringPerGameUrl = `https://api.nhle.com/stats/rest/en/skater/scoringpergame?isAggregate=true&isGame=true&sort=%5B%7B%22property%22:%22pointsPerGame%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22goalsPerGame%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=${limit}&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameDate%3C=%22${formattedDate}%2023:59:59%22%20and%20gameDate%3E=%22${formattedDate}%22%20and%20gameTypeId=2`;
    const shotTypeUrl = `https://api.nhle.com/stats/rest/en/skater/shottype?isAggregate=true&isGame=true&sort=%5B%7B%22property%22:%22shootingPct%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22shootingPctBat%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=${limit}&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameDate%3C=%22${formattedDate}%2023:59:59%22%20and%20gameDate%3E=%22${formattedDate}%22%20and%20gameTypeId=2`;
    const timeOnIceUrl = `https://api.nhle.com/stats/rest/en/skater/timeonice?isAggregate=true&isGame=true&sort=%5B%7B%22property%22:%22timeOnIce%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=${limit}&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameDate%3C=%22${formattedDate}%2023:59:59%22%20and%20gameDate%3E=%22${formattedDate}%22%20and%20gameTypeId=2`;

    const [
      skaterStatsResponse,
      bioStatsResponse,
      miscSkaterStatsResponse,
      faceOffStatsResponse,
      faceOffWinLossResponse,
      goalsForAgainstResponse,
      penaltiesResponse,
      penaltyKillResponse,
      powerPlayResponse,
      puckPossessionResponse,
      satCountsResponse,
      satPercentagesResponse,
      scoringRatesResponse,
      scoringPerGameResponse,
      shotTypeResponse,
      timeOnIceResponse
    ] = await Promise.all([
      Fetch(skaterStatsUrl),
      Fetch(bioStatsUrl),
      Fetch(miscSkaterStatsUrl),
      Fetch(faceOffStatsUrl),
      Fetch(faceoffWinLossUrl),
      Fetch(goalsForAgainstUrl),
      Fetch(penaltiesUrl),
      Fetch(penaltyKillUrl),
      Fetch(powerPlayUrl),
      Fetch(puckPossessionUrl),
      Fetch(satCountsUrl),
      Fetch(satPercentagesUrl),
      Fetch(scoringRatesUrl),
      Fetch(scoringPerGameUrl),
      Fetch(shotTypeUrl),
      Fetch(timeOnIceUrl)
    ]);

    skaterStats = skaterStats.concat(skaterStatsResponse.data);
    bioStats = bioStats.concat(bioStatsResponse.data);
    miscSkaterStats = miscSkaterStats.concat(miscSkaterStatsResponse.data);
    faceOffStats = faceOffStats.concat(faceOffStatsResponse.data);
    faceOffWLStats = faceOffWLStats.concat(faceOffWinLossResponse.data);
    goalsForAgainstStats = goalsForAgainstStats.concat(
      goalsForAgainstResponse.data
    );
    penaltiesStats = penaltiesStats.concat(penaltiesResponse.data);
    penaltyKillStats = penaltyKillStats.concat(penaltyKillResponse.data);
    powerPlayStats = powerPlayStats.concat(powerPlayResponse.data);
    puckPossessionStats = puckPossessionStats.concat(
      puckPossessionResponse.data
    );
    satCountsStats = satCountsStats.concat(satCountsResponse.data);
    satPercentagesStats = satPercentagesStats.concat(
      satPercentagesResponse.data
    );
    scoringRatesStats = scoringRatesStats.concat(scoringRatesResponse.data);
    scoringPerGameStats = scoringPerGameStats.concat(
      scoringPerGameResponse.data
    );
    shotTypeStats = shotTypeStats.concat(shotTypeResponse.data);
    timeOnIceStats = timeOnIceStats.concat(timeOnIceResponse.data);

    moreDataAvailable =
      skaterStatsResponse.data.length === limit ||
      bioStatsResponse.data.length === limit ||
      miscSkaterStatsResponse.data.length === limit ||
      faceOffStatsResponse.data.length === limit ||
      faceOffWinLossResponse.data.length === limit ||
      goalsForAgainstResponse.data.length === limit ||
      penaltiesResponse.data.length === limit ||
      penaltyKillResponse.data.length === limit ||
      powerPlayResponse.data.length === limit ||
      puckPossessionResponse.data.length === limit ||
      satCountsResponse.data.length === limit ||
      satPercentagesResponse.data.length === limit ||
      scoringRatesResponse.data.length === limit ||
      scoringPerGameResponse.data.length === limit ||
      shotTypeResponse.data.length === limit ||
      timeOnIceResponse.data.length === limit;

    start += limit;
  }

  return {
    skaterStats,
    bioStats,
    miscSkaterStats,
    faceOffStats,
    faceOffWLStats,
    goalsForAgainstStats,
    penaltiesStats,
    penaltyKillStats,
    powerPlayStats,
    puckPossessionStats,
    satCountsStats,
    satPercentagesStats,
    scoringRatesStats,
    scoringPerGameStats,
    shotTypeStats,
    timeOnIceStats
  };
}

async function fetchNHLSkaterData() {
  let seasonStart = "2023-10-10";
  const limit = 100;

  // Get the most recent date from the database
  const mostRecentDate = await getMostRecentDate();

  let currentDate = mostRecentDate
    ? addDays(parseISO(mostRecentDate), 1)
    : parseISO(seasonStart);

  const today = new Date();

  while (
    isBefore(currentDate, today) ||
    currentDate.toISOString().split("T")[0] ===
      today.toISOString().split("T")[0]
  ) {
    let formattedDate = format(currentDate, "yyyy-MM-dd");
    console.log(`Fetching data for ${formattedDate}`);

    // Fetch schedule for the current date
    const scheduleResponse = await Fetch(
      `https://api-web.nhle.com/v1/schedule/${formattedDate}`
    );

    // Extract the current season
    let currentSeason = null;

    if (
      scheduleResponse.gameWeek &&
      scheduleResponse.gameWeek.length > 0 &&
      scheduleResponse.gameWeek[0].games &&
      scheduleResponse.gameWeek[0].games.length > 0
    ) {
      currentSeason = scheduleResponse.gameWeek[0].games[0].season;
    } else {
      console.warn(`No games found for date ${formattedDate}`);
      // Skip dates with no games
      currentDate = addDays(currentDate, 1);
      continue;
    }

    const {
      skaterStats,
      bioStats,
      miscSkaterStats,
      faceOffStats,
      faceOffWLStats,
      goalsForAgainstStats,
      penaltiesStats,
      penaltyKillStats,
      powerPlayStats,
      puckPossessionStats,
      satCountsStats,
      satPercentagesStats,
      scoringRatesStats,
      scoringPerGameStats,
      shotTypeStats,
      timeOnIceStats
    } = await fetchAllDataForDate(formattedDate, limit);

    for (const [index, stat] of skaterStats.entries()) {
      const bioStat = bioStats.find(
        (bStat) => bStat.playerId === stat.playerId
      );
      const miscStats = miscSkaterStats.find(
        (mStat) => mStat.playerId === stat.playerId
      );
      const faceOffStat = faceOffStats.find(
        (fStat) => fStat.playerId === stat.playerId
      );
      const faceOffWLStat = faceOffWLStats.find(
        (fwlStat) => fwlStat.playerId === stat.playerId
      );
      const goalsForAgainstStat = goalsForAgainstStats.find(
        (gfaStat) => gfaStat.playerId === stat.playerId
      );
      const penaltiesStat = penaltiesStats.find(
        (pStat) => pStat.playerId === stat.playerId
      );
      const penaltyKillStat = penaltyKillStats.find(
        (pkStat) => pkStat.playerId === stat.playerId
      );
      const powerPlayStat = powerPlayStats.find(
        (ppStat) => ppStat.playerId === stat.playerId
      );
      const puckPossessionStat = puckPossessionStats.find(
        (possStat) => possStat.playerId === stat.playerId
      );
      const satCountsStat = satCountsStats.find(
        (scStat) => scStat.playerId === stat.playerId
      );
      const satPercentagesStat = satPercentagesStats.find(
        (spStat) => spStat.playerId === stat.playerId
      );
      const scoringRatesStat = scoringRatesStats.find(
        (srStat) => srStat.playerId === stat.playerId
      );
      const scoringPerGameStat = scoringPerGameStats.find(
        (spgStat) => spgStat.playerId === stat.playerId
      );
      const shotTypeStat = shotTypeStats.find(
        (stStat) => stStat.playerId === stat.playerId
      );
      const timeOnIceStat = timeOnIceStats.find(
        (toiStat) => toiStat.playerId === stat.playerId
      );

      let upsertedStats = ["skaterStatsResponse"];

      if (bioStat) {
        upsertedStats.push("bioStatsResponse");
      }
      if (miscStats) {
        upsertedStats.push("miscSkaterStatsResponse");
      }
      if (faceOffStat) {
        upsertedStats.push("faceOffStatsResponse");
      }
      if (faceOffWLStat) {
        upsertedStats.push("faceOffWLStatsResponse");
      }
      if (goalsForAgainstStat) {
        upsertedStats.push("goalsForAgainstResponse");
      }
      if (penaltiesStat) {
        upsertedStats.push("penaltiesResponse");
      }
      if (penaltyKillStat) {
        upsertedStats.push("penaltyKillResponse");
      }
      if (powerPlayStat) {
        upsertedStats.push("powerPlayResponse");
      }
      if (puckPossessionStat) {
        upsertedStats.push("puckPossessionResponse");
      }
      if (satCountsStat) {
        upsertedStats.push("satCountsResponse");
      }
      if (satPercentagesStat) {
        upsertedStats.push("satPercentagesResponse");
      }
      if (scoringRatesStat) {
        upsertedStats.push("scoringRatesResponse");
      }
      if (scoringPerGameStat) {
        upsertedStats.push("scoringPerGameResponse");
      }
      if (shotTypeStat) {
        upsertedStats.push("shotTypeResponse");
      }
      if (timeOnIceStat) {
        upsertedStats.push("timeOnIceResponse");
      }

      console.log(
        `(${index + 1}/${
          skaterStats.length
        }) -- ${formattedDate} -- Upserting stats for player ID: ${
          stat.playerId
        }, Name: ${stat.skaterFullName} [${upsertedStats.join(", ")}]`
      );

      try {
        const response = await supabase.from("wgo_skater_stats").upsert({
          // Summary stats from skaterStatsResponse (stat)
          player_id: stat.playerId, // int
          player_name: stat.skaterFullName, // text
          date: formattedDate, // date
          shoots_catches: stat.shootsCatches, // text
          position_code: stat.positionCode, // text
          games_played: stat.gamesPlayed, // int
          points: stat.points, // int
          points_per_game: stat.pointsPerGame, // float
          goals: stat.goals, // int
          assists: stat.assists, // int
          shots: stat.shots, // int
          shooting_percentage: stat.shootingPct, // float
          plus_minus: stat.plusMinus, // int
          ot_goals: stat.otGoals, // int
          gw_goals: stat.gameWinningGoals, // int
          pp_points: stat.ppPoints, // int
          fow_percentage: stat.faceoffWinPct, // float
          toi_per_game: stat.timeOnIcePerGame, // float
          // Bio stats from bioStatsResponse (bioStat)
          birth_city: bioStat?.birthCity ?? null, // text
          birth_date: bioStat?.birthDate ?? null, // date
          current_team_abbreviation: bioStat?.currentTeamAbbrev ?? null, // text
          current_team_name: bioStat?.currentTeamName ?? null, // text
          draft_overall: bioStat?.draftOverall ?? null, // int
          draft_round: bioStat?.draftRound ?? null, // int
          draft_year: bioStat?.draftYear ?? null, // int
          first_season_for_game_type: bioStat?.firstSeasonForGameType ?? null, // int
          nationality_code: bioStat?.nationalityCode ?? null, // text
          weight: bioStat?.weight ?? null, // int
          height: bioStat?.height ?? null, // int
          birth_country: bioStat?.birthCountryCode ?? null, // text
          season_id: currentSeason, // int

          // Realtime stats from miscSkaterStatsResponse (miscStats)
          blocked_shots: miscStats?.blockedShots ?? null, // int
          blocks_per_60: miscStats?.blockedShotsPer60 ?? null, // float
          empty_net_assists: miscStats?.emptyNetAssists ?? null, // int
          empty_net_goals: miscStats?.emptyNetGoals ?? null, // int
          empty_net_points: miscStats?.emptyNetPoints ?? null, // int
          first_goals: miscStats?.firstGoals ?? null, // int
          giveaways: miscStats?.giveaways ?? null, // int
          giveaways_per_60: miscStats?.giveawaysPer60 ?? null, // float
          hits: miscStats?.hits ?? null, // int
          hits_per_60: miscStats?.hitsPer60 ?? null, // float
          missed_shot_crossbar: miscStats?.missedShotCrossbar ?? null, // int
          missed_shot_goal_post: miscStats?.missedShotGoalpost ?? null, // int
          missed_shot_over_net: miscStats?.missedShotOverNet ?? null, // int
          missed_shot_short_side: miscStats?.missedShotShort ?? null, // int
          missed_shot_wide_of_net: miscStats?.missedShotWideOfNet ?? null, // int
          missed_shots: miscStats?.missedShots ?? null, // int
          takeaways: miscStats?.takeaways ?? null, // int
          takeaways_per_60: miscStats?.takeawaysPer60 ?? null, // float

          // Faceoff stats from faceOffStatsResponse (faceOffStat)
          d_zone_fo_percentage: faceOffStat?.defensiveZoneFaceoffPct ?? null, // float
          d_zone_faceoffs: faceOffStat?.defensiveZoneFaceoffs ?? null, // int
          ev_faceoff_percentage: faceOffStat?.evFaceoffPct ?? null, // float
          ev_faceoffs: faceOffStat?.evFaceoffs ?? null, // int
          n_zone_fo_percentage: faceOffStat?.neutralZoneFaceoffPct ?? null, // float
          n_zone_faceoffs: faceOffStat?.neutralZoneFaceoffs ?? null, // int
          o_zone_fo_percentage: faceOffStat?.offensiveZoneFaceoffPct ?? null, // float
          o_zone_faceoffs: faceOffStat?.offensiveZoneFaceoffs ?? null, // int
          pp_faceoff_percentage: faceOffStat?.ppFaceoffPct ?? null, // float
          pp_faceoffs: faceOffStat?.ppFaceoffs ?? null, // int
          sh_faceoff_percentage: faceOffStat?.shFaceoffPct ?? null, // float
          sh_faceoffs: faceOffStat?.shFaceoffs ?? null, // int
          total_faceoffs: faceOffStat?.totalFaceoffs ?? null, // int

          // Faceoff win/loss stats from faceOffWLStatsResponse (faceOffWLStat)
          d_zone_fol: faceOffWLStat?.defensiveZoneFaceoffLosses ?? null, // int
          d_zone_fow: faceOffWLStat?.defensiveZoneFaceoffWins ?? null, // int
          ev_fol: faceOffWLStat?.evFaceoffsLost ?? null, // int
          ev_fow: faceOffWLStat?.evFaceoffsWon ?? null, // int
          n_zone_fol: faceOffWLStat?.neutralZoneFaceoffLosses ?? null, // int
          n_zone_fow: faceOffWLStat?.neutralZoneFaceoffWins ?? null, // int
          o_zone_fol: faceOffWLStat?.offensiveZoneFaceoffLosses ?? null, // int
          o_zone_fow: faceOffWLStat?.offensiveZoneFaceoffWins ?? null, // int
          pp_fol: faceOffWLStat?.ppFaceoffsLost ?? null, // int
          pp_fow: faceOffWLStat?.ppFaceoffsWon ?? null, // int
          sh_fol: faceOffWLStat?.shFaceoffsLost ?? null, // int
          sh_fow: faceOffWLStat?.shFaceoffsWon ?? null, // int
          total_fol: faceOffWLStat?.totalFaceoffLosses ?? null, // int
          total_fow: faceOffWLStat?.totalFaceoffWins ?? null, // int

          // Goals for/against stats from goalsForAgainstResponse (goalsForAgainstStat)
          es_goal_diff: goalsForAgainstStat?.evenStrengthGoalDifference ?? null, // int
          es_goals_against:
            goalsForAgainstStat?.evenStrengthGoalsAgainst ?? null, // int
          es_goals_for: goalsForAgainstStat?.evenStrengthGoalsFor ?? null, // int
          es_goals_for_percentage:
            goalsForAgainstStat?.evenStrengthGoalsForPct ?? null, // float
          es_toi_per_game:
            goalsForAgainstStat?.evenStrengthTimeOnIcePerGame ?? null, // float
          pp_goals_against: goalsForAgainstStat?.powerPlayGoalsAgainst ?? null, // int
          pp_goals_for: goalsForAgainstStat?.powerPlayGoalFor ?? null, // int
          pp_toi_per_game:
            goalsForAgainstStat?.powerPlayTimeOnIcePerGame ?? null, // float
          sh_goals_against:
            goalsForAgainstStat?.shortHandedGoalsAgainst ?? null, // int
          sh_goals_for: goalsForAgainstStat?.shortHandedGoalsFor ?? null, // int
          sh_toi_per_game:
            goalsForAgainstStat?.shortHandedTimeOnIcePerGame ?? null, // float

          // Penalties stats from penaltiesResponse (penaltiesStat)
          game_misconduct_penalties:
            penaltiesStat?.gameMisconductPenalties ?? null, // int
          major_penalties: penaltiesStat?.majorPenalties ?? null, // int
          match_penalties: penaltiesStat?.matchPenalties ?? null, // int
          minor_penalties: penaltiesStat?.minorPenalties ?? null, // int
          misconduct_penalties: penaltiesStat?.misconductPenalties ?? null, // int
          net_penalties: penaltiesStat?.netPenalties ?? null, // int
          net_penalties_per_60: penaltiesStat?.netPenaltiesPer60 ?? null, // float
          penalties: penaltiesStat?.penalties ?? null, // int
          penalties_drawn: penaltiesStat?.penaltiesDrawn ?? null, // int
          penalties_drawn_per_60: penaltiesStat?.penaltiesDrawnPer60 ?? null, // float
          penalties_taken_per_60: penaltiesStat?.penaltiesTakenPer60 ?? null, // float
          penalty_minutes: penaltiesStat?.penaltyMinutes ?? null, // int
          penalty_minutes_per_toi:
            penaltiesStat?.penaltyMinutesPerTimeOnIce ?? null, // float
          penalty_seconds_per_game:
            penaltiesStat?.penaltySecondsPerGame ?? null, // float

          // Penalty kill stats from penaltyKillResponse (penaltyKillStat)
          pp_goals_against_per_60: penaltyKillStat?.ppGoalsAgainstPer60 ?? null, // float
          sh_assists: penaltyKillStat?.shAssists ?? null, // int
          sh_goals: penaltyKillStat?.shGoals ?? null, // int
          sh_points: penaltyKillStat?.shPoints ?? null, // int
          sh_goals_per_60: penaltyKillStat?.shGoalsPer60 ?? null, // float
          sh_individual_sat_for: penaltyKillStat?.shIndividualSatFor ?? null, // int
          sh_individual_sat_per_60:
            penaltyKillStat?.shIndividualSatForPer60 ?? null, // float
          sh_points_per_60: penaltyKillStat?.shPointsPer60 ?? null, // float
          sh_primary_assists: penaltyKillStat?.shPrimaryAssists ?? null, // int
          sh_primary_assists_per_60:
            penaltyKillStat?.shPrimaryAssistsPer60 ?? null, // float
          sh_secondary_assists: penaltyKillStat?.shSecondaryAssists ?? null, // int
          sh_secondary_assists_per_60:
            penaltyKillStat?.shSecondaryAssistsPer60 ?? null, // float
          sh_shooting_percentage: penaltyKillStat?.shShootingPct ?? null, // float
          sh_shots: penaltyKillStat?.shShots ?? null, // int
          sh_shots_per_60: penaltyKillStat?.shShotsPer60 ?? null, // float
          sh_time_on_ice: penaltyKillStat?.shTimeOnIce ?? null, // int
          sh_time_on_ice_pct_per_game:
            penaltyKillStat?.shTimeOnIcePctPerGame ?? null, // float

          // Power play stats from powerPlayResponse (powerPlayStat)
          pp_assists: powerPlayStat?.ppAssists ?? null, // int
          pp_goals: powerPlayStat?.ppGoals ?? null, // int
          pp_goals_for_per_60: powerPlayStat?.ppGoalsForPer60 ?? null, // float
          pp_goals_per_60: powerPlayStat?.ppGoalsPer60 ?? null, // float
          pp_individual_sat_for: powerPlayStat?.ppIndividualSatFor ?? null, // int
          pp_individual_sat_per_60:
            powerPlayStat?.ppIndividualSatForPer60 ?? null, // float
          pp_points_per_60: powerPlayStat?.ppPointsPer60 ?? null, // float
          pp_primary_assists: powerPlayStat?.ppPrimaryAssists ?? null, // int
          pp_primary_assists_per_60:
            powerPlayStat?.ppPrimaryAssistsPer60 ?? null, // float
          pp_secondary_assists: powerPlayStat?.ppSecondaryAssists ?? null, // int
          pp_secondary_assists_per_60:
            powerPlayStat?.ppSecondaryAssistsPer60 ?? null, // float
          pp_shooting_percentage: powerPlayStat?.ppShootingPct ?? null, // float
          pp_shots: powerPlayStat?.ppShots ?? null, // int
          pp_shots_per_60: powerPlayStat?.ppShotsPer60 ?? null, // float
          pp_toi: powerPlayStat?.ppTimeOnIce ?? null, // int
          pp_toi_pct_per_game: powerPlayStat?.ppTimeOnIcePctPerGame ?? null, // float

          // Puck possession stats from puckPossessionResponse (puckPossessionStat)
          goals_pct: puckPossessionStat?.goalsPct ?? null, // float
          faceoff_pct_5v5: puckPossessionStat?.faceoffPct5v5 ?? null, // float
          individual_sat_for_per_60:
            puckPossessionStat?.individualSatForPer60 ?? null, // float
          individual_shots_for_per_60:
            puckPossessionStat?.individualShotsForPer60 ?? null, // float
          on_ice_shooting_pct: puckPossessionStat?.onIceShootingPct ?? null, // float
          sat_pct: puckPossessionStat?.satPct ?? null, // float
          toi_per_game_5v5: puckPossessionStat?.timeOnIcePerGame5v5 ?? null, // float
          usat_pct: puckPossessionStat?.usatPct ?? null, // float
          zone_start_pct: puckPossessionStat?.zoneStartPct ?? null, // float

          // Shooting stats from satCountsResponse (satCountsStat)
          sat_against: satCountsStat?.satAgainst ?? null, // int
          sat_ahead: satCountsStat?.satAhead ?? null, // int
          sat_behind: satCountsStat?.satBehind ?? null, // int
          sat_close: satCountsStat?.satClose ?? null, // int
          sat_for: satCountsStat?.satFor ?? null, // int
          sat_tied: satCountsStat?.satTied ?? null, // int
          sat_total: satCountsStat?.satTotal ?? null, // int
          usat_against: satCountsStat?.usatAgainst ?? null, // int
          usat_ahead: satCountsStat?.usatAhead ?? null, // int
          usat_behind: satCountsStat?.usatBehind ?? null, // int
          usat_close: satCountsStat?.usatClose ?? null, // int
          usat_for: satCountsStat?.usatFor ?? null, // int
          usat_tied: satCountsStat?.usatTied ?? null, // int
          usat_total: satCountsStat?.usatTotal ?? null, // int

          // Shooting percentages from satPercentagesResponse (satPercentagesStat)
          sat_percentage: satPercentagesStat?.satPercentage ?? null, // float
          sat_percentage_ahead: satPercentagesStat?.satPercentageAhead ?? null, // float
          sat_percentage_behind:
            satPercentagesStat?.satPercentageBehind ?? null, // float
          sat_percentage_close: satPercentagesStat?.satPercentageClose ?? null, // float
          sat_percentage_tied: satPercentagesStat?.satPercentageTied ?? null, // float
          sat_relative: satPercentagesStat?.satRelative ?? null, // float
          shooting_percentage_5v5: satPercentagesStat?.shootingPct5v5 ?? null, // float
          skater_save_pct_5v5: satPercentagesStat?.skaterSavePct5v5 ?? null, // float
          skater_shooting_plus_save_pct_5v5:
            satPercentagesStat?.skaterShootingPlusSavePct5v5 ?? null, // float
          usat_percentage: satPercentagesStat?.usatPercentage ?? null, // float
          usat_percentage_ahead:
            satPercentagesStat?.usatPercentageAhead ?? null, // float
          usat_percentage_behind:
            satPercentagesStat?.usatPercentageBehind ?? null, // float
          usat_percentage_close:
            satPercentagesStat?.usatPercentageClose ?? null, // float
          usat_percentage_tied: satPercentagesStat?.usatPercentageTied ?? null, // float
          usat_relative: satPercentagesStat?.usatRelative ?? null, // float
          zone_start_pct_5v5: satPercentagesStat?.zoneStartPct5v5 ?? null, // float

          // Scoring rates from scoringRatesResponse (scoringRatesStat)
          assists_5v5: scoringRatesStat?.assists5v5 ?? null, // int
          assists_per_60_5v5: scoringRatesStat?.assistsPer605v5 ?? null, // float
          goals_5v5: scoringRatesStat?.goals5v5 ?? null, // int
          goals_per_60_5v5: scoringRatesStat?.goalsPer605v5 ?? null, // float
          net_minor_penalties_per_60:
            scoringRatesStat?.netMinorPenaltiesPer60 ?? null, // float
          o_zone_start_pct_5v5:
            scoringRatesStat?.offensiveZoneStartPct5v5 ?? null, // float
          on_ice_shooting_pct_5v5:
            scoringRatesStat?.onIceShootingPct5v5 ?? null, // float
          points_5v5: scoringRatesStat?.points5v5 ?? null, // int
          points_per_60_5v5: scoringRatesStat?.pointsPer605v5 ?? null, // float
          primary_assists_5v5: scoringRatesStat?.primaryAssists5v5 ?? null, // int
          primary_assists_per_60_5v5:
            scoringRatesStat?.primaryAssistsPer605v5 ?? null, // float
          sat_relative_5v5: scoringRatesStat?.satRelative5v5 ?? null, // float
          secondary_assists_5v5: scoringRatesStat?.secondaryAssists5v5 ?? null, // int
          secondary_assists_per_60_5v5:
            scoringRatesStat?.secondaryAssistsPer605v5 ?? null, // float

          // Scoring per game from scoringPerGameResponse (scoringPerGameStat)
          assists_per_game: scoringPerGameStat?.assistsPerGame ?? null, // float
          blocks_per_game: scoringPerGameStat?.blocksPerGame ?? null, // float
          goals_per_game: scoringPerGameStat?.goalsPerGame ?? null, // float
          hits_per_game: scoringPerGameStat?.hitsPerGame ?? null, // float
          penalty_minutes_per_game:
            scoringPerGameStat?.penaltyMinutesPerGame ?? null, // float
          primary_assists_per_game:
            scoringPerGameStat?.primaryAssistsPerGame ?? null, // float
          secondary_assists_per_game:
            scoringPerGameStat?.secondaryAssistsPerGame ?? null, // float
          shots_per_game: scoringPerGameStat?.shotsPerGame ?? null, // float
          total_primary_assists:
            scoringPerGameStat?.totalPrimaryAssists ?? null, // int
          total_secondary_assists:
            scoringPerGameStat?.totalSecondaryAssists ?? null, // int

          // Shot type stats from shotTypeResponse (shotTypeStat)
          goals_backhand: shotTypeStat?.goalsBackhand ?? null, // int
          goals_bat: shotTypeStat?.goalsBat ?? null, // int
          goals_between_legs: shotTypeStat?.goalsBetweenLegs ?? null, // int
          goals_cradle: shotTypeStat?.goalsCradle ?? null, // int
          goals_deflected: shotTypeStat?.goalsDeflected ?? null, // int
          goals_poke: shotTypeStat?.goalsPoke ?? null, // int
          goals_slap: shotTypeStat?.goalsSlap ?? null, // int
          goals_snap: shotTypeStat?.goalsSnap ?? null, // int
          goals_tip_in: shotTypeStat?.goalsTipIn ?? null, // int
          goals_wrap_around: shotTypeStat?.goalsWrapAround ?? null, // int
          goals_wrist: shotTypeStat?.goalsWrist ?? null, // int
          shooting_pct_backhand: shotTypeStat?.shootingPctBackhand ?? null, // float
          shooting_pct_bat: shotTypeStat?.shootingPctBat ?? null, // float
          shooting_pct_between_legs:
            shotTypeStat?.shootingPctBetweenLegs ?? null, // float
          shooting_pct_cradle: shotTypeStat?.shootingPctCradle ?? null, // float
          shooting_pct_deflected: shotTypeStat?.shootingPctDeflected ?? null, // float
          shooting_pct_poke: shotTypeStat?.shootingPctPoke ?? null, // float
          shooting_pct_slap: shotTypeStat?.shootingPctSlap ?? null, // float
          shooting_pct_snap: shotTypeStat?.shootingPctSnap ?? null, // float
          shooting_pct_tip_in: shotTypeStat?.shootingPctTipIn ?? null, // float
          shooting_pct_wrap_around: shotTypeStat?.shootingPctWrapAround ?? null, // float
          shooting_pct_wrist: shotTypeStat?.shootingPctWrist ?? null, // float
          shots_on_net_backhand: shotTypeStat?.shotsOnNetBackhand ?? null, // int
          shots_on_net_bat: shotTypeStat?.shotsOnNetBat ?? null, // int
          shots_on_net_between_legs:
            shotTypeStat?.shotsOnNetBetweenLegs ?? null, // int
          shots_on_net_cradle: shotTypeStat?.shotsOnNetCradle ?? null, // int
          shots_on_net_deflected: shotTypeStat?.shotsOnNetDeflected ?? null, // int
          shots_on_net_poke: shotTypeStat?.shotsOnNetPoke ?? null, // int
          shots_on_net_slap: shotTypeStat?.shotsOnNetSlap ?? null, // int
          shots_on_net_snap: shotTypeStat?.shotsOnNetSnap ?? null, // int
          shots_on_net_tip_in: shotTypeStat?.shotsOnNetTipIn ?? null, // int
          shots_on_net_wrap_around: shotTypeStat?.shotsOnNetWrapAround ?? null, // int
          shots_on_net_wrist: shotTypeStat?.shotsOnNetWrist ?? null, // int

          // Time on ice stats from timeOnIceResponse (timeOnIceStat)
          ev_time_on_ice: timeOnIceStat?.evTimeOnIce ?? null, // int
          ev_time_on_ice_per_game: timeOnIceStat?.evTimeOnIcePerGame ?? null, // float
          ot_time_on_ice: timeOnIceStat?.otTimeOnIce ?? null, // int
          ot_time_on_ice_per_game: timeOnIceStat?.otTimeOnIcePerOtGame ?? null, // float
          shifts: timeOnIceStat?.shifts ?? null, // int
          shifts_per_game: timeOnIceStat?.shiftsPerGame ?? null, // float
          time_on_ice_per_shift: timeOnIceStat?.timeOnIcePerShift ?? null // float
        });

        if (response.error) {
          console.error("Error upserting data:", response.error);
        }
      } catch (error) {
        console.error("Unexpected error upserting data:", error);
      }
    }

    currentDate = addDays(currentDate, 1); // Move to the next day
  }
}

fetchNHLSkaterData();
