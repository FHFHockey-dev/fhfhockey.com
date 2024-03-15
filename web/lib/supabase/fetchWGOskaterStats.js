// lib/supabase/fetchWGOskaterData.js

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

async function fetchNHLSkaterData() {
  const scheduleResponse = await Fetch(
    "https://api-web.nhle.com/v1/schedule/now"
  );
  let seasonStart = scheduleResponse.regularSeasonStartDate || "2023-10-10";

  let currentDate = parseISO(seasonStart);
  const today = new Date();

  while (
    isBefore(currentDate, today) ||
    currentDate.toISOString().split("T")[0] ===
      today.toISOString().split("T")[0]
  ) {
    let formattedDate = format(currentDate, "yyyy-MM-dd");
    let start = 0;
    const limit = 100; // Fetch in batches of 100
    let moreDataAvailable = true;

    console.log(`Fetching data for ${formattedDate}`);

    while (moreDataAvailable) {
      // Update the URL to use dynamic start and limit parameters
      const skaterStatsUrl = `https://api.nhle.com/stats/rest/en/skater/summary?isAggregate=true&isGame=true&sort=[{"property":"points","direction":"DESC"},{"property":"goals","direction":"DESC"},{"property":"assists","direction":"DESC"},{"property":"playerId","direction":"ASC"}]&start=${start}&limit=${limit}&factCayenneExp=gamesPlayed>=1&cayenneExp=gameDate<='${formattedDate}' and gameDate>='${formattedDate}' and gameTypeId=2`;
      const skaterStatsResponse = await Fetch(skaterStatsUrl);

      const miscSkaterStatsUrl = `https://api.nhle.com/stats/rest/en/skater/realtime?isAggregate=true&isGame=true&sort=%5B%7B%22property%22:%22hits%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=${limit}&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameDate%3C=%22${formattedDate}%2023%3A59%3A59%22%20and%20gameDate%3E=%22${formattedDate}%22%20and%20gameTypeId=2`;
      const miscSkaterStatsResponse = await Fetch(miscSkaterStatsUrl);

      const faceOffStatsUrl = `https://api.nhle.com/stats/rest/en/skater/faceoffpercentages?isAggregate=true&isGame=true&sort=%5B%7B%22property%22:%22totalFaceoffs%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=${limit}&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameDate%3C=%22${formattedDate}%2023%3A59%3A59%22%20and%20gameDate%3E=%22${formattedDate}%22%20and%20gameTypeId=2`;
      const faceOffStatsResponse = await Fetch(faceOffStatsUrl);

      const faceoffWinLossUrl = `https://api.nhle.com/stats/rest/en/skater/faceoffwins?isAggregate=true&isGame=true&sort=%5B%7B%22property%22:%22totalFaceoffWins%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22faceoffWinPct%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=${limit}&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameDate%3C=%22${formattedDate}%2023%3A59%3A59%22%20and%20gameDate%3E=%22${formattedDate}%22%20and%20gameTypeId=2`;
      const faceoffWinLossResponse = await Fetch(faceoffWinLossUrl);

      if (
        skaterStatsResponse &&
        skaterStatsResponse.data &&
        skaterStatsResponse.data.length > 0 &&
        miscSkaterStatsResponse &&
        miscSkaterStatsResponse.data &&
        miscSkaterStatsResponse.data.length > 0 &&
        faceOffStatsResponse &&
        faceOffStatsResponse.data &&
        faceOffStatsResponse.data.length > 0 &&
        faceoffWinLossResponse &&
        faceoffWinLossResponse.data &&
        faceoffWinLossResponse.data.length > 0
      ) {
        console.log(
          `Fetched ${skaterStatsResponse.data.length} skater stats for ${formattedDate} starting from ${start}`
        );

        for (const stat of skaterStatsResponse.data) {
          const miscStats = miscSkaterStatsResponse.data.find(
            (addStat) => addStat.franchiseId === stat.franchiseId
          );

          const faceOffStats = faceOffStatsResponse.data.find(
            (faceOffStats) => faceOffStats.playerId === stat.playerId
          );

          const faceoffWinLossStats = faceoffWinLossResponse.data.find(
            (faceoffWinLossStats) =>
              faceoffWinLossStats.playerId === stat.playerId
          );

          if (miscStats && faceOffStats && faceoffWinLossStats) {
            console.log(
              `Upserting stats for player ID: ${stat.playerId}, Name: ${stat.skaterFullName}`
            );

            await supabase.from("wgo_skater_stats").upsert({
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
              penalty_minutes: stat.penaltyMinutes, // int
              ot_goals: stat.otGoals, // int
              gw_goals: stat.gameWinningGoals, // int
              sh_goals: stat.shGoals, // int
              pp_goals: stat.ppGoals, // int
              sh_points: stat.shPoints, // int
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
              d_zone_fo_percentage: faceOffStats.defensiveZoneFaceoffPct, // float
              d_zone_faceoffs: faceOffStats.defensiveZoneFaceoffs, // int
              ev_faceoff_percentage: faceOffStats.evFaceoffPct, // float
              ev_faceoffs: faceOffStats.evFaceoffs, // int
              n_zone_fo_percentage: faceOffStats.neutralZoneFaceoffPct, // float
              neutral_zone_faceoffs: faceOffStats.neutralZoneFaceoffs, // int
              o_zone_fo_percentage: faceOffStats.offensiveZoneFaceoffPct, // float
              o_zone_faceoffs: faceOffStats.offensiveZoneFaceoffs, // int
              pp_faceoff_percentage: faceOffStats.ppFaceoffPct, // float
              pp_faceoffs: faceOffStats.ppFaceoffs, // int
              sh_faceoff_percentage: faceOffStats.shFaceoffPct, // float
              sh_faceoffs: faceOffStats.shFaceoffs, // int
              total_faceoffs: faceOffStats.totalFaceoffs, // int
              // faceoff win/loss stats from faceoffWinLossResponse (faceoffWinLossStats)
              d_zone_fol: faceoffWinLossStats.defensiveZoneFaceoffLosses, // int
              d_zone_fow: faceoffWinLossStats.defensiveZoneFaceoffWins, // int
              ev_fol: faceoffWinLossStats.evFaceoffsLost, // int
              ev_fow: faceoffWinLossStats.evFaceoffsWon, // int
              n_zone_fol: faceoffWinLossStats.neutralZoneFaceoffLosses, // int
              n_zone_fow: faceoffWinLossStats.neutralZoneFaceoffWins, // int
              o_zone_fol: faceoffWinLossStats.offensiveZoneFaceoffLosses, // int
              o_zone_fow: faceoffWinLossStats.offensiveZoneFaceoffWins, // int
              pp_fol: faceoffWinLossStats.ppFaceoffsLost, // int
              pp_fow: faceoffWinLossStats.ppFaceoffsWon, // int
              sh_fol: faceoffWinLossStats.shFaceoffsLost, // int
              sh_fow: faceoffWinLossStats.shFaceoffsWon, // int
              total_fol: faceoffWinLossStats.totalFaceoffLosses, // int
            });
          }
        }

        // After fetching all the data
        let allResponses = [
          skaterStatsResponse,
          miscSkaterStatsResponse,
          faceOffStatsResponse,
          faceoffWinLossResponse,
          // Add Responses here
        ];

        // Check if any response has data equal to the limit indicating there might be more data available
        let moreDataChecks = allResponses.map(
          (response) =>
            response && response.data && response.data.length >= limit
        );
        moreDataAvailable = moreDataChecks.some((isMoreData) => isMoreData);

        // If moreDataAvailable is still true after checking all responses, you will continue the while loop
        if (!moreDataAvailable) {
          console.log(`Finished fetching skater stats for ${formattedDate}`);
        } else {
          start += limit; // Prepare to fetch the next batch
        }
      } else {
        // No more data or an error occurred
        moreDataAvailable = false;
        console.error("No data fetched or an error occurred.");
      }
    }

    currentDate = addDays(currentDate, 1); // Move to the next day
  }
}

fetchNHLSkaterData();
