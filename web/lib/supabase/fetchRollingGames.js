// C:\Users\timbr\OneDrive\Desktop\fhfhockey.com-3\web\lib\supabase\fetchRollingGames.js

require("dotenv").config({ path: "../../.env.local" });
const { createClient } = require("@supabase/supabase-js");
const fetch = require("node-fetch");
const { parseISO, isBefore } = require("date-fns");

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; // Corrected environment variable
const supabase = createClient(supabaseUrl, supabaseKey);

// Utility function to fetch and parse JSON with error handling
async function Fetch(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
  }
  return response.json();
}

// Team Information for looping through franchise IDs
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
};

// Helper function for fetching all rows with pagination
async function fetchAllRows(table, options = {}) {
  const { filters = {}, order = { column: "id", ascending: true } } = options;
  const limit = 1000;
  let start = 0;
  let allData = [];
  let hasMoreData = true;

  while (hasMoreData) {
    let query = supabase
      .from(table)
      .select("*")
      .range(start, start + limit - 1);

    // Apply filters
    for (const [key, value] of Object.entries(filters)) {
      query = query.eq(key, value);
    }

    // Apply ordering
    if (order.column) {
      query = query.order(order.column, { ascending: order.ascending });
    }

    const { data, error } = await query;

    if (error) {
      console.error(`Error fetching data from table ${table}:`, error);
      break;
    }

    if (data.length > 0) {
      allData = allData.concat(data);
      start += limit;
      // If fetched less than limit, no more data
      if (data.length < limit) {
        hasMoreData = false;
      }
    } else {
      hasMoreData = false;
    }
  }

  return allData;
}

// Fetch NHL Seasons
async function fetchNHLSeasons() {
  const url =
    "https://api.nhle.com/stats/rest/en/season?sort=%5B%7B%22property%22:%22id%22,%22direction%22:%22DESC%22%7D%5D";
  const response = await Fetch(url);
  return response.data;
}

// Determine Current Season (or Previous Season in Offseason)
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
    } else if (today >= seasonStartDate && today <= regularSeasonEndDate) {
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

// Function to fetch data from a specific endpoint
async function fetchEndpointData(url) {
  try {
    const data = await Fetch(url);
    return data.data;
  } catch (error) {
    console.error(`Error fetching data from ${url}:`, error);
    return [];
  }
}

// Function to format date without time
function formatDateWithoutTime(dateString) {
  return dateString.split("T")[0]; // Split at 'T' and return only the date part
}

// Function to fetch and upsert rolling games data with pagination and opponent_team_id lookup
async function fetchAndUpsertAllGames(
  franchiseId,
  startDate,
  regularSeasonEndDate,
  teamsInfo
) {
  let start = 0;
  const limit = 100; // Set the limit to 100 as requested
  let hasMoreData = true;
  const formattedStartDate = formatDateWithoutTime(startDate);
  const formattedEndDate = formatDateWithoutTime(regularSeasonEndDate);

  while (hasMoreData) {
    // Define URLs for the four endpoints (added penaltyUrl)
    const summaryUrl = `https://api.nhle.com/stats/rest/en/team/summary?isAggregate=false&isGame=true&sort=%5B%7B%22property%22:%22gameDate%22,%22direction%22:%22ASC%22%7D,%7B%22property%22:%22teamId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=${limit}&cayenneExp=franchiseId%3D${franchiseId}%20and%20gameDate%3C=%22${formattedEndDate}%2023%3A59%3A59%22%20and%20gameDate%3E=%22${formattedStartDate}%22%20and%20gameTypeId=2`;
    const realtimeUrl = `https://api.nhle.com/stats/rest/en/team/realtime?isAggregate=false&isGame=true&sort=%5B%7B%22property%22:%22gameDate%22,%22direction%22:%22ASC%22%7D,%7B%22property%22:%22teamId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=${limit}&cayenneExp=franchiseId%3D${franchiseId}%20and%20gameDate%3C=%22${formattedEndDate}%2023%3A59%3A59%22%20and%20gameDate%3E=%22${formattedStartDate}%22%20and%20gameTypeId=2`;
    const powerPlayUrl = `https://api.nhle.com/stats/rest/en/team/powerplay?isAggregate=false&isGame=true&sort=%5B%7B%22property%22:%22powerPlayPct%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22teamId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=${limit}&cayenneExp=franchiseId%3D${franchiseId}%20and%20gameDate%3C=%22${formattedEndDate}%2023%3A59%3A59%22%20and%20gameDate%3E=%22${formattedStartDate}%22%20and%20gameTypeId=2`;
    const penaltyUrl = `https://api.nhle.com/stats/rest/en/team/penalties?isAggregate=false&isGame=true&sort=%5B%7B%22property%22:%22penaltyMinutes%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22teamId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=${limit}&cayenneExp=franchiseId%3D${franchiseId}%20and%20gameDate%3C=%22${formattedEndDate}%2023%3A59%3A59%22%20and%20gameDate%3E=%22${formattedStartDate}%22%20and%20gameTypeId=2`;

    // Fetch data from all four endpoints in parallel
    const [summaryData, realtimeData, powerPlayData, penaltyData] =
      await Promise.all([
        fetchEndpointData(summaryUrl),
        fetchEndpointData(realtimeUrl),
        fetchEndpointData(powerPlayUrl),
        fetchEndpointData(penaltyUrl),
      ]);

    console.log(
      `Fetched ${summaryData.length} summary games, ${realtimeData.length} realtime games, ${powerPlayData.length} powerplay games, ${penaltyData.length} penalty games for franchise ID ${franchiseId}.`
    );

    if (
      summaryData.length === 0 &&
      realtimeData.length === 0 &&
      powerPlayData.length === 0 &&
      penaltyData.length === 0
    ) {
      hasMoreData = false;
      break;
    }

    // Create maps for realtime, powerplay, and penalty data keyed by gameId and teamId for quick lookup
    const realtimeMap = new Map();
    realtimeData.forEach((game) => {
      realtimeMap.set(`${game.gameId}_${game.teamId}`, game);
    });

    const powerPlayMap = new Map();
    powerPlayData.forEach((game) => {
      powerPlayMap.set(`${game.gameId}_${game.teamId}`, game);
    });

    const penaltyMap = new Map();
    penaltyData.forEach((game) => {
      penaltyMap.set(`${game.gameId}_${game.teamId}`, game);
    });

    // Prepare merged data for upsert
    const mergedGamesData = summaryData
      .map((summaryGame) => {
        const key = `${summaryGame.gameId}_${summaryGame.teamId}`;
        const realtimeGame = realtimeMap.get(key);
        const powerPlayGame = powerPlayMap.get(key);
        const penaltyGame = penaltyMap.get(key);

        if (!realtimeGame) {
          console.warn(
            `Realtime data not found for gameId: ${summaryGame.gameId}, teamId: ${summaryGame.teamId}. Skipping.`
          );
          return null; // Skip if no matching realtime data
        }

        if (!powerPlayGame) {
          console.warn(
            `PowerPlay data not found for gameId: ${summaryGame.gameId}, teamId: ${summaryGame.teamId}. Skipping.`
          );
          return null; // Skip if no matching powerplay data
        }

        if (!penaltyGame) {
          console.warn(
            `Penalty data not found for gameId: ${summaryGame.gameId}, teamId: ${summaryGame.teamId}. Skipping.`
          );
          return null; // Skip if no matching penalty data
        }

        const opponentAbbrev = summaryGame.opponentTeamAbbrev;
        const opponentTeam = teamsInfo[opponentAbbrev];

        if (!opponentTeam) {
          console.warn(
            `Opponent abbreviation ${opponentAbbrev} not found in teamsInfo. Skipping gameId: ${summaryGame.gameId}.`
          );
          return null; // Skip if opponent team not found
        }

        return {
          game_id: summaryGame.gameId,
          team_id: summaryGame.teamId,
          opponent_team_id: opponentTeam.id, // Lookup opponent team ID
          game_date: summaryGame.gameDate,
          // Removed game_type_id since it's no longer needed
          faceoff_win_pct: summaryGame.faceoffWinPct,
          goals_against: summaryGame.goalsAgainst,
          goals_for: summaryGame.goalsFor,
          home_road: summaryGame.homeRoad,
          losses: summaryGame.losses,
          ot_losses: summaryGame.otLosses,
          penalty_kill_pct: summaryGame.penaltyKillPct,
          point_pct: summaryGame.pointPct,
          points: summaryGame.points,
          power_play_pct: summaryGame.powerPlayPct,
          regulation_and_ot_wins: summaryGame.regulationAndOtWins,
          shots_against_per_game: summaryGame.shotsAgainstPerGame,
          shots_for_per_game: summaryGame.shotsForPerGame,
          team_full_name: summaryGame.teamFullName,
          wins: summaryGame.wins,
          wins_in_regulation: summaryGame.winsInRegulation,
          wins_in_shootout: summaryGame.winsInShootout,

          // Fields from realtime endpoint
          blocked_shots: realtimeGame.blockedShots,
          blocked_shots_per60: realtimeGame.blockedShotsPer60,
          empty_net_goals: realtimeGame.emptyNetGoals,
          giveaways: realtimeGame.giveaways,
          giveaways_per60: realtimeGame.giveawaysPer60,
          hits: realtimeGame.hits,
          hits_per60: realtimeGame.hitsPer60,
          missed_shots: realtimeGame.missedShots,
          sat_pct: realtimeGame.satPct,
          takeaways: realtimeGame.takeaways,
          takeaways_per60: realtimeGame.takeawaysPer60,
          time_on_ice_per_game_5v5: realtimeGame.timeOnIcePerGame5v5,

          // Fields from powerplay endpoint
          power_play_goals_for: powerPlayGame.powerPlayGoalsFor,
          power_play_pct: powerPlayGame.powerPlayPct,
          pp_opportunities: powerPlayGame.ppOpportunities,
          pp_time_on_ice_per_game: powerPlayGame.ppTimeOnIcePerGame,
          sh_goals_against: powerPlayGame.shGoalsAgainst,

          // Fields from penalty endpoint
          pim: penaltyGame.penaltyMinutes,
        };
      })
      .filter(Boolean); // Remove null entries

    if (mergedGamesData.length > 0) {
      // Upsert data into Supabase
      const { data: upsertedData, error } = await supabase
        .from("rolling_games")
        .upsert(mergedGamesData, { onConflict: ["game_id", "team_id"] });

      if (error) {
        console.error("Error upserting rolling games data:", error);
      } else {
        console.log(
          `Successfully upserted ${mergedGamesData.length} rolling games data for franchise ID ${franchiseId}.`
        );
      }
    } else {
      console.log(
        `No merged game data to upsert for franchise ID ${franchiseId} in this batch.`
      );
    }

    // Move to the next batch
    start += limit;

    // If fewer than 100 games returned, we've reached the end
    if (
      summaryData.length < limit ||
      realtimeData.length < limit ||
      powerPlayData.length < limit ||
      penaltyData.length < limit
    ) {
      hasMoreData = false;
    }
  }
}

// Function to calculate and update cumulative statistics
async function calculateAndUpdateCumulativeStats(currentSeason) {
  const teamIds = Object.values(teamsInfo).map((team) => team.id);

  // Fetch all games sorted by game_date ascending for all teams with pagination
  const allGames = await fetchAllRollingGames();

  if (!allGames) {
    console.error("Failed to fetch all games from rolling_games table.");
    return;
  }

  // Fetch all standings data for the current season with pagination
  const standingsData = await fetchAllRows("standings", {
    filters: { season_id: currentSeason.id },
    order: { column: "date", ascending: true },
  });

  if (!standingsData || standingsData.length === 0) {
    console.error("No standings data found for the current season.");
    return;
  }

  console.log(`Total standings records fetched: ${standingsData.length}`);

  // Create a map from team_id to an array of standings sorted by date ascending
  const standingsMap = new Map();
  standingsData.forEach((standingsRow) => {
    const teamId = standingsRow.team_id;
    const date = standingsRow.date.split("T")[0];
    if (!standingsMap.has(teamId)) {
      standingsMap.set(teamId, []);
    }
    standingsMap.get(teamId).push({
      date: date,
      wins: standingsRow.wins,
      losses: standingsRow.losses,
      ot_losses: standingsRow.ot_losses,
    });
  });

  // Log the number of standings records per team
  standingsMap.forEach((standings, teamId) => {
    console.log(`Team ID ${teamId} has ${standings.length} standings records.`);
  });

  // Function to find the latest standings up to a given date for a team
  function findLatestStandings(teamId, gameDate) {
    const teamStandings = standingsMap.get(teamId);
    if (!teamStandings) return null;

    // Binary search for the latest date <= gameDate
    let left = 0;
    let right = teamStandings.length - 1;
    let result = null;

    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const midDate = teamStandings[mid].date;

      if (midDate === gameDate) {
        return teamStandings[mid];
      } else if (midDate < gameDate) {
        result = teamStandings[mid];
        left = mid + 1;
      } else {
        right = mid - 1;
      }
    }

    return result;
  }

  // Process each team separately
  for (const teamId of teamIds) {
    // Filter games for the current team and sort by date ascending
    const teamGames = allGames
      .filter((game) => game.team_id === teamId)
      .sort((a, b) => new Date(a.game_date) - new Date(b.game_date));

    if (teamGames.length === 0) {
      console.log(`No games found for team_id ${teamId}. Skipping.`);
      continue;
    }

    console.log(
      `\nProcessing statistics for Team ID ${teamId} with ${teamGames.length} games.`
    );

    let gameNumber = 1; // Initialize game_number
    let cumulative_opponent_wins = 0;
    let cumulative_opponent_losses = 0;
    let cumulative_opponent_ot_losses = 0;

    for (const game of teamGames) {
      // Assign game_number
      const currentGameNumber = gameNumber;

      // Find opponent's standings up to this game date
      const opponentId = game.opponent_team_id;
      const gameDate = formatDateWithoutTime(game.game_date);
      const opponentStandings = findLatestStandings(opponentId, gameDate);

      let opponent_wins = 0;
      let opponent_losses = 0;
      let opponent_ot_losses = 0;

      if (opponentStandings) {
        opponent_wins = opponentStandings.wins;
        opponent_losses = opponentStandings.losses;
        opponent_ot_losses = opponentStandings.ot_losses;
      } else {
        console.warn(
          `Standings not found for opponent_team_id ${opponentId} on or before date ${gameDate}. Setting opponent_wins, opponent_losses, opponent_ot_losses to 0.`
        );
      }

      // Update cumulative opponent stats
      cumulative_opponent_wins += opponent_wins;
      cumulative_opponent_losses += opponent_losses;
      cumulative_opponent_ot_losses += opponent_ot_losses;

      // Prepare update payload
      const updatePayload = {
        game_number: currentGameNumber,
        opponent_wins: cumulative_opponent_wins,
        opponent_losses: cumulative_opponent_losses,
        opponent_ot_losses: cumulative_opponent_ot_losses,
      };

      // Update the game record in the database
      const { error } = await supabase
        .from("rolling_games")
        .update(updatePayload)
        .eq("game_id", game.game_id)
        .eq("team_id", teamId);

      if (error) {
        console.error(
          `Error updating game_number for game_id ${game.game_id}:`,
          error
        );
      } else {
        console.log(
          `Updated game_number ${currentGameNumber} for Team ID ${teamId}, Game ID ${game.game_id}`
        );
      }

      gameNumber += 1; // Increment game_number
    }

    console.log(`Completed game_number assignment for Team ID ${teamId}.`);
  }

  // After assigning game_numbers, calculate LTG and STD opponent stats
  await calculateOpponentAndLtgStats(currentSeason, teamIds, standingsMap);
}

// Helper function to fetch all rolling_games with pagination
async function fetchAllRollingGames() {
  const table = "rolling_games";
  const options = {
    order: { column: "game_date", ascending: true },
  };
  const allGames = await fetchAllRows(table, options);
  return allGames;
}

// Function to calculate and update opponent_* and LTG/STD opponent_* stats
async function calculateOpponentAndLtgStats(
  currentSeason,
  teamIds,
  standingsMap
) {
  // Fetch all games sorted by game_date ascending for all teams with pagination
  const allGames = await fetchAllRollingGames();

  if (!allGames) {
    console.error("Failed to fetch all games from rolling_games table.");
    return;
  }

  // Create a map from team_id to their games sorted by date ascending
  const teamGamesMap = new Map();
  teamIds.forEach((teamId) => {
    const games = allGames
      .filter((game) => game.team_id === teamId)
      .sort((a, b) => new Date(a.game_date) - new Date(b.game_date));
    teamGamesMap.set(teamId, games);
  });

  for (const teamId of teamIds) {
    const games = teamGamesMap.get(teamId);

    if (!games || games.length === 0) {
      console.log(
        `No games found for team_id ${teamId} during opponent stats calculation.`
      );
      continue;
    }

    console.log(
      `\nCalculating opponent and LTG/STD opponent stats for Team ID ${teamId}.`
    );

    // Initialize accumulators for STD (Standard) stats
    let stdRates = {
      faceoff_win_pct: 0,
      penalty_kill_pct: 0,
      power_play_pct: 0,
      point_pct: 0,
      shots_for_per_game: 0,
      shots_against_per_game: 0,
      blocked_shots_per60: 0,
      giveaways_per60: 0,
      hits_per60: 0,
      sat_pct: 0,
      pp_time_on_ice_per_game: 0,
      time_on_ice_per_game_5v5: 0,
    };

    let stdCounts = {
      goals_against: 0,
      goals_for: 0,
      losses: 0,
      ot_losses: 0,
      points: 0,
      regulation_and_ot_wins: 0,
      wins: 0,
      blocked_shots: 0,
      empty_net_goals: 0,
      giveaways: 0,
      takeaways: 0,
      missed_shots: 0,
      hits: 0,
      pim: 0,
      power_play_goals_for: 0,
      pp_opportunities: 0,
      sh_goals_against: 0,
    };

    let cumulative_std_opponent_wins = 0;
    let cumulative_std_opponent_losses = 0;
    let cumulative_std_opponent_ot_losses = 0;

    // Arrays to hold std_game_ids, std_opponent_team_ids, std_home_roads
    let std_game_ids = [];
    let std_opponent_team_ids = [];
    let std_home_roads = [];

    for (let i = 0; i < games.length; i++) {
      const game = games[i];
      const gameId = game.game_id;
      const gameDate = formatDateWithoutTime(game.game_date);
      const opponentId = game.opponent_team_id;

      // Fetch opponent's standings up to this game date
      const opponentStandings = findLatestStandings(
        standingsMap,
        opponentId,
        gameDate
      );

      let opponent_wins = 0;
      let opponent_losses = 0;
      let opponent_ot_losses = 0;

      if (opponentStandings) {
        opponent_wins = opponentStandings.wins;
        opponent_losses = opponentStandings.losses;
        opponent_ot_losses = opponentStandings.ot_losses;
      } else {
        console.warn(
          `Standings not found for opponent_team_id ${opponentId} on or before date ${gameDate}. Setting opponent_wins, opponent_losses, opponent_ot_losses to 0.`
        );
      }

      // Prepare opponent update payload
      const opponentUpdatePayload = {
        opponent_wins,
        opponent_losses,
        opponent_ot_losses,
      };

      // Update opponent_* columns
      const { error: opponentError } = await supabase
        .from("rolling_games")
        .update(opponentUpdatePayload)
        .eq("game_id", gameId)
        .eq("team_id", teamId);

      if (opponentError) {
        console.error(
          `Error updating opponent stats for game_id ${gameId}:`,
          opponentError
        );
      } else {
        console.log(
          `Updated opponent stats for Team ID ${teamId}, Game ID ${gameId}`
        );
      }

      // Update STD (Standard) accumulators
      stdRates.faceoff_win_pct += game.faceoff_win_pct;
      stdRates.penalty_kill_pct += game.penalty_kill_pct;
      stdRates.power_play_pct += game.power_play_pct;
      stdRates.point_pct += game.point_pct;
      stdRates.shots_for_per_game += game.shots_for_per_game;
      stdRates.shots_against_per_game += game.shots_against_per_game;
      stdRates.blocked_shots_per60 += game.blocked_shots_per60;
      stdRates.giveaways_per60 += game.giveaways_per60;
      stdRates.hits_per60 += game.hits_per60;
      stdRates.sat_pct += game.sat_pct;
      stdRates.pp_time_on_ice_per_game += game.pp_time_on_ice_per_game;
      stdRates.time_on_ice_per_game_5v5 += game.time_on_ice_per_game_5v5;

      stdCounts.goals_against += game.goals_against;
      stdCounts.goals_for += game.goals_for;
      stdCounts.losses += game.losses;
      stdCounts.ot_losses += game.ot_losses;
      stdCounts.points += game.points;
      stdCounts.regulation_and_ot_wins += game.regulation_and_ot_wins;
      stdCounts.wins += game.wins;
      stdCounts.blocked_shots += game.blocked_shots;
      stdCounts.empty_net_goals += game.empty_net_goals;
      stdCounts.giveaways += game.giveaways;
      stdCounts.takeaways += game.takeaways;
      stdCounts.missed_shots += game.missed_shots;
      stdCounts.hits += game.hits;
      stdCounts.pim += game.pim;
      stdCounts.power_play_goals_for += game.power_play_goals_for;
      stdCounts.pp_opportunities += game.pp_opportunities;
      stdCounts.sh_goals_against += game.sh_goals_against;

      // Update cumulative STD opponent stats
      cumulative_std_opponent_wins += opponent_wins;
      cumulative_std_opponent_losses += opponent_losses;
      cumulative_std_opponent_ot_losses += opponent_ot_losses;

      // Populate std_* arrays
      std_game_ids.push(game.game_id);
      std_opponent_team_ids.push(game.opponent_team_id);
      std_home_roads.push(game.home_road);

      // Calculate STD averages
      const stdGameCount = i + 1;
      const std_faceoff_win_pct = stdRates.faceoff_win_pct / stdGameCount;
      const std_penalty_kill_pct = stdRates.penalty_kill_pct / stdGameCount;
      const std_power_play_pct = stdRates.power_play_pct / stdGameCount;
      const std_point_pct = stdRates.point_pct / stdGameCount;
      const std_shots_for_per_game = stdRates.shots_for_per_game / stdGameCount;
      const std_shots_against_per_game =
        stdRates.shots_against_per_game / stdGameCount;
      const std_blocked_shots_per60 =
        stdRates.blocked_shots_per60 / stdGameCount;
      const std_giveaways_per60 = stdRates.giveaways_per60 / stdGameCount;
      const std_hits_per60 = stdRates.hits_per60 / stdGameCount;
      const std_sat_pct = stdRates.sat_pct / stdGameCount;
      const std_pp_time_on_ice_per_game =
        stdRates.pp_time_on_ice_per_game / stdGameCount;
      const std_time_on_ice_per_game_5v5 =
        stdRates.time_on_ice_per_game_5v5 / stdGameCount;

      // Calculate std_date_range
      const stdStartGameDate = formatDateWithoutTime(games[0].game_date);
      const stdCurrentGameDate = formatDateWithoutTime(game.game_date);
      const std_date_range = `${stdStartGameDate} to ${stdCurrentGameDate}`;

      // Prepare STD update payload
      const stdUpdatePayload = {
        std_faceoff_win_pct,
        std_penalty_kill_pct,
        std_power_play_pct,
        std_point_pct,
        std_shots_for_per_game,
        std_shots_against_per_game,
        std_blocked_shots_per60,
        std_giveaways_per60,
        std_hits_per60,
        std_sat_pct,
        std_pp_time_on_ice_per_game,
        std_time_on_ice_per_game_5v5,
        std_goals_against: stdCounts.goals_against,
        std_goals_for: stdCounts.goals_for,
        std_losses: stdCounts.losses,
        std_ot_losses: stdCounts.ot_losses,
        std_points: stdCounts.points,
        std_regulation_and_ot_wins: stdCounts.regulation_and_ot_wins,
        std_wins: stdCounts.wins,
        std_blocked_shots: stdCounts.blocked_shots,
        std_empty_net_goals: stdCounts.empty_net_goals,
        std_giveaways: stdCounts.giveaways,
        std_takeaways: stdCounts.takeaways,
        std_missed_shots: stdCounts.missed_shots,
        std_hits: stdCounts.hits,
        std_pim: stdCounts.pim,
        std_power_play_goals_for: stdCounts.power_play_goals_for,
        std_pp_opportunities: stdCounts.pp_opportunities,
        std_sh_goals_against: stdCounts.sh_goals_against,
        std_date_range, // Added std_date_range
        std_opponent_wins: cumulative_std_opponent_wins,
        std_opponent_losses: cumulative_std_opponent_losses,
        std_opponent_ot_losses: cumulative_std_opponent_ot_losses,
        std_game_ids, // Added std_game_ids array
        std_opponent_team_ids, // Added std_opponent_team_ids array
        std_home_roads, // Added std_home_roads array
      };

      // Update the game record in the database with STD stats
      const { error: stdError } = await supabase
        .from("rolling_games")
        .update(stdUpdatePayload)
        .eq("game_id", game.game_id)
        .eq("team_id", teamId);

      if (stdError) {
        console.error(
          `Error updating STD stats for game_id ${gameId}:`,
          stdError
        );
      } else {
        console.log(
          `Updated STD stats for Team ID ${teamId}, Game ID ${gameId}`
        );
      }

      // Calculate LTG (Last Ten Games) stats
      const ltgStartIndex = Math.max(0, i - 9); // Last 10 games including current
      const lastTenGames = games.slice(ltgStartIndex, i + 1);

      // Initialize accumulators for LTG
      let ltgRates = {
        faceoff_win_pct: 0,
        penalty_kill_pct: 0,
        power_play_pct: 0,
        point_pct: 0,
        shots_for_per_game: 0,
        shots_against_per_game: 0,
        blocked_shots_per60: 0,
        giveaways_per60: 0,
        hits_per60: 0,
        sat_pct: 0,
        pp_time_on_ice_per_game: 0,
        time_on_ice_per_game_5v5: 0,
      };

      let ltgCounts = {
        goals_against: 0,
        goals_for: 0,
        losses: 0,
        ot_losses: 0,
        points: 0,
        regulation_and_ot_wins: 0,
        wins: 0,
        blocked_shots: 0,
        empty_net_goals: 0,
        giveaways: 0,
        takeaways: 0,
        missed_shots: 0,
        hits: 0,
        pim: 0,
        power_play_goals_for: 0,
        pp_opportunities: 0,
        sh_goals_against: 0,
      };

      let cumulative_opponent_wins = 0;
      let cumulative_opponent_losses = 0;
      let cumulative_opponent_ot_losses = 0;

      // Arrays to hold ltg_game_ids, ltg_opponent_team_ids, ltg_home_roads
      let ltg_game_ids = [];
      let ltg_opponent_team_ids = [];
      let ltg_home_roads = [];

      for (const ltgGame of lastTenGames) {
        ltgRates.faceoff_win_pct += ltgGame.faceoff_win_pct;
        ltgRates.penalty_kill_pct += ltgGame.penalty_kill_pct;
        ltgRates.power_play_pct += ltgGame.power_play_pct;
        ltgRates.point_pct += ltgGame.point_pct;
        ltgRates.shots_for_per_game += ltgGame.shots_for_per_game;
        ltgRates.shots_against_per_game += ltgGame.shots_against_per_game;
        ltgRates.blocked_shots_per60 += ltgGame.blocked_shots_per60;
        ltgRates.giveaways_per60 += ltgGame.giveaways_per60;
        ltgRates.hits_per60 += ltgGame.hits_per60;
        ltgRates.sat_pct += ltgGame.sat_pct;
        ltgRates.pp_time_on_ice_per_game += ltgGame.pp_time_on_ice_per_game;
        ltgRates.time_on_ice_per_game_5v5 += ltgGame.time_on_ice_per_game_5v5;

        ltgCounts.goals_against += ltgGame.goals_against;
        ltgCounts.goals_for += ltgGame.goals_for;
        ltgCounts.losses += ltgGame.losses;
        ltgCounts.ot_losses += ltgGame.ot_losses;
        ltgCounts.points += ltgGame.points;
        ltgCounts.regulation_and_ot_wins += ltgGame.regulation_and_ot_wins;
        ltgCounts.wins += ltgGame.wins;
        ltgCounts.blocked_shots += ltgGame.blocked_shots;
        ltgCounts.empty_net_goals += ltgGame.empty_net_goals;
        ltgCounts.giveaways += ltgGame.giveaways;
        ltgCounts.takeaways += ltgGame.takeaways;
        ltgCounts.missed_shots += ltgGame.missed_shots;
        ltgCounts.hits += ltgGame.hits;
        ltgCounts.pim += ltgGame.pim;
        ltgCounts.power_play_goals_for += ltgGame.power_play_goals_for;
        ltgCounts.pp_opportunities += ltgGame.pp_opportunities;
        ltgCounts.sh_goals_against += ltgGame.sh_goals_against;

        // Fetch opponent's standings for LTG
        const ltgOpponentId = ltgGame.opponent_team_id;
        const ltgGameDate = formatDateWithoutTime(ltgGame.game_date);

        const ltgStandings = findLatestStandings(
          standingsMap,
          ltgOpponentId,
          ltgGameDate
        );

        if (ltgStandings) {
          cumulative_opponent_wins += ltgStandings.wins;
          cumulative_opponent_losses += ltgStandings.losses;
          cumulative_opponent_ot_losses += ltgStandings.ot_losses;
        } else {
          console.warn(
            `Standings not found for opponent_team_id ${ltgOpponentId} on or before date ${ltgGameDate}. Setting ltg_opponent_wins, ltg_opponent_losses, ltg_opponent_ot_losses to 0.`
          );
        }

        // Populate arrays
        ltg_game_ids.push(ltgGame.game_id);
        ltg_opponent_team_ids.push(ltgGame.opponent_team_id);
        ltg_home_roads.push(ltgGame.home_road);
      }

      const ltgGameCount = lastTenGames.length;
      const ltg_faceoff_win_pct = ltgRates.faceoff_win_pct / ltgGameCount;
      const ltg_penalty_kill_pct = ltgRates.penalty_kill_pct / ltgGameCount;
      const ltg_power_play_pct = ltgRates.power_play_pct / ltgGameCount;
      const ltg_point_pct = ltgRates.point_pct / ltgGameCount;
      const ltg_shots_for_per_game = ltgRates.shots_for_per_game / ltgGameCount;
      const ltg_shots_against_per_game =
        ltgRates.shots_against_per_game / ltgGameCount;
      const ltg_blocked_shots_per60 =
        ltgRates.blocked_shots_per60 / ltgGameCount;
      const ltg_giveaways_per60 = ltgRates.giveaways_per60 / ltgGameCount;
      const ltg_hits_per60 = ltgRates.hits_per60 / ltgGameCount;
      const ltg_sat_pct = ltgRates.sat_pct / ltgGameCount;
      const ltg_pp_time_on_ice_per_game =
        ltgRates.pp_time_on_ice_per_game / ltgGameCount;
      const ltg_time_on_ice_per_game_5v5 =
        ltgRates.time_on_ice_per_game_5v5 / ltgGameCount;

      // Calculate ltg_date_range
      const ltgStartGameDate = formatDateWithoutTime(lastTenGames[0].game_date);
      const ltgCurrentGameDate = formatDateWithoutTime(game.game_date);
      const ltg_date_range = `${ltgStartGameDate} to ${ltgCurrentGameDate}`;

      // Prepare LTG update payload
      const ltgUpdatePayload = {
        ltg_faceoff_win_pct,
        ltg_penalty_kill_pct,
        ltg_power_play_pct,
        ltg_point_pct,
        ltg_shots_for_per_game,
        ltg_shots_against_per_game,
        ltg_blocked_shots_per60,
        ltg_giveaways_per60,
        ltg_hits_per60,
        ltg_sat_pct,
        ltg_pp_time_on_ice_per_game,
        ltg_time_on_ice_per_game_5v5,
        ltg_goals_against: ltgCounts.goals_against,
        ltg_goals_for: ltgCounts.goals_for,
        ltg_losses: ltgCounts.losses,
        ltg_ot_losses: ltgCounts.ot_losses,
        ltg_points: ltgCounts.points,
        ltg_regulation_and_ot_wins: ltgCounts.regulation_and_ot_wins,
        ltg_wins: ltgCounts.wins,
        ltg_blocked_shots: ltgCounts.blocked_shots,
        ltg_empty_net_goals: ltgCounts.empty_net_goals,
        ltg_giveaways: ltgCounts.giveaways,
        ltg_takeaways: ltgCounts.takeaways,
        ltg_missed_shots: ltgCounts.missed_shots,
        ltg_hits: ltgCounts.hits,
        ltg_pim: ltgCounts.pim,
        ltg_power_play_goals_for: ltgCounts.power_play_goals_for,
        ltg_pp_opportunities: ltgCounts.pp_opportunities,
        ltg_sh_goals_against: ltgCounts.sh_goals_against,
        ltg_date_range, // Added ltg_date_range
        ltg_opponent_wins: cumulative_opponent_wins,
        ltg_opponent_losses: cumulative_opponent_losses,
        ltg_opponent_ot_losses: cumulative_opponent_ot_losses,
        ltg_game_ids, // Added ltg_game_ids array
        ltg_opponent_team_ids, // Added ltg_opponent_team_ids array
        ltg_home_roads, // Added ltg_home_roads array
      };

      // Update the game record in the database
      const { error: ltgError } = await supabase
        .from("rolling_games")
        .update(ltgUpdatePayload)
        .eq("game_id", game.game_id)
        .eq("team_id", teamId);

      if (ltgError) {
        console.error(
          `Error updating LTG stats for game_id ${gameId}:`,
          ltgError
        );
      } else {
        console.log(
          `Updated LTG stats for Team ID ${teamId}, Game ID ${gameId}`
        );
      }
    }

    console.log(
      `Completed opponent and LTG/STD stats calculation for Team ID ${teamId}.`
    );
  }

  console.log("Cumulative statistics calculation completed for all teams.");
}

// Helper function to find latest standings
function findLatestStandings(standingsMap, teamId, gameDate) {
  const teamStandings = standingsMap.get(teamId);
  if (!teamStandings) return null;

  // Binary search for the latest date <= gameDate
  let left = 0;
  let right = teamStandings.length - 1;
  let result = null;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const midDate = teamStandings[mid].date;

    if (midDate === gameDate) {
      return teamStandings[mid];
    } else if (midDate < gameDate) {
      result = teamStandings[mid];
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }

  return result;
}

// Main function to execute fetching and upserting for each team, then calculating stats
(async () => {
  try {
    const seasons = await fetchNHLSeasons();
    const currentSeason = await determineCurrentSeason(seasons);

    if (!currentSeason) {
      throw new Error("Unable to determine the current or latest NHL season.");
    }

    console.log(
      `\nFetching rolling games data for Season ID: ${currentSeason.id} (${currentSeason.startDate} to ${currentSeason.regularSeasonEndDate})`
    );

    // Step 1: Fetch and upsert all game data for each team
    for (const teamKey in teamsInfo) {
      if (teamsInfo.hasOwnProperty(teamKey)) {
        const team = teamsInfo[teamKey];
        const franchiseId = team.franchiseId;
        const startDate = currentSeason.startDate; // Use dynamic start date from current season
        const regularSeasonEndDate = currentSeason.regularSeasonEndDate; // Use dynamic end date from current season

        console.log(
          `\nFetching and upserting rolling games data for Team: ${team.name} (Franchise ID: ${franchiseId})`
        );

        await fetchAndUpsertAllGames(
          franchiseId,
          startDate,
          regularSeasonEndDate,
          teamsInfo
        );
      }
    }

    console.log(
      "\nRolling games data fetching and upserting completed for all teams."
    );

    // Step 2: Calculate and update cumulative statistics
    await calculateAndUpdateCumulativeStats(currentSeason);

    console.log("Cumulative statistics calculated and updated successfully.");
  } catch (error) {
    console.error("An error occurred during the fetching process:", error);
  }
})();
