// C:\Users\timbr\OneDrive\Desktop\fhfhockey.com-3\web\lib\supabase\sosStandings.js

require("dotenv").config({ path: "../../.env.local" });
const { createClient } = require("@supabase/supabase-js");
const fetch = require("node-fetch");
const { parseISO, format, addDays, isBefore, isAfter } = require("date-fns");
const ProgressBar = require("progress");
const winston = require("winston");
const fs = require("fs");

// Initialize Winston Logger
const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp({
      format: "YYYY-MM-DD HH:mm:ss"
    }),
    winston.format.printf(
      (info) =>
        `${info.timestamp} [${info.level.toUpperCase()}]: ${info.message}`
    )
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: "sosStandings.log" })
  ]
});

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Use service role key for server-side operations
// CHANGED SUPABASE THING
const supabase = createClient(supabaseUrl, supabaseKey);

// Team Information
const teamsInfo = {
  NJD: { name: "New Jersey Devils", franchiseId: 23, id: 1 },
  NYI: { name: "New York Islanders", franchiseId: 22, id: 2 },
  NYR: { name: "New York Rangers", franchiseId: 10, id: 3 },
  PHI: { name: "Philadelphia Flyers", franchiseId: 16, id: 4 },
  PIT: { name: "Pittsburgh Penguins", franchiseId: 17, id: 5 },
  BOS: { name: "Boston Bruins", franchiseId: 6, id: 6 },
  BUF: { name: "Buffalo Sabres", franchiseId: 19, id: 7 },
  MTL: { name: "Montréal Canadiens", franchiseId: 1, id: 8 },
  OTT: { name: "Ottawa Senators", franchiseId: 30, id: 9 },
  TOR: { name: "Toronto Maple Leafs", franchiseId: 5, id: 10 },
  CAR: { name: "Carolina Hurricanes", franchiseId: 26, id: 12 },
  FLA: { name: "Florida Panthers", franchiseId: 33, id: 13 },
  TBL: { name: "Tampa Bay Lightning", franchiseId: 31, id: 14 },
  WSH: { name: "Washington Capitals", franchiseId: 24, id: 15 },
  CHI: { name: "Chicago Blackhawks", franchiseId: 11, id: 16 },
  DET: { name: "Detroit Red Wings", franchiseId: 12, id: 17 },
  NSH: { name: "Nashville Predators", franchiseId: 34, id: 18 },
  STL: { name: "St. Louis Blues", franchiseId: 18, id: 19 },
  CGY: { name: "Calgary Flames", franchiseId: 21, id: 20 },
  COL: { name: "Colorado Avalanche", franchiseId: 27, id: 21 },
  EDM: { name: "Edmonton Oilers", franchiseId: 25, id: 22 },
  VAN: { name: "Vancouver Canucks", franchiseId: 20, id: 23 },
  ANA: { name: "Anaheim Ducks", franchiseId: 32, id: 24 },
  DAL: { name: "Dallas Stars", franchiseId: 15, id: 25 },
  LAK: { name: "Los Angeles Kings", franchiseId: 14, id: 26 },
  SJS: { name: "San Jose Sharks", franchiseId: 29, id: 28 },
  CBJ: { name: "Columbus Blue Jackets", franchiseId: 36, id: 29 },
  MIN: { name: "Minnesota Wild", franchiseId: 37, id: 30 },
  WPG: { name: "Winnipeg Jets", franchiseId: 35, id: 52 },
  ARI: { name: "Arizona Coyotes", franchiseId: 28, id: 53 },
  VGK: { name: "Vegas Golden Knights", franchiseId: 38, id: 54 },
  SEA: { name: "Seattle Kraken", franchiseId: 39, id: 55 },
  UTA: { name: "Utah Hockey Club", franchiseId: 40, id: 59 }
};

// Helper Function: Delay Execution for a Given Number of Milliseconds
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Helper Function: Retry Logic with Exponential Backoff
async function retryOperation(
  operation,
  retries = 10,
  delayMs = 1000,
  factor = 2
) {
  try {
    return await operation();
  } catch (error) {
    if (retries <= 0) {
      throw error;
    }
    logger.warn(
      `Operation failed: ${error.message}. Retrying in ${delayMs} ms... (${retries} retries left)`
    );
    await delay(delayMs);
    return retryOperation(operation, retries - 1, delayMs * factor, factor);
  }
}

// Fetch NHL Seasons
async function fetchNHLSeasons() {
  const url =
    "https://api.nhle.com/stats/rest/en/season?sort=%5B%7B%22property%22:%22id%22,%22direction%22:%22DESC%22%7D%5D";
  try {
    const response = await Fetch(url);
    return response.data;
  } catch (error) {
    logger.error(`Failed to fetch NHL seasons: ${error.message}`);
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

  if (!currentSeason) {
    logger.error("Unable to determine the current or latest NHL season.");
    throw new Error("Unable to determine the current or latest NHL season.");
  }

  return currentSeason;
}

// Enhanced Fetch Function with Logging
async function Fetch(url) {
  logger.info(`Fetching URL: ${url}`);
  try {
    const response = await fetch(url);
    if (!response.ok) {
      logger.error(
        `Failed to fetch ${url}: ${response.status} ${response.statusText}`
      );
      throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
    }
    const data = await response.json();
    logger.info(`Successfully fetched data from ${url}`);
    return data;
  } catch (error) {
    logger.error(`Exception during fetching ${url}: ${error.message}`);
    throw error;
  }
}

// Fetch Daily Standings and Upsert to sos_standings
async function fetchDailyStandings(season, teams) {
  const { startDate, regularSeasonEndDate, id: seasonId } = season;
  const start = parseISO(startDate);
  const end = parseISO(regularSeasonEndDate);
  const totalDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
  const bar = new ProgressBar("Fetching Standings [:bar] :percent :etas", {
    total: totalDays,
    width: 40
  });

  // Map to store standings per team
  const standingsMap = {}; // team_abbrev -> array of standings rows

  for (let i = 0; i < totalDays; i++) {
    const currentDate = addDays(start, i);
    const formattedDate = format(currentDate, "yyyy-MM-dd");
    const url = `https://api-web.nhle.com/v1/standings/${formattedDate}`;

    try {
      const data = await retryOperation(() => Fetch(url));
      // Assume data.standings is an array of team standings
      const standings = data.standings;

      // Collect all standingsData for the day
      const standingsDataBatch = standings
        .map((teamStanding) => {
          const teamAbbrev = teamStanding.teamAbbrev.default;
          const teamInfo = teams[teamAbbrev];
          if (!teamInfo) {
            logger.warn(
              `Team abbreviation ${teamAbbrev} not found in teamsInfo.`
            );
            return null;
          }

          // Prepare the standings row for sos_standings
          const rowSosStandings = {
            season_id: seasonId,
            game_date: formattedDate,
            team_id: teamInfo.id,
            team_name: teamStanding.teamName.default || null, // Handle potential NULL
            team_abbrev: teamStanding.teamAbbrev.default,
            team_wins: teamStanding.wins || 0,
            team_losses: teamStanding.losses || 0,
            team_ot_losses: teamStanding.otLosses || 0,
            team_points: teamStanding.points || 0,
            team_point_pct: teamStanding.pointPctg || 0,
            team_win_pct: teamStanding.winPctg || 0,
            team_games_played: teamStanding.gamesPlayed || 0,
            past_opponents: [], // Initialize as empty array
            future_opponents: [] // Initialize as empty array
          };

          // Initialize standingsMap for the team if not present
          if (!standingsMap[teamAbbrev]) {
            standingsMap[teamAbbrev] = [];
          }
          standingsMap[teamAbbrev].push({
            season_id: rowSosStandings.season_id,
            game_date: rowSosStandings.game_date,
            team_id: rowSosStandings.team_id,
            past_opponents: rowSosStandings.past_opponents,
            future_opponents: rowSosStandings.future_opponents
          });

          return rowSosStandings;
        })
        .filter(Boolean); // Remove null entries

      if (standingsDataBatch.length > 0) {
        // Upsert each row individually
        for (const row of standingsDataBatch) {
          try {
            const { error } = await retryOperation(() =>
              supabase.from("sos_standings").upsert([row], {
                onConflict: ["season_id", "game_date", "team_id"]
              })
            );
            if (error) {
              logger.error(
                `Failed to upsert standings for Team ID ${row.team_id} on ${row.game_date}: ${error.message}`
              );
            }
          } catch (error) {
            logger.error(
              `Exception during upserting standings for Team ID ${row.team_id} on ${row.game_date}: ${error.message}`
            );
          }
        }
        logger.info(
          `Successfully upserted sos_standings for ${formattedDate}.`
        );
      }
    } catch (error) {
      logger.error(
        `Failed to fetch standings for ${formattedDate}: ${error.message}`
      );
      // Optionally, log the failed date for manual review or further processing
    }

    bar.tick();
  }

  return standingsMap;
}

// Fetch All Standings from raw_standings_sos for Current Season
async function fetchRawStandings(seasonId) {
  const batchSize = 1000;
  let page = 0;
  let fetchedAll = false;
  const allStandings = [];

  while (!fetchedAll) {
    const fetchOperation = async () => {
      const response = await supabase
        .from("raw_standings_sos")
        .select("*", { count: "exact" })
        .eq("season_id", seasonId)
        .range(page * batchSize, (page + 1) * batchSize - 1)
        .order("date", { ascending: true });

      if (response.error) {
        throw response.error;
      }

      return response;
    };

    try {
      const response = await retryOperation(fetchOperation);
      const { data, count } = response;

      allStandings.push(...data);

      if ((page + 1) * batchSize >= count) {
        fetchedAll = true;
      } else {
        page += 1;
      }

      logger.info(`Fetched batch ${page + 1} of raw_standings_sos.`);
    } catch (error) {
      logger.error(
        `Failed to fetch raw_standings_sos (Page ${page + 1}): ${error.message}`
      );
      throw error; // For now, we'll abort
    }
  }

  logger.info(
    `Total raw_standings_sos records fetched: ${allStandings.length}`
  );
  return allStandings;
}

// Fetch and Process Game Logs
async function fetchAndProcessGameLogs(currentSeason, standingsMap) {
  const uniqueTeamAbbrevs = Object.keys(standingsMap);

  const teamGameLogs = {}; // team_abbrev -> array of game objects

  logger.info("Fetching game logs for each team...");

  for (const teamAbbrev of uniqueTeamAbbrevs) {
    const url = `https://api-web.nhle.com/v1/club-schedule-season/${teamAbbrev}/${currentSeason.id}`;
    try {
      const data = await retryOperation(() => Fetch(url));
      const games = data.games;

      // Filter for regular season games (gameType === 2)
      const regularSeasonGames = games.filter((game) => game.gameType === 2);

      // Map games to required info
      const mappedGames = regularSeasonGames
        .map((game) => {
          // Determine opponent
          let opponentTeam = null;
          if (game.awayTeam.abbrev === teamAbbrev) {
            opponentTeam = game.homeTeam;
          } else if (game.homeTeam.abbrev === teamAbbrev) {
            opponentTeam = game.awayTeam;
          } else {
            logger.warn(
              `Team abbreviation ${teamAbbrev} does not match either away or home team in game ID ${game.id}.`
            );
          }

          if (!opponentTeam) {
            return null; // Skip if opponent not found
          }

          return {
            game_id: game.id,
            game_type: game.gameType,
            game_date: game.gameDate,
            opponent_team_id: opponentTeam.id,
            opponent_team_name: opponentTeam.abbrev
          };
        })
        .filter(Boolean); // Remove null entries

      // Sort games by game_date
      mappedGames.sort((a, b) => new Date(a.game_date) - new Date(b.game_date));

      teamGameLogs[teamAbbrev] = mappedGames;
      logger.info(`Fetched and processed game log for ${teamAbbrev}.`);
    } catch (error) {
      logger.error(
        `Failed to fetch game log for ${teamAbbrev}: ${error.message}`
      );
      teamGameLogs[teamAbbrev] = []; // Assign empty array on failure
    }
  }

  return teamGameLogs;
}

// Update Standings with Opponents from raw_standings_sos
async function updateStandingsWithOpponents(
  seasonId,
  standingsMap,
  rawStandings,
  teamGameLogs
) {
  logger.info("Updating standings with past and future opponents...");

  // Build a lookup map: `${team_id}_${date}` => { wins, losses, ot_losses }
  const standingsLookup = {};
  rawStandings.forEach((standings) => {
    const dateStr = format(parseISO(standings.date), "yyyy-MM-dd");
    const key = `${standings.team_id}_${dateStr}`;
    standingsLookup[key] = {
      wins: standings.wins,
      losses: standings.losses,
      ot_losses: standings.ot_losses
    };
  });

  const updates = []; // Array of update objects

  // Iterate over each team
  for (const [teamAbbrev, standingsRows] of Object.entries(standingsMap)) {
    const gameLog = teamGameLogs[teamAbbrev] || [];

    if (gameLog.length === 0) {
      logger.warn(`No game log available for team ${teamAbbrev}. Skipping...`);
      continue;
    }

    // Iterate over each standings row for the team
    for (const row of standingsRows) {
      const gameDate = row.game_date;
      const formattedGameDate = format(parseISO(gameDate), "yyyy-MM-dd");

      // Find past opponents (games on or before gameDate)
      const pastOpponents = gameLog
        .filter((game) => game.game_date <= formattedGameDate)
        .map((game) => {
          const key = `${game.opponent_team_id}_${formattedGameDate}`;
          const opponentStandings = standingsLookup[key];

          if (!opponentStandings) {
            logger.warn(
              `No standings found for opponent_team_id ${game.opponent_team_id} on ${formattedGameDate}. Setting wins, losses, and ot_losses to 0.`
            );
          }

          return {
            game_id: game.game_id,
            game_date: game.game_date,
            game_type: game.game_type,
            opponent_team_id: game.opponent_team_id,
            opponent_team_name: game.opponent_team_name,
            opponent_wins_on_date: opponentStandings
              ? opponentStandings.wins
              : 0,
            opponent_losses_on_date: opponentStandings
              ? opponentStandings.losses
              : 0,
            opponent_ot_losses_on_date: opponentStandings
              ? opponentStandings.ot_losses
              : 0
          };
        });

      // Find future opponents (games after gameDate)
      const futureOpponents = gameLog
        .filter((game) => game.game_date > formattedGameDate)
        .map((game) => {
          const key = `${game.opponent_team_id}_${formattedGameDate}`;
          const opponentStandings = standingsLookup[key];

          if (!opponentStandings) {
            logger.warn(
              `No standings found for opponent_team_id ${game.opponent_team_id} on ${formattedGameDate}. Setting wins, losses, and ot_losses to 0.`
            );
          }

          return {
            game_id: game.game_id,
            game_date: game.game_date,
            game_type: game.game_type,
            opponent_team_id: game.opponent_team_id,
            opponent_team_name: game.opponent_team_name,
            opponent_wins_on_date: opponentStandings
              ? opponentStandings.wins
              : 0,
            opponent_losses_on_date: opponentStandings
              ? opponentStandings.losses
              : 0,
            opponent_ot_losses_on_date: opponentStandings
              ? opponentStandings.ot_losses
              : 0
          };
        });

      updates.push({
        season_id: seasonId,
        game_date: gameDate,
        team_id: row.team_id,
        past_opponents: pastOpponents,
        future_opponents: futureOpponents
      });
    }
  }

  // Row-by-Row Update for Opponents
  logger.info("Starting row-by-row upsert for opponents...");

  let successfulOpponentsUpserts = 0;
  let failedOpponentsUpserts = 0;

  for (const update of updates) {
    const rowIdentifier = `Team ID ${update.team_id} on ${update.game_date}`;

    // Validate past_opponents and future_opponents
    if (
      !Array.isArray(update.past_opponents) ||
      !Array.isArray(update.future_opponents)
    ) {
      logger.warn(
        `Invalid opponents data format for ${rowIdentifier}. Skipping upsert.`
      );
      failedOpponentsUpserts += 1;
      continue;
    }

    // Optionally, add more validation here if needed

    try {
      const { error } = await retryOperation(() =>
        supabase.from("sos_standings").upsert([update], {
          onConflict: ["season_id", "game_date", "team_id"]
        })
      );

      if (error) {
        logger.error(
          `Failed to upsert opponents for ${rowIdentifier}: ${error.message}`
        );
        failedOpponentsUpserts += 1;
      } else {
        successfulOpponentsUpserts += 1;
      }
    } catch (error) {
      logger.error(
        `Exception during upserting opponents for ${rowIdentifier}: ${error.message}`
      );
      failedOpponentsUpserts += 1;
    }
  }

  logger.info(
    `Opponents upsert completed. Successful: ${successfulOpponentsUpserts}, Failed: ${failedOpponentsUpserts}.`
  );

  // **New Step: Calculate and Upsert Total Opponent Records Row-by-Row**
  logger.info("Calculating and upserting total opponent records row-by-row...");

  const standingsFetchBatchSize = 1000; // Keeping batch size for fetching to balance performance
  let pageTotals = 0;
  let fetchedAllTotals = false;

  // Initialize counters for totals upsert
  let successfulTotalsUpserts = 0;
  let failedTotalsUpserts = 0;

  while (!fetchedAllTotals) {
    logger.info(`Fetching totals batch ${pageTotals + 1}...`);

    // Define the fetch operation with retry
    const fetchOperation = async () => {
      const response = await supabase
        .from("sos_standings")
        .select(
          "season_id, game_date, team_id, past_opponents, future_opponents"
        )
        .eq("season_id", seasonId) // Filter by season_id to reduce data fetched
        .range(
          pageTotals * standingsFetchBatchSize,
          (pageTotals + 1) * standingsFetchBatchSize - 1
        );

      if (response.error) {
        throw response.error;
      }

      return response.data;
    };

    let standingsData;

    try {
      standingsData = await retryOperation(fetchOperation);
    } catch (error) {
      logger.error(
        `Failed to fetch standings for totals calculation on batch ${
          pageTotals + 1
        }: ${error.message}`
      );
      // Optionally, decide whether to continue or abort the script
      break; // Exit the loop or handle as needed
    }

    if (standingsData.length === 0) {
      fetchedAllTotals = true;
      logger.info("No more standings data to process for totals.");
      break;
    }

    logger.info(
      `Processing totals batch ${pageTotals + 1} with ${
        standingsData.length
      } rows.`
    );

    // Iterate through each standings row to calculate and upsert totals
    for (const row of standingsData) {
      const rowIdentifier = `Team ID ${row.team_id} on ${row.game_date}`;

      // Validate past_opponents and future_opponents
      if (
        !Array.isArray(row.past_opponents) ||
        !Array.isArray(row.future_opponents)
      ) {
        logger.warn(
          `Invalid opponents data format for ${rowIdentifier}. Skipping calculation.`
        );
        failedTotalsUpserts += 1;
        continue;
      }

      // Calculate totals for past opponents
      let past_total_wins = 0;
      let past_total_losses = 0;
      let past_total_ot_losses = 0;

      for (const opponent of row.past_opponents) {
        const wins = Number(opponent.opponent_wins_on_date);
        const losses = Number(opponent.opponent_losses_on_date);
        const ot_losses = Number(opponent.opponent_ot_losses_on_date);

        if (isNaN(wins) || isNaN(losses) || isNaN(ot_losses)) {
          logger.warn(
            `Invalid opponent data for past opponent in ${rowIdentifier}. Skipping opponent.`
          );
          continue;
        }

        past_total_wins += wins;
        past_total_losses += losses;
        past_total_ot_losses += ot_losses;
      }

      // Calculate totals for future opponents
      let future_total_wins = 0;
      let future_total_losses = 0;
      let future_total_ot_losses = 0;

      for (const opponent of row.future_opponents) {
        const wins = Number(opponent.opponent_wins_on_date);
        const losses = Number(opponent.opponent_losses_on_date);
        const ot_losses = Number(opponent.opponent_ot_losses_on_date);

        if (isNaN(wins) || isNaN(losses) || isNaN(ot_losses)) {
          logger.warn(
            `Invalid opponent data for future opponent in ${rowIdentifier}. Skipping opponent.`
          );
          continue;
        }

        future_total_wins += wins;
        future_total_losses += losses;
        future_total_ot_losses += ot_losses;
      }

      // Prepare the update object with totals
      const totalsUpdate = {
        season_id: row.season_id,
        game_date: row.game_date,
        team_id: row.team_id,
        past_opponent_total_wins: past_total_wins,
        past_opponent_total_losses: past_total_losses,
        past_opponent_total_ot_losses: past_total_ot_losses,
        future_opponent_total_wins: future_total_wins,
        future_opponent_total_losses: future_total_losses,
        future_opponent_total_ot_losses: future_total_ot_losses
      };

      // Log if any totals are zero unexpectedly
      if (
        past_total_wins === 0 &&
        past_total_losses === 0 &&
        past_total_ot_losses === 0 &&
        future_total_wins === 0 &&
        future_total_losses === 0 &&
        future_total_ot_losses === 0
      ) {
        logger.warn(
          `All opponent totals are zero for ${rowIdentifier}. Check data integrity.`
        );
      }

      // Upsert the totals row
      try {
        const { error } = await retryOperation(() =>
          supabase.from("sos_standings").upsert([totalsUpdate], {
            onConflict: ["season_id", "game_date", "team_id"]
          })
        );

        if (error) {
          logger.error(
            `Failed to upsert totals for ${rowIdentifier}: ${error.message}`
          );
          failedTotalsUpserts += 1;
        } else {
          successfulTotalsUpserts += 1;
        }
      } catch (error) {
        logger.error(
          `Exception during upserting totals for ${rowIdentifier}: ${error.message}`
        );
        failedTotalsUpserts += 1;
      }
    }

    logger.info(
      `Totals upsert for batch ${
        pageTotals + 1
      } completed. Successful: ${successfulTotalsUpserts}, Failed: ${failedTotalsUpserts}.`
    );

    // Determine if all data has been fetched
    if (standingsData.length < standingsFetchBatchSize) {
      fetchedAllTotals = true;
      logger.info("All standings data processed for totals calculation.");
    } else {
      pageTotals += 1;
    }
  }

  logger.info(
    `Totals upsert completed. Successful: ${successfulTotalsUpserts}, Failed: ${failedTotalsUpserts}.`
  );
  logger.info("Standings updated with past and future opponents' totals.");
}

// Main Execution Function
(async () => {
  try {
    // Step 1: Fetch NHL seasons and determine the current season
    const seasons = await fetchNHLSeasons();
    const currentSeason = await determineCurrentSeason(seasons);

    logger.info(
      `Fetching standings for Season ID: ${currentSeason.id} (${currentSeason.startDate} to ${currentSeason.regularSeasonEndDate})`
    );

    // Step 2: Fetch and upsert standings into sos_standings
    const standingsMap = await fetchDailyStandings(currentSeason, teamsInfo);

    logger.info("Standings upserted successfully into sos_standings.");

    // Step 3: Fetch all standings from raw_standings_sos for the current season
    const rawStandings = await fetchRawStandings(currentSeason.id);

    // Step 4: Fetch and process game logs
    const teamGameLogs = await fetchAndProcessGameLogs(
      currentSeason,
      standingsMap
    );

    // Step 5: Update standings with opponents' records using raw_standings_sos data
    await updateStandingsWithOpponents(
      currentSeason.id,
      standingsMap,
      rawStandings,
      teamGameLogs
    );

    logger.info("Standings data fetching and upserting completed.");
  } catch (error) {
    logger.error(
      `An error occurred during the fetching process: ${error.message}`
    );
  }
})();
