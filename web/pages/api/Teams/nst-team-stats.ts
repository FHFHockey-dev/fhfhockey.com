// pages/api/Teams/nst-team-stats.ts

import type { NextApiRequest, NextApiResponse } from "next";
import { spawn } from "child_process";
import path from "path";
import { RateLimiterMemory } from "rate-limiter-flexible";
import { teamsInfo } from "lib/teamsInfo";
import { createClient } from "@supabase/supabase-js";
import { getCurrentSeason } from "lib/NHL/server"; // Corrected import path

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!; // Use service role for server-side operations

export const supabase = createClient(supabaseUrl, supabaseKey);

// Define the structure for date-based counts team statistics
interface CountsTeamStatDate {
  team_abbreviation: string; // Team abbreviation
  team_name: string; // Full team name
  gp: number | null;
  toi: string | null;
  w: number | null;
  l: number | null;
  otl: number | null;
  points: number | null;
  cf: number | null;
  ca: number | null;
  cf_pct: number | null;
  ff: number | null;
  fa: number | null;
  ff_pct: number | null;
  sf: number | null;
  sa: number | null;
  sf_pct: number | null;
  gf: number | null;
  ga: number | null;
  gf_pct: number | null;
  xgf: number | null;
  xga: number | null;
  xgf_pct: number | null;
  scf: number | null;
  sca: number | null;
  scf_pct: number | null;
  hdcf: number | null;
  hdca: number | null;
  hdcf_pct: number | null;
  hdsf: number | null;
  hdsa: number | null;
  hdsf_pct: number | null;
  hdgf: number | null;
  hdga: number | null;
  hdgf_pct: number | null;
  sh_pct: number | null;
  sv_pct: number | null;
  pdo: number | null;
  date: string; // Date field for tracking
  situation: string; // Situation field
}

// Define the structure for season-based counts team statistics
interface CountsTeamStatSeason {
  team_abbreviation: string; // Team abbreviation
  team_name: string; // Full team name
  gp: number | null;
  toi: string | null;
  w: number | null;
  l: number | null;
  otl: number | null;
  points: number | null;
  cf: number | null;
  ca: number | null;
  cf_pct: number | null;
  ff: number | null;
  fa: number | null;
  ff_pct: number | null;
  sf: number | null;
  sa: number | null;
  sf_pct: number | null;
  gf: number | null;
  ga: number | null;
  gf_pct: number | null;
  xgf: number | null;
  xga: number | null;
  xgf_pct: number | null;
  scf: number | null;
  sca: number | null;
  scf_pct: number | null;
  hdcf: number | null;
  hdca: number | null;
  hdcf_pct: number | null;
  hdsf: number | null;
  hdsa: number | null;
  hdsf_pct: number | null;
  hdgf: number | null;
  hdga: number | null;
  hdgf_pct: number | null;
  sh_pct: number | null;
  sv_pct: number | null;
  pdo: number | null;
  season: string; // Season field
  situation: string; // Situation field
}

// Define TeamStat as a union type
type TeamStat = CountsTeamStatDate | CountsTeamStatSeason;

// Define the overall response structure
interface ResponseData {
  success: boolean;
  message: string;
  processedDates: string[]; // List of dates processed
  upsertedRecords: {
    [key: string]: number; // Number of records upserted per category
  };
  errors?: {
    date: string;
    category: string;
    message: string;
  }[];
}

// Define the situations and rates with hardcoded URLs
const responseKeys: {
  [key: string]: { situation: string; rate: string; url: string };
} = {
  // Existing Date-Based Tables
  countsAll: {
    situation: "all",
    rate: "n",
    url: `https://www.naturalstattrick.com/teamtable.php?fromseason=20242025&thruseason=20242025&stype=2&sit=all&score=all&rate=n&team=all&loc=B&gpf=410&fd=`,
  },
  counts5v5: {
    situation: "5v5",
    rate: "n",
    url: `https://www.naturalstattrick.com/teamtable.php?fromseason=20242025&thruseason=20242025&stype=2&sit=5v5&score=all&rate=n&team=all&loc=B&gpf=410&fd=`,
  },
  countsPP: {
    situation: "pp",
    rate: "n",
    url: `https://www.naturalstattrick.com/teamtable.php?fromseason=20242025&thruseason=20242025&stype=2&sit=pp&score=all&rate=n&team=all&loc=B&gpf=410&fd=`,
  },
  countsPK: {
    situation: "pk",
    rate: "n",
    url: `https://www.naturalstattrick.com/teamtable.php?fromseason=20242025&thruseason=20242025&stype=2&sit=pk&score=all&rate=n&team=all&loc=B&gpf=410&fd=`,
  },

  // New Season-Based Tables
  seasonStats: {
    situation: "all",
    rate: "n",
    url: `https://www.naturalstattrick.com/teamtable.php?fromseason={seasonId}&thruseason={seasonId}&stype=2&sit=all&score=all&rate=n&team=all&loc=B&gpf=410&fd=&td=`,
  },
  lastSeasonStats: {
    situation: "all",
    rate: "n",
    url: `https://www.naturalstattrick.com/teamtable.php?fromseason={lastSeasonId}&thruseason={lastSeasonId}&stype=2&sit=all&score=all&rate=n&team=all&loc=B&gpf=410&fd=&td=`,
  },
};

// Define the category prefixes for each response key
const categoryPrefixes: { [key: string]: string } = {
  // Existing Date-Based Tables
  countsAll: "nst_team_all",
  counts5v5: "nst_team_5v5",
  countsPP: "nst_team_pp",
  countsPK: "nst_team_pk",

  // New Season-Based Tables
  seasonStats: "nst_team_stats",
  lastSeasonStats: "nst_team_stats_ly",
};

// Helper function to normalize team names (remove punctuation and accents)
function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove accents
    .replace(/[.,']/g, "") // Remove punctuation
    .trim()
    .toLowerCase();
}

// Create a reverse mapping from normalized team names to their abbreviations
const normalizedTeamInfo: { [normalizedName: string]: string } = {};

for (const [abbr, info] of Object.entries(teamsInfo)) {
  const normalized = normalizeName(info.name);
  normalizedTeamInfo[normalized] = abbr;
}

// Define the rate limiters
const rateLimiter = new RateLimiterMemory({
  points: 30, // Allow up to 30 requests per minute
  duration: 60, // Per 60 seconds
});

const rateLimiter5Min = new RateLimiterMemory({
  points: 60, // Allow up to 60 requests per 5 minutes
  duration: 300, // 5 minutes (300 seconds)
});

const rateLimiter15Min = new RateLimiterMemory({
  points: 80, // Allow up to 80 requests per 15 minutes
  duration: 900, // 15 minutes (900 seconds)
});

const rateLimiterHour = new RateLimiterMemory({
  points: 150, // Allow up to 150 requests per hour
  duration: 3600, // 1 hour (3600 seconds)
});

// Define the structure for rejection responses
interface RejectedResponse {
  msBeforeNext: number;
}

// Function to handle rate-limited delays and requests
async function rateLimitedRequestWithDelays(fn: () => Promise<any>) {
  try {
    // Apply rate limits for different time windows
    await rateLimiter.consume(1); // Consume 1 point for the per-minute limiter
    await rateLimiter5Min.consume(1); // Consume 1 point for the 5-minute limiter
    await rateLimiter15Min.consume(1); // Consume 1 point for the 15-minute limiter
    await rateLimiterHour.consume(1); // Consume 1 point for the hourly limiter

    return await fn();
  } catch (rejRes) {
    const error = rejRes as RejectedResponse;
    if (error.msBeforeNext) {
      console.warn(
        `Rate limit exceeded, waiting for ${error.msBeforeNext}ms before retrying...`
      );
      await new Promise((resolve) => setTimeout(resolve, error.msBeforeNext));
      return await fn();
    } else {
      throw new Error("Rate limiting failed");
    }
  }
}

// Helper function to introduce a delay between each batch of scrapes
async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Initialize responseDataMap with precise types per key
const responseDataMap = {
  countsAll: { situation: "all", rate: "n", data: [] as CountsTeamStatDate[] },
  counts5v5: { situation: "5v5", rate: "n", data: [] as CountsTeamStatDate[] },
  countsPP: { situation: "pp", rate: "n", data: [] as CountsTeamStatDate[] },
  countsPK: { situation: "pk", rate: "n", data: [] as CountsTeamStatDate[] },
  seasonStats: {
    situation: "all",
    rate: "n",
    data: [] as CountsTeamStatSeason[],
  },
  lastSeasonStats: {
    situation: "all",
    rate: "n",
    data: [] as CountsTeamStatSeason[],
  },
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData | { success: false; message: string }>
) {
  try {
    const { date } = req.query;
    const fetchDate =
      typeof date === "string" ? date : new Date().toISOString().split("T")[0];

    let datesToFetch: string[] = [];
    const upsertedRecords: { [key: string]: number } = {};
    const errors: { date: string; category: string; message: string }[] = [];

    // Fetch current season details using getCurrentSeason
    const currentSeason = await getCurrentSeason();

    if (fetchDate === "all") {
      // Fetch latest date from Supabase for date-based tables
      const { data: latestDateData, error: latestDateError } = await supabase
        .from("nst_team_all")
        .select("date")
        .order("date", { ascending: false })
        .limit(1);

      if (latestDateError) {
        console.error(
          "Error fetching latest date from Supabase:",
          latestDateError.message
        );
        return res.status(500).json({
          success: false,
          message: "Error fetching latest date from Supabase.",
        });
      }

      let startDate: string;

      if (currentSeason.seasonId === undefined) {
        // Fallback in case season data is not available
        startDate = "2024-10-14";
      } else {
        if (
          latestDateData &&
          latestDateData.length > 0 &&
          latestDateData[0].date
        ) {
          // Start from the day after the latest date
          const lastDate = new Date(latestDateData[0].date);
          lastDate.setDate(lastDate.getDate() + 1);
          startDate = lastDate.toISOString().split("T")[0];
        } else {
          // Use the start date from the current season
          startDate = currentSeason.regularSeasonStartDate;
        }
      }

      const currentDate = new Date().toISOString().split("T")[0];

      // Generate all dates from startDate to currentDate
      let dateIterator = new Date(startDate);
      const endDate = new Date(currentDate);

      while (dateIterator <= endDate) {
        const dateStr = dateIterator.toISOString().split("T")[0];
        datesToFetch.push(dateStr);
        dateIterator.setDate(dateIterator.getDate() + 1);
      }

      if (datesToFetch.length === 0) {
        return res.status(200).json({
          success: true,
          message: "No new dates to fetch.",
          processedDates: [],
          upsertedRecords,
        });
      }

      // Prepare season-based URLs
      // For current season
      responseKeys.seasonStats.url = responseKeys.seasonStats.url.replace(
        "{seasonId}",
        `${currentSeason.seasonId}`
      );

      // For last season
      responseKeys.lastSeasonStats.url =
        responseKeys.lastSeasonStats.url.replace(
          "{lastSeasonId}",
          `${currentSeason.lastSeasonId}`
        );

      console.log("Current Season ID: ", currentSeason.seasonId);
      console.log("Previous Season ID: ", currentSeason.lastSeasonId);
    } else {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(fetchDate)) {
        return res.status(400).json({
          success: false,
          message: "Invalid date format. Use YYYY-MM-DD or 'all'.",
        });
      }
      datesToFetch.push(fetchDate);
    }

    if (fetchDate === "all") {
      console.log(
        `\n=== Scraping Current Season: ${currentSeason.seasonId} ===`
      );
      try {
        await rateLimitedRequestWithDelays(async () => {
          const pythonProcess = spawn("python", [
            path.join(process.cwd(), "scripts", "fetch_team_table.py"),
            "--from_season",
            `${currentSeason.seasonId}`,
            "--thru_season",
            `${currentSeason.seasonId}`,
            "--stype",
            "2",
            "--sit",
            "all",
            "--score",
            "all",
            "--rate",
            "n",
            "--team",
            "all",
            "--loc",
            "B",
            "--gpf",
            "410",
            "--fd",
            "",
            "--td",
            "",
          ]);

          let stdout = "";
          let stderr = "";

          pythonProcess.stdout.on("data", (data) => {
            stdout += data.toString();
          });

          pythonProcess.stderr.on("data", (data) => {
            stderr += data.toString();
          });

          const exitCode = await new Promise<number>((resolve, reject) => {
            pythonProcess.on("close", resolve);
            pythonProcess.on("error", reject);
          });

          if (exitCode !== 0) {
            console.error(
              `Python script exited with code ${exitCode} for seasonStats on season ${currentSeason.seasonId}`
            );
            console.error(`Stderr: ${stderr}`);
            errors.push({
              date: `${currentSeason.seasonId}`,
              category: "seasonStats",
              message: `Python script exited with code ${exitCode}`,
            });
            return;
          }

          let jsonOutput;
          try {
            jsonOutput = JSON.parse(stdout);
          } catch (parseError) {
            let message = "Unknown error";
            if (parseError instanceof Error) {
              message = parseError.message;
            }
            console.error(
              `Error parsing JSON output for seasonStats on season ${currentSeason.seasonId}:`,
              parseError
            );
            errors.push({
              date: `${currentSeason.seasonId}`,
              category: "seasonStats",
              message: `Error parsing JSON output: ${message}`,
            });
            return;
          }

          if (jsonOutput.debug?.Error) {
            console.error(
              `Error in Python script for seasonStats on season ${currentSeason.seasonId}: ${jsonOutput.debug.Error}`
            );
            console.error(`Debug Info: ${JSON.stringify(jsonOutput.debug)}`);
            errors.push({
              date: `${currentSeason.seasonId}`,
              category: "seasonStats",
              message: jsonOutput.debug.Error,
            });
            return;
          }

          // Map JSON data to CountsTeamStatSeason
          const parsedData: CountsTeamStatSeason[] = jsonOutput.data.map(
            (item: any) => ({
              team_abbreviation:
                normalizedTeamInfo[normalizeName(item["Team"])] || "Unknown",
              team_name: item["Team"] || "Unknown",
              gp: item["GP"] ? parseInt(item["GP"]) : null,
              toi: item["TOI"] || null,
              w: item["W"] ? parseInt(item["W"]) : null,
              l: item["L"] ? parseInt(item["L"]) : null,
              otl: item["OTL"] ? parseInt(item["OTL"]) : null,
              points: item["Points"] ? parseInt(item["Points"]) : null,
              cf: item["CF"] ? parseInt(item["CF"]) : null,
              ca: item["CA"] ? parseInt(item["CA"]) : null,
              cf_pct: item["CFPct"] ? parseFloat(item["CFPct"]) : null,
              ff: item["FF"] ? parseInt(item["FF"]) : null,
              fa: item["FA"] ? parseInt(item["FA"]) : null,
              ff_pct: item["FFPct"] ? parseFloat(item["FFPct"]) : null,
              sf: item["SF"] ? parseInt(item["SF"]) : null,
              sa: item["SA"] ? parseInt(item["SA"]) : null,
              sf_pct: item["SFPct"] ? parseFloat(item["SFPct"]) : null,
              gf: item["GF"] ? parseInt(item["GF"]) : null,
              ga: item["GA"] ? parseInt(item["GA"]) : null,
              gf_pct: item["GFPct"] ? parseFloat(item["GFPct"]) : null,
              xgf: item["xGF"] ? parseInt(item["xGF"]) : null,
              xga: item["xGA"] ? parseInt(item["xGA"]) : null,
              xgf_pct: item["xGFPct"] ? parseFloat(item["xGFPct"]) : null,
              scf: item["SCF"] ? parseInt(item["SCF"]) : null,
              sca: item["SCA"] ? parseInt(item["SCA"]) : null,
              scf_pct: item["SCFPct"] ? parseFloat(item["SCFPct"]) : null,
              hdcf: item["HDCF"] ? parseInt(item["HDCF"]) : null,
              hdca: item["HDCA"] ? parseInt(item["HDCA"]) : null,
              hdcf_pct: item["HDCFPct"] ? parseFloat(item["HDCFPct"]) : null,
              hdsf: item["HDSF"] ? parseInt(item["HDSF"]) : null,
              hdsa: item["HDSA"] ? parseInt(item["HDSA"]) : null,
              hdsf_pct: item["HDSFPct"] ? parseFloat(item["HDSFPct"]) : null,
              hdgf: item["HDGF"] ? parseInt(item["HDGF"]) : null,
              hdga: item["HDGA"] ? parseInt(item["HDGA"]) : null,
              hdgf_pct: item["HDGFPct"] ? parseFloat(item["HDGFPct"]) : null,
              sh_pct: item["SCSHPct"] ? parseFloat(item["SCSHPct"]) : null,
              sv_pct: item["SCSVPct"] ? parseFloat(item["SCSVPct"]) : null,
              pdo: item["PDO"] ? parseFloat(item["PDO"]) : null,
              season: currentSeason.seasonId.toString(),
              situation: responseKeys.seasonStats.situation,
            })
          );

          if (parsedData.length === 0) {
            console.warn(
              `No data found for seasonStats on season ${currentSeason.seasonId}.`
            );
            return;
          }

          responseDataMap.seasonStats.data.push(...parsedData);

          // Update upsertedRecords count
          upsertedRecords["seasonStats"] =
            (upsertedRecords["seasonStats"] || 0) + parsedData.length;

          console.log(
            `Parsed ${parsedData.length} records for seasonStats on season ${currentSeason.seasonId}.`
          );
        });
      } catch (error: any) {
        console.error("API Error during seasonStats scraping:", error.message);
        errors.push({
          date: `${currentSeason.seasonId}`,
          category: "seasonStats",
          message: error.message,
        });
      }

      try {
        const { data: existingData, error: existingError } = await supabase
          .from("nst_team_stats_ly")
          .select("season")
          .eq("season", currentSeason.lastSeasonId)
          .limit(1);

        if (existingError) {
          console.error(
            "Error checking existing data in nst_team_stats_ly:",
            existingError.message
          );
          errors.push({
            date: `${currentSeason.lastSeasonId}`,
            category: "lastSeasonStats",
            message: "Error checking existing data in nst_team_stats_ly.",
          });
        }

        if (!existingData || existingData.length === 0) {
          console.log(
            `\n=== Scraping Last Season: ${currentSeason.lastSeasonId} ===`
          );
          try {
            await rateLimitedRequestWithDelays(async () => {
              const pythonProcess = spawn("python", [
                path.join(process.cwd(), "scripts", "fetch_team_table.py"),
                "--from_season",
                `${currentSeason.lastSeasonId}`,
                "--thru_season",
                `${currentSeason.lastSeasonId}`,
                "--stype",
                "2",
                "--sit",
                "all",
                "--score",
                "all",
                "--rate",
                "n",
                "--team",
                "all",
                "--loc",
                "B",
                "--gpf",
                "410",
                "--fd",
                "",
                "--td",
                "",
              ]);

              let stdout = "";
              let stderr = "";

              pythonProcess.stdout.on("data", (data) => {
                stdout += data.toString();
              });

              pythonProcess.stderr.on("data", (data) => {
                stderr += data.toString();
              });

              const exitCode = await new Promise<number>((resolve, reject) => {
                pythonProcess.on("close", resolve);
                pythonProcess.on("error", reject);
              });

              if (exitCode !== 0) {
                console.error(
                  `Python script exited with code ${exitCode} for lastSeasonStats on season ${currentSeason.lastSeasonId}`
                );
                console.error(`Stderr: ${stderr}`);
                errors.push({
                  date: `${currentSeason.lastSeasonId}`,
                  category: "lastSeasonStats",
                  message: `Python script exited with code ${exitCode}`,
                });
                return;
              }

              let jsonOutput;
              try {
                jsonOutput = JSON.parse(stdout);
              } catch (parseError) {
                let message = "Unknown error";
                if (parseError instanceof Error) {
                  message = parseError.message;
                }
                console.error(
                  `Error parsing JSON output for lastSeasonStats on season ${currentSeason.lastSeasonId}:`,
                  parseError
                );
                errors.push({
                  date: `${currentSeason.lastSeasonId}`,
                  category: "lastSeasonStats",
                  message: `Error parsing JSON output: ${message}`,
                });
                return;
              }

              if (jsonOutput.debug?.Error) {
                console.error(
                  `Error in Python script for lastSeasonStats on season ${currentSeason.lastSeasonId}: ${jsonOutput.debug.Error}`
                );
                console.error(
                  `Debug Info: ${JSON.stringify(jsonOutput.debug)}`
                );
                errors.push({
                  date: `${currentSeason.lastSeasonId}`,
                  category: "lastSeasonStats",
                  message: jsonOutput.debug.Error,
                });
                return;
              }

              // Map JSON data to CountsTeamStatSeason
              const parsedData: CountsTeamStatSeason[] = jsonOutput.data.map(
                (item: any) => ({
                  team_abbreviation:
                    normalizedTeamInfo[normalizeName(item["Team"])] ||
                    "Unknown",
                  team_name: item["Team"] || "Unknown",
                  gp: item["GP"] ? parseInt(item["GP"]) : null,
                  toi: item["TOI"] || null,
                  w: item["W"] ? parseInt(item["W"]) : null,
                  l: item["L"] ? parseInt(item["L"]) : null,
                  otl: item["OTL"] ? parseInt(item["OTL"]) : null,
                  points: item["Points"] ? parseInt(item["Points"]) : null,
                  cf: item["CF"] ? parseInt(item["CF"]) : null,
                  ca: item["CA"] ? parseInt(item["CA"]) : null,
                  cf_pct: item["CFPct"] ? parseFloat(item["CFPct"]) : null,
                  ff: item["FF"] ? parseInt(item["FF"]) : null,
                  fa: item["FA"] ? parseInt(item["FA"]) : null,
                  ff_pct: item["FFPct"] ? parseFloat(item["FFPct"]) : null,
                  sf: item["SF"] ? parseInt(item["SF"]) : null,
                  sa: item["SA"] ? parseInt(item["SA"]) : null,
                  sf_pct: item["SFPct"] ? parseFloat(item["SFPct"]) : null,
                  gf: item["GF"] ? parseInt(item["GF"]) : null,
                  ga: item["GA"] ? parseInt(item["GA"]) : null,
                  gf_pct: item["GFPct"] ? parseFloat(item["GFPct"]) : null,
                  xgf: item["xGF"] ? parseInt(item["xGF"]) : null,
                  xga: item["xGA"] ? parseInt(item["xGA"]) : null,
                  xgf_pct: item["xGFPct"] ? parseFloat(item["xGFPct"]) : null,
                  scf: item["SCF"] ? parseInt(item["SCF"]) : null,
                  sca: item["SCA"] ? parseInt(item["SCA"]) : null,
                  scf_pct: item["SCFPct"] ? parseFloat(item["SCFPct"]) : null,
                  hdcf: item["HDCF"] ? parseInt(item["HDCF"]) : null,
                  hdca: item["HDCA"] ? parseInt(item["HDCA"]) : null,
                  hdcf_pct: item["HDCFPct"]
                    ? parseFloat(item["HDCFPct"])
                    : null,
                  hdsf: item["HDSF"] ? parseInt(item["HDSF"]) : null,
                  hdsa: item["HDSA"] ? parseInt(item["HDSA"]) : null,
                  hdsf_pct: item["HDSFPct"]
                    ? parseFloat(item["HDSFPct"])
                    : null,
                  hdgf: item["HDGF"] ? parseInt(item["HDGF"]) : null,
                  hdga: item["HDGA"] ? parseInt(item["HDGA"]) : null,
                  hdgf_pct: item["HDGFPct"]
                    ? parseFloat(item["HDGFPct"])
                    : null,
                  sh_pct: item["SCSHPct"] ? parseFloat(item["SCSHPct"]) : null,
                  sv_pct: item["SCSVPct"] ? parseFloat(item["SCSVPct"]) : null,
                  pdo: item["PDO"] ? parseFloat(item["PDO"]) : null,
                  season: currentSeason.lastSeasonId.toString(),
                  situation: responseKeys.lastSeasonStats.situation,
                })
              );

              if (parsedData.length === 0) {
                console.warn(
                  `No data found for lastSeasonStats on season ${currentSeason.lastSeasonId}.`
                );
                return;
              }

              responseDataMap.lastSeasonStats.data.push(...parsedData);

              // Update upsertedRecords count
              upsertedRecords["lastSeasonStats"] =
                (upsertedRecords["lastSeasonStats"] || 0) + parsedData.length;

              console.log(
                `Parsed ${parsedData.length} records for lastSeasonStats on season ${currentSeason.lastSeasonId}.`
              );
            });
          } catch (error: any) {
            console.error(
              "API Error during lastSeasonStats scraping:",
              error.message
            );
            errors.push({
              date: `${currentSeason.lastSeasonId}`,
              category: "lastSeasonStats",
              message: error.message,
            });
          }
        }

        // Perform upserts for date-based tables
        for (const [key, { rate }] of Object.entries(responseKeys)) {
          // Skip season-based tables
          if (key === "seasonStats" || key === "lastSeasonStats") continue;

          const categoryPrefix = categoryPrefixes[key];
          if (!categoryPrefix) continue;

          const categoryData = responseDataMap[
            key as keyof typeof responseDataMap
          ].data as CountsTeamStatDate[];

          if (categoryData.length === 0) {
            console.warn(
              `No data to upsert for category: ${categoryPrefix} on date(s): ${datesToFetch.join(
                ", "
              )}`
            );
            continue;
          }

          await rateLimitedRequestWithDelays(async () => {
            const { data: upsertedData, error } = await supabase
              .from(categoryPrefix)
              .upsert(categoryData, { onConflict: "team_abbreviation, date" })
              .select();

            if (error) {
              console.error(
                `Supabase Upsert Error for ${categoryPrefix}:`,
                error.message
              );
              datesToFetch.forEach((date) => {
                errors.push({
                  date,
                  category: key,
                  message: error.message,
                });
              });
            } else {
              console.log(
                `Supabase Upsert Successful for ${categoryPrefix}:`,
                upsertedData.length,
                "records upserted."
              );
            }
          });

          // Clear data for the category to prevent duplicate upserts
          (
            responseDataMap[key as keyof typeof responseDataMap] as {
              data: any[];
            }
          ).data = [];
        }

        // Perform upserts for season-based tables
        for (const key of ["seasonStats", "lastSeasonStats"] as const) {
          const categoryPrefix = categoryPrefixes[key];
          if (!categoryPrefix) continue;

          const categoryData = responseDataMap[key]
            .data as CountsTeamStatSeason[];

          if (categoryData.length === 0) {
            console.warn(`No data to upsert for category: ${categoryPrefix}.`);
            continue;
          }

          await rateLimitedRequestWithDelays(async () => {
            const { data: upsertedData, error } = await supabase
              .from(categoryPrefix)
              .upsert(categoryData, { onConflict: "team_abbreviation, season" })
              .select();

            if (error) {
              console.error(
                `Supabase Upsert Error for ${categoryPrefix}:`,
                error.message
              );
              categoryData.forEach((item) => {
                const seasonValue = item.season || "unknown";
                errors.push({
                  date: seasonValue,
                  category: key,
                  message: error.message,
                });
              });
            } else {
              console.log(
                `Supabase Upsert Successful for ${categoryPrefix}:`,
                upsertedData.length,
                "records upserted."
              );
            }
          });

          // Clear data for the category to prevent duplicate upserts
          responseDataMap[key].data = [];
        }

        // Respond to the API request with the processed information
        return res.status(200).json({
          success: true,
          message:
            "Successfully fetched NST team stats and upserted to Supabase.",
          processedDates: datesToFetch,
          upsertedRecords,
          errors: errors.length > 0 ? errors : undefined,
        });
      } catch (error: any) {
        console.error("API Error:", error.message);
        return res.status(500).json({
          success: false,
          message: "An error occurred while fetching NST team stats.",
        });
      }
    }
  } catch (error: any) {
    console.error("API Error:", error.message);
    return res.status(500).json({
      success: false,
      message: "An error occurred while fetching NST team stats.",
    });
  }
}
