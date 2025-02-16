///////////////////////////////////////////////////////////////////////////////////////////////
// C:\Users\timbr\OneDrive\Desktop\fhfhockey.com-3\web\lib\supabase\shotsByCoord.js

const path = "./../../.env.local";
require("dotenv").config({ path: path });
const { createClient } = require("@supabase/supabase-js");

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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
// CHANGED SUPABASE THING
const supabase = createClient(supabaseUrl, supabaseKey);

const BATCH_SIZE = 1000; // Supabase row limit per query

async function fetchPlaysBatch(offset) {
  // Fetch a batch of play-by-play data with pagination (limit and offset)
  const { data: pbpPlays, error } = await supabase
    .from("pbp_plays")
    .select("*")
    .or("typedesckey.eq.shot-on-goal,typedesckey.eq.goal")
    .range(offset, offset + BATCH_SIZE - 1); // Fetch a batch of rows

  if (error) {
    console.error("Error fetching pbp plays:", error);
    return [];
  }

  return pbpPlays || [];
}

async function updateShotsAndGoals() {
  let offset = 0;
  let hasMoreData = true;

  // Loop to fetch and process batches until no more data
  while (hasMoreData) {
    const pbpPlays = await fetchPlaysBatch(offset);

    if (pbpPlays.length === 0) {
      hasMoreData = false;
      console.log("No more play-by-play data to process.");
      break;
    }

    // Create a map for teams using their `id` from teamsInfo
    const teamIdToColumns = Object.keys(teamsInfo).reduce(
      (map, teamAbbreviation) => {
        const team = teamsInfo[teamAbbreviation];
        map[team.id] = {
          shotsColumn: `team_${team.id}_shots`,
          goalsColumn: `team_${team.id}_goals`
        };
        return map;
      },
      {}
    );

    // Process each play
    for (const play of pbpPlays) {
      const { xcoord, ycoord, eventownerteamid, typedesckey } = play;

      if (xcoord === null || ycoord === null || !eventownerteamid) continue;

      const columns = teamIdToColumns[eventownerteamid];

      if (!columns) continue; // Skip if team ID is not found in teamsInfo

      const shotColumn = columns.shotsColumn;
      const goalColumn = columns.goalsColumn;

      // Determine if it's a shot or a goal
      const isGoal = typedesckey === "goal";

      // Fetch the current counts for this coordinate
      const { data: existingData, error: fetchError } = await supabase
        .from("shots_goals_by_coord")
        .select(`${shotColumn}, ${goalColumn}, league_shots, league_goals`)
        .eq("xcoord", xcoord)
        .eq("ycoord", ycoord)
        .maybeSingle(); // Use maybeSingle to allow no results without error

      if (fetchError) {
        console.error("Error fetching existing shot/goal data:", fetchError);
        continue;
      }

      const currentShots = existingData ? existingData[shotColumn] || 0 : 0;
      const currentGoals = existingData ? existingData[goalColumn] || 0 : 0;
      const currentLeagueShots = existingData
        ? existingData.league_shots || 0
        : 0;
      const currentLeagueGoals = existingData
        ? existingData.league_goals || 0
        : 0;

      // Increment the shot and goal counts
      let shotUpdate = {
        [shotColumn]: currentShots + 1,
        league_shots: currentLeagueShots + 1
      };

      // If it's a goal, increment the goal count
      if (isGoal) {
        shotUpdate[goalColumn] = currentGoals + 1;
        shotUpdate["league_goals"] = currentLeagueGoals + 1;
      }

      // Upsert into shots_goals_by_coord, ensuring that each coordinate has an entry
      const { error: upsertError } = await supabase
        .from("shots_goals_by_coord")
        .upsert(
          {
            xcoord,
            ycoord,
            ...shotUpdate
          },
          {
            onConflict: ["xcoord", "ycoord"] // Ensure that coordinates are unique
          }
        );

      if (upsertError) {
        console.error("Error updating shot/goal data:", upsertError);
      }
    }

    console.log(`Processed batch starting from offset ${offset}.`);

    // Move to the next batch
    offset += BATCH_SIZE;
  }

  console.log("All shots and goals successfully updated.");
}

updateShotsAndGoals();
