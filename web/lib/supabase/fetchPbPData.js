require("dotenv").config({ path: "../../.env.local" });
const { createClient } = require("@supabase/supabase-js");
const fetch = require("node-fetch"); // Ensure you have node-fetch or equivalent installed
const { format, subDays } = require("date-fns");
const { de } = require("date-fns/locale");

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_SUPABASE_SERVICE_ROLE_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTables() {
  try {
    const { data, error } = await supabase
      .from("pbp_games")
      .select("*")
      .limit(1);

    if (error) throw error;

    console.log("Connection to PbP_Games successful, data:", data);
  } catch (err) {
    console.error("Error accessing PbP_Games:", err.message);
  }
}

checkTables();

async function fetchMissingGameIDs() {
  // Fetch all game IDs from 'games' table
  const { data: allGameIds, error: allGamesError } = await supabase
    .from("games")
    .select("id");

  if (allGamesError) {
    console.error("Error fetching all game IDs:", allGamesError);
    return [];
  }

  // Fetch all game IDs from 'pbp_games' table
  const { data: pbpGameIds, error: pbpGamesError } = await supabase
    .from("pbp_games")
    .select("id");

  if (pbpGamesError) {
    console.error("Error fetching pbp game IDs:", pbpGamesError);
    return [];
  }

  const pbpGameIdSet = new Set(pbpGameIds.map((game) => game.id));
  const missingGameIds = allGameIds.filter(
    (game) => !pbpGameIdSet.has(game.id)
  );

  return missingGameIds.map((game) => game.id);
}

async function getMostRecentGameDate() {
  const { data, error } = await supabase
    .from("pbp_games")
    .select("date")
    .order("date", { ascending: false })
    .limit(1);

  if (error) {
    console.error("Error fetching most recent game date:", error);
    return null;
  }

  return data.length > 0 ? new Date(data[0].date) : null;
}

// Function to fetch game IDs from Supabase
async function fetchGameIDs(startDate) {
  const today = new Date();
  const startFetchDate = startDate
    ? format(startDate, "yyyy-MM-dd")
    : format(subDays(today, 180), "yyyy-MM-dd"); // Start from 180 days ago if no games exist
  const { data, error } = await supabase
    .from("games")
    .select("id")
    .eq("type", 2) // Only regular season games
    .gte("date", startFetchDate);

  if (error) {
    console.error("Error fetching game IDs:", error);
    return [];
  }

  return data.map((game) => game.id);
}

// Function to fetch play-by-play data from NHL API using the custom fetch wrapper
async function fetchPlayByPlayData(gameId) {
  const url = `https://api-web.nhle.com/v1/gamecenter/${gameId}/play-by-play`;
  try {
    const response = await fetch(url);
    return await response.json();
  } catch (error) {
    console.error(`Failed to fetch data for game ${gameId}:`, error);
    return null;
  }
}

// Function to process data and extract unique points
async function processGameData() {
  const missingGameIds = await fetchMissingGameIDs();

  // Concatenate missing games with the ones fetched from the API
  const gameIDs = missingGameIds.concat(await fetchGameIDs());

  for (const gameId of gameIDs) {
    console.log(`Starting scraping for Game: ${gameId}`);
    try {
      const gameData = await fetchPlayByPlayData(gameId);
      if (gameData) {
        await upsertGameData(gameId, gameData);
      }
      console.log(`Finished scraping for Game: ${gameId}`);
    } catch (error) {
      console.error(`Failed to process game ${gameId}: Retrying...`, error);
      await retryUpsert(gameId); // Retry logic
    }
  }
}

async function retryUpsert(gameId, attempts = 3) {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const gameData = await fetchPlayByPlayData(gameId);
      await upsertGameData(gameId, gameData);
      return; // Exit if successful
    } catch (error) {
      console.error(`Attempt ${attempt} failed for game ${gameId}:`, error);
      if (attempt === attempts)
        throw new Error(`Failed after ${attempts} attempts.`);
    }
  }
}

async function upsertGameData(gameId, gameData) {
  // Upsert Game data
  const gameUpsert = {
    id: gameId,
    date: gameData.gameDate,
    starttime: gameData.startTimeUTC,
    type: gameData.gameType,
    season: gameData.season,
    hometeamid: gameData.homeTeam.id,
    hometeamname: gameData.homeTeam.name.default,
    hometeamabbrev: gameData.homeTeam.abbrev,
    hometeamscore: gameData.homeTeam.score,
    hometeamshots: gameData.homeTeam.sog,
    awayteamid: gameData.awayTeam.id,
    awayteamname: gameData.awayTeam.name.default,
    awayteamabbrev: gameData.awayTeam.abbrev,
    awayteamscore: gameData.awayTeam.score,
    awayteamshots: gameData.awayTeam.sog,
    venue: gameData.venue.default,
    location: gameData.venueLocation.default,
    outcome: gameData.gameOutcome.lastPeriodType,
  };

  try {
    const { data, error } = await supabase.from("pbp_games").upsert(gameUpsert);
    if (error) throw error;

    // Upsert play data
    if (gameData.plays && gameData.plays.length > 0) {
      for (const play of gameData.plays) {
        const details = play.details || {};
        const playUpsert = {
          id: play.eventId,
          gameid: gameId,
          periodnumber: play.periodDescriptor.number,
          periodtype: play.periodDescriptor.periodType,
          timeinperiod: play.timeInPeriod,
          timeremaining: play.timeRemaining,
          situationcode: play.situationCode,
          typedesckey: play.typeDescKey,
          typecode: play.typeCode,
          hometeamdefendingside: play.homeTeamDefendingSide,
          sortorder: play.sortOrder,
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
        };

        const { data: playData, error: playError } = await supabase
          .from("pbp_plays")
          .upsert(playUpsert);

        if (playError) {
          console.error(
            `Error upserting play data for play ${play.eventId}:`,
            playError
          );
          continue; // Optionally skip this play on error
        }
      }
    }
  } catch (err) {
    console.error(`Error upserting data for game ${gameId}:`, err.message);
  }
}

processGameData();

module.exports = { processGameData }; // Export the function
