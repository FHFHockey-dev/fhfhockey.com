// lib/supabase/fetchWGOgoalieData.js

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
const supabaseKey = process.env.NEXT_SUPABASE_SERVICE_ROLE_KEY;
// CHANGED SUPABASE THING

const supabase = createClient(supabaseUrl, supabaseKey);

async function fetchAllDataForDate(formattedDate, limit) {
  let start = 0;
  let moreDataAvailable = true;
  // Initialize arrays to store data
  let goalieStats = [];
  let advancedGoalieStats = [];

  while (moreDataAvailable) {
    const goalieStatsUrl = `https://api.nhle.com/stats/rest/en/goalie/summary?isAggregate=true&isGame=true&sort=%5B%7B%22property%22:%22wins%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22savePct%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=${limit}&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameDate%3C=%22${formattedDate}%2023%3A59%3A59%22%20and%20gameDate%3E=%22${formattedDate}%22%20and%20gameTypeId=2`;
    const advancedGoalieStatsUrl = `https://api.nhle.com/stats/rest/en/goalie/advanced?isAggregate=true&isGame=true&sort=%5B%7B%22property%22:%22qualityStart%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22goalsAgainstAverage%22,%22direction%22:%22ASC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=${limit}&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameDate%3C=%22${formattedDate}%2023%3A59%3A59%22%20and%20gameDate%3E=%22${formattedDate}%22%20and%20gameTypeId=2`;

    const [goalieStatsResponse, advancedGoalieStatsResponse] =
      await Promise.all([Fetch(goalieStatsUrl), Fetch(advancedGoalieStatsUrl)]);

    goalieStats = goalieStats.concat(goalieStatsResponse.data);
    advancedGoalieStats = advancedGoalieStats.concat(
      advancedGoalieStatsResponse.data
    );

    moreDataAvailable =
      goalieStatsResponse.data.length === limit ||
      advancedGoalieStatsResponse.data.length === limit ||
      daysRestStatsResponse.data.length === limit;

    start += limit;
  }

  return {
    goalieStats,
    advancedGoalieStats,
    daysRestStats
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

    const { goalieStats, advancedGoalieStats } = await fetchAllDataForDate(
      formattedDate,
      limit
    );

    goalieStats.forEach(async (stat, index) => {
      const advStats = advancedGoalieStats.find(
        (aStat) => aStat.playerId === stat.playerId
      );

      let upsertedStats = ["goalieStatsResponse"];

      if (advStats) {
        upsertedStats.push("advancedGoalieStatsResponse");
      }

      console.log(
        `(${index + 1}/${
          goalieStats.length
        }) -- ${formattedDate} -- Upserting stats for player ID: ${
          stat.playerId
        }, Name: ${stat.goalieFullName} [${upsertedStats.join(", ")}]`
      );

      const response = await supabase.from("wgo_goalie_stats").upsert({
        // summary stats from goalieStatsResponse (stat)
        goalie_id: stat.playerId, // int
        goalie_name: stat.goalieFullName, // text
        date: formattedDate, // date
        shoots_catches: stat.shootsCatches, // text
        position_code: "G", // text
        games_played: stat.gamesPlayed, // int
        games_started: stat.gamesStarted, // int
        wins: stat.wins, // int
        losses: stat.losses, // int
        ot_losses: stat.otLosses, // int
        save_pct: stat.savePct, // float
        saves: stat.saves, // int
        goals_against: stat.goalsAgainst, // int
        goals_against_avg: stat.goalsAgainstAverage, // float
        shots_against: stat.shotsAgainst, // int
        time_on_ice: stat.timeOnIce, // int
        shutouts: stat.shutouts, // int
        goals: stat.goals, // int
        assists: stat.assists, // int
        // advanced stats from advancedGoalieStatsResponse (advStats)
        complete_game_pct: advStats?.completeGamePct, // float
        complete_games: advStats?.completeGames, // int
        incomplete_games: advStats?.incompleteGames, // int
        quality_start: advStats?.qualityStart, // int
        quality_starts_pct: advStats?.qualityStartsPct, // float
        regulation_losses: advStats?.regulationLosses, // int
        regulation_wins: advStats?.regulationWins, // int
        shots_against_per_60: advStats?.shotsAgainstPer60 // float
      });

      if (response.error) {
        console.error("Error upserting data:", response.error);
      }
    });

    currentDate = addDays(currentDate, 1); // Move to the next day
  }
}

fetchNHLSkaterData();
