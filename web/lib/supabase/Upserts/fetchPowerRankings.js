// C:\Users\timbr\OneDrive\Desktop\fhfhockey.com-3\web\lib\supabase\fetchPowerRankings.js

require("dotenv").config({ path: "../../.env.local" });
const { createClient } = require("@supabase/supabase-js");
const fetch = require("node-fetch");
const { parseISO, format, addDays, isBefore, isAfter } = require("date-fns");
const ProgressBar = require("progress");

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_SUPABASE_SERVICE_ROLE_KEY;
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
      // If today is before the start of this season, check the next one
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

// Fetch Daily Standings
async function fetchDailyStandings(season, teams) {
  const { startDate, regularSeasonEndDate } = season;
  const start = parseISO(startDate);
  const end = parseISO(regularSeasonEndDate);
  const totalDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
  const bar = new ProgressBar("Fetching Standings [:bar] :percent :etas", {
    total: totalDays,
    width: 40
  });

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

          return {
            season_id: season.id,
            date: formattedDate,
            team_id: teamInfo.id,
            wins: teamStanding.wins || 0,
            losses: teamStanding.losses || 0,
            overtime_losses: teamStanding.otLosses || 0,
            points: teamStanding.points || 0,
            goal_differential: teamStanding.goalDifferentialPctg || 0, // Corrected
            points_percentage: teamStanding.pointPctg || 0,
            goals_for: teamStanding.goalsFor || 0,
            goals_against: teamStanding.goalsAgainst || 0,
            cumulative_wins: teamStanding.wins || 0, // Adjust if cumulative
            cumulative_losses: teamStanding.losses || 0, // Adjust if cumulative
            cumulative_overtime_losses: teamStanding.otLosses || 0 // Adjust if cumulative
            // Add other relevant cumulative fields as needed
          };
        })
        .filter(Boolean); // Remove null entries

      if (standingsDataBatch.length > 0) {
        // Batch upsert into Supabase
        const { error } = await supabase
          .from("standings")
          .upsert(standingsDataBatch, {
            onConflict: ["season_id", "date", "team_id"]
          });

        if (error) {
          console.error(
            `Error batch upserting standings for ${formattedDate}:`,
            error
          );
        }
      }
    } catch (error) {
      console.error(`Failed to fetch standings for ${formattedDate}:`, error);
    }

    bar.tick();
  }
}

// Fetch Team Schedules and Game IDs
async function fetchTeamSchedules(season, teams) {
  const teamAbbrevs = Object.keys(teams);
  const totalTeams = teamAbbrevs.length;
  const bar = new ProgressBar("Fetching Schedules [:bar] :percent :etas", {
    total: totalTeams,
    width: 40
  });

  for (const abbrev of teamAbbrevs) {
    const team = teams[abbrev];
    const scheduleUrl = `https://api-web.nhle.com/v1/club-schedule-season/${abbrev}/${season.id}`;

    try {
      const data = await Fetch(scheduleUrl);
      const games = data.games;

      for (const game of games) {
        const gameId = game.gameId;
        const gameDate = parseISO(game.gameDate);
        const opponentAbbrev = game.opponentTeam.abbrev;
        const isHomeGame = game.isHomeGame;

        const opponentInfo = teams[opponentAbbrev];
        if (!opponentInfo) {
          console.warn(
            `Opponent abbreviation ${opponentAbbrev} not found in teamsInfo.`
          );
          continue;
        }

        const scheduleData = {
          game_id: gameId,
          date: gameDate.toISOString(),
          season_id: season.id,
          start_time: gameDate.toISOString(),
          type: 2, // Regular season game
          home_team_id: isHomeGame ? team.id : opponentInfo.id,
          away_team_id: isHomeGame ? opponentInfo.id : team.id
          // Add other relevant fields as needed
        };

        // Upsert into Supabase
        const { error } = await supabase
          .from("games")
          .upsert(scheduleData, { onConflict: ["game_id"] });

        if (error) {
          console.error(`Error upserting game ${gameId}:`, error);
        }
      }
    } catch (error) {
      console.error(`Failed to fetch schedule for team ${abbrev}:`, error);
    }

    bar.tick();
  }
}

// Fetch Team Summaries (Boxscores) from `wgo_team_stats`
// Fetch Team Summaries (Boxscores) from `wgo_team_stats`
async function fetchTeamSummaries(season, teams) {
  // Build the Supabase query
  const query = supabase
    .from("games")
    .select("game_id, home_team_id, away_team_id, date")
    .eq("season_id", season.id)
    .eq("type", 2) // Regular season games
    .order("date", { ascending: true });

  let games = [];
  try {
    // Fetch all games with pagination
    games = await fetchAllWithPagination(query);
  } catch (error) {
    console.error("Error fetching games from Supabase:", error);
    return;
  }

  const totalTeams = games.length * 2; // Two teams per game
  const bar = new ProgressBar("Fetching Team Summaries [:bar] :percent :etas", {
    total: totalTeams,
    width: 40
  });

  for (const game of games) {
    const { game_id, home_team_id, away_team_id, date } = game;

    // Fetch wgo_team_stats for both teams in the game

    // Query by team_id and date instead of game_id
    const queryHome = supabase
      .from("wgo_team_stats")
      .select("*")
      .eq("team_id", home_team_id)
      .eq("date", date);

    const queryAway = supabase
      .from("wgo_team_stats")
      .select("*")
      .eq("team_id", away_team_id)
      .eq("date", date);

    // Fetch home team stats with pagination (though unlikely to exceed 1000)
    const [homeStats, awayStats] = await Promise.all([
      fetchAllWithPagination(queryHome),
      fetchAllWithPagination(queryAway)
    ]);

    const allWgoStats = [...homeStats, ...awayStats];

    if (allWgoStats.length === 0) {
      console.warn(`No wgo_team_stats found for game ${game_id}`);
      // Increment progress bar for both teams to avoid hanging
      bar.tick(2);
      continue;
    }

    // Process stats for each team in the game
    for (const stat of allWgoStats) {
      const teamId = stat.team_id;

      // Fetch all games up to and including the current game for std
      const querySeasonGames = supabase
        .from("wgo_team_stats")
        .select("*")
        .eq("team_id", teamId)
        .eq("season_id", season.id)
        .lte("date", date)
        .order("date", { ascending: true });

      let seasonGames = [];
      try {
        seasonGames = await fetchAllWithPagination(querySeasonGames);
      } catch (error) {
        console.error(`Error fetching season games for team ${teamId}:`, error);
        bar.tick();
        continue;
      }

      // Calculate Season-to-Date (std) Statistics
      const seasonStats = calculateAggregatedStats(seasonGames);

      // Fetch the last 10 games up to and including the current game for l_10
      const queryLastTenGames = supabase
        .from("wgo_team_stats")
        .select("*")
        .eq("team_id", teamId)
        .eq("season_id", season.id)
        .lte("date", date)
        .order("date", { ascending: false })
        .limit(10);

      let lastTenStats = [];
      try {
        lastTenStats = await fetchAllWithPagination(queryLastTenGames, 10);
      } catch (error) {
        console.error(
          `Error fetching last ten stats for team ${teamId}:`,
          error
        );
        bar.tick();
        continue;
      }

      // Calculate Last 10 Games (l_10) Statistics
      const l_10Stats = calculateAggregatedStats(lastTenStats);

      // Fetch ranks for each stat based on std
      const ranks = await calculateRanks(teamId, season.id, date);

      // Fetch SoS past and future
      const { sos_past, sos_future } = await calculateSoSForTeam(
        teamId,
        season.id,
        date
      );

      // Fetch season averages and records
      const { season_avg_pts_pct, season_avg_record } =
        await fetchSeasonAveragesAndRecord(teamId, season.id);

      // Fetch opponent aggregate records
      const opponent_past_aggregate_record = await fetchOpponentAggregateRecord(
        teamId,
        season.id,
        "past"
      );
      const opponent_future_aggregate_record =
        await fetchOpponentAggregateRecord(teamId, season.id, "future");

      // Prepare data for upsert
      const powerRankingData = {
        team_id: teamId,
        season_id: season.id,
        date: format(parseISO(date), "yyyy-MM-dd"),
        // Season-to-Date (std) Stats
        std_pim: seasonStats.pim,
        std_pts_pct: seasonStats.point_pct,
        std_hits: seasonStats.hits,
        std_blocks: seasonStats.blocked_shots,
        std_power_play_opportunities: seasonStats.pp_opportunities,
        std_goals_for: seasonStats.goals_for,
        std_goals_against: seasonStats.goals_against,
        std_goals_for_pct: seasonStats.goals_for_pct,
        std_shots_for: seasonStats.shots_for_per_game,
        std_power_play_pct: seasonStats.power_play_pct,
        std_penalty_kill_pct: seasonStats.penalty_kill_pct,
        // Last 10 Games (l_10) Stats
        l_10_pim: l_10Stats.pim,
        l_10_pts_pct: l_10Stats.point_pct,
        l_10_hits: l_10Stats.hits,
        l_10_blocks: l_10Stats.blocked_shots,
        l_10_power_play_opportunities: l_10Stats.pp_opportunities,
        l_10_goals_for: l_10Stats.goals_for,
        l_10_goals_against: l_10Stats.goals_against,
        l_10_goals_for_pct: l_10Stats.goals_for_pct,
        l_10_shots_for: l_10Stats.shots_for_per_game,
        l_10_power_play_pct: l_10Stats.power_play_pct,
        l_10_penalty_kill_pct: l_10Stats.penalty_kill_pct,
        // Ranks based on std
        rank_std_pim: ranks.std_pim_rank,
        rank_std_pts_pct: ranks.std_pts_pct_rank,
        rank_std_hits: ranks.std_hits_rank,
        rank_std_blocks: ranks.std_blocks_rank,
        rank_std_power_play_opportunities:
          ranks.std_power_play_opportunities_rank,
        rank_std_goals_for: ranks.std_goals_for_rank,
        rank_std_goals_for_pct: ranks.std_goals_for_pct_rank,
        rank_std_shots_for: ranks.std_shots_for_rank,
        rank_std_power_play_pct: ranks.std_power_play_pct_rank,
        rank_std_penalty_kill_pct: ranks.std_penalty_kill_pct_rank,
        // Strength of Schedule
        sos_past,
        sos_future,
        // Season Averages and Records
        season_avg_pts_pct,
        season_avg_record,
        // Opponent Aggregate Records
        opponent_past_aggregate_record,
        opponent_future_aggregate_record
        // Add other relevant fields as needed
      };

      // Upsert into Supabase
      const { error } = await supabase
        .from("power_rankings")
        .upsert(powerRankingData, {
          onConflict: ["team_id", "season_id", "date"]
        });

      if (error) {
        console.error(
          `Error upserting power_rankings for Team ID: ${teamId} on ${date}:`,
          error
        );
      }

      // Increment progress bar
      bar.tick();
    }
  }
}

// Calculate Averages
function average(data, key) {
  if (!data || data.length === 0) return 0;
  const sum = data.reduce((acc, item) => acc + (parseFloat(item[key]) || 0), 0);
  return sum / data.length;
}

// Calculate Ranks for Each Stat
async function calculateRanks(teamId, seasonId, date) {
  const statsKeys = [
    "std_pim",
    "std_pts_pct",
    "std_hits",
    "std_blocks",
    "std_power_play_opportunities",
    "std_goals_for",
    "std_goals_for_pct",
    "std_shots_for",
    "std_power_play_pct",
    "std_penalty_kill_pct"
  ];

  const ranks = {};

  for (const key of statsKeys) {
    // Build the Supabase query
    const query = supabase
      .from("power_rankings")
      .select(`team_id, ${key}`)
      .eq("season_id", seasonId)
      .lte("date", date);

    try {
      // Fetch all data with pagination
      const teamsStats = await fetchAllWithPagination(query);

      // Sort teams based on the stat in descending order
      const sortedTeams = teamsStats
        .filter((stat) => stat[key] !== null && stat[key] !== undefined)
        .sort((a, b) => b[key] - a[key]); // Descending order

      // Assign ranks
      let rank = 1;
      for (const stat of sortedTeams) {
        if (stat.team_id === teamId) {
          ranks[`${key}_rank`] = rank;
          break;
        }
        rank++;
      }

      // Handle cases where the team has no stats
      if (ranks[`${key}_rank`] === undefined) {
        ranks[`${key}_rank`] = null;
      }
    } catch (error) {
      console.error(`Error fetching stats for ranking ${key}:`, error);
      ranks[`${key}_rank`] = null;
    }
  }

  return ranks;
}

// Calculate Strength of Schedule (SoS) for a Team
// Calculate Strength of Schedule (SoS) for a Team
async function calculateSoSForTeam(teamId, seasonId, currentGameDate) {
  // Build the Supabase query
  const query = supabase
    .from("games")
    .select("home_team_id, away_team_id, date")
    .eq("season_id", seasonId)
    .order("date", { ascending: true });

  let games = [];
  try {
    // Fetch all games with pagination
    games = await fetchAllWithPagination(query);
  } catch (error) {
    console.error(`Error fetching games for SoS calculation:`, error);
    return { sos_past: 0, sos_future: 0 };
  }

  const pastGames = [];
  const futureGames = [];

  const currentDate = new Date(currentGameDate);

  games.forEach((game) => {
    const gameDate = new Date(game.date);
    if (game.home_team_id === teamId) {
      const opponentId = game.away_team_id;
      if (isBefore(gameDate, currentDate)) {
        pastGames.push(opponentId);
      } else {
        futureGames.push(opponentId);
      }
    } else if (game.away_team_id === teamId) {
      const opponentId = game.home_team_id;
      if (isBefore(gameDate, currentDate)) {
        pastGames.push(opponentId);
      } else {
        futureGames.push(opponentId);
      }
    }
  });

  // Fetch points percentage for past opponents
  const queryPastOpponents = supabase
    .from("power_rankings")
    .select("team_id, l_ten_pts_pct")
    .in("team_id", pastGames)
    .eq("season_id", seasonId)
    .lte("date", currentGameDate);

  let pastOpponentsStats = [];
  try {
    pastOpponentsStats = await fetchAllWithPagination(queryPastOpponents);
  } catch (error) {
    console.error(`Error fetching past opponents' stats:`, error);
  }

  // Calculate average SoS for past opponents
  const avg_past_sos =
    pastOpponentsStats && pastOpponentsStats.length > 0
      ? pastOpponentsStats.reduce(
          (acc, stat) => acc + (stat.l_ten_pts_pct || 0),
          0
        ) / pastOpponentsStats.length
      : 0;

  // Fetch points percentage for future opponents
  const queryFutureOpponents = supabase
    .from("power_rankings")
    .select("team_id, l_ten_pts_pct")
    .in("team_id", futureGames)
    .eq("season_id", seasonId)
    .gte("date", currentGameDate);

  let futureOpponentsStats = [];
  try {
    futureOpponentsStats = await fetchAllWithPagination(queryFutureOpponents);
  } catch (error) {
    console.error(`Error fetching future opponents' stats:`, error);
  }

  // Calculate average SoS for future opponents
  const avg_future_sos =
    futureOpponentsStats && futureOpponentsStats.length > 0
      ? futureOpponentsStats.reduce(
          (acc, stat) => acc + (stat.l_ten_pts_pct || 0),
          0
        ) / futureOpponentsStats.length
      : 0;

  return {
    sos_past: avg_past_sos.toFixed(3),
    sos_future: avg_future_sos.toFixed(3)
  };
}

// Fetch Season Averages and Record
async function fetchSeasonAveragesAndRecord(teamId, seasonId) {
  // Fetch average Points Percentage
  const { data: avgData, error: avgError } = await supabase
    .from("power_rankings")
    .select("season_avg_pts_pct")
    .eq("team_id", teamId)
    .eq("season_id", seasonId)
    .order("date", { ascending: false })
    .limit(1);

  const season_avg_pts_pct =
    avgData && avgData.length > 0 ? avgData[0].season_avg_pts_pct : 0;

  // Fetch season record
  const { data: recordData, error: recordError } = await supabase
    .from("standings")
    .select("wins, losses, overtime_losses")
    .eq("team_id", teamId)
    .eq("season_id", seasonId);

  let season_avg_record = "0-0-0";
  if (!recordError && recordData && recordData.length > 0) {
    const totalWins = recordData.reduce((acc, row) => acc + row.wins, 0);
    const totalLosses = recordData.reduce((acc, row) => acc + row.losses, 0);
    const totalOTLosses = recordData.reduce(
      (acc, row) => acc + row.overtime_losses,
      0
    );
    season_avg_record = `${totalWins}-${totalLosses}-${totalOTLosses}`;
  } else {
    console.warn(
      `No standings data found for Team ID: ${teamId} in Season ID: ${seasonId}`
    );
  }

  return { season_avg_pts_pct, season_avg_record };
}

// Fetch Opponent Aggregate Record
async function fetchOpponentAggregateRecord(teamId, seasonId, type = "past") {
  // Fetch all games for the team
  const { data: games, error } = await supabase
    .from("games")
    .select("home_team_id, away_team_id, date")
    .eq("season_id", seasonId);

  if (error) {
    console.error(`Error fetching games for opponent aggregate record:`, error);
    return "0-0-0";
  }

  const opponents = [];

  games.forEach((game) => {
    const gameDate = new Date(game.date);
    if (game.home_team_id === teamId) {
      const opponentId = game.away_team_id;
      if (type === "past" && gameDate < new Date()) {
        opponents.push(opponentId);
      } else if (type === "future" && gameDate >= new Date()) {
        opponents.push(opponentId);
      }
    } else if (game.away_team_id === teamId) {
      const opponentId = game.home_team_id;
      if (type === "past" && gameDate < new Date()) {
        opponents.push(opponentId);
      } else if (type === "future" && gameDate >= new Date()) {
        opponents.push(opponentId);
      }
    }
  });

  if (opponents.length === 0) {
    return "0-0-0";
  }

  // Fetch outcomes for opponents
  const { data: outcomes, error: outcomesError } = await supabase
    .from("gameOutcomes")
    .select("outcome")
    .in("teamId", opponents)
    .eq("season_id", seasonId);

  if (outcomesError) {
    console.error(`Error fetching game outcomes for opponents:`, outcomesError);
    return "0-0-0";
  }

  let wins = 0;
  let losses = 0;
  let ties = 0;

  outcomes.forEach((outcome) => {
    if (outcome.outcome === "WIN") {
      wins += 1;
    } else if (outcome.outcome === "LOSS") {
      losses += 1;
    } else {
      ties += 1;
    }
  });

  return `${wins}-${losses}-${ties}`;
}

// Function to Calculate and Upsert Power Rankings
async function calculateAndUpsertPowerRankings(season, teams) {
  const teamAbbrevs = Object.keys(teams);
  const totalTeams = teamAbbrevs.length;
  const bar = new ProgressBar(
    "Calculating Power Rankings [:bar] :percent :etas",
    {
      total: totalTeams,
      width: 40
    }
  );

  for (const abbrev of teamAbbrevs) {
    const team = teams[abbrev];
    try {
      // Fetch the last ten games for the team
      const { data: lastTenGames, error: lastTenError } = await supabase
        .from("wgo_team_stats")
        .select("*")
        .eq("team_id", team.id)
        .eq("season_id", season.id)
        .order("date", { ascending: false })
        .limit(10);

      if (lastTenError) {
        console.error(
          `Error fetching last ten games for team ${abbrev}:`,
          lastTenError
        );
        bar.tick();
        continue;
      }

      if (!lastTenGames || lastTenGames.length === 0) {
        console.warn(`No last ten games found for team ${abbrev}`);
        bar.tick();
        continue;
      }

      // Calculate l_ten Statistics
      const l_ten_pim = average(lastTenGames, "pim") || 0;
      const l_ten_pts_pct = average(lastTenGames, "point_pct") || 0;
      const l_ten_hits = average(lastTenGames, "hits") || 0;
      const l_ten_blocks = average(lastTenGames, "blocked_shots") || 0;
      const l_ten_power_play_opportunities =
        average(lastTenGames, "pp_opportunities") || 0;
      const l_ten_goals_for = average(lastTenGames, "goals_for") || 0;
      const l_ten_goals_against = average(lastTenGames, "goals_against") || 0;
      const l_ten_goals_for_pct = l_ten_goals_for / (l_ten_goals_against || 1); // Prevent division by zero
      const l_ten_shots_for = average(lastTenGames, "shots_for_per_game") || 0;
      const l_ten_power_play_pct = average(lastTenGames, "power_play_pct") || 0;
      const l_ten_penalty_kill_pct =
        average(lastTenGames, "penalty_kill_pct") || 0;

      // Calculate Ranks for Each Stat
      const ranks = await calculateRanks(team.id, season.id, season.endDate);

      // Calculate SoS Past and Future
      const { sos_past, sos_future } = await calculateSoSForTeam(
        team.id,
        season.id,
        season.endDate
      );

      // Fetch Season Averages and Record
      const { season_avg_pts_pct, season_avg_record } =
        await fetchSeasonAveragesAndRecord(team.id, season.id);

      // Fetch Opponent Aggregate Records
      const opponent_past_aggregate_record = await fetchOpponentAggregateRecord(
        team.id,
        season.id,
        "past"
      );
      const opponent_future_aggregate_record =
        await fetchOpponentAggregateRecord(team.id, season.id, "future");

      // Prepare Data for Upsert
      const powerRankingData = {
        team_id: team.id,
        season_id: season.id,
        date: format(parseISO(season.endDate), "yyyy-MM-dd"), // Adjust the date as needed
        l_ten_pim,
        l_ten_pts_pct,
        l_ten_hits,
        l_ten_blocks,
        l_ten_power_play_opportunities,
        l_ten_goals_for,
        l_ten_goals_for_pct,
        l_ten_shots_for,
        l_ten_power_play_pct,
        l_ten_penalty_kill_pct,
        rank_l_ten_pim: ranks.l_ten_pim_rank,
        rank_l_ten_pts_pct: ranks.l_ten_pts_pct_rank,
        rank_l_ten_hits: ranks.l_ten_hits_rank,
        rank_l_ten_blocks: ranks.l_ten_blocks_rank,
        rank_l_ten_power_play_opportunities:
          ranks.l_ten_power_play_opportunities_rank,
        rank_l_ten_goals_for: ranks.l_ten_goals_for_rank,
        rank_l_ten_goals_for_pct: ranks.l_ten_goals_for_pct_rank,
        rank_l_ten_shots_for: ranks.l_ten_shots_for_rank,
        rank_l_ten_power_play_pct: ranks.l_ten_power_play_pct_rank,
        rank_l_ten_penalty_kill_pct: ranks.l_ten_penalty_kill_pct_rank,
        sos_past,
        sos_future,
        season_avg_pts_pct,
        season_avg_record,
        opponent_past_aggregate_record,
        opponent_future_aggregate_record
        // Add other relevant fields as needed
      };

      // Upsert into Supabase
      const { error } = await supabase
        .from("power_rankings")
        .upsert(powerRankingData, {
          onConflict: ["team_id", "season_id", "date"]
        });

      if (error) {
        console.error(
          `Error upserting power_rankings for Team ID: ${team.id}:`,
          error
        );
      }

      bar.tick();
    } catch (error) {
      console.error(
        `Error processing power rankings for team ${abbrev}:`,
        error
      );
      bar.tick();
      continue;
    }
  }
}

// Main Execution Function
async function main() {
  try {
    // Step 1: Fetch Seasons
    const seasons = await fetchNHLSeasons();
    if (!seasons || seasons.length === 0) {
      throw new Error("No seasons data fetched.");
    }

    // Step 2: Determine Current Season
    const currentSeason = await determineCurrentSeason(seasons);
    if (!currentSeason) {
      throw new Error("Current season could not be determined.");
    }

    console.log(`Current Season: ${currentSeason.formattedSeasonId}`);

    // Step 3: Fetch Daily Standings
    console.log("Starting to fetch daily standings...");
    await fetchDailyStandings(currentSeason, teamsInfo);
    console.log("Daily standings fetched and upserted successfully.");

    // Step 4: Fetch Team Schedules and Game IDs
    console.log("Starting to fetch team schedules...");
    await fetchTeamSchedules(currentSeason, teamsInfo);
    console.log("Team schedules fetched and upserted successfully.");

    // Step 5: Fetch Team Summaries (Boxscores) from `wgo_team_stats`
    console.log("Starting to fetch team summaries (wgo_team_stats)...");
    await fetchTeamSummaries(currentSeason, teamsInfo);
    console.log("Team summaries fetched and upserted successfully.");

    // Step 6: Calculate and Upsert Power Rankings
    console.log("Starting to calculate and upsert Power Rankings...");
    await calculateAndUpsertPowerRankings(currentSeason, teamsInfo);
    console.log("Power Rankings calculated and upserted successfully.");

    console.log("All tasks completed successfully.");
  } catch (error) {
    console.error("An error occurred during execution:", error);
  }
}

// Execute the script
main();
