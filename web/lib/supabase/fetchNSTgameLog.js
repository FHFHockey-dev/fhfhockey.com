// Import necessary modules
const axios = require("axios"); // To make HTTP requests
const cheerio = require("cheerio"); // To parse HTML
const { createClient } = require("@supabase/supabase-js"); // Supabase client
const { RateLimiterMemory } = require("rate-limiter-flexible");

// Load environment variables
require("dotenv").config({ path: "./../../.env.local" });

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

// Rate limiter setup (e.g., 1 requests per 4 seconds)
// NST limit is >75 in 4 minutes, so 1 per 4 seconds is safe
const rateLimiter = new RateLimiterMemory({
  points: 1, // Number of requests
  duration: 25, // Sleep for n seconds
});

// Function to pause execution to respect rate limits
async function rateLimitedRequest(fn) {
  try {
    await rateLimiter.consume(1); // Consume 1 point
    return await fn();
  } catch (rejRes) {
    if (rejRes.msBeforeNext) {
      // If rate limit exceeded, wait for the required time
      await new Promise((resolve) => setTimeout(resolve, rejRes.msBeforeNext));
      return await fn();
    } else {
      throw new Error("Rate limiting failed");
    }
  }
}

// Function to fetch and process data
async function fetchAndProcessData(url, key, playerId) {
  try {
    // Make HTTP request with rate limiting
    const response = await rateLimitedRequest(() => axios.get(url));

    // Check if the request was successful
    if (response.status === 200) {
      console.log(`Successfully fetched data for player ${playerId} (${key}).`);
    } else {
      console.log(
        `Failed to fetch data for player ${playerId} (${key}). Status code: ${response.status}`
      );
      return {};
    }

    // Parse the HTML using Cheerio
    const $ = cheerio.load(response.data);

    // Find the target table (assuming the first table)
    const targetTable = $("table").first();

    // Extract initial headers from <th> elements
    let headers = [];
    targetTable.find("th").each((i, el) => {
      headers.push($(el).text().trim());
    });

    // Check if extra header row exists (only for 'oi')
    let handleExtraHeader = false;
    let extraHeaders = [];
    if (key === "oi") {
      handleExtraHeader = true;
    }

    // Position to insert extra headers (after 'LDGF%')
    const insertIndex = headers.indexOf("LDGF%") + 1;

    // Extract data rows
    const tableData = [];

    targetTable.find("tr").each((i, row) => {
      const cells = $(row).find("td");
      if (cells.length > 0) {
        const cellData = [];
        cells.each((j, cell) => {
          cellData.push($(cell).text().trim());
        });

        // Check for extra headers (only for 'oi')
        if (
          handleExtraHeader &&
          cellData[0] === "On-Ice SH%" &&
          cellData[1] === "On-Ice SV%" &&
          cellData[2] === "PDO"
        ) {
          // Insert these headers into the headers array at the correct position
          headers.splice(insertIndex, 0, ...cellData);
          handleExtraHeader = false; // Extra headers have been handled
        } else {
          tableData.push(cellData);
        }
      }
    });

    // Adjust data rows to match the number of headers
    tableData.forEach((row, index) => {
      if (row.length !== headers.length) {
        if (row.length < headers.length) {
          if (key === "oi") {
            // For 'oi', pad with nulls at the insertIndex
            row.splice(insertIndex, 0, ...Array(3).fill(null));
          } else {
            // For 'std', pad at the end
            row.push(...Array(headers.length - row.length).fill(null));
          }
        } else if (row.length > headers.length) {
          // Trim extra columns
          row = row.slice(0, headers.length);
        }
        tableData[index] = row;
      }
    });

    // Create an array of objects with headers as keys
    const dataObjects = tableData.map((row) => {
      const rowData = {};
      headers.forEach((header, index) => {
        rowData[header] = row[index];
      });
      return rowData;
    });

    // Restructure the data
    const structuredData = {};

    dataObjects.forEach((row) => {
      // Extract the date and teams from the "Game" field
      const gameInfo = row["Game"];
      if (!gameInfo) return; // Skip rows with missing game information

      const dateAndTeams = gameInfo.split(" ");
      if (dateAndTeams.length >= 2) {
        const date = dateAndTeams[0];
        const teams = dateAndTeams.slice(1).join(" ");
        const [awayTeam, homeTeam] = teams.split(" at ");

        // Remove the original "Game" field
        delete row["Game"];

        // Prepare the data object
        const dataEntry = row;

        // Initialize the date entry if not already present
        if (!structuredData[date]) {
          structuredData[date] = {};
        }

        // Add the data under the appropriate key ('oi' or 'std')
        structuredData[date][key] = dataEntry;
        structuredData[date].homeTeam = homeTeam;
        structuredData[date].awayTeam = awayTeam;
      }
    });

    return structuredData;
  } catch (error) {
    console.error(
      `Error fetching or processing data for player ${playerId} (${key}):`,
      error.message
    );
    return {};
  }
}

// Main function to fetch data for all players and upsert into Supabase
async function main() {
  try {
    let page = 0;
    const pageSize = 1000;
    let hasMorePlayers = true;

    while (hasMorePlayers) {
      // Fetch player IDs from the 'players' table with pagination
      const { data: players, error } = await supabase
        .from("players")
        .select("id")
        .order("id")
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (error) {
        console.error("Error fetching player IDs:", error.message);
        return;
      }

      if (players.length === 0) {
        hasMorePlayers = false;
        break;
      }

      console.log(`Processing page ${page + 1}, ${players.length} players.`);

      // Loop through each player ID
      for (const player of players) {
        const playerId = player.id;
        console.log(`Processing player ID: ${playerId}`);

        // Fetch data from both URLs for the player
        const urls = {
          oi: `https://naturalstattrick.com/playerreport.php?fromseason=20232024&thruseason=20232024&stype=2&sit=5v5&stdoi=oi&rate=n&v=g&playerid=${playerId}`,
          std: `https://naturalstattrick.com/playerreport.php?fromseason=20232024&thruseason=20232024&stype=2&sit=5v5&stdoi=std&rate=n&v=g&playerid=${playerId}`,
        };

        const [oiData, stdData] = await Promise.all([
          fetchAndProcessData(urls.oi, "oi", playerId),
          fetchAndProcessData(urls.std, "std", playerId),
        ]);

        // Combine the data based on dates
        const combinedData = {};

        // Merge 'oi' data
        for (const date in oiData) {
          if (!combinedData[date]) {
            combinedData[date] = {};
          }
          combinedData[date] = {
            ...combinedData[date],
            ...oiData[date],
          };
        }

        // Merge 'std' data
        for (const date in stdData) {
          if (!combinedData[date]) {
            combinedData[date] = {};
          }
          combinedData[date] = {
            ...combinedData[date],
            ...stdData[date],
          };
        }

        // Prepare data for upsertion into Supabase
        const upsertData = [];

        for (const date in combinedData) {
          const entry = combinedData[date];
          const dataToUpsert = {
            playerid: playerId,
            date: date,
            // From 'std' data
            toi: parseFloat(entry.std?.TOI) || null,
            goals: parseInt(entry.std?.Goals) || 0,
            first_assists: parseInt(entry.std?.["First Assists"]) || 0,
            second_assists: parseInt(entry.std?.["Second Assists"]) || 0,
            ipp: parseFloat(entry.std?.IPP) || null,
            shots: parseInt(entry.std?.Shots) || 0,
            s_percentage: parseFloat(entry.std?.["S%"]) || null,
            ixg: parseFloat(entry.std?.ixG) || null,
            icf: parseInt(entry.std?.iCF) || 0,
            iscf: parseInt(entry.std?.iSCF) || 0,
            ihdcf: parseInt(entry.std?.iHDCF) || 0,
            // From 'oi' data
            cf_percentage: parseFloat(entry.oi?.["CF%"]) || null,
            sf_percentage: parseFloat(entry.oi?.["SF%"]) || null,
            gf_percentage: parseFloat(entry.oi?.["GF%"]) || null,
            xgf: parseFloat(entry.oi?.xGF) || null,
            xgf_percentage: parseFloat(entry.oi?.["xGF%"]) || null,
            scf: parseInt(entry.oi?.SCF) || 0,
            scf_percentage: parseFloat(entry.oi?.["SCF%"]) || null,
            hdcf: parseInt(entry.oi?.HDCF) || 0,
            hdcf_percentage: parseFloat(entry.oi?.["HDCF%"]) || null,
            oish: parseFloat(entry.oi?.["On-Ice SH%"]) || null,
            oisv: parseFloat(entry.oi?.["On-Ice SV%"]) || null,
            ozs: parseFloat(entry.oi?.["Off. Zone Start %"]) || null,
          };

          upsertData.push(dataToUpsert);
        }

        // Upsert data into Supabase
        const { data, error } = await supabase
          .from("nst_sko_stats")
          .upsert(upsertData, { onConflict: "playerid,date" });

        if (error) {
          console.error(
            `Error upserting data for player ${playerId}:`,
            error.message
          );
        } else {
          console.log(
            `Successfully upserted data for player ${playerId}, ${upsertData.length} records.`
          );
        }
      }

      // Move to the next page
      page += 1;
    }

    console.log("Data fetching and upsertion completed.");
  } catch (error) {
    console.error("An error occurred during processing:", error.message);
  }
}

// Run the main function
main();
