// pages/api/Teams/nst-team-stats.ts

import { NextApiResponse } from "next";
import adminOnly from "utils/adminOnlyMiddleware";
import { getCurrentSeason } from "lib/NHL/server";
import { exec } from "child_process";
import path from "path";
import { promisify } from "util";
import { teamsInfo, teamNameToAbbreviationMap } from "lib/teamsInfo"; // Import the mapping
import { addDays, format, parseISO, isAfter } from "date-fns";

// Promisify exec for easier async/await usage
const execAsync = promisify(exec);

// Define the responseKeys with necessary parameters for date-based tables
const dateBasedResponseKeys: {
  [key: string]: { situation: string; rate: string };
} = {
  countsAll: {
    situation: "all",
    rate: "n",
  },
  counts5v5: {
    situation: "5v5",
    rate: "n",
  },
  countsPP: {
    situation: "pp",
    rate: "n",
  },
  countsPK: {
    situation: "pk",
    rate: "n",
  },
};

// Define the responseKeys for season-based tables
const seasonBasedResponseKeys: {
  [key: string]: { situation: string; rate: string };
} = {
  seasonStats: {
    situation: "all",
    rate: "n",
  },
  lastSeasonStats: {
    situation: "all",
    rate: "n",
  },
};

// Define TypeScript interfaces for clarity
interface PythonScriptOutput {
  debug: {
    [key: string]: any;
  };
  data: TeamStat[];
}

interface TeamStat {
  date: string | null; // Changed to allow null for season-based data
  situation: string;
  Team: string;
  GP: string;
  TOI: string;
  W: string;
  L: string;
  OTL: string;
  Points: string;
  CF: string;
  CA: string;
  CFPct: number | null;
  FF: string;
  FA: string;
  FFPct: number | null;
  SF: string;
  SA: string;
  SFPct: number | null;
  GF: string;
  GA: string;
  GFPct: number | null;
  xGF: string;
  xGA: string;
  xGFPct: number | null;
  SCF: string;
  SCA: string;
  SCFPct: number | null;
  HDCF: string;
  HDCA: string;
  HDCFPct: number | null;
  HDSF: string;
  HDSA: string;
  HDSFPct: number | null;
  HDGF: string;
  HDGA: string;
  HDGFPct: number | null;
  SHPct: number | null;
  SVPct: number | null;
  PDO: string | null;
  season?: string; // Added optional season field
}

// Helper function to normalize team names by removing punctuation, diacritics, and converting to lowercase
const normalizeTeamName = (name: string): string =>
  name
    .normalize("NFD") // Decompose combined letters into base letters and diacritics
    .replace(/[\u0300-\u036f]/g, "") // Remove diacritics
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "") // Remove punctuation
    .trim()
    .toLowerCase();

// Helper function to introduce delays (if not using Bottleneck)
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Safely parses a string to a number.
 * Returns null if the input is "-", otherwise returns the parsed number.
 * @param value - The string value to parse.
 * @returns The parsed number or null.
 */
export const safeParseNumber = (value: string): number | null => {
  if (value.trim() === "-") {
    return null;
  }
  const parsed = Number(value);
  return isNaN(parsed) ? null : parsed;
};

export default adminOnly(async (req: any, res: NextApiResponse) => {
  const { supabase } = req;

  try {
    // 1. Extract 'date' query parameter
    const { date } = req.query;

    // Validate 'date' parameter
    if (!date) {
      return res.status(400).json({
        message: "Missing 'date' query parameter.",
        success: false,
      });
    }

    // 2. Get current and last season details
    const currentSeason = await getCurrentSeason();
    const {
      seasonId,
      lastSeasonId,
      regularSeasonStartDate,
      regularSeasonEndDate,
      seasonEndDate,
      lastRegularSeasonStartDate,
      lastRegularSeasonEndDate,
      lastSeasonEndDate,
    } = currentSeason;

    // 3. Preliminary Check for Date-Based Tables and Data Fetching
    if (date === "all") {
      console.log("Performing preliminary checks for date-based tables.");

      // Define date-based tables
      const dateBasedTables = [
        "nst_team_all",
        "nst_team_5v5",
        "nst_team_pp",
        "nst_team_pk",
      ];

      // Function to get the latest date from a table
      const getLatestDate = async (table: string): Promise<string | null> => {
        const { data, error } = await supabase
          .from(table)
          .select("date")
          .order("date", { ascending: false })
          .limit(1)
          .single();

        if (error) {
          console.error(
            `Error fetching latest date from ${table}:`,
            error.message
          );
          return null;
        }

        return data?.date || null;
      };

      // Fetch the latest date from each date-based table
      const latestDatesPromises = dateBasedTables.map((table) =>
        getLatestDate(table)
      );
      const latestDates = await Promise.all(latestDatesPromises);

      // Filter out nulls and find the maximum date
      const validDates = latestDates.filter((d) => d !== null) as string[];
      let fetchStartDate: Date;

      if (validDates.length > 0) {
        const maxDateStr = validDates.reduce((a, b) => (a > b ? a : b));
        const maxDate = parseISO(maxDateStr);
        fetchStartDate = addDays(maxDate, 1); // Start from the next day
      } else {
        // If no data exists, start from regularSeasonStartDate
        fetchStartDate = parseISO(regularSeasonStartDate);
      }

      const today = new Date();
      if (isAfter(fetchStartDate, today)) {
        console.log("All data is up to date. No new data to fetch.");
        return res.status(200).json({
          message: "All date-based team statistics are up to date.",
          success: true,
        });
      }

      console.log(
        `Fetching date-based team statistics starting from ${format(
          fetchStartDate,
          "yyyy-MM-dd"
        )}.`
      );

      // **Run the full script: iterate through each date starting from fetchStartDate**
      console.log("Running full script: Iterating through dates.");

      const startDate = fetchStartDate;
      const endDate = new Date(); // Today's date

      let currentDate = startDate;

      while (!isAfter(currentDate, endDate)) {
        const formattedDate = format(currentDate, "yyyy-MM-dd");
        console.log("20s Delay");
        await delay(20000); // added 20s delay to avoid rate limiting
        console.log(`Processing date: ${formattedDate}`);

        // Iterate through the four date-based responseKeys
        for (const key in dateBasedResponseKeys) {
          const { situation, rate } = dateBasedResponseKeys[key];

          // Construct arguments for the Python script
          const scriptArgs = [
            "--sit",
            situation,
            "--rate",
            rate,
            "--fd",
            formattedDate,
            "--td",
            formattedDate,
            "--from_season",
            seasonId.toString(),
            "--thru_season",
            seasonId.toString(),
            "--stype",
            "2",
            "--score",
            "all",
            "--team",
            "all",
            "--loc",
            "B",
            "--gpf",
            "410",
          ];

          // Path to the Python script
          const scriptPath = path.join(
            process.cwd(),
            "scripts",
            "fetch_team_table.py"
          );

          try {
            // Execute the Python script using Bottleneck's limiter
            const { stdout, stderr } = await execAsync(
              `python "${scriptPath}" ${scriptArgs
                .map((arg) => `"${arg}"`)
                .join(" ")}`
            );

            if (stderr) {
              console.error(
                `Error executing Python script for key ${key} on date ${formattedDate}:`,
                stderr
              );
              throw new Error(`Python script error: ${stderr}`);
            }

            // Parse the JSON output
            const scriptOutput: PythonScriptOutput = JSON.parse(stdout);

            if (scriptOutput.debug && scriptOutput.debug.Error) {
              console.error(
                `Script Error for key ${key} on date ${formattedDate}:`,
                scriptOutput.debug.Error
              );
              throw new Error(`Script Error: ${scriptOutput.debug.Error}`);
            }

            const teamStats = scriptOutput.data;

            // Determine the target Supabase table based on the key
            let targetTable = "";
            switch (key) {
              case "countsAll":
                targetTable = "nst_team_all";
                break;
              case "counts5v5":
                targetTable = "nst_team_5v5";
                break;
              case "countsPP":
                targetTable = "nst_team_pp";
                break;
              case "countsPK":
                targetTable = "nst_team_pk";
                break;
              default:
                console.warn(`Unknown date-based key: ${key}. Skipping...`);
                continue;
            }

            // Prepare data for upsert
            const upsertData = teamStats
              .map((stat) => {
                const teamName = stat.Team;
                let teamAbbreviation = teamNameToAbbreviationMap[teamName];

                // Normalize team name and attempt mapping
                if (!teamAbbreviation) {
                  console.warn(
                    `Unknown team name "${teamName}". Attempting to find a match...`
                  );

                  // Attempt to find a match using normalized team name
                  const normalizedTeamName = normalizeTeamName(teamName);
                  const matchedAbbreviation = Object.keys(teamsInfo).find(
                    (abbr) =>
                      normalizeTeamName(teamsInfo[abbr].name) ===
                      normalizedTeamName
                  );

                  if (matchedAbbreviation) {
                    teamAbbreviation = matchedAbbreviation;
                  } else {
                    console.error(
                      `Unable to find abbreviation for team name "${teamName}". Skipping this entry.`
                    );
                    return null; // Exclude this entry from upsert
                  }
                }

                // Handle special case for "Utah Utah HC"
                if (teamName === "Utah Utah HC" && teamAbbreviation !== "UTA") {
                  teamAbbreviation = "UTA";
                }

                return {
                  team_abbreviation: teamAbbreviation,
                  team_name: teamsInfo[teamAbbreviation]?.name || teamName, // Use mapped name or original
                  gp: safeParseNumber(stat.GP),
                  toi: stat.TOI === "-" ? null : safeParseNumber(stat.TOI),
                  w: safeParseNumber(stat.W),
                  l: safeParseNumber(stat.L),
                  otl: safeParseNumber(stat.OTL),
                  points: safeParseNumber(stat.Points),
                  cf: safeParseNumber(stat.CF),
                  ca: safeParseNumber(stat.CA),
                  cf_pct:
                    stat.CFPct !== null
                      ? parseFloat(stat.CFPct.toFixed(2))
                      : null,
                  ff: safeParseNumber(stat.FF),
                  fa: safeParseNumber(stat.FA),
                  ff_pct:
                    stat.FFPct !== null
                      ? parseFloat(stat.FFPct.toFixed(2))
                      : null,
                  sf: safeParseNumber(stat.SF),
                  sa: safeParseNumber(stat.SA),
                  sf_pct:
                    stat.SFPct !== null
                      ? parseFloat(stat.SFPct.toFixed(2))
                      : null,
                  gf: safeParseNumber(stat.GF),
                  ga: safeParseNumber(stat.GA),
                  gf_pct:
                    stat.GFPct !== null
                      ? parseFloat(stat.GFPct.toFixed(2))
                      : null,
                  xgf: safeParseNumber(stat.xGF),
                  xga: safeParseNumber(stat.xGA),
                  xgf_pct:
                    stat.xGFPct !== null
                      ? parseFloat(stat.xGFPct.toFixed(2))
                      : null,
                  scf: safeParseNumber(stat.SCF),
                  sca: safeParseNumber(stat.SCA),
                  scf_pct:
                    stat.SCFPct !== null
                      ? parseFloat(stat.SCFPct.toFixed(2))
                      : null,
                  hdcf: safeParseNumber(stat.HDCF),
                  hdca: safeParseNumber(stat.HDCA),
                  hdcf_pct:
                    stat.HDCFPct !== null
                      ? parseFloat(stat.HDCFPct.toFixed(2))
                      : null,
                  hdsf: safeParseNumber(stat.HDSF),
                  hdsa: safeParseNumber(stat.HDSA),
                  hdsf_pct:
                    stat.HDSFPct !== null
                      ? parseFloat(stat.HDSFPct.toFixed(2))
                      : null,
                  hdgf: safeParseNumber(stat.HDGF),
                  hdga: safeParseNumber(stat.HDGA),
                  hdgf_pct:
                    stat.HDGFPct !== null
                      ? parseFloat(stat.HDGFPct.toFixed(2))
                      : null,
                  sh_pct:
                    stat.SHPct !== null
                      ? parseFloat(stat.SHPct.toFixed(2))
                      : null,
                  sv_pct:
                    stat.SVPct !== null
                      ? parseFloat(stat.SVPct.toFixed(2))
                      : null,
                  pdo: stat.PDO !== null ? parseFloat(stat.PDO) : null,
                  date: formattedDate,
                  situation: stat.situation || "all",
                  // For date-based tables, season is undefined
                };
              })
              .filter(
                (entry): entry is NonNullable<typeof entry> => entry !== null
              ); // Remove null entries
            await delay(1500); // another delay
            console.log("1.5 delay");
            // Upsert data into Supabase
            const { error } = await supabase
              .from(targetTable)
              .upsert(upsertData, {
                onConflict: ["team_abbreviation", "date"],
              });

            if (error) {
              console.error(
                `Supabase upsert error for table ${targetTable}:`,
                error.message
              );
              throw new Error(`Supabase upsert error: ${error.message}`);
            }

            console.log(
              `Successfully upserted ${upsertData.length} records into ${targetTable} for date ${formattedDate}`
            );
          } catch (error: any) {
            console.error(
              `Error executing Python script for key ${key} on date ${formattedDate}:`,
              error.message
            );
            throw new Error(`Python script error: ${error.message}`);
          }
        }

        // Move to the next day
        currentDate = addDays(currentDate, 1);
      }

      // **Process season-based response keys**
      console.log("Processing season-based response keys.");

      for (const key in seasonBasedResponseKeys) {
        const { situation, rate } = seasonBasedResponseKeys[key];

        // Determine the target Supabase table based on the key
        let targetTable = "";
        switch (key) {
          case "seasonStats":
            targetTable = "nst_team_stats";
            break;
          case "lastSeasonStats":
            targetTable = "nst_team_stats_ly";
            break;
          default:
            console.warn(`Unknown season-based key: ${key}. Skipping...`);
            continue;
        }

        // Determine the season parameters
        const from_season =
          key === "seasonStats" ? seasonId.toString() : lastSeasonId.toString();
        const thru_season =
          key === "seasonStats" ? seasonId.toString() : lastSeasonId.toString();

        // Special handling for 'lastSeasonStats'
        let shouldFetchSeason = true;
        if (key === "lastSeasonStats") {
          // Check if the latest season in nst_team_stats_ly matches lastSeasonId
          const { data, error } = await supabase
            .from(targetTable)
            .select("season")
            .eq("season", lastSeasonId.toString())
            .limit(1)
            .single();

          if (!error && data) {
            console.log(
              `Season-based table ${targetTable} already has data for season ${lastSeasonId}. Skipping fetch.`
            );
            shouldFetchSeason = false;
          }
        }

        if (!shouldFetchSeason) {
          continue; // Skip fetching for this season-based key
        }

        // Construct arguments for the Python script
        const scriptArgs = [
          "--sit",
          situation,
          "--rate",
          rate,
          "--fd",
          "", // Not applicable for season-based
          "--td",
          "", // Not applicable for season-based
          "--from_season",
          from_season,
          "--thru_season",
          thru_season,
          "--stype",
          "2",
          "--score",
          "all",
          "--team",
          "all",
          "--loc",
          "B",
          "--gpf",
          "410",
        ];

        // Path to the Python script
        const scriptPath = path.join(
          process.cwd(),
          "scripts",
          "fetch_team_table.py"
        );

        try {
          // Execute the Python script using Bottleneck's limiter
          const { stdout, stderr } = await execAsync(
            `python "${scriptPath}" ${scriptArgs
              .map((arg) => `"${arg}"`)
              .join(" ")}`
          );

          if (stderr) {
            console.error(
              `Error executing Python script for key ${key}:`,
              stderr
            );
            throw new Error(`Python script error: ${stderr}`);
          }

          // Parse the JSON output
          const scriptOutput: PythonScriptOutput = JSON.parse(stdout);

          if (scriptOutput.debug && scriptOutput.debug.Error) {
            console.error(
              `Script Error for key ${key}:`,
              scriptOutput.debug.Error
            );
            throw new Error(`Script Error: ${scriptOutput.debug.Error}`);
          }

          const teamStats = scriptOutput.data;

          // Prepare data for upsert
          const upsertData = teamStats
            .map((stat) => {
              const teamName = stat.Team;
              let teamAbbreviation = teamNameToAbbreviationMap[teamName];

              // Normalize team name and attempt mapping
              if (!teamAbbreviation) {
                console.warn(
                  `Unknown team name "${teamName}". Attempting to find a match...`
                );

                // Attempt to find a match using normalized team name
                const normalizedTeamName = normalizeTeamName(teamName);
                const matchedAbbreviation = Object.keys(
                  teamNameToAbbreviationMap
                ).find(
                  (abbr) =>
                    normalizeTeamName(teamsInfo[abbr].name) ===
                    normalizedTeamName
                );

                if (matchedAbbreviation) {
                  teamAbbreviation =
                    teamNameToAbbreviationMap[
                      teamsInfo[matchedAbbreviation].name
                    ];
                } else {
                  console.error(
                    `Unable to find abbreviation for team name "${teamName}". Skipping this entry.`
                  );
                  return null; // Exclude this entry from upsert
                }
              }

              // Handle special case for "Utah Utah HC"
              if (teamName === "Utah Utah HC" && teamAbbreviation !== "UTA") {
                teamAbbreviation = "UTA";
              }

              return {
                team_abbreviation: teamAbbreviation,
                team_name: teamsInfo[teamAbbreviation]?.name || teamName, // Use mapped name or original
                gp: safeParseNumber(stat.GP),
                toi: stat.TOI === "-" ? null : safeParseNumber(stat.TOI),
                w: safeParseNumber(stat.W),
                l: safeParseNumber(stat.L),
                otl: safeParseNumber(stat.OTL),
                points: safeParseNumber(stat.Points),
                cf: safeParseNumber(stat.CF),
                ca: safeParseNumber(stat.CA),
                cf_pct:
                  stat.CFPct !== null
                    ? parseFloat(stat.CFPct.toFixed(2))
                    : null,
                ff: safeParseNumber(stat.FF),
                fa: safeParseNumber(stat.FA),
                ff_pct:
                  stat.FFPct !== null
                    ? parseFloat(stat.FFPct.toFixed(2))
                    : null,
                sf: safeParseNumber(stat.SF),
                sa: safeParseNumber(stat.SA),
                sf_pct:
                  stat.SFPct !== null
                    ? parseFloat(stat.SFPct.toFixed(2))
                    : null,
                gf: safeParseNumber(stat.GF),
                ga: safeParseNumber(stat.GA),
                gf_pct:
                  stat.GFPct !== null
                    ? parseFloat(stat.GFPct.toFixed(2))
                    : null,
                xgf: safeParseNumber(stat.xGF),
                xga: safeParseNumber(stat.xGA),
                xgf_pct:
                  stat.xGFPct !== null
                    ? parseFloat(stat.xGFPct.toFixed(2))
                    : null,
                scf: safeParseNumber(stat.SCF),
                sca: safeParseNumber(stat.SCA),
                scf_pct:
                  stat.SCFPct !== null
                    ? parseFloat(stat.SCFPct.toFixed(2))
                    : null,
                hdcf: safeParseNumber(stat.HDCF),
                hdca: safeParseNumber(stat.HDCA),
                hdcf_pct:
                  stat.HDCFPct !== null
                    ? parseFloat(stat.HDCFPct.toFixed(2))
                    : null,
                hdsf: safeParseNumber(stat.HDSF),
                hdsa: safeParseNumber(stat.HDSA),
                hdsf_pct:
                  stat.HDSFPct !== null
                    ? parseFloat(stat.HDSFPct.toFixed(2))
                    : null,
                hdgf: safeParseNumber(stat.HDGF),
                hdga: safeParseNumber(stat.HDGA),
                hdgf_pct:
                  stat.HDGFPct !== null
                    ? parseFloat(stat.HDGFPct.toFixed(2))
                    : null,
                sh_pct:
                  stat.SHPct !== null
                    ? parseFloat(stat.SHPct.toFixed(2))
                    : null,
                sv_pct:
                  stat.SVPct !== null
                    ? parseFloat(stat.SVPct.toFixed(2))
                    : null,
                pdo: stat.PDO !== null ? parseFloat(stat.PDO) : null,
                situation: stat.situation || "all",
                season: from_season, // Added season field
                // For season-based tables, date is undefined or null
              };
            })
            .filter(
              (entry): entry is NonNullable<typeof entry> => entry !== null
            ); // Remove null entries

          // Upsert data into Supabase
          const { error } = await supabase
            .from(targetTable)
            .upsert(upsertData, {
              onConflict: ["team_abbreviation", "season"], // Ensure 'season' is a unique constraint in your table
            });

          if (error) {
            console.error(
              `Supabase upsert error for table ${targetTable}:`,
              error.message
            );
            throw new Error(`Supabase upsert error: ${error.message}`);
          }

          console.log(
            `Successfully upserted ${upsertData.length} records into ${targetTable}.`
          );
        } catch (error: any) {
          console.error(
            `Error executing Python script for key ${key}:`,
            error.message
          );
          throw new Error(`Python script error: ${error.message}`);
        }
      }

      // **Process season-based response keys**
      console.log("Processing season-based response keys.");

      for (const key in seasonBasedResponseKeys) {
        const { situation, rate } = seasonBasedResponseKeys[key];

        // Determine the target Supabase table based on the key
        let targetTable = "";
        switch (key) {
          case "seasonStats":
            targetTable = "nst_team_stats";
            break;
          case "lastSeasonStats":
            targetTable = "nst_team_stats_ly";
            break;
          default:
            console.warn(`Unknown season-based key: ${key}. Skipping...`);
            continue;
        }

        // Determine the season parameters
        const from_season =
          key === "seasonStats" ? seasonId.toString() : lastSeasonId.toString();
        const thru_season =
          key === "seasonStats" ? seasonId.toString() : lastSeasonId.toString();

        // Special handling for 'lastSeasonStats'
        let shouldFetchSeason = true;
        if (key === "lastSeasonStats") {
          // Check if the latest season in nst_team_stats_ly matches lastSeasonId
          const { data, error } = await supabase
            .from(targetTable)
            .select("season")
            .eq("season", lastSeasonId.toString())
            .limit(1)
            .single();

          if (!error && data) {
            console.log(
              `Season-based table ${targetTable} already has data for season ${lastSeasonId}. Skipping fetch.`
            );
            shouldFetchSeason = false;
          }
        }

        if (!shouldFetchSeason) {
          continue; // Skip fetching for this season-based key
        }

        // Construct arguments for the Python script
        const scriptArgs = [
          "--sit",
          situation,
          "--rate",
          rate,
          "--fd",
          "", // Not applicable for season-based
          "--td",
          "", // Not applicable for season-based
          "--from_season",
          from_season,
          "--thru_season",
          thru_season,
          "--stype",
          "2",
          "--score",
          "all",
          "--team",
          "all",
          "--loc",
          "B",
          "--gpf",
          "410",
        ];

        // Path to the Python script
        const scriptPath = path.join(
          process.cwd(),
          "scripts",
          "fetch_team_table.py"
        );

        try {
          // Execute the Python script using Bottleneck's limiter
          const { stdout, stderr } = await execAsync(
            `python "${scriptPath}" ${scriptArgs
              .map((arg) => `"${arg}"`)
              .join(" ")}`
          );

          if (stderr) {
            console.error(
              `Error executing Python script for key ${key}:`,
              stderr
            );
            throw new Error(`Python script error: ${stderr}`);
          }

          // Parse the JSON output
          const scriptOutput: PythonScriptOutput = JSON.parse(stdout);

          if (scriptOutput.debug && scriptOutput.debug.Error) {
            console.error(
              `Script Error for key ${key}:`,
              scriptOutput.debug.Error
            );
            throw new Error(`Script Error: ${scriptOutput.debug.Error}`);
          }

          const teamStats = scriptOutput.data;

          // Prepare data for upsert
          const upsertData = teamStats
            .map((stat) => {
              const teamName = stat.Team;
              let teamAbbreviation = teamNameToAbbreviationMap[teamName];

              // Normalize team name and attempt mapping
              if (!teamAbbreviation) {
                console.warn(
                  `Unknown team name "${teamName}". Attempting to find a match...`
                );

                // Attempt to find a match using normalized team name
                const normalizedTeamName = normalizeTeamName(teamName);
                const matchedAbbreviation = Object.keys(
                  teamNameToAbbreviationMap
                ).find(
                  (abbr) =>
                    normalizeTeamName(teamsInfo[abbr].name) ===
                    normalizedTeamName
                );

                if (matchedAbbreviation) {
                  teamAbbreviation =
                    teamNameToAbbreviationMap[
                      teamsInfo[matchedAbbreviation].name
                    ];
                } else {
                  console.error(
                    `Unable to find abbreviation for team name "${teamName}". Skipping this entry.`
                  );
                  return null; // Exclude this entry from upsert
                }
              }

              // Handle special case for "Utah Utah HC"
              if (teamName === "Utah Utah HC" && teamAbbreviation !== "UTA") {
                teamAbbreviation = "UTA";
              }

              return {
                team_abbreviation: teamAbbreviation,
                team_name: teamsInfo[teamAbbreviation]?.name || teamName, // Use mapped name or original
                gp: safeParseNumber(stat.GP),
                toi: stat.TOI === "-" ? null : safeParseNumber(stat.TOI),
                w: safeParseNumber(stat.W),
                l: safeParseNumber(stat.L),
                otl: safeParseNumber(stat.OTL),
                points: safeParseNumber(stat.Points),
                cf: safeParseNumber(stat.CF),
                ca: safeParseNumber(stat.CA),
                cf_pct:
                  stat.CFPct !== null
                    ? parseFloat(stat.CFPct.toFixed(2))
                    : null,
                ff: safeParseNumber(stat.FF),
                fa: safeParseNumber(stat.FA),
                ff_pct:
                  stat.FFPct !== null
                    ? parseFloat(stat.FFPct.toFixed(2))
                    : null,
                sf: safeParseNumber(stat.SF),
                sa: safeParseNumber(stat.SA),
                sf_pct:
                  stat.SFPct !== null
                    ? parseFloat(stat.SFPct.toFixed(2))
                    : null,
                gf: safeParseNumber(stat.GF),
                ga: safeParseNumber(stat.GA),
                gf_pct:
                  stat.GFPct !== null
                    ? parseFloat(stat.GFPct.toFixed(2))
                    : null,
                xgf: safeParseNumber(stat.xGF),
                xga: safeParseNumber(stat.xGA),
                xgf_pct:
                  stat.xGFPct !== null
                    ? parseFloat(stat.xGFPct.toFixed(2))
                    : null,
                scf: safeParseNumber(stat.SCF),
                sca: safeParseNumber(stat.SCA),
                scf_pct:
                  stat.SCFPct !== null
                    ? parseFloat(stat.SCFPct.toFixed(2))
                    : null,
                hdcf: safeParseNumber(stat.HDCF),
                hdca: safeParseNumber(stat.HDCA),
                hdcf_pct:
                  stat.HDCFPct !== null
                    ? parseFloat(stat.HDCFPct.toFixed(2))
                    : null,
                hdsf: safeParseNumber(stat.HDSF),
                hdsa: safeParseNumber(stat.HDSA),
                hdsf_pct:
                  stat.HDSFPct !== null
                    ? parseFloat(stat.HDSFPct.toFixed(2))
                    : null,
                hdgf: safeParseNumber(stat.HDGF),
                hdga: safeParseNumber(stat.HDGA),
                hdgf_pct:
                  stat.HDGFPct !== null
                    ? parseFloat(stat.HDGFPct.toFixed(2))
                    : null,
                sh_pct:
                  stat.SHPct !== null
                    ? parseFloat(stat.SHPct.toFixed(2))
                    : null,
                sv_pct:
                  stat.SVPct !== null
                    ? parseFloat(stat.SVPct.toFixed(2))
                    : null,
                pdo: stat.PDO !== null ? parseFloat(stat.PDO) : null,
                situation: stat.situation || "all",
                season: from_season, // Added season field
                // For season-based tables, date is undefined or null
              };
            })
            .filter(
              (entry): entry is NonNullable<typeof entry> => entry !== null
            ); // Remove null entries

          // Upsert data into Supabase
          const { error } = await supabase
            .from(targetTable)
            .upsert(upsertData, {
              onConflict: ["team_abbreviation", "season"], // Ensure 'season' is a unique constraint in your table
            });

          if (error) {
            console.error(
              `Supabase upsert error for table ${targetTable}:`,
              error.message
            );
            throw new Error(`Supabase upsert error: ${error.message}`);
          }

          console.log(
            `Successfully upserted ${upsertData.length} records into ${targetTable}.`
          );
        } catch (error: any) {
          console.error(
            `Error executing Python script for key ${key}:`,
            error.message
          );
          throw new Error(`Python script error: ${error.message}`);
        }
      }

      // **Process nst_team_stats (seasonStats)**
      // No preliminary check needed; update rows based on new data
      console.log("Processing nst_team_stats.");

      for (const key in seasonBasedResponseKeys) {
        const { situation, rate } = seasonBasedResponseKeys[key];

        if (key !== "seasonStats") continue; // Skip other keys here

        const targetTable = "nst_team_stats";

        // Determine the season parameters
        const from_season = seasonId.toString();
        const thru_season = seasonId.toString();

        // Construct arguments for the Python script
        const scriptArgs = [
          "--sit",
          situation,
          "--rate",
          rate,
          "--fd",
          "", // Not applicable for season-based
          "--td",
          "", // Not applicable for season-based
          "--from_season",
          from_season,
          "--thru_season",
          thru_season,
          "--stype",
          "2",
          "--score",
          "all",
          "--team",
          "all",
          "--loc",
          "B",
          "--gpf",
          "410",
        ];

        // Path to the Python script
        const scriptPath = path.join(
          process.cwd(),
          "scripts",
          "fetch_team_table.py"
        );

        try {
          // Execute the Python script using Bottleneck's limiter
          const { stdout, stderr } = await execAsync(
            `python "${scriptPath}" ${scriptArgs
              .map((arg) => `"${arg}"`)
              .join(" ")}`
          );

          if (stderr) {
            console.error(
              `Error executing Python script for key ${key}:`,
              stderr
            );
            throw new Error(`Python script error: ${stderr}`);
          }

          // Parse the JSON output
          const scriptOutput: PythonScriptOutput = JSON.parse(stdout);

          if (scriptOutput.debug && scriptOutput.debug.Error) {
            console.error(
              `Script Error for key ${key}:`,
              scriptOutput.debug.Error
            );
            throw new Error(`Script Error: ${scriptOutput.debug.Error}`);
          }

          const teamStats = scriptOutput.data;

          // Prepare data for upsert
          const upsertData = teamStats
            .map((stat) => {
              const teamName = stat.Team;
              let teamAbbreviation = teamNameToAbbreviationMap[teamName];

              // Normalize team name and attempt mapping
              if (!teamAbbreviation) {
                console.warn(
                  `Unknown team name "${teamName}". Attempting to find a match...`
                );

                // Attempt to find a match using normalized team name
                const normalizedTeamName = normalizeTeamName(teamName);
                const matchedAbbreviation = Object.keys(
                  teamNameToAbbreviationMap
                ).find(
                  (abbr) =>
                    normalizeTeamName(teamsInfo[abbr].name) ===
                    normalizedTeamName
                );

                if (matchedAbbreviation) {
                  teamAbbreviation =
                    teamNameToAbbreviationMap[
                      teamsInfo[matchedAbbreviation].name
                    ];
                } else {
                  console.error(
                    `Unable to find abbreviation for team name "${teamName}". Skipping this entry.`
                  );
                  return null; // Exclude this entry from upsert
                }
              }

              // Handle special case for "Utah Utah HC"
              if (teamName === "Utah Utah HC" && teamAbbreviation !== "UTA") {
                teamAbbreviation = "UTA";
              }

              return {
                team_abbreviation: teamAbbreviation,
                team_name: teamsInfo[teamAbbreviation]?.name || teamName, // Use mapped name or original
                gp: safeParseNumber(stat.GP),
                toi: stat.TOI === "-" ? null : safeParseNumber(stat.TOI),
                w: safeParseNumber(stat.W),
                l: safeParseNumber(stat.L),
                otl: safeParseNumber(stat.OTL),
                points: safeParseNumber(stat.Points),
                cf: safeParseNumber(stat.CF),
                ca: safeParseNumber(stat.CA),
                cf_pct:
                  stat.CFPct !== null
                    ? parseFloat(stat.CFPct.toFixed(2))
                    : null,
                ff: safeParseNumber(stat.FF),
                fa: safeParseNumber(stat.FA),
                ff_pct:
                  stat.FFPct !== null
                    ? parseFloat(stat.FFPct.toFixed(2))
                    : null,
                sf: safeParseNumber(stat.SF),
                sa: safeParseNumber(stat.SA),
                sf_pct:
                  stat.SFPct !== null
                    ? parseFloat(stat.SFPct.toFixed(2))
                    : null,
                gf: safeParseNumber(stat.GF),
                ga: safeParseNumber(stat.GA),
                gf_pct:
                  stat.GFPct !== null
                    ? parseFloat(stat.GFPct.toFixed(2))
                    : null,
                xgf: safeParseNumber(stat.xGF),
                xga: safeParseNumber(stat.xGA),
                xgf_pct:
                  stat.xGFPct !== null
                    ? parseFloat(stat.xGFPct.toFixed(2))
                    : null,
                scf: safeParseNumber(stat.SCF),
                sca: safeParseNumber(stat.SCA),
                scf_pct:
                  stat.SCFPct !== null
                    ? parseFloat(stat.SCFPct.toFixed(2))
                    : null,
                hdcf: safeParseNumber(stat.HDCF),
                hdca: safeParseNumber(stat.HDCA),
                hdcf_pct:
                  stat.HDCFPct !== null
                    ? parseFloat(stat.HDCFPct.toFixed(2))
                    : null,
                hdsf: safeParseNumber(stat.HDSF),
                hdsa: safeParseNumber(stat.HDSA),
                hdsf_pct:
                  stat.HDSFPct !== null
                    ? parseFloat(stat.HDSFPct.toFixed(2))
                    : null,
                hdgf: safeParseNumber(stat.HDGF),
                hdga: safeParseNumber(stat.HDGA),
                hdgf_pct:
                  stat.HDGFPct !== null
                    ? parseFloat(stat.HDGFPct.toFixed(2))
                    : null,
                sh_pct:
                  stat.SHPct !== null
                    ? parseFloat(stat.SHPct.toFixed(2))
                    : null,
                sv_pct:
                  stat.SVPct !== null
                    ? parseFloat(stat.SVPct.toFixed(2))
                    : null,
                pdo: stat.PDO !== null ? parseFloat(stat.PDO) : null,
                situation: stat.situation || "all",
                season: from_season, // Added season field
                // For season-based tables, date is undefined or null
              };
            })
            .filter(
              (entry): entry is NonNullable<typeof entry> => entry !== null
            ); // Remove null entries

          // Upsert data into Supabase
          const { error } = await supabase
            .from(targetTable)
            .upsert(upsertData, {
              onConflict: ["team_abbreviation", "season"], // Ensure 'season' is a unique constraint in your table
            });

          if (error) {
            console.error(
              `Supabase upsert error for table ${targetTable}:`,
              error.message
            );
            throw new Error(`Supabase upsert error: ${error.message}`);
          }

          console.log(
            `Successfully upserted ${upsertData.length} records into ${targetTable}.`
          );
          // Delay to Respect Rate Limits
          await delay(20000); // 20 seconds
        } catch (error: any) {
          console.error(`Error executing Python script`, error.message);
          throw new Error(`Python script error: ${error.message}`);
        }
      }

      // Respond after processing the specific date
      return res.status(200).json({
        message: `Successfully upserted team statistics.`,
        success: true,
      });
    }
  } catch (error: any) {
    console.error("Error in nst-team-stats API:", error.message);
    return res.status(500).json({
      message: "Failed to upsert team statistics: " + error.message,
      success: false,
    });
  }
});
