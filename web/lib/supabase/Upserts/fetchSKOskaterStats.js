// lib/supabase/fetchSKOskaterData.js

const path = "../../../.env.local";
require("dotenv").config({ path: path });

const { createClient } = require("@supabase/supabase-js");
const nodeFetch = require("node-fetch"); // Renamed to avoid conflict with Fetch function
const { parseISO, format, addDays, isBefore, isEqual } = require("date-fns");

// Simplified Fetch function for Node.js with error handling
async function Fetch(url) {
  try {
    const response = await nodeFetch(url);

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status} for URL: ${url}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`Fetch error for URL ${url}:`, error);
    throw error;
  }
}

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
// CHANGED SUPABASE THING

if (!supabaseUrl || !supabaseKey) {
  console.error(
    "Supabase URL or Public Key is missing in the environment variables."
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Function to fetch all seasons data
async function fetchAllSeasons() {
  const url =
    "https://api.nhle.com/stats/rest/en/season?sort=%5B%7B%22property%22:%22id%22,%22direction%22:%22DESC%22%7D%5D";
  const data = await Fetch(url);
  return data.data; // Assuming data.data is the array of seasons
}

// Function to get the last N seasons
function getLastNSeasons(seasons, n) {
  return seasons.slice(0, n);
}

// Function to fetch all data for a specific date
async function fetchAllDataForDate(formattedDate, limit) {
  let start = 0;
  let moreDataAvailable = true;

  let skaterStats = [];
  let puckPossessionStats = [];
  let powerPlayStats = [];
  let goalsForAgainstStats = [];
  let scoringPerGameStats = [];
  let timeOnIceStats = [];

  while (moreDataAvailable) {
    const skaterStatsUrl = `https://api.nhle.com/stats/rest/en/skater/summary?isAggregate=true&isGame=true&start=${start}&limit=${limit}&cayenneExp=gameDate<=%22${formattedDate}%2023:59:59%22%20and%20gameDate>=%22${formattedDate}%22%20and%20gameTypeId=2`;
    const puckPossessionUrl = `https://api.nhle.com/stats/rest/en/skater/puckPossessions?isAggregate=true&isGame=true&start=${start}&limit=${limit}&cayenneExp=gameDate<=%22${formattedDate}%2023:59:59%22%20and%20gameDate>=%22${formattedDate}%22%20and%20gameTypeId=2`;
    const powerPlayUrl = `https://api.nhle.com/stats/rest/en/skater/powerplay?isAggregate=true&isGame=true&start=${start}&limit=${limit}&cayenneExp=gameDate<=%22${formattedDate}%2023:59:59%22%20and%20gameDate>=%22${formattedDate}%22%20and%20gameTypeId=2`;
    const goalsForAgainstUrl = `https://api.nhle.com/stats/rest/en/skater/goalsForAgainst?isAggregate=true&isGame=true&start=${start}&limit=${limit}&cayenneExp=gameDate<=%22${formattedDate}%2023:59:59%22%20and%20gameDate>=%22${formattedDate}%22%20and%20gameTypeId=2`;
    const scoringPerGameUrl = `https://api.nhle.com/stats/rest/en/skater/scoringpergame?isAggregate=true&isGame=true&start=${start}&limit=${limit}&cayenneExp=gameDate<=%22${formattedDate}%2023:59:59%22%20and%20gameDate>=%22${formattedDate}%22%20and%20gameTypeId=2`;
    const timeOnIceUrl = `https://api.nhle.com/stats/rest/en/skater/timeonice?isAggregate=true&isGame=true&start=${start}&limit=${limit}&cayenneExp=gameDate<=%22${formattedDate}%2023:59:59%22%20and%20gameDate>=%22${formattedDate}%22%20and%20gameTypeId=2`;

    try {
      const [
        skaterStatsResponse,
        puckPossessionResponse,
        powerPlayResponse,
        goalsForAgainstResponse,
        scoringPerGameResponse,
        timeOnIceResponse
      ] = await Promise.all([
        Fetch(skaterStatsUrl),
        Fetch(puckPossessionUrl),
        Fetch(powerPlayUrl),
        Fetch(goalsForAgainstUrl),
        Fetch(scoringPerGameUrl),
        Fetch(timeOnIceUrl)
      ]);

      skaterStats = skaterStats.concat(skaterStatsResponse.data);
      puckPossessionStats = puckPossessionStats.concat(
        puckPossessionResponse.data
      );
      powerPlayStats = powerPlayStats.concat(powerPlayResponse.data);
      goalsForAgainstStats = goalsForAgainstStats.concat(
        goalsForAgainstResponse.data
      );
      scoringPerGameStats = scoringPerGameStats.concat(
        scoringPerGameResponse.data
      );
      timeOnIceStats = timeOnIceStats.concat(timeOnIceResponse.data);

      moreDataAvailable =
        skaterStatsResponse.data.length === limit ||
        puckPossessionResponse.data.length === limit ||
        powerPlayResponse.data.length === limit ||
        goalsForAgainstResponse.data.length === limit ||
        scoringPerGameResponse.data.length === limit ||
        timeOnIceResponse.data.length === limit;

      start += limit;
    } catch (error) {
      console.error(
        `Error fetching data for ${formattedDate} with start=${start}:`,
        error
      );
      break;
    }
  }

  return {
    skaterStats,
    puckPossessionStats,
    powerPlayStats,
    goalsForAgainstStats,
    scoringPerGameStats,
    timeOnIceStats
  };
}

// Main function to fetch NHL Skater Data for the last 3 seasons
async function fetchNHLSkaterDataLast3Seasons() {
  const limit = 100;
  const today = new Date();

  // Fetch all seasons
  let allSeasons = [];
  try {
    allSeasons = await fetchAllSeasons();
    console.log(`Fetched ${allSeasons.length} seasons.`);
  } catch (error) {
    console.error("Error fetching all seasons data:", error);
    return;
  }

  // Select the last 3 seasons
  const last3Seasons = getLastNSeasons(allSeasons, 3);
  console.log(`Processing the last ${last3Seasons.length} seasons.`);

  for (const season of last3Seasons) {
    console.log(
      `\n--- Processing Season ID: ${season.id} (${season.formattedSeasonId}) ---`
    );

    // Use regularSeasonEndDate instead of endDate
    const seasonStart = season.startDate ? new Date(season.startDate) : null;
    const seasonEnd = season.regularSeasonEndDate
      ? new Date(season.regularSeasonEndDate)
      : null;

    if (!seasonStart || !seasonEnd) {
      console.error(
        `Invalid start or end date for season ID ${season.id}. Skipping this season.`
      );
      continue;
    }

    // Determine the starting date for data fetching
    let currentDate;
    try {
      const { data: maxDateData, error: maxDateError } = await supabase
        .from("sko_skater_stats")
        .select("date")
        .eq("season_id", season.id) // Filter by current season
        .order("date", { ascending: false })
        .limit(1)
        .single();

      if (maxDateError && maxDateError.code !== "PGRST116") {
        console.error(
          "Error fetching the latest date from Supabase:",
          maxDateError
        );
        currentDate = new Date(seasonStart); // Use seasonStart if error other than "Row not found"
      } else if (maxDateData && maxDateData.date) {
        currentDate = addDays(parseISO(maxDateData.date), 1);
        console.log(
          `Starting from date: ${currentDate.toISOString().split("T")[0]}`
        );
      } else {
        currentDate = new Date(seasonStart);
        console.log(
          `No existing data found. Starting from season start date: ${
            currentDate.toISOString().split("T")[0]
          }`
        );
      }
    } catch (error) {
      console.error("Error querying Supabase for the latest date:", error);
      currentDate = new Date(seasonStart);
    }

    // Safety check to prevent infinite loops
    const maxIterations = 1000; // Adjust as needed
    let iterations = 0;

    // Loop through each date in the season
    while (
      isBefore(currentDate, seasonEnd) ||
      isEqual(currentDate, seasonEnd)
    ) {
      if (iterations >= maxIterations) {
        console.error(
          `Reached maximum iterations for season ID ${season.id}. Breaking the loop.`
        );
        break;
      }

      const formattedDate = format(currentDate, "yyyy-MM-dd");
      console.log(`Fetching data for ${formattedDate}`);

      let fetchedData;
      try {
        fetchedData = await fetchAllDataForDate(formattedDate, limit);
      } catch (error) {
        console.error(
          `Error fetching all data for date ${formattedDate}:`,
          error
        );
        currentDate = addDays(currentDate, 1);
        iterations++;
        continue;
      }

      const {
        skaterStats,
        puckPossessionStats,
        powerPlayStats,
        goalsForAgainstStats,
        scoringPerGameStats,
        timeOnIceStats
      } = fetchedData;

      for (const stat of skaterStats) {
        // Find corresponding stats
        const puckPossessionStat = puckPossessionStats.find(
          (pps) => pps.playerId === stat.playerId
        );
        const powerPlayStat = powerPlayStats.find(
          (pps) => pps.playerId === stat.playerId
        );
        const goalsForAgainstStat = goalsForAgainstStats.find(
          (gfas) => gfas.playerId === stat.playerId
        );
        const scoringPerGameStat = scoringPerGameStats.find(
          (spgs) => spgs.playerId === stat.playerId
        );
        const timeOnIceStat = timeOnIceStats.find(
          (toi) => toi.playerId === stat.playerId
        );

        // Calculate fields
        const totalOnIceGoalsFor =
          (goalsForAgainstStat ? goalsForAgainstStat.evenStrengthGoalsFor : 0) +
          (goalsForAgainstStat ? goalsForAgainstStat.powerPlayGoalFor : 0) +
          (goalsForAgainstStat ? goalsForAgainstStat.shortHandedGoalsFor : 0);

        const ipp =
          totalOnIceGoalsFor && totalOnIceGoalsFor > 0
            ? (stat.points / totalOnIceGoalsFor) * 100
            : null;

        const timeOnIceInMinutes = timeOnIceStat
          ? timeOnIceStat.timeOnIce / 60
          : null;

        const sogPer60 =
          timeOnIceInMinutes && timeOnIceInMinutes > 0
            ? (stat.shots / timeOnIceInMinutes) * 60
            : null;

        // Prepare playerStats object with calculated fields for future sKO calculation
        const currentPlayerStats = {
          shooting_percentage: stat.shootingPct,
          ixs_pct: null, // Removed as per user request
          ipp: ipp,
          on_ice_shooting_pct: puckPossessionStat
            ? puckPossessionStat.onIceShootingPct
            : null,
          sog_per_60: sogPer60
        };

        // Upsert data into Supabase with season_id
        try {
          const { error } = await supabase.from("sko_skater_stats").upsert(
            {
              player_id: stat.playerId,
              player_name: stat.skaterFullName,
              date: formattedDate,
              season_id: season.id, // Add season_id
              position_code: stat.positionCode,
              games_played: stat.gamesPlayed,
              goals: stat.goals,
              assists: stat.assists,
              points: stat.points,
              shots: stat.shots,
              shooting_percentage: stat.shootingPct,
              time_on_ice: timeOnIceStat ? timeOnIceStat.timeOnIce : null,
              on_ice_shooting_pct: puckPossessionStat
                ? puckPossessionStat.onIceShootingPct
                : null,
              zone_start_pct: puckPossessionStat
                ? puckPossessionStat.zoneStartPct
                : null,
              pp_toi_pct_per_game: powerPlayStat
                ? powerPlayStat.ppTimeOnIcePctPerGame
                : null,
              es_goals_for: goalsForAgainstStat
                ? goalsForAgainstStat.evenStrengthGoalsFor
                : null,
              pp_goals_for: goalsForAgainstStat
                ? goalsForAgainstStat.powerPlayGoalFor
                : null,
              sh_goals_for: goalsForAgainstStat
                ? goalsForAgainstStat.shortHandedGoalsFor
                : null,
              total_primary_assists: scoringPerGameStat
                ? scoringPerGameStat.totalPrimaryAssists
                : null,
              total_secondary_assists: scoringPerGameStat
                ? scoringPerGameStat.totalSecondaryAssists
                : null,
              ipp: ipp,
              sog_per_60: sogPer60
            },
            {
              onConflict: "player_id,date,season_id" // Include season_id in conflict
            }
          );

          if (error) {
            console.error(
              `Error upserting data for player ID ${stat.playerId}:`,
              error
            );
          }
        } catch (error) {
          console.error(
            `Supabase upsert error for player ID ${stat.playerId}:`,
            error
          );
        }
      }

      // Move to the next day
      currentDate = addDays(currentDate, 1);
      iterations++;
    }

    console.log(
      `--- Completed processing Season ID: ${season.id} (${season.formattedSeasonId}) ---\n`
    );
  }
}

fetchNHLSkaterDataLast3Seasons();
