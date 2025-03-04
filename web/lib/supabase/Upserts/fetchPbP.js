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
  const { data: gameIds, error } = await supabase
    .from("games") // Updated table name to 'pbp_games'
    .select("id")
    .in("seasonId", seasons) // Filter for the selected seasons
    .order("date", { ascending: false }) // Order by date to get the most recent games
    .range(offset, offset + ROW_LIMIT - 1); // Fetch in batches of ROW_LIMIT

  if (error) {
    console.error("Error fetching game IDs from games:", error.message);
    return [];
  }

  return gameIds;
}

// Process all game IDs for the selected seasons
async function processPlayByPlayData() {
  try {
    const currentSeason = await fetchCurrentSeason(); // Fetch the current or most recent season based on today's date
    const selectedSeasons = [currentSeason.id];
    if (currentSeason.previousSeasonId) {
      selectedSeasons.push(currentSeason.previousSeasonId);
    }

    let offset = 0;
    let hasMoreData = true;

    while (hasMoreData) {
      console.log(
        `Fetching game IDs from pbp_games for seasons ${selectedSeasons.join(
          ", "
        )}, starting at offset ${offset}...`
      );

      // Fetch a batch of game IDs
      const gameIds = await fetchGameIdsFromSupabase(selectedSeasons, offset);

      if (gameIds.length === 0) {
        hasMoreData = false; // No more data to process
        console.log("No more game IDs to process.");
        break;
      }

      // Process each game one by one in the current batch
      for (const game of gameIds) {
        const gameId = game.id;

        // Log the start of processing for each game
        console.log(
          `Fetching and processing play-by-play data for game ${gameId}...`
        );

        // Fetch the play-by-play data for this game
        const gameData = await fetchPlayByPlayData(gameId);

        if (gameData) {
          // Upsert the play-by-play data into the pbp_plays table
          await upsertPlayByPlayData(gameId, gameData);
        } else {
          console.warn(`No play-by-play data found for game ${gameId}.`);
        }

        // Log the completion of processing for this game
        console.log(
          `Finished processing play-by-play data for game ${gameId}.`
        );
      }

      // Move to the next batch
      offset += ROW_LIMIT;
    }

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

main();
