// lib/supabase/fetchSKOskaterData.js

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
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error(
    "Supabase URL or Public Key is missing in the environment variables."
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Function to fetch NHL seasons and determine if we are in the offseason
async function fetchCurrentSeason() {
  const url =
    "https://api.nhle.com/stats/rest/en/season?sort=%5B%7B%22property%22:%22id%22,%22direction%22:%22DESC%22%7D%5D";
  const data = await Fetch(url);

  // Assuming the API returns seasons sorted by most recent first
  const today = new Date();
  for (const season of data.data) {
    const startDate = new Date(season.startDate);
    const endDate = new Date(season.endDate);

    if (today >= startDate && today <= endDate) {
      return season; // We are in the current season
    }

    // If today is after the current season's end date, return this season as the last complete season
    if (today > endDate) {
      return season;
    }
  }
  throw new Error("Could not determine the current season.");
}

// Function to get the last complete season
function getLastCompleteSeason(seasonData) {
  const today = new Date();
  for (const season of seasonData) {
    const seasonEndDate = new Date(season.endDate);
    if (today > seasonEndDate) {
      return season;
    }
  }
  return null;
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
        timeOnIceResponse,
      ] = await Promise.all([
        Fetch(skaterStatsUrl),
        Fetch(puckPossessionUrl),
        Fetch(powerPlayUrl),
        Fetch(goalsForAgainstUrl),
        Fetch(scoringPerGameUrl),
        Fetch(timeOnIceUrl),
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
    timeOnIceStats,
  };
}

// Main function to fetch NHL Skater Data
async function fetchNHLSkaterData() {
  const limit = 100;
  const today = new Date();

  // Fetch current season
  let currentSeason;
  try {
    currentSeason = await fetchCurrentSeason();
    console.log(`Current Season ID: ${currentSeason.id}`);
  } catch (error) {
    console.error("Error fetching current season data:", error);
    return; // Exit if unable to fetch the current season
  }

  const seasonStart = new Date(currentSeason.startDate);
  const seasonEnd = new Date(currentSeason.endDate);

  // Fetch NHL Seasons Data again to determine last complete season
  let seasonData = [];
  try {
    seasonData = await Fetch(
      "https://api.nhle.com/stats/rest/en/season?sort=%5B%7B%22property%22:%22id%22,%22direction%22:%22DESC%22%7D%5D"
    );
  } catch (error) {
    console.error("Error fetching NHL seasons data:", error);
    return;
  }

  // Determine Last Complete Season
  const lastCompleteSeason = getLastCompleteSeason(seasonData.data);
  if (!lastCompleteSeason) {
    console.error("No complete season found. Exiting.");
    return;
  }

  const lastSeasonId = lastCompleteSeason.id.toString();
  console.log(`Last Complete Season ID: ${lastSeasonId}`);

  // Query Supabase to get the maximum date in the 'sko_skater_stats' table
  let currentDate;
  try {
    const { data: maxDateData, error: maxDateError } = await supabase
      .from("sko_skater_stats")
      .select("date")
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

  // Loop through each date and fetch data
  while (
    isBefore(currentDate, today) ||
    currentDate.toISOString().split("T")[0] ===
      today.toISOString().split("T")[0]
  ) {
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
      continue;
    }

    const {
      skaterStats,
      puckPossessionStats,
      powerPlayStats,
      goalsForAgainstStats,
      scoringPerGameStats,
      timeOnIceStats,
    } = fetchedData;

    for (const stat of skaterStats) {
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

      // **Calculate totalOnIceGoalsFor**
      const totalOnIceGoalsFor =
        (goalsForAgainstStat ? goalsForAgainstStat.evenStrengthGoalsFor : 0) +
        (goalsForAgainstStat ? goalsForAgainstStat.powerPlayGoalFor : 0) +
        (goalsForAgainstStat ? goalsForAgainstStat.shortHandedGoalsFor : 0);

      // **Calculate ipp (Individual Points Percentage)**
      const ipp =
        totalOnIceGoalsFor && totalOnIceGoalsFor > 0
          ? (stat.points / totalOnIceGoalsFor) * 100
          : null;

      // **Calculate timeOnIceInMinutes**
      const timeOnIceInMinutes = timeOnIceStat
        ? timeOnIceStat.timeOnIce / 60
        : null;

      // **Calculate sogPer60 (Shots on Goal per 60 Minutes)**
      const sogPer60 =
        timeOnIceInMinutes && timeOnIceInMinutes > 0
          ? (stat.shots / timeOnIceInMinutes) * 60
          : null;

      // **Fetch Career Averages**
      let careerAverages = null;
      try {
        const careerResponse = await Fetch(
          `https://fhfhockey.com/api/CareerAverages/${stat.playerId}`
        );
        if (careerResponse && careerResponse.success) {
          careerAverages = careerResponse.data;
          console.log(`Fetched Career Averages for player ID ${stat.playerId}`);
        }
      } catch (error) {
        console.error(
          `Error fetching career averages for player ID ${stat.playerId}:`,
          error
        );
      }

      // **Fetch Three-Year Averages**
      let threeYearAverages = null;
      try {
        const threeYearResponse = await Fetch(
          `https://fhfhockey.com/api/ThreeYearAverages/${stat.playerId}`
        );
        if (threeYearResponse && threeYearResponse.success) {
          threeYearAverages = threeYearResponse.data;
          console.log(
            `Fetched Three-Year Averages for player ID ${stat.playerId}`
          );
        }
      } catch (error) {
        console.error(
          `Error fetching three-year averages for player ID ${stat.playerId}:`,
          error
        );
      }

      // **Extract Last Season Data from Three-Year Averages**
      let lastSeasonData = null;
      if (threeYearAverages && threeYearAverages[lastSeasonId]) {
        lastSeasonData = threeYearAverages[lastSeasonId];
      } else {
        console.warn(
          `No data found for last season ID ${lastSeasonId} in ThreeYearAverages for player ID ${stat.playerId}`
        );
      }

      // **Prepare playerStats object with calculated fields for future sKO calculation**
      const currentPlayerStats = {
        shooting_percentage: stat.shootingPct,
        ixs_pct: careerAverages ? careerAverages["xS%"] : null,
        ipp: ipp,
        on_ice_shooting_pct: puckPossessionStat
          ? puckPossessionStat.onIceShootingPct
          : null,
        sog_per_60: sogPer60,
        iscf_per_60:
          careerAverages && timeOnIceInMinutes
            ? (careerAverages.iSCF / timeOnIceInMinutes) * 60
            : null,
        ihdcf_per_60:
          careerAverages && timeOnIceInMinutes
            ? (careerAverages.iHDCF / timeOnIceInMinutes) * 60
            : null,
        total_primary_assists: scoringPerGameStat
          ? scoringPerGameStat.totalPrimaryAssists
          : null,
        total_secondary_assists: scoringPerGameStat
          ? scoringPerGameStat.totalSecondaryAssists
          : null,
        pp_toi_pct_per_game: powerPlayStat
          ? powerPlayStat.ppTimeOnIcePctPerGame
          : null,
        zone_start_pct: puckPossessionStat
          ? puckPossessionStat.zoneStartPct
          : null,
        ixg: careerAverages ? careerAverages.ixG : null,
      };

      // **Upsert data into Supabase without sKO calculations**
      try {
        const { error } = await supabase.from("sko_skater_stats").upsert(
          {
            player_id: stat.playerId,
            player_name: stat.skaterFullName,
            date: formattedDate,
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
            sog_per_60: sogPer60,
            iscf_per_60: currentPlayerStats.iscf_per_60,
            ihdcf_per_60: currentPlayerStats.ihdcf_per_60,
            ixg: currentPlayerStats.ixg,
            ixs_pct: currentPlayerStats.ixs_pct,
          },
          {
            onConflict: "player_id,date",
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
  }
}

fetchNHLSkaterData();
