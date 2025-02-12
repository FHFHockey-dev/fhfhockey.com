///////////////////////////////////////////////////////////////////////////////////////////
// C:\Users\timbr\OneDrive\Desktop\fhfhockey.com-3\web\lib\supabase\fetchPPTOIdata.js

require("dotenv").config({ path: "../../../.env.local" });
const { createClient } = require("@supabase/supabase-js");
const fetch = require("node-fetch");

const BATCH_SIZE = 10; // Adjust this value for the size of each batch
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_SUPABASE_SERVICE_ROLE_KEY || "";
// CHANGED SUPABASE THING
const supabase = createClient(supabaseUrl, supabaseKey);

// Helper function for delaying retries
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Step 1: Fetch season data to determine start and end dates for the past 5 years
async function fetchSeasonData() {
  const url =
    "https://api.nhle.com/stats/rest/en/season?sort=%5B%7B%22property%22:%22id%22,%22direction%22:%22DESC%22%7D%5D";

  try {
    const response = await fetch(url);
    const data = await response.json();

    // Filter for the last 5 seasons
    const seasons = data.data.slice(0, 5);
    return seasons.map((season) => ({
      seasonId: season.id,
      startDate: season.startDate.split("T")[0],
      endDate: season.endDate.split("T")[0],
      preseasonStart: season.preseasonStartdate
        ? season.preseasonStartdate.split("T")[0]
        : null
    }));
  } catch (error) {
    console.error("Error fetching season data:", error);
    return [];
  }
}

// Step 2: Paginate through the schedule API to get all game IDs for all seasons
async function fetchGameIDsForSeasons(seasons) {
  const allGameIds = new Set();

  for (const season of seasons) {
    let currentDate = season.startDate;

    while (currentDate <= season.endDate) {
      const url = `https://api-web.nhle.com/v1/schedule/${currentDate}`;
      try {
        const response = await fetch(url);
        const data = await response.json();

        data.gameWeek.forEach((day) => {
          day.games.forEach((game) => {
            allGameIds.add(game.id); // Add each game ID to the Set
          });
        });

        currentDate = data.nextStartDate; // Move to the next date from API response
      } catch (error) {
        console.error(`Error fetching games for ${currentDate}:`, error);
        break; // Stop if there's an error
      }
    }
  }

  return Array.from(allGameIds); // Convert Set to Array
}

// Step 3: Upsert game data into Supabase
async function upsertGameData(gameId) {
  const url = `https://api-web.nhle.com/v1/gamecenter/${gameId}/play-by-play`;

  try {
    const response = await fetch(url);
    const gameData = await response.json();

    const gameUpsert = {
      id: gameId,
      date: gameData.gameDate,
      starttime: gameData.startTimeUTC,
      type: gameData.gameType,
      season: gameData.season,
      hometeamid: gameData.homeTeam?.id || null,
      hometeamname: gameData.homeTeam?.placeName?.default || null,
      hometeamabbrev: gameData.homeTeam?.abbrev || null,
      hometeamscore: gameData.homeTeam?.score || null,
      awayteamid: gameData.awayTeam?.id || null,
      awayteamname: gameData.awayTeam?.placeName?.default || null,
      awayteamabbrev: gameData.awayTeam?.abbrev || null,
      awayteamscore: gameData.awayTeam?.score || null,
      location: gameData.venue?.default || null,
      outcome: gameData.gameOutcome?.lastPeriodType || null
    };

    const { error } = await supabase.from("pbp_games").upsert(gameUpsert);
    if (error) throw error;

    console.log(`Game ${gameId} upserted successfully.`);
  } catch (error) {
    console.error(`Error upserting game data for ${gameId}:`, error);
  }
}

// Step 4: Fetch all game IDs, upsert them, and complete the `pbp_games` table before moving on
const processGameIDs = async () => {
  console.log("Fetching season data...");
  const seasons = await fetchSeasonData();

  console.log("Fetching game IDs for the last 5 seasons...");
  const gameIds = await fetchGameIDsForSeasons(seasons);

  console.log(
    `Collected ${gameIds.length} game IDs. Upserting game data into pbp_games...`
  );

  await processInBatches(gameIds, BATCH_SIZE, async (gameId) => {
    await upsertGameData(gameId);
  });

  console.log("pbp_games table populated.");
};

module.exports = { processGameIDs };

// Helper function to process batches
async function processInBatches(items, batchSize, processFunction) {
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    await Promise.all(batch.map((item) => processFunction(item)));
  }
}

module.exports = { processGameIDs };

// First fetch and upsert game IDs into pbp_games
async function main() {
  await processGameIDs();
}

main();
