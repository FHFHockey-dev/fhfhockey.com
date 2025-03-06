//////////////////////////////////////////////////////////////////////////////////////////////
// C:\Users\timbr\OneDrive\Desktop\fhfhockey.com-3\web\lib\supabase\fetchPbP.js

require("dotenv").config({ path: "../../../.env.local" });
const { createClient } = require("@supabase/supabase-js");
const { parseISO, isBefore, isAfter } = require("date-fns");

// Constants
const BATCH_SIZE = 10; // Adjust this value for batch processing
const ROW_LIMIT = 1000; // Limit for Supabase row fetch

// Supabase Client Initialization
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
// CHANGED SUPABASE THING
const supabase = createClient(supabaseUrl, supabaseKey);

// Helper function to delay retries
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Utility function to fetch and parse JSON
async function Fetch(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
  }
  return response.json();
}

// Fetch NHL Seasons
async function fetchNHLSeasons() {
  const url =
    "https://api.nhle.com/stats/rest/en/season?sort=%5B%7B%22property%22:%22id%22,%22direction%22:%22DESC%22%7D%5D";
  try {
    const data = await Fetch(url);
    return data.data;
  } catch (error) {
    console.error("Error fetching NHL seasons:", error.message);
    throw error;
  }
}

// Determine Current Season
async function determineCurrentSeason(seasons) {
  const today = new Date();
  let currentSeason = null;

  for (let i = 0; i < seasons.length; i++) {
    const season = seasons[i];
    const seasonStartDate = parseISO(season.startDate);
    const regularSeasonEndDate = parseISO(season.regularSeasonEndDate);

    if (isBefore(today, seasonStartDate)) {
      // If today is before the start of this season, use the previous season
      if (i + 1 < seasons.length) {
        currentSeason = seasons[i + 1];
        break;
      }
    } else if (
      (isAfter(today, seasonStartDate) || +today === +seasonStartDate) &&
      (isBefore(today, regularSeasonEndDate) ||
        +today === +regularSeasonEndDate)
    ) {
      // Today is within this season
      currentSeason = season;
      break;
    }
  }

  // If no current season found, default to the latest season
  if (!currentSeason && seasons.length > 0) {
    currentSeason = seasons[0];
  }

  return currentSeason;
}

// Fetch Current Season
async function fetchCurrentSeason() {
  const seasons = await fetchNHLSeasons();
  const currentSeason = await determineCurrentSeason(seasons);
  return currentSeason;
}

// Fetch play-by-play data from NHL API with retry logic
async function fetchPlayByPlayData(gameId, retries = 3) {
  const url = `https://api-web.nhle.com/v1/gamecenter/${gameId}/play-by-play`;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const gameData = await Fetch(url);
      return gameData;
    } catch (error) {
      if (error.message.includes("502 Bad Gateway")) {
        console.error(
          `502 Bad Gateway for game ${gameId}. Attempt ${attempt} of ${retries}`
        );
      } else {
        console.error(
          `Failed to fetch data for game ${gameId}. Attempt ${attempt} of ${retries}:`,
          error.message
        );
      }

      if (attempt < retries) {
        console.warn(`Retrying fetch for game ${gameId}...`);
        await delay(2000); // Wait 2 seconds before retrying
      } else {
        console.error(
          `Max retries reached for game ${gameId}. Skipping this game.`
        );
        return null;
      }
    }
  }
}

// Upsert play-by-play data into Supabase
async function upsertPlayByPlayData(gameId, gameData) {
  if (gameData.plays && gameData.plays.length > 0) {
    for (const play of gameData.plays) {
      const details = play.details || {}; // Default to empty object if details are missing

      const playUpsert = {
        id: play.eventId, // Use eventId directly as id
        gameid: gameId, // Use gameId to keep track of the game
        periodnumber: play.periodDescriptor?.number || null,
        periodtype: play.periodDescriptor?.periodType || null,
        timeinperiod: play.timeInPeriod || null,
        timeremaining: play.timeRemaining || null,
        situationcode: play.situationCode || null,
        typedesckey: play.typeDescKey || null,
        typecode: play.typeCode || null,
        hometeamdefendingside: play.homeTeamDefendingSide || null,
        sortorder: play.sortOrder || null,
        eventownerteamid: details.eventOwnerTeamId || null,
        losingplayerid: details.losingPlayerId || null,
        winningplayerid: details.winningPlayerId || null,
        shootingplayerid: details.shootingPlayerId || null,
        goalieinnetid: details.goalieInNetId || null,
        awaysog: details.awaySOG ?? null,
        homesog: details.homeSOG ?? null,
        blockingplayerid: details.blockingPlayerId || null,
        hittingplayerid: details.hittingPlayerId || null,
        hitteeplayerid: details.hitteePlayerId || null,
        durationofpenalty: details.duration || null,
        committedbyplayerid: details.committedByPlayerId || null,
        drawnbyplayerid: details.drawnByPlayerId || null,
        penalizedteam: details.typeCode || null,
        scoringplayerid: details.scoringPlayerId || null,
        scoringplayertotal: details.scoringPlayerTotal || null,
        shottype: details.shotType || null,
        assist1playerid: details.assist1PlayerId || null,
        assist1playertotal: details.assist1PlayerTotal || null,
        assist2playerid: details.assist2PlayerId || null,
        assist2playertotal: details.assist2PlayerTotal || null,
        homescore: details.homeScore ?? null,
        awayscore: details.awayScore ?? null,
        playerid: details.playerId || null,
        zonecode: details.zoneCode || null,
        xcoord: details.xCoord ?? null,
        ycoord: details.yCoord ?? null,
        reason: details.reason || null
      };

      try {
        const { error } = await supabase.from("pbp_plays").upsert(playUpsert);
        if (error) {
          console.error(
            `Error upserting play data for play ${play.eventId}:`,
            error.message
          );
        }
      } catch (upsertError) {
        console.error(
          `Error during upsert for play ${play.eventId}:`,
          upsertError.message
        );
      }
    }
  } else {
    console.warn(`No plays found for game ${gameId}.`);
  }
}

// Fetch game IDs from pbp_games table with pagination for the selected seasons
async function fetchGameIdsFromSupabase(seasons, offset = 0) {
  const today = new Date().toISOString().split("T")[0];
  const { data: gameIds, error } = await supabase
    .from("games")
    .select("id")
    .in("seasonId", seasons)
    .lte("date", today) // This line filters out future games
    .order("date", { ascending: false })
    .range(offset, offset + ROW_LIMIT - 1);

  if (error) {
    console.error("Error fetching game IDs from games:", error.message);
    return [];
  }

  return gameIds;
}

// Process all game IDs grouped by day for the selected seasons
async function processPlayByPlayData() {
  try {
    // Determine the current and previous season(s)
    const currentSeason = await fetchCurrentSeason();
    const selectedSeasons = [currentSeason.id];
    if (currentSeason.previousSeasonId) {
      selectedSeasons.push(currentSeason.previousSeasonId);
    }

    // Get today's date (adjust based on how your date column is stored)
    const today = new Date().toISOString().split("T")[0];

    // First, fetch all game dates for the selected seasons (only past or today's games)
    const { data: gamesData, error: gamesError } = await supabase
      .from("games")
      .select("date")
      .in("seasonId", selectedSeasons)
      .lte("date", today)
      .order("date", { ascending: false });

    if (gamesError) {
      console.error("Error fetching game dates:", gamesError.message);
      return;
    }

    // Deduplicate the dates (if the table returns duplicate dates)
    const distinctDates = [...new Set(gamesData.map((game) => game.date))];
    console.log("Dates to process:", distinctDates);

    const dayDurations = []; // Array to track each day's processing time (in ms)

    // Process each day sequentially
    for (const date of distinctDates) {
      console.log(`\n--- Starting processing for date: ${date} ---`);
      const startTime = Date.now();

      // Fetch all game IDs for the current day
      const { data: gamesForDay, error: errorForDay } = await supabase
        .from("games")
        .select("id")
        .in("seasonId", selectedSeasons)
        .eq("date", date)
        .order("date", { ascending: false });

      if (errorForDay) {
        console.error(
          `Error fetching games for date ${date}:`,
          errorForDay.message
        );
        continue;
      }

      // Process each game concurrently
      await Promise.all(
        gamesForDay.map(async (game) => {
          console.log(`Processing game ${game.id} on ${date}...`);
          const gameData = await fetchPlayByPlayData(game.id);
          if (gameData) {
            await upsertPlayByPlayData(game.id, gameData);
          } else {
            console.warn(
              `No play-by-play data found for game ${game.id} on ${date}.`
            );
          }
        })
      );

      const endTime = Date.now();
      const duration = endTime - startTime;
      dayDurations.push({ date, duration });
      console.log(
        `Finished processing for date ${date}. Time taken: ${(
          duration / 1000
        ).toFixed(2)} seconds.`
      );
    }

    // Calculate statistics over all processed days
    const durationsInSec = dayDurations.map((day) => day.duration / 1000);
    const total = durationsInSec.reduce((acc, val) => acc + val, 0);
    const average = total / durationsInSec.length;
    const min = Math.min(...durationsInSec);
    const max = Math.max(...durationsInSec);

    console.log("\n=== Processing Summary ===");
    console.log(`Average time per day: ${average.toFixed(2)} seconds.`);
    console.log(`Shortest day: ${min.toFixed(2)} seconds.`);
    console.log(`Longest day: ${max.toFixed(2)} seconds.`);
    console.log("Play-by-play data processing complete.");
  } catch (error) {
    console.error(
      "An unexpected error occurred during processing:",
      error.message
    );
  }
}

// Start processing play-by-play data
async function main() {
  await processPlayByPlayData();
}

if (require.main === module) {
  main();
}

module.exports = { main };
