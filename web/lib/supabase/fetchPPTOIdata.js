// lib/supabase/fetchSKOskaterData.js
// C:\Users\timbr\OneDrive\Desktop\fhfhockey.com-1\web\lib\supabase\fetchPPTOIdata.js

// DEV NOTE
// For days that fail, those days need to be retried after the script has finished running
// maybe an array that stores the failed dates and then a loop that runs through the failed dates

const path = "./../../.env.local";
require("dotenv").config({ path: path });

const { createClient } = require("@supabase/supabase-js");
const fetch = require("node-fetch");
const { parseISO, format, addDays, isBefore } = require("date-fns");

// Simplified Fetch (cors-fetch) function for Node.js that isnt imported
async function Fetch(url) {
  const response = await fetch(url);
  return response.json();
}

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error(
    "Supabase URL or Service Role Key is missing in the environment variables."
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fetchAllDataForDate(formattedDate, limit) {
  let start = 0;
  let moreDataAvailable = true;
  // Initialize arrays to store data
  let skaterStats = [];
  let bioSkaterStats = [];
  let powerPlayStats = [];

  while (moreDataAvailable) {
    const skaterStatsUrl = `https://api.nhle.com/stats/rest/en/skater/summary?isAggregate=true&isGame=true&sort=%5B%7B%22property%22:%22points%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22goals%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22assists%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=${limit}&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameDate%3C=%22${formattedDate}%2023%3A59%3A59%22%20and%20gameDate%3E=%22${formattedDate}%22%20and%20gameTypeId=2`;
    const skaterBioUrl = `https://api.nhle.com/stats/rest/en/skater/bios?isAggregate=false&isGame=true&sort=%5B%7B%22property%22:%22lastName%22,%22direction%22:%22ASC_CI%22%7D,%7B%22property%22:%22skaterFullName%22,%22direction%22:%22ASC_CI%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=${limit}&cayenneExp=gameDate%3C=%22${formattedDate}%2023%3A59%3A59%22%20and%20gameDate%3E=%22${formattedDate}%22%20and%20gameTypeId=2`;
    const powerPlayUrl = `https://api.nhle.com/stats/rest/en/skater/powerplay?isAggregate=true&isGame=true&sort=%5B%7B%22property%22:%22ppTimeOnIce%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=${start}&limit=${limit}&factCayenneExp=gamesPlayed%3E=1&cayenneExp=gameDate%3C=%22${formattedDate}%2023%3A59%3A59%22%20and%20gameDate%3E=%22${formattedDate}%22%20and%20gameTypeId=2`;

    const [skaterStatsResponse, bioStatsResponse, powerPlayResponse] =
      await Promise.all([
        Fetch(skaterStatsUrl),
        Fetch(skaterBioUrl),
        Fetch(powerPlayUrl),
      ]);

    skaterStats = skaterStats.concat(skaterStatsResponse.data);
    bioSkaterStats = bioSkaterStats.concat(bioStatsResponse.data);
    powerPlayStats = powerPlayStats.concat(powerPlayResponse.data);

    moreDataAvailable =
      skaterStatsResponse.data.length === limit ||
      bioStatsResponse.data.length === limit ||
      powerPlayResponse.data.length === limit;
    start += limit;
  }

  return {
    skaterStats,
    bioSkaterStats,
    powerPlayStats,
  };
}

async function fetchNHLSkaterData() {
  const scheduleResponse = await Fetch(
    "https://api-web.nhle.com/v1/schedule/now"
  );
  let seasonStart = "2023-10-10";
  // let seasonStart = scheduleResponse.data[0].startDate;
  let currentDate = parseISO(seasonStart);
  const today = new Date();
  const limit = 100;

  while (
    isBefore(currentDate, today) ||
    currentDate.toISOString().split("T")[0] ===
      today.toISOString().split("T")[0]
  ) {
    let formattedDate = format(currentDate, "yyyy-MM-dd");
    console.log(`Fetching data for ${formattedDate}`);

    const { skaterStats, bioSkaterStats, powerPlayStats } =
      await fetchAllDataForDate(formattedDate, limit);

    skaterStats.forEach(async (stat, index) => {
      const bioStats = bioSkaterStats.find(
        (bStat) => bStat.playerId === stat.playerId
      );
      const powerPlayStat = powerPlayStats.find(
        (ppStat) => ppStat.playerId === stat.playerId
      );

      let upsertedStats = ["skaterStatsResponse"];

      if (bioStats) {
        upsertedStats.push("bioStatsResponse");
      }
      if (powerPlayStat) {
        upsertedStats.push("powerPlayResponse");
      }

      console.log(
        `(${index + 1}/${
          skaterStats.length
        }) -- ${formattedDate} -- Upserting stats for player ID: ${
          stat.playerId
        }, Name: ${stat.skaterFullName} [${upsertedStats.join(", ")}]`
      );

      const response = await supabase.from("sko_pp_stats").upsert({
        // summary stats from skaterStatsResponse (stat)
        player_id: stat.playerId, // int
        player_name: stat.skaterFullName, // text
        date: formattedDate, // date
        shoots_catches: stat.shootsCatches, // text
        position_code: stat.positionCode, // text
        games_played: stat.gamesPlayed, // int
        // bio stats from skatersBioResponse (bioStats)
        current_team_abbreviation: bioStats?.currentTeamAbbrev, // text
        current_team_name: bioStats?.currentTeamName, // text
        // power play stats from powerPlayResponse (powerPlayStat)
        pp_toi_pct_per_game: powerPlayStat.ppTimeOnIcePctPerGame, // float
      });

      if (response.error) {
        console.error("Error upserting data:", response.error);
      }
    });

    currentDate = addDays(currentDate, 1); // Move to the next day
  }
}

fetchNHLSkaterData();
