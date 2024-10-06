// C:\Users\timbr\OneDrive\Desktop\fhfhockey.com-3\web\lib\supabase\fetchStandings.js

require("dotenv").config({ path: "../../.env.local" });
const { createClient } = require("@supabase/supabase-js");
const fetch = require("node-fetch");
const { parseISO, format, addDays, isBefore, isAfter } = require("date-fns");
const ProgressBar = require("progress");

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLIC_KEY; // Use service role key for server-side operations
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
    width: 40,
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
            season_id: seasonId,
            date: formattedDate,
            team_id: teamInfo.id,
            losses: teamStanding.losses,
            ot_losses: teamStanding.otLosses,
            point_pctg: teamStanding.pointPctg,
            points: teamStanding.points,
            wins: teamStanding.wins,
          };
        })
        .filter(Boolean); // Remove null entries

      if (standingsDataBatch.length > 0) {
        // Batch upsert into Supabase
        const { data: upsertedData, error } = await supabase
          .from("raw_standings_sos")
          .upsert(standingsDataBatch, {
            onConflict: ["season_id", "date", "team_id"],
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

    await fetchDailyStandings(currentSeason, teamsInfo);

    console.log("Standings data fetching and upserting completed.");
  } catch (error) {
    console.error("An error occurred during the fetching process:", error);
  }
})();
