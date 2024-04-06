// lib/supabase/fetchWGOskaterData.js

// DEV NOTE
// For days that fail, those days need to be retried after the script has finished running
// maybe an array that stores the failed dates and then a loop that runs through the failed dates

require("dotenv").config({ path: "../../.env.local" });

const { createClient } = require("@supabase/supabase-js");
const fetch = require("node-fetch");
const { parseISO, format, addDays, isBefore } = require("date-fns");

// Simplified Fetch (cors-fetch) function for Node.js that isnt imported
async function Fetch(url) {
  const response = await fetch(url);
  return response.json();
}

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function fetchAllDataForDate(formattedDate, limit) {
  let start = 0;
  let moreDataAvailable = true;
  // Initialize arrays to store data
  let skaterStats = [];
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
    const skaterStatsUrl = `https://api.nhle.com/stats/rest/en/skater/summary?isAggregate=true&isGame=true&sort=%5B%7B%22property%22:%22points%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22goals%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22assists%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=${limit}&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameDate%3C=%22${formattedDate}%2023%3A59%3A59%22%20and%20gameDate%3E=%22${formattedDate}%22%20and%20gameTypeId=2`;
    const miscSkaterStatsUrl = `https://api.nhle.com/stats/rest/en/skater/realtime?isAggregate=true&isGame=true&sort=%5B%7B%22property%22:%22hits%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=${limit}&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameDate%3C=%22${formattedDate}%2023%3A59%3A59%22%20and%20gameDate%3E=%22${formattedDate}%22%20and%20gameTypeId=2`;
    const faceOffStatsUrl = `https://api.nhle.com/stats/rest/en/skater/faceoffpercentages?isAggregate=true&isGame=true&sort=%5B%7B%22property%22:%22totalFaceoffs%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=${limit}&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameDate%3C=%22${formattedDate}%2023%3A59%3A59%22%20and%20gameDate%3E=%22${formattedDate}%22%20and%20gameTypeId=2`;
    const faceoffWinLossUrl = `https://api.nhle.com/stats/rest/en/skater/faceoffwins?isAggregate=true&isGame=true&sort=%5B%7B%22property%22:%22totalFaceoffWins%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22faceoffWinPct%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=${limit}&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameDate%3C=%22${formattedDate}%2023%3A59%3A59%22%20and%20gameDate%3E=%22${formattedDate}%22%20and%20gameTypeId=2`;
    const goalsForAgainstUrl = `https://api.nhle.com/stats/rest/en/skater/goalsForAgainst?isAggregate=true&isGame=true&sort=%5B%7B%22property%22:%22evenStrengthGoalDifference%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=${limit}&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameDate%3C=%22${formattedDate}%2023%3A59%3A59%22%20and%20gameDate%3E=%22${formattedDate}%22%20and%20gameTypeId=2`;
    const penaltiesUrl = `https://api.nhle.com/stats/rest/en/skater/penalties?isAggregate=true&isGame=true&sort=%5B%7B%22property%22:%22penaltyMinutes%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=${limit}&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameDate%3C=%22${formattedDate}%2023%3A59%3A59%22%20and%20gameDate%3E=%22${formattedDate}%22%20and%20gameTypeId=2`;
    const penaltyKillUrl = `https://api.nhle.com/stats/rest/en/skater/penaltykill?isAggregate=true&isGame=true&sort=%5B%7B%22property%22:%22shTimeOnIce%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=${limit}&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameDate%3C=%22${formattedDate}%2023%3A59%3A59%22%20and%20gameDate%3E=%22${formattedDate}%22%20and%20gameTypeId=2`;
    const powerPlayUrl = `https://api.nhle.com/stats/rest/en/skater/powerplay?isAggregate=true&isGame=true&sort=%5B%7B%22property%22:%22ppTimeOnIce%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=${limit}&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameDate%3C=%22${formattedDate}%2023%3A59%3A59%22%20and%20gameDate%3E=%22${formattedDate}%22%20and%20gameTypeId=2`;
    const puckPossessionUrl = `https://api.nhle.com/stats/rest/en/skater/puckPossessions?isAggregate=true&isGame=true&sort=%5B%7B%22property%22:%22satPct%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=${limit}&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameDate%3C=%22${formattedDate}%2023%3A59%3A59%22%20and%20gameDate%3E=%22${formattedDate}%22%20and%20gameTypeId=2`;
    const satCountsUrl = `https://api.nhle.com/stats/rest/en/skater/summaryshooting?isAggregate=true&isGame=true&sort=%5B%7B%22property%22:%22satTotal%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22usatTotal%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=${limit}&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameDate%3C=%22${formattedDate}%2023%3A59%3A59%22%20and%20gameDate%3E=%22${formattedDate}%22%20and%20gameTypeId=2`;
    const satPercentagesUrl = `https://api.nhle.com/stats/rest/en/skater/percentages?isAggregate=true&isGame=true&sort=%5B%7B%22property%22:%22satPercentage%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=${limit}&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameDate%3C=%22${formattedDate}%2023%3A59%3A59%22%20and%20gameDate%3E=%22${formattedDate}%22%20and%20gameTypeId=2`;
    const scoringRatesUrl = `https://api.nhle.com/stats/rest/en/skater/scoringRates?isAggregate=true&isGame=true&sort=%5B%7B%22property%22:%22pointsPer605v5%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22goalsPer605v5%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=${limit}&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameDate%3C=%22${formattedDate}%2023%3A59%3A59%22%20and%20gameDate%3E=%22${formattedDate}%22%20and%20gameTypeId=2`;
    const scoringPerGameUrl = `https://api.nhle.com/stats/rest/en/skater/scoringpergame?isAggregate=true&isGame=true&sort=%5B%7B%22property%22:%22pointsPerGame%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22goalsPerGame%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=${limit}&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameDate%3C=%22${formattedDate}%2023%3A59%3A59%22%20and%20gameDate%3E=%22${formattedDate}%22%20and%20gameTypeId=2`;
    const shotTypeUrl = `https://api.nhle.com/stats/rest/en/skater/shottype?isAggregate=true&isGame=true&sort=%5B%7B%22property%22:%22shootingPct%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22shootingPctBat%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=${limit}&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameDate%3C=%22${formattedDate}%2023%3A59%3A59%22%20and%20gameDate%3E=%22${formattedDate}%22%20and%20gameTypeId=2`;
    const timeOnIceUrl = `https://api.nhle.com/stats/rest/en/skater/timeonice?isAggregate=true&isGame=true&sort=%5B%7B%22property%22:%22timeOnIce%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=${limit}&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameDate%3C=%22${formattedDate}%2023%3A59%3A59%22%20and%20gameDate%3E=%22${formattedDate}%22%20and%20gameTypeId=2`;

    const [
      skaterStatsResponse,
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
      timeOnIceResponse,
    ] = await Promise.all([
      Fetch(skaterStatsUrl),
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
      Fetch(timeOnIceUrl),
    ]);

    skaterStats = skaterStats.concat(skaterStatsResponse.data);
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
    timeOnIceStats,
  };
}

async function fetchNHLSkaterData() {
  const scheduleResponse = await Fetch(
    "https://api-web.nhle.com/v1/schedule/now"
  );
  let seasonStart = scheduleResponse.regularSeasonStartDate || "2023-10-10";
  let currentDate = parseISO(seasonStart);
  const today = new Date();
  const limit = 100;

  while (
    isBefore(currentDate, today) ||
    currentDate.toISOString().split("T")[0] ===
      today.toISOString().split("T")[0]
  ) {
    let formattedDate = format(currentDate, "yyyy-MM-dd");
    console.log(`Fetching data for ${formattedDate}`);

    const {
      skaterStats,
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
      timeOnIceStats,
    } = await fetchAllDataForDate(formattedDate, limit);

    skaterStats.forEach(async (stat, index) => {
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

      const response = await supabase.from("wgo_skater_stats").upsert({
        // summary stats from skaterStatsResponse (stat)
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
        // realtime stats from miscSkaterStatsResponse (miscStats)
        blocked_shots: miscStats.blockedShots, // int
        blocks_per_60: miscStats.blockedShotsPer60, // float
        empty_net_assists: miscStats.emptyNetAssists, // int
        empty_net_goals: miscStats.emptyNetGoals, // int
        empty_net_points: miscStats.emptyNetPoints, // int
        first_goals: miscStats.firstGoals, // int
        giveaways: miscStats.giveaways, // int
        giveaways_per_60: miscStats.giveawaysPer60, // float
        hits: miscStats.hits, // int
        hits_per_60: miscStats.hitsPer60, // float
        missed_shot_crossbar: miscStats.missedShotCrossbar, // int
        missed_shot_goal_post: miscStats.missedShotGoalpost, // int
        missed_shot_over_net: miscStats.missedShotOverNet, // int
        missed_shot_short_side: miscStats.missedShotShort, // int
        missed_shot_wide_of_net: miscStats.missedShotWideOfNet, // int
        missed_shots: miscStats.missedShots, // int
        takeaways: miscStats.takeaways, // int
        takeaways_per_60: miscStats.takeawaysPer60, // float
        // faceoff stats from faceOffStatsResponse (faceOffStats)
        d_zone_fo_percentage: faceOffStat.defensiveZoneFaceoffPct, // float
        d_zone_faceoffs: faceOffStat.defensiveZoneFaceoffs, // int
        ev_faceoff_percentage: faceOffStat.evFaceoffPct, // float
        ev_faceoffs: faceOffStat.evFaceoffs, // int
        n_zone_fo_percentage: faceOffStat.neutralZoneFaceoffPct, // float
        n_zone_faceoffs: faceOffStat.neutralZoneFaceoffs, // int
        o_zone_fo_percentage: faceOffStat.offensiveZoneFaceoffPct, // float
        o_zone_faceoffs: faceOffStat.offensiveZoneFaceoffs, // int
        pp_faceoff_percentage: faceOffStat.ppFaceoffPct, // float
        pp_faceoffs: faceOffStat.ppFaceoffs, // int
        sh_faceoff_percentage: faceOffStat.shFaceoffPct, // float
        sh_faceoffs: faceOffStat.shFaceoffs, // int
        total_faceoffs: faceOffStat.totalFaceoffs, // int
        // faceoff win/loss stats from faceoffWinLossResponse (faceoffWinLossStats)
        d_zone_fol: faceOffWLStat.defensiveZoneFaceoffLosses, // int
        d_zone_fow: faceOffWLStat.defensiveZoneFaceoffWins, // int
        ev_fol: faceOffWLStat.evFaceoffsLost, // int
        ev_fow: faceOffWLStat.evFaceoffsWon, // int
        n_zone_fol: faceOffWLStat.neutralZoneFaceoffLosses, // int
        n_zone_fow: faceOffWLStat.neutralZoneFaceoffWins, // int
        o_zone_fol: faceOffWLStat.offensiveZoneFaceoffLosses, // int
        o_zone_fow: faceOffWLStat.offensiveZoneFaceoffWins, // int
        pp_fol: faceOffWLStat.ppFaceoffsLost, // int
        pp_fow: faceOffWLStat.ppFaceoffsWon, // int
        sh_fol: faceOffWLStat.shFaceoffsLost, // int
        sh_fow: faceOffWLStat.shFaceoffsWon, // int
        total_fol: faceOffWLStat.totalFaceoffLosses, // int
        total_fow: faceOffWLStat.totalFaceoffWins, // int
        // goals for/against stats from goalsForAgainstResponse (goalsForAgainstStats)
        es_goal_diff: goalsForAgainstStat.evenStrengthGoalDifference, // int
        es_goals_against: goalsForAgainstStat.evenStrengthGoalsAgainst, // int
        es_goals_for: goalsForAgainstStat.evenStrengthGoalsFor, // int
        es_goals_for_percentage: goalsForAgainstStat.evenStrengthGoalsForPct, // float
        es_toi_per_game: goalsForAgainstStat.evenStrengthTimeOnIcePerGame, // float
        pp_goals_against: goalsForAgainstStat.powerPlayGoalsAgainst, // int
        pp_goals_for: goalsForAgainstStat.powerPlayGoalFor, // int
        pp_toi_per_game: goalsForAgainstStat.powerPlayTimeOnIcePerGame, // float
        sh_goals_against: goalsForAgainstStat.shortHandedGoalsAgainst, // int
        sh_goals_for: goalsForAgainstStat.shortHandedGoalsFor, // int
        sh_toi_per_game: goalsForAgainstStat.shortHandedTimeOnIcePerGame, // float
        // penalties stats from penaltiesResponse (penaltiesStat)
        game_misconduct_penalties: penaltiesStat.gameMisconductPenalties, // int
        major_penalties: penaltiesStat.majorPenalties, // int
        match_penalties: penaltiesStat.matchPenalties, // int
        minor_penalties: penaltiesStat.minorPenalties, // int
        misconduct_penalties: penaltiesStat.misconductPenalties, // int
        net_penalties: penaltiesStat.netPenalties, // int
        net_penalties_per_60: penaltiesStat.netPenaltiesPer60, // float
        penalties: penaltiesStat.penalties, // int
        penalties_drawn: penaltiesStat.penaltiesDrawn, // int
        penalties_drawn_per_60: penaltiesStat.penaltiesDrawnPer60, // float
        penalties_taken_per_60: penaltiesStat.penaltiesTakenPer60, // float
        penalty_minutes: penaltiesStat.penaltyMinutes, // int
        penalty_minutes_per_toi: penaltiesStat.penaltyMinutesPerTimeOnIce, // float
        penalty_seconds_per_game: penaltiesStat.penaltySecondsPerGame, // float
        // penalty kill stats from penaltyKillResponse (penaltyKillStat)
        pp_goals_against_per_60: penaltyKillStat.ppGoalsAgainstPer60, // float/
        sh_assists: penaltyKillStat.shAssists, // int
        sh_goals: penaltyKillStat.shGoals, // int
        sh_points: penaltyKillStat.shPoints, // int
        sh_goals_per_60: penaltyKillStat.shGoalsPer60, // float
        sh_individual_sat_for: penaltyKillStat.shIndividualSatFor, // int
        sh_individual_sat_per_60: penaltyKillStat.shIndividualSatForPer60, // float
        sh_points_per_60: penaltyKillStat.shPointsPer60, // float
        sh_primary_assists: penaltyKillStat.shPrimaryAssists, // int
        sh_primary_assists_per_60: penaltyKillStat.shPrimaryAssistsPer60, // float
        sh_secondary_assists: penaltyKillStat.shSecondaryAssists, // int
        sh_secondary_assists_per_60: penaltyKillStat.shSecondaryAssistsPer60, // float
        sh_shooting_percentage: penaltyKillStat.shShootingPct, // float
        sh_shots: penaltyKillStat.shShots, // int
        sh_shots_per_60: penaltyKillStat.shShotsPer60, // float
        sh_time_on_ice: penaltyKillStat.shTimeOnIce, // int
        sh_time_on_ice_pct_per_game: penaltyKillStat.shTimeOnIcePctPerGame, // float
        // power play stats from powerPlayResponse (powerPlayStat)
        pp_assists: powerPlayStat.ppAssists, // int
        pp_goals: powerPlayStat.ppGoals, // int
        pp_goals_for_per_60: powerPlayStat.ppGoalsForPer60, // float
        pp_goals_per_60: powerPlayStat.ppGoalsPer60, // float
        pp_individual_sat_for: powerPlayStat.ppIndividualSatFor, // int
        pp_individual_sat_per_60: powerPlayStat.ppIndividualSatForPer60, // float
        pp_points_per_60: powerPlayStat.ppPointsPer60, // float
        pp_primary_assists: powerPlayStat.ppPrimaryAssists, // int
        pp_primary_assists_per_60: powerPlayStat.ppPrimaryAssistsPer60, // float
        pp_secondary_assists: powerPlayStat.ppSecondaryAssists, // int
        pp_secondary_assists_per_60: powerPlayStat.ppSecondaryAssistsPer60, // float
        pp_shooting_percentage: powerPlayStat.ppShootingPct, // float
        pp_shots: powerPlayStat.ppShots, // int
        pp_shots_per_60: powerPlayStat.ppShotsPer60, // float
        pp_toi: powerPlayStat.ppTimeOnIce, // int
        pp_toi_pct_per_game: powerPlayStat.ppTimeOnIcePctPerGame, // float
        // puck possession stats from puckPossessionResponse (puckPossessionStat)
        goals_pct: puckPossessionStat.goalsPct, // float
        faceoff_pct_5v5: puckPossessionStat.faceoffPct5v5, // float
        individual_sat_for_per_60: puckPossessionStat.individualSatForPer60, // float
        individual_shots_for_per_60: puckPossessionStat.individualShotsForPer60, // float
        on_ice_shooting_pct: puckPossessionStat.onIceShootingPct, // float
        sat_pct: puckPossessionStat.satPct, // float
        toi_per_game_5v5: puckPossessionStat.timeOnIcePerGame5v5, // float
        usat_pct: puckPossessionStat.usatPct, // float
        zone_start_pct: puckPossessionStat.zoneStartPct, // float
        // shooting stats from satCountsResponse (satCountsStat)
        sat_against: satCountsStat.satAgainst, // int
        sat_ahead: satCountsStat.satAhead, // int
        sat_behind: satCountsStat.satBehind, // int
        sat_close: satCountsStat.satClose, // int
        sat_for: satCountsStat.satFor, // int
        sat_tied: satCountsStat.satTied, // int
        sat_total: satCountsStat.satTotal, // int
        usat_against: satCountsStat.usatAgainst, // int
        usat_ahead: satCountsStat.usatAhead, // int
        usat_behind: satCountsStat.usatBehind, // int
        usat_close: satCountsStat.usatClose, // int
        usat_for: satCountsStat.usatFor, // int
        usat_tied: satCountsStat.usatTied, // int
        usat_total: satCountsStat.usatTotal, // int
        // shooting percentages from satPercentagesResponse (satPercentagesStat)
        sat_percentage: satPercentagesStat.satPercentage, // float
        sat_percentage_ahead: satPercentagesStat.satPercentageAhead, // float
        sat_percentage_behind: satPercentagesStat.satPercentageBehind, // float
        sat_percentage_close: satPercentagesStat.satPercentageClose, // float
        sat_percentage_tied: satPercentagesStat.satPercentageTied, // float
        sat_relative: satPercentagesStat.satRelative, // float
        shooting_percentage_5v5: satPercentagesStat.shootingPct5v5, // float
        skater_save_pct_5v5: satPercentagesStat.skaterSavePct5v5, // float
        skater_shooting_plus_save_pct_5v5:
          satPercentagesStat.skaterShootingPlusSavePct5v5, // float
        usat_percentage: satPercentagesStat.usatPercentage, // float
        usat_percentage_ahead: satPercentagesStat.usatPercentageAhead, // float
        usat_percentage_behind: satPercentagesStat.usatPercentageBehind, // float
        usat_percentage_close: satPercentagesStat.usatPrecentageClose, // float
        usat_percentage_tied: satPercentagesStat.usatPercentageTied, // float
        usat_relative: satPercentagesStat.usatRelative, // float
        zone_start_pct_5v5: satPercentagesStat.zoneStartPct5v5, // float
        // scoring rates from scoringRatesResponse (scoringRatesStat)
        assists_5v5: scoringRatesStat.assists5v5, // int
        assists_per_60_5v5: scoringRatesStat.assistsPer605v5, // float
        goals_5v5: scoringRatesStat.goals5v5, // int
        goals_per_60_5v5: scoringRatesStat.goalsPer605v5, // float
        net_minor_penalties_per_60: scoringRatesStat.netMinorPenaltiesPer60, // float
        o_zone_start_pct_5v5: scoringRatesStat.offensiveZoneStartPct5v5, // float
        on_ice_shooting_pct_5v5: scoringRatesStat.onIceShootingPct5v5, // float
        points_5v5: scoringRatesStat.points5v5, // int
        points_per_60_5v5: scoringRatesStat.pointsPer605v5, // float
        primary_assists_5v5: scoringRatesStat.primaryAssists5v5, // int
        primary_assists_per_60_5v5: scoringRatesStat.primaryAssistsPer605v5, // float
        sat_relative_5v5: scoringRatesStat.satRelative5v5, // float
        secondary_assists_5v5: scoringRatesStat.secondaryAssists5v5, // int
        secondary_assists_per_60_5v5: scoringRatesStat.secondaryAssistsPer605v5, // float
        // scoring per game from scoringPerGameResponse (scoringPerGameStat)
        assists_per_game: scoringPerGameStat.assistsPerGame, // float
        blocks_per_game: scoringPerGameStat.blocksPerGame, // float
        goals_per_game: scoringPerGameStat.goalsPerGame, // float
        hits_per_game: scoringPerGameStat.hitsPerGame, // float
        penalty_minutes_per_game: scoringPerGameStat.penaltyMinutesPerGame, // float
        primary_assists_per_game: scoringPerGameStat.primaryAssistsPerGame, // float
        secondary_assists_per_game: scoringPerGameStat.secondaryAssistsPerGame, // float
        shots_per_game: scoringPerGameStat.shotsPerGame, // float
        total_primary_assists: scoringPerGameStat.totalPrimaryAssists, // int
        total_secondary_assists: scoringPerGameStat.totalSecondaryAssists, // int
        // shot type stats from shotTypeResponse (shotTypeStat)
        goals_backhand: shotTypeStat.goalsBackhand, // int
        goals_bat: shotTypeStat.goalsBat, // int
        goals_between_legs: shotTypeStat.goalsBetweenLegs, // int
        goals_cradle: shotTypeStat.goalsCradle, // int
        goals_deflected: shotTypeStat.goalsDeflected, // int
        goals_poke: shotTypeStat.goalsPoke, // int
        goals_slap: shotTypeStat.goalsSlap, // int
        goals_snap: shotTypeStat.goalsSnap, // int
        goals_tip_in: shotTypeStat.goalsTipIn, // int
        goals_wrap_around: shotTypeStat.goalsWrapAround, // int
        goals_wrist: shotTypeStat.goalsWrist, // int
        shooting_pct_backhand: shotTypeStat.shootingPctBackhand, // float
        shooting_pct_bat: shotTypeStat.shootingPctBat, // float
        shooting_pct_between_legs: shotTypeStat.shootingPctBetweenLegs, // float
        shooting_pct_cradle: shotTypeStat.shootingPctCradle, // float
        shooting_pct_deflected: shotTypeStat.shootingPctDeflected, // float
        shooting_pct_poke: shotTypeStat.shootingPctPoke, // float
        shooting_pct_slap: shotTypeStat.shootingPctSlap, // float
        shooting_pct_snap: shotTypeStat.shootingPctSnap, // float
        shooting_pct_tip_in: shotTypeStat.shootingPctTipIn, // float
        shooting_pct_wrap_around: shotTypeStat.shootingPctWrapAround, // float
        shooting_pct_wrist: shotTypeStat.shootingPctWrist, // float
        shots_on_net_backhand: shotTypeStat.shotsOnNetBackhand, // int
        shots_on_net_bat: shotTypeStat.shotsOnNetBat, // int
        shots_on_net_between_legs: shotTypeStat.shotsOnNetBetweenLegs, // int
        shots_on_net_cradle: shotTypeStat.shotsOnNetCradle, // int
        shots_on_net_deflected: shotTypeStat.shotsOnNetDeflected, // int
        shots_on_net_poke: shotTypeStat.shotsOnNetPoke, // int
        shots_on_net_slap: shotTypeStat.shotsOnNetSlap, // int
        shots_on_net_snap: shotTypeStat.shotsOnNetSnap, // int
        shots_on_net_tip_in: shotTypeStat.shotsOnNetTipIn, // int
        shots_on_net_wrap_around: shotTypeStat.shotsOnNetWrapAround, // int
        shots_on_net_wrist: shotTypeStat.shotsOnNetWrist, // int
        // time on ice stats from timeOnIceResponse (timeOnIceStat)
        ev_time_on_ice: timeOnIceStat.evTimeOnIce, // int
        ev_time_on_ice_per_game: timeOnIceStat.evTimeOnIcePerGame, // float
        ot_time_on_ice: timeOnIceStat.otTimeOnIce, // int
        ot_time_on_ice_per_game: timeOnIceStat.otTimeOnIcePerOtGame, // float
        shifts: timeOnIceStat.shifts, // int
        shifts_per_game: timeOnIceStat.shiftsPerGame, // float
        time_on_ice_per_shift: timeOnIceStat.timeOnIcePerShift, // float
      });

      if (response.error) {
        console.error("Error upserting data:", response.error);
      }
    });

    currentDate = addDays(currentDate, 1); // Move to the next day
  }
}

fetchNHLSkaterData();
