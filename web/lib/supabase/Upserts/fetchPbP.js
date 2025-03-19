require("dotenv").config({ path: "../../../.env.local" });
const { createClient } = require("@supabase/supabase-js");
import { parseISO, isBefore, isAfter } from "date-fns";

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

/**
 * Fetch seasons from the NHL API.
 * (Note: In production you might instead query the "seasons" table in Supabase.)
 */
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

/**
 * Determine the current season from the provided seasons.
 */
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

async function fetchCurrentSeason() {
  const seasons = await fetchNHLSeasons();
  const currentSeason = await determineCurrentSeason(seasons);
  return currentSeason;
}

/**
 * Fetch play-by-play data from the NHL API with retry logic.
 */
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

/**
 * Bulk upsert play-by-play data into Supabase for one game.
 * Each play record now gets a "game_date" field from gameData.gameDate.
 */
async function upsertPlayByPlayData(gameId, gameData) {
  if (gameData.plays && gameData.plays.length > 0) {
    // Build a list of play objects from all plays returned by the API
    const plays = gameData.plays.map((play) => {
      const details = play.details || {};
      return {
        id: play.eventId, // Use eventId directly as id
        gameid: gameId,
        game_date: gameData.gameDate, // New field added (YYYY-MM-DD format)
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
        reason: details.reason || null,
        updated_at: new Date().toISOString() // Set updated_at here
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

/**
 * Helper: Given an array of season objects (from the seasons table),
 * return an array of season IDs and a map of season boundaries.
 */
async function getSelectedSeasons() {
  // Option 1: Use a hard-coded slice (force processing only these seasons)
  // Uncomment the next line to force specific season IDs.
  // const forcedSeasonIds = ["20192020", "20202021", "20212022", "20222023", "20232024", "20242025"];

  // Option 2: Dynamically fetch all seasons from the "seasons" table.
  const { data: seasonsData, error } = await supabase
    .from("seasons")
    .select("*");
  if (error) {
    throw new Error("Error fetching seasons from Supabase: " + error.message);
  }
  // For fetchPbP, you might limit to a slice (e.g., the most recent 6 seasons)
  const sortedSeasons = seasonsData.sort((a, b) =>
    a.startDate < b.startDate ? 1 : -1
  );
  // Adjust slice as needed
  const forcedSeasonIds = sortedSeasons.slice(0, 6).map((s) => s.id.toString());

  // Build a map of boundaries { seasonId: { startDate, endDate } }
  const seasonBoundaries = {};
  seasonsData.forEach((season) => {
    if (forcedSeasonIds.includes(season.id.toString())) {
      seasonBoundaries[season.id.toString()] = {
        start: season.startDate, // expected format: YYYY-MM-DD
        end: season.endDate // use endDate (not regularSeasonEndDate)
      };
    }
  });

  return { seasonIds: forcedSeasonIds, seasonBoundaries };
}

/**
 * Process play-by-play data.
 *
 * @param {boolean} fullProcess - If true, process all games back to the backlog
 *                                and overwrite all data. If false, process only today's games.
 */
async function processPlayByPlayData(fullProcess = false) {
  // Get the selected season IDs and their date boundaries from the seasons table.
  const { seasonIds, seasonBoundaries } = await getSelectedSeasons();

  // In queries below, we restrict games by seasonId using our selected IDs.
  const selectedSeasons = seasonIds;

  if (!fullProcess) {
    // Process only today's games if not in fullProcess mode.
    const today = new Date().toISOString().split("T")[0];
    // Check if today's date falls in any selected season boundaries.
    const validForSomeSeason = selectedSeasons.some((sid) => {
      const { start, end } = seasonBoundaries[sid];
      return today >= start && today <= end;
    });
    if (!validForSomeSeason) {
      console.log(
        `Today's date ${today} is not within any season boundaries. Skipping.`
      );
      return;
    }

    console.log(`\n--- Processing date: ${today} ---`);
    const dayStartTime = Date.now();

    const { data: gamesForDay, error: errorForDay } = await supabase
      .from("games")
      .select("id, date, seasonId")
      .in("seasonId", selectedSeasons)
      .eq("date", today)
      .order("date", { ascending: false });
    if (errorForDay) {
      console.error(
        `Error fetching games for date ${today}:`,
        errorForDay.message
      );
      return;
    }
    if (!gamesForDay || gamesForDay.length === 0) {
      console.log(`No games found for date ${today}.`);
      return;
    }

    // For non-fullProcess mode, filter out games already processed.
    const gameIdsForDay = gamesForDay.map((game) => game.id);
    const { data: processedGames } = await supabase
      .from("pbp_plays")
      .select("gameid")
      .in("gameid", gameIdsForDay);
    let processedGameIds = new Set();
    if (processedGames) {
      processedGames.forEach((row) => processedGameIds.add(row.gameid));
    }
    const gamesToProcess = gamesForDay.filter(
      (game) => !processedGameIds.has(game.id)
    );
    console.log(
      `Found ${gamesForDay.length} games for ${today}. Skipping ${
        gamesForDay.length - gamesToProcess.length
      } already processed games.`
    );

    await Promise.all(
      gamesToProcess.map(async (game) => {
        console.log(`Processing game ${game.id} on ${today}...`);
        const gameData = await fetchPlayByPlayData(game.id);
        if (gameData) {
          console.log(
            `Game ${game.id} on ${today} returned ${gameData.plays.length} plays.`
          );
          if (gameData.plays && gameData.plays.length > 0) {
            await upsertPlayByPlayData(game.id, gameData);
          }
        } else {
          console.warn(
            `No play-by-play data found for game ${game.id} on ${today}.`
          );
        }
      })
    );

    const dayEndTime = Date.now();
    const dayDuration = dayEndTime - dayStartTime;
    console.log(
      `Finished processing for date ${today}. Time taken: ${(
        dayDuration / 1000
      ).toFixed(2)} seconds.`
    );
    return;
  } else {
    // Full backlog processing: loop backward day by day until no games are found.
    // Compute the earliest start date from the selected seasons.
    const earliestStartDate = Object.values(seasonBoundaries)
      .map((boundary) => boundary.start)
      .sort()[0];
    console.log(
      `Earliest start date among selected seasons: ${earliestStartDate}`
    );

    let currentDate = new Date();
    let currentDateStr = currentDate.toISOString().split("T")[0];

    while (true) {
      // Break condition: if currentDateStr is before the earliest season start date, stop processing.
      if (currentDateStr < earliestStartDate) {
        console.log(
          `Reached earliest season start date (${earliestStartDate}). Terminating backlog processing.`
        );
        break;
      }

      // Check if currentDateStr is within at least one selected season's boundaries.
      const validForSomeSeason = selectedSeasons.some((sid) => {
        const { start, end } = seasonBoundaries[sid];
        return currentDateStr >= start && currentDateStr <= end;
      });
      if (!validForSomeSeason) {
        console.log(
          `Date ${currentDateStr} is not within any season boundaries. Skipping.`
        );
        // Move to previous day and continue.
        currentDate.setDate(currentDate.getDate() - 1);
        currentDateStr = currentDate.toISOString().split("T")[0];
        continue;
      }

      console.log(`\n--- Processing date: ${currentDateStr} ---`);
      const dayStartTime = Date.now();

      const { data: gamesForDay, error: errorForDay } = await supabase
        .from("games")
        .select("id, date, seasonId")
        .in("seasonId", selectedSeasons)
        .eq("date", currentDateStr)
        .order("date", { ascending: false });
      if (errorForDay) {
        console.error(
          `Error fetching games for date ${currentDateStr}:`,
          errorForDay.message
        );
        // Move to previous day and continue.
        currentDate.setDate(currentDate.getDate() - 1);
        currentDateStr = currentDate.toISOString().split("T")[0];
        continue;
      }
      if (!gamesForDay || gamesForDay.length === 0) {
        console.log(`No games found for date ${currentDateStr}. Skipping.`);
        currentDate.setDate(currentDate.getDate() - 1);
        currentDateStr = currentDate.toISOString().split("T")[0];
        continue;
      }

      // In fullProcess mode, always update (overwrite) all games for the day.
      await Promise.all(
        gamesForDay.map(async (game) => {
          console.log(`Processing game ${game.id} on ${currentDateStr}...`);
          const gameData = await fetchPlayByPlayData(game.id);
          if (gameData) {
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

      // Move to the previous day.
      currentDate.setDate(currentDate.getDate() - 1);
      currentDateStr = currentDate.toISOString().split("T")[0];
    }
  }
}

// Main function now accepts a parameter to choose processing mode.
export async function main(fullProcess = false) {
  await processPlayByPlayData(fullProcess);
}

if (require.main === module) {
  // Default run (process today's games only)
  main();
}

module.exports = { main };
