require("dotenv").config({ path: "../../../.env.local" });
const { createClient } = require("@supabase/supabase-js");
const { parseISO, isBefore, isAfter } = require("date-fns");

// Constants
const ROW_LIMIT = 1000; // Limit for Supabase row fetch

// Supabase Client Initialization
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
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
      if (i + 1 < seasons.length) {
        currentSeason = seasons[i + 1];
        break;
      }
    } else if (
      (isAfter(today, seasonStartDate) || +today === +seasonStartDate) &&
      (isBefore(today, regularSeasonEndDate) ||
        +today === +regularSeasonEndDate)
    ) {
      currentSeason = season;
      break;
    }
  }
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
        await delay(2000);
      } else {
        console.error(
          `Max retries reached for game ${gameId}. Skipping this game.`
        );
        return null;
      }
    }
  }
}

// Bulk upsert play-by-play data into Supabase for one game
async function upsertPlayByPlayData(gameId, gameData) {
  if (gameData.plays && gameData.plays.length > 0) {
    // Build a list of play objects from all plays returned by the API
    const plays = gameData.plays.map((play) => {
      const details = play.details || {};
      return {
        id: play.eventId, // Use eventId directly as id
        gameid: gameId,
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
    });

    // Perform a single bulk upsert for all plays in this game
    const { error } = await supabase.from("pbp_plays").upsert(plays);
    if (error) {
      console.error(`Error upserting plays for game ${gameId}:`, error.message);
    }
  } else {
    console.warn(`No plays found for game ${gameId}.`);
  }
}

// Process games in reverse chronological order until we hit a day that is already processed
async function processPlayByPlayData() {
  try {
    // Determine current season(s)
    const currentSeason = await fetchCurrentSeason();
    const selectedSeasons = [currentSeason.id];
    if (currentSeason.previousSeasonId) {
      selectedSeasons.push(currentSeason.previousSeasonId);
    }

    // Start from today and work backward
    let currentDate = new Date();
    let currentDateStr = currentDate.toISOString().split("T")[0];

    while (true) {
      console.log(`\n--- Processing date: ${currentDateStr} ---`);
      const dayStartTime = Date.now();

      // Fetch all game IDs for the current day
      const { data: gamesForDay, error: errorForDay } = await supabase
        .from("games")
        .select("id")
        .in("seasonId", selectedSeasons)
        .eq("date", currentDateStr)
        .order("date", { ascending: false });
      if (errorForDay) {
        console.error(
          `Error fetching games for date ${currentDateStr}:`,
          errorForDay.message
        );
        // Move to the previous day and continue
        currentDate.setDate(currentDate.getDate() - 1);
        currentDateStr = currentDate.toISOString().split("T")[0];
        continue;
      }
      if (!gamesForDay || gamesForDay.length === 0) {
        console.log(`No games found for date ${currentDateStr}. Skipping.`);
        // Move to the previous day and continue
        currentDate.setDate(currentDate.getDate() - 1);
        currentDateStr = currentDate.toISOString().split("T")[0];
        continue;
      }

      // Check which games for this day are already processed
      const gameIdsForDay = gamesForDay.map((game) => game.id);
      const { data: processedGames, error: processedError } = await supabase
        .from("pbp_plays")
        .select("gameid")
        .in("gameid", gameIdsForDay);
      let processedGameIds = new Set();
      if (!processedError && processedGames) {
        processedGames.forEach((row) => processedGameIds.add(row.gameid));
      } else if (processedError) {
        console.error(
          "Error fetching processed games:",
          processedError.message
        );
      }

      // If all games for the day are processed, stop the backlog processing
      if (processedGameIds.size === gamesForDay.length) {
        console.log(
          `All games for ${currentDateStr} are already processed. Stopping backlog processing.`
        );
        break;
      }

      // Process only games that have not been processed yet
      await Promise.all(
        gamesForDay
          .filter((game) => !processedGameIds.has(game.id))
          .map(async (game) => {
            console.log(`Processing game ${game.id} on ${currentDateStr}...`);
            const gameData = await fetchPlayByPlayData(game.id);
            if (gameData) {
              // Log the number of plays for this game
              console.log(
                `Game ${game.id} on ${currentDateStr} returned ${gameData.plays.length} plays.`
              );
              if (gameData.plays && gameData.plays.length > 0) {
                await upsertPlayByPlayData(game.id, gameData);
              }
            } else {
              console.warn(
                `No play-by-play data found for game ${game.id} on ${currentDateStr}.`
              );
            }
          })
      );

      const dayEndTime = Date.now();
      const dayDuration = dayEndTime - dayStartTime;
      console.log(
        `Finished processing for date ${currentDateStr}. Time taken: ${(
          dayDuration / 1000
        ).toFixed(2)} seconds.`
      );

      // Move to the previous day
      currentDate.setDate(currentDate.getDate() - 1);
      currentDateStr = currentDate.toISOString().split("T")[0];
    }
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
