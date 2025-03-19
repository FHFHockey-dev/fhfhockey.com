// pages/api/Teams/nst-team-stats.ts

import { NextApiResponse } from "next";
import adminOnly from "utils/adminOnlyMiddleware";
import { getCurrentSeason } from "lib/NHL/server";
import { teamsInfo, teamNameToAbbreviationMap } from "lib/teamsInfo";
import {
  addDays,
  format,
  parseISO,
  isAfter,
  differenceInCalendarDays
} from "date-fns";

// ---
// For date‐based tables we set these keys as before.
const dateBasedResponseKeys: {
  [key: string]: { situation: string; rate: string };
} = {
  countsAll: { situation: "all", rate: "n" },
  counts5v5: { situation: "5v5", rate: "n" },
  countsPP: { situation: "pp", rate: "n" },
  countsPK: { situation: "pk", rate: "n" }
};

// For season‐based tables, update the parameters to match your expected URL (sit=pk).
const seasonBasedResponseKeys: {
  [key: string]: { situation: string; rate: string };
} = {
  seasonStats: { situation: "all", rate: "n" },
  lastSeasonStats: { situation: "all", rate: "n" }
};

interface PythonScriptOutput {
  debug: { [key: string]: any };
  data: TeamStat[];
}

interface TeamStat {
  date: string | null;
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
  season?: string;
}

// Helper to normalize team names
const normalizeTeamName = (name: string): string =>
  name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "")
    .trim()
    .toLowerCase();

// Delay helper
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Safely parses a string to a number.
 */
export const safeParseNumber = (value: string): number | null => {
  if (value.trim() === "-") return null;
  const parsed = Number(value);
  return isNaN(parsed) ? null : parsed;
};

/**
 * Converts a time string in MM:SS format to total seconds.
 */
export const convertToSeconds = (toi: string): number | null => {
  if (!toi || toi === "-") return null;
  const parts = toi.split(":");
  if (parts.length !== 2) return null;
  const minutes = parseInt(parts[0], 10);
  const seconds = parseInt(parts[1], 10);
  if (isNaN(minutes) || isNaN(seconds)) return null;
  return minutes * 60 + seconds;
};

export default adminOnly(async (req: any, res: NextApiResponse) => {
  const scriptStartTime = Date.now();
  const { supabase } = req;

  try {
    // Extract 'date' query parameter.
    const { date } = req.query;
    if (!date) {
      return res.status(400).json({
        message: "Missing 'date' query parameter.",
        success: false
      });
    }

    // Get current season details.
    const currentSeason = await getCurrentSeason();
    const { seasonId, lastSeasonId, regularSeasonStartDate } = currentSeason;

    // --- Date-based processing ---
    if (date === "all") {
      console.log("Performing preliminary checks for date-based tables.");

      const dateBasedTables = [
        "nst_team_all",
        "nst_team_5v5",
        "nst_team_pp",
        "nst_team_pk"
      ];

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

      const latestDatesPromises = dateBasedTables.map((table) =>
        getLatestDate(table)
      );
      const latestDates = await Promise.all(latestDatesPromises);
      const validDates = latestDates.filter((d) => d !== null) as string[];

      let fetchStartDate: Date;
      if (validDates.length > 0) {
        const maxDateStr = validDates.reduce((a, b) => (a > b ? a : b));
        const maxDate = parseISO(maxDateStr);
        fetchStartDate = addDays(maxDate, 1);
      } else {
        fetchStartDate = parseISO(regularSeasonStartDate);
      }

      const today = new Date();
      if (isAfter(fetchStartDate, today)) {
        console.log("All data is up to date. No new data to fetch.");
        const scriptEndTime = Date.now();
        const totalTimeSeconds = (scriptEndTime - scriptStartTime) / 1000;
        console.log(`Script execution time: ${totalTimeSeconds} seconds`);
        return res.status(200).json({
          message: `All date-based team statistics are up to date. Execution time: ${totalTimeSeconds} seconds.`,
          success: true
        });
      }

      console.log(
        `Fetching date-based team statistics starting from ${format(
          fetchStartDate,
          "yyyy-MM-dd"
        )}.`
      );
      const startDate = fetchStartDate;
      const endDate = new Date();
      const daysToProcess = differenceInCalendarDays(endDate, startDate) + 1;
      const useDelays = daysToProcess > 2;
      console.log(
        `Days to process: ${daysToProcess}. Using delays: ${useDelays}`
      );

      let currentDate = startDate;
      while (!isAfter(currentDate, endDate)) {
        const formattedDate = format(currentDate, "yyyy-MM-dd");
        console.log(`Processing date: ${formattedDate}`);

        // For each date-based key, build the URL and fetch data.
        for (const key in dateBasedResponseKeys) {
          const { situation, rate } = dateBasedResponseKeys[key];
          const baseUrl =
            "https://functions-fhfhockey.vercel.app/fetch_team_table";
          const queryParams = new URLSearchParams({
            sit: situation,
            rate: rate,
            fd: formattedDate,
            td: formattedDate,
            from_season: seasonId.toString(),
            thru_season: seasonId.toString(),
            stype: "2",
            score: "all",
            team: "all",
            loc: "B",
            gpf: "410"
          });
          const fullUrl = `${baseUrl}?${queryParams.toString()}`;
          console.log(`Fetching URL: ${fullUrl}`);

          try {
            const response = await fetch(fullUrl);
            if (!response.ok) {
              throw new Error(`HTTP error: ${response.status}`);
            }
            const responseText = await response.text();
            let scriptOutput: PythonScriptOutput = JSON.parse(responseText);
            if (typeof scriptOutput === "string") {
              scriptOutput = JSON.parse(scriptOutput);
            }
            if (!scriptOutput.data) {
              throw new Error("No data returned from endpoint");
            }
            const teamStats = scriptOutput.data;
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
            const upsertData = teamStats
              .map((stat) => {
                const teamName = stat.Team;
                let teamAbbreviation = teamNameToAbbreviationMap[teamName];
                if (!teamAbbreviation) {
                  console.warn(
                    `Unknown team name "${teamName}". Attempting to find a match...`
                  );
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
                    return null;
                  }
                }
                if (teamName === "Utah Utah HC" && teamAbbreviation !== "UTA") {
                  teamAbbreviation = "UTA";
                }
                const totalTOI = convertToSeconds(stat.TOI);
                return {
                  team_abbreviation: teamAbbreviation,
                  team_name: teamsInfo[teamAbbreviation]?.name || teamName,
                  gp: safeParseNumber(stat.GP),
                  toi: totalTOI,
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
                  situation: stat.situation || "all"
                };
              })
              .filter(
                (entry): entry is NonNullable<typeof entry> => entry !== null
              );
            if (useDelays) {
              await delay(21000);
              console.log("21s delay");
            }
            const { error } = await supabase
              .from(targetTable)
              .upsert(upsertData, {
                onConflict: ["team_abbreviation", "date"]
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
            if (useDelays) {
              console.log("Waiting 30 seconds before next fetch...");
              await delay(30000);
            }
          } catch (error: any) {
            console.error(
              `Error fetching data for key ${key} on date ${formattedDate}:`,
              error.message
            );
            throw new Error(`Fetch error: ${error.message}`);
          }
        }
        currentDate = addDays(currentDate, 1);
      }

      // --- Season-based processing ---
      console.log("Processing season-based response keys.");
      for (const key in seasonBasedResponseKeys) {
        const { situation, rate } = seasonBasedResponseKeys[key];
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
        // For season-based queries, use seasonId or lastSeasonId.
        const from_season =
          key === "seasonStats" ? seasonId.toString() : lastSeasonId.toString();
        const thru_season =
          key === "seasonStats" ? seasonId.toString() : lastSeasonId.toString();
        // Build URL for season-based fetch (omit fd and td).
        const baseUrl =
          "https://functions-fhfhockey.vercel.app/fetch_team_table";
        const queryParams = new URLSearchParams({
          sit: situation,
          rate: rate,
          from_season: from_season,
          thru_season: thru_season,
          stype: "2",
          score: "all",
          team: "all",
          loc: "B",
          gpf: "410"
        });
        const fullUrl = `${baseUrl}?${queryParams.toString()}`;
        console.log(`Fetching season URL for key ${key}: ${fullUrl}`);
        try {
          const response = await fetch(fullUrl);
          if (!response.ok) {
            throw new Error(`HTTP error: ${response.status}`);
          }
          const responseText = await response.text();
          let scriptOutput: PythonScriptOutput = JSON.parse(responseText);
          if (typeof scriptOutput === "string") {
            scriptOutput = JSON.parse(scriptOutput);
          }
          if (!scriptOutput.data) {
            throw new Error("No data returned from endpoint");
          }
          const teamStats = scriptOutput.data;
          const upsertData = teamStats
            .map((stat) => {
              const teamName = stat.Team;
              let teamAbbreviation = teamNameToAbbreviationMap[teamName];
              if (!teamAbbreviation) {
                console.warn(
                  `Unknown team name "${teamName}". Attempting to find a match...`
                );
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
                  return null;
                }
              }
              if (teamName === "Utah Utah HC" && teamAbbreviation !== "UTA") {
                teamAbbreviation = "UTA";
              }
              const totalTOI = convertToSeconds(stat.TOI);
              return {
                team_abbreviation: teamAbbreviation,
                team_name: teamsInfo[teamAbbreviation]?.name || teamName,
                gp: safeParseNumber(stat.GP),
                toi: totalTOI,
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
                season: from_season
              };
            })
            .filter(
              (entry): entry is NonNullable<typeof entry> => entry !== null
            );
          const { error } = await supabase
            .from(targetTable)
            .upsert(upsertData, {
              onConflict: ["team_abbreviation", "season"]
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
          // Optionally delay if needed
          if (useDelays) {
            await delay(20000);
          }
        } catch (error: any) {
          console.error(
            `Error fetching season-based data for key ${key}:`,
            error.message
          );
          throw new Error(`Season fetch error: ${error.message}`);
        }
      }
      const scriptEndTime = Date.now();
      const totalTimeSeconds = (scriptEndTime - scriptStartTime) / 1000;
      console.log(`Script execution time: ${totalTimeSeconds} seconds`);
      return res.status(200).json({
        message: `Successfully upserted team statistics in ${totalTimeSeconds} seconds.`,
        success: true
      });
    }
  } catch (error: any) {
    console.error("Error in nst-team-stats API:", error.message);
    return res.status(500).json({
      message: "Failed to upsert team statistics: " + error.message,
      success: false
    });
  }
});
