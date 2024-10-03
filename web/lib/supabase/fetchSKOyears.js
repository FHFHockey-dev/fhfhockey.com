// C:\Users\timbr\OneDrive\Desktop\fhfhockey.com-3\web\lib\supabase\fetchSKOyears.js

const path = "./../../.env.local";
require("dotenv").config({ path: path });

const { createClient } = require("@supabase/supabase-js");
const fetch = require("node-fetch");
const { parseISO, format, addDays, isBefore } = require("date-fns");

// Simplified Fetch function for Node.js with error handling
async function Fetch(url) {
  try {
    const response = await fetch(url);

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
const supabaseKey = process.env.NEXT_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error(
    "Supabase URL or Public Key is missing in the environment variables."
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Define the season IDs you want to process
const seasonIds = [20192020, 20202021, 20212022, 20222023, 20232024];

/**
 * Fetch all data for a given endpoint and seasonId by paginating through all pages.
 * @param {string} endpoint - The NHL API endpoint URL.
 * @param {number} seasonId - The season ID to fetch data for.
 * @param {number} limit - Number of records per page.
 * @returns {Array} - An array containing all fetched data for the endpoint.
 */
async function fetchAllDataForEndpoint(endpoint, seasonId, limit = 100) {
  let start = 0;
  let allData = [];
  let moreDataAvailable = true;

  while (moreDataAvailable) {
    // Construct the URL with proper query parameters
    const url = `${endpoint}?isAggregate=false&isGame=false&sort=%5B%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=${limit}&cayenneExp=gameTypeId=2%20and%20seasonId=${seasonId}`;

    try {
      const response = await Fetch(url);
      const data = response.data;

      if (!Array.isArray(data)) {
        console.error(`Unexpected data format from URL: ${url}`);
        break;
      }

      allData = allData.concat(data);

      if (data.length < limit) {
        moreDataAvailable = false; // No more data to fetch
      } else {
        start += limit; // Move to the next page
      }
    } catch (error) {
      console.error(`Error fetching data from ${url}:`, error);
      break;
    }
  }

  return allData;
}

/**
 * Main function to fetch NHL Skater Data and upsert into Supabase.
 */
async function fetchNHLSkaterData() {
  for (const seasonId of seasonIds) {
    console.log(`\nFetching data for season ${seasonId}`);

    // Define the endpoints for the current season
    const endpoints = {
      skaterStats: "https://api.nhle.com/stats/rest/en/skater/summary",
      puckPossession:
        "https://api.nhle.com/stats/rest/en/skater/puckPossessions",
      powerPlay: "https://api.nhle.com/stats/rest/en/skater/powerplay",
      goalsForAgainst:
        "https://api.nhle.com/stats/rest/en/skater/goalsForAgainst",
      scoringPerGame:
        "https://api.nhle.com/stats/rest/en/skater/scoringpergame",
      timeOnIce: "https://api.nhle.com/stats/rest/en/skater/timeonice",
    };

    try {
      // Fetch all data for each endpoint concurrently
      const [
        skaterStats,
        puckPossessionStats,
        powerPlayStats,
        goalsForAgainstStats,
        scoringPerGameStats,
        timeOnIceStats,
      ] = await Promise.all([
        fetchAllDataForEndpoint(endpoints.skaterStats, seasonId),
        fetchAllDataForEndpoint(endpoints.puckPossession, seasonId),
        fetchAllDataForEndpoint(endpoints.powerPlay, seasonId),
        fetchAllDataForEndpoint(endpoints.goalsForAgainst, seasonId),
        fetchAllDataForEndpoint(endpoints.scoringPerGame, seasonId),
        fetchAllDataForEndpoint(endpoints.timeOnIce, seasonId),
      ]);

      console.log(
        `Fetched ${skaterStats.length} skaterStats, ${puckPossessionStats.length} puckPossessionStats, ${powerPlayStats.length} powerPlayStats, ${goalsForAgainstStats.length} goalsForAgainstStats, ${scoringPerGameStats.length} scoringPerGameStats, ${timeOnIceStats.length} timeOnIceStats.`
      );

      // Create maps for quick lookup by playerId
      const puckPossessionMap = new Map(
        puckPossessionStats.map((stat) => [stat.playerId, stat])
      );
      const powerPlayMap = new Map(
        powerPlayStats.map((stat) => [stat.playerId, stat])
      );
      const goalsForAgainstMap = new Map(
        goalsForAgainstStats.map((stat) => [stat.playerId, stat])
      );
      const scoringPerGameMap = new Map(
        scoringPerGameStats.map((stat) => [stat.playerId, stat])
      );
      const timeOnIceMap = new Map(
        timeOnIceStats.map((stat) => [stat.playerId, stat])
      );

      // Iterate through skaterStats and upsert merged data
      for (const stat of skaterStats) {
        const playerId = stat.playerId;

        // Retrieve corresponding stats from other endpoints
        const puckPossessionStat = puckPossessionMap.get(playerId) || {};
        const powerPlayStat = powerPlayMap.get(playerId) || {};
        const goalsForAgainstStat = goalsForAgainstMap.get(playerId) || {};
        const scoringPerGameStat = scoringPerGameMap.get(playerId) || {};
        const timeOnIceStat = timeOnIceMap.get(playerId) || {};

        // Calculate totalOnIceGoalsFor correctly with parentheses
        const totalOnIceGoalsFor =
          (goalsForAgainstStat.evenStrengthGoalsFor || 0) +
          (goalsForAgainstStat.powerPlayGoalFor || 0) +
          (goalsForAgainstStat.shortHandedGoalsFor || 0);

        // Calculate ipp (Individual Points Percentage)
        const ipp =
          totalOnIceGoalsFor > 0
            ? (stat.points / totalOnIceGoalsFor) * 100
            : null;

        // Calculate timeOnIceInMinutes
        const timeOnIceInMinutes = timeOnIceStat.timeOnIce
          ? timeOnIceStat.timeOnIce / 60
          : null;

        // Calculate sogPer60 (Shots on Goal per 60 Minutes)
        const sogPer60 =
          stat.shots && timeOnIceInMinutes
            ? (stat.shots / timeOnIceInMinutes) * 60
            : null;

        // Upsert data into Supabase
        try {
          const { error } = await supabase.from("sko_skater_years").upsert(
            {
              player_id: playerId,
              player_name: stat.skaterFullName,
              season: seasonId,
              position_code: stat.positionCode,
              games_played: stat.gamesPlayed,
              goals: stat.goals,
              assists: stat.assists,
              points: stat.points,
              shots: stat.shots,
              shooting_percentage: stat.shootingPct || null,
              time_on_ice: timeOnIceStat.timeOnIce || null,
              on_ice_shooting_pct: puckPossessionStat.onIceShootingPct || null,
              zone_start_pct: puckPossessionStat.zoneStartPct || null,
              pp_toi_pct_per_game: powerPlayStat.ppTimeOnIcePctPerGame || null,
              es_goals_for: goalsForAgainstStat.evenStrengthGoalsFor || null,
              pp_goals_for: goalsForAgainstStat.powerPlayGoalFor || null,
              sh_goals_for: goalsForAgainstStat.shortHandedGoalsFor || null,
              total_primary_assists:
                scoringPerGameStat.totalPrimaryAssists || null,
              total_secondary_assists:
                scoringPerGameStat.totalSecondaryAssists || null,
              ipp: ipp,
              sog_per_60: sogPer60,
            },
            {
              onConflict: ["player_id", "season"],
            }
          );

          if (error) {
            console.error(
              `Error upserting data for player ID ${playerId}:`,
              error
            );
          }
        } catch (error) {
          console.error(
            `Supabase upsert error for player ID ${playerId}:`,
            error
          );
        }
      }

      console.log(`Completed upserting data for season ${seasonId}.`);
    } catch (error) {
      console.error(`Error processing season ${seasonId}:`, error);
    }
  }

  console.log("\nAll seasons processed.");
}

fetchNHLSkaterData();
