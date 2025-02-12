// C:\Users\timbr\OneDrive\Desktop\fhfhockey.com-3\web\lib\supabase\sosStandings.js

require("dotenv").config({ path: "../../.env.local" });
const { createClient } = require("@supabase/supabase-js");
const fetch = require("node-fetch");
const { parseISO, format, addDays, isBefore, isAfter } = require("date-fns");
const ProgressBar = require("progress");

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
// CHANGED SUPABASE THING
// Use service role key for server-side operations
const supabase = createClient(supabaseUrl, supabaseKey);

// Utility function to fetch and parse JSON
async function Fetch(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
  }
  return response.json();
}

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

// Fetch NHL Seasons
async function fetchNHLSeasons() {
  const url =
    "https://api.nhle.com/stats/rest/en/season?sort=%5B%7B%22property%22:%22id%22,%22direction%22:%22DESC%22%7D%5D";
  const response = await Fetch(url);
  return response.data;
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

// Fetch Daily Standings and Upsert to Supabase
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
      const data = await Fetch(url);
      // Assume data.standings is an array of team standings
      const standings = data.standings;

      // Collect all standingsData for the day
      const standingsDataBatch = standings
        .map((teamStanding) => {
          const teamAbbrev = teamStanding.teamAbbrev.default;
          const teamInfo = teams[teamAbbrev];
          if (!teamInfo) {
            console.warn(
              `Team abbreviation ${teamAbbrev} not found in teamsInfo.`
            );
            return null;
          }

          // Prepare the standings row
          const row = {
            season_id: seasonId,
            game_date: formattedDate,
            game_type: teamStanding.game_type || null, // Handle potential NULL
            team_id: teamInfo.id,
            team_name: teamStanding.team_common_name || null, // Handle potential NULL
            team_abbrev: teamAbbrev,
            team_wins: teamStanding.wins || null,
            team_losses: teamStanding.losses || null,
            team_ot_losses: teamStanding.ot_losses || null,
            team_points: teamStanding.points || null,
            team_point_pct: teamStanding.point_pctg || null,
            team_win_pct: teamStanding.win_pctg || null,
            team_games_played: teamStanding.games_played || null
          };

          // Initialize standingsMap for the team if not present
          if (!standingsMap[teamAbbrev]) {
            standingsMap[teamAbbrev] = [];
          }
          standingsMap[teamAbbrev].push({
            season_id: row.season_id,
            game_date: row.game_date,
            team_id: row.team_id,
            past_opponents: null,
            future_opponents: null
          });

          return row;
        })
        .filter(Boolean); // Remove null entries

      if (standingsDataBatch.length > 0) {
        // Batch upsert into Supabase
        const { data: upsertedData, error } = await supabase
          .from("sos_standings")
          .upsert(standingsDataBatch, {
            onConflict: ["season_id", "game_date", "team_id"]
          });

        if (error) {
          console.error(
            `Error batch upserting standings for ${formattedDate}:`,
            error
          );
        } else {
          console.log(`Successfully upserted standings for ${formattedDate}.`);
        }
      }
    } catch (error) {
      console.error(`Failed to fetch standings for ${formattedDate}:`, error);
    }

    bar.tick();
  }

  return standingsMap;
}

// Fetch and Process Game Logs
async function fetchAndProcessGameLogs(currentSeason, standingsMap) {
  const uniqueTeamAbbrevs = Object.keys(standingsMap);

  const teamGameLogs = {}; // team_abbrev -> array of game objects

  console.log("Fetching game logs for each team...");

  const fetchGameLogPromises = uniqueTeamAbbrevs.map(async (teamAbbrev) => {
    const url = `https://api-web.nhle.com/v1/club-schedule-season/${teamAbbrev}/${currentSeason.id}`;
    try {
      const data = await Fetch(url);
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
            console.warn(
              `Team abbreviation ${teamAbbrev} does not match either away or home team in game ID ${game.id}.`
            );
          }

          if (!opponentTeam) {
            return null; // Skip if opponent not found
          }

          return {
            game_id: game.id,
            game_date: game.gameDate,
            opponent_team_id: opponentTeam.id,
            opponent_team_name: opponentTeam.placeName.default
          };
        })
        .filter(Boolean); // Remove null entries

      // Sort games by game_date
      mappedGames.sort((a, b) => new Date(a.game_date) - new Date(b.game_date));

      teamGameLogs[teamAbbrev] = mappedGames;
      console.log(`Fetched and processed game log for ${teamAbbrev}.`);
    } catch (error) {
      console.error(`Failed to fetch game log for ${teamAbbrev}:`, error);
      teamGameLogs[teamAbbrev] = []; // Assign empty array on failure
    }
  });

  // Fetch all game logs in parallel
  await Promise.all(fetchGameLogPromises);

  return teamGameLogs;
}

// Update Standings with Opponents
async function updateStandingsWithOpponents(
  seasonId,
  standingsMap,
  teamGameLogs
) {
  console.log("Updating standings with past and future opponents...");

  const updates = []; // Array of update objects

  // Iterate over each team
  for (const [teamAbbrev, standingsRows] of Object.entries(standingsMap)) {
    const gameLog = teamGameLogs[teamAbbrev] || [];

    if (gameLog.length === 0) {
      console.warn(`No game log available for team ${teamAbbrev}. Skipping...`);
      continue;
    }

    // Iterate over each standings row for the team
    for (const row of standingsRows) {
      const gameDate = row.game_date;
      const gameDateObj = parseISO(gameDate);

      // Find past opponents (games on or before gameDate)
      const pastOpponents = gameLog
        .filter((game) => {
          const gameDateObj = parseISO(game.game_date);
          return gameDateObj <= gameDateObj;
        })
        .map((game) => ({
          game_id: game.game_id,
          game_date: game.game_date,
          opponent_team_id: game.opponent_team_id,
          opponent_team_name: game.opponent_team_name
        }));

      // Find future opponents (games after gameDate)
      const futureOpponents = gameLog
        .filter((game) => {
          const gameDateObj = parseISO(game.game_date);
          return gameDateObj > gameDateObj;
        })
        .map((game) => ({
          game_id: game.game_id,
          game_date: game.game_date,
          opponent_team_id: game.opponent_team_id,
          opponent_team_name: game.opponent_team_name
        }));

      updates.push({
        season_id: seasonId,
        game_date: gameDate,
        team_id: row.team_id,
        past_opponents: pastOpponents,
        future_opponents: futureOpponents
      });
    }
  }

  // Batch update with a reasonable batch size to prevent overloading
  const batchSize = 100; // Adjust as necessary
  for (let i = 0; i < updates.length; i += batchSize) {
    const batch = updates.slice(i, i + batchSize);

    try {
      const { data, error } = await supabase
        .from("sos_standings")
        .upsert(batch, {
          onConflict: ["season_id", "game_date", "team_id"]
        });

      if (error) {
        console.error(
          `Error batch upserting opponents for batch starting at index ${i}:`,
          error
        );
      } else {
        console.log(
          `Successfully upserted opponents for batch starting at index ${i}.`
        );
      }
    } catch (error) {
      console.error(
        `Unexpected error during batch upserting opponents for batch starting at index ${i}:`,
        error
      );
    }
  }

  console.log("Standings updated with past and future opponents.");
}

// Main Execution Function
(async () => {
  try {
    const seasons = await fetchNHLSeasons();
    const currentSeason = await determineCurrentSeason(seasons);

    if (!currentSeason) {
      throw new Error("Unable to determine the current or latest NHL season.");
    }

    console.log(
      `Fetching standings for Season ID: ${currentSeason.id} (${currentSeason.startDate} to ${currentSeason.regularSeasonEndDate})`
    );

    // Step 1: Fetch and upsert standings, and collect standingsMap
    const standingsMap = await fetchDailyStandings(currentSeason, teamsInfo);

    console.log("Standings upserted successfully.");

    // Step 2: Fetch and process game logs
    const teamGameLogs = await fetchAndProcessGameLogs(
      currentSeason,
      standingsMap
    );

    // Step 3: Update standings with opponents
    await updateStandingsWithOpponents(
      currentSeason.id,
      standingsMap,
      teamGameLogs
    );

    console.log("Standings data fetching and upserting completed.");
  } catch (error) {
    console.error("An error occurred during the fetching process:", error);
  }
})();
