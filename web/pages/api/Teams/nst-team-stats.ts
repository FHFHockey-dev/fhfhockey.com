import { NextApiResponse } from "next";
import { addDays, format, isAfter, parseISO } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import adminOnly from "utils/adminOnlyMiddleware";
import { getCurrentSeason } from "lib/NHL/server";
import { teamsInfo, teamNameToAbbreviationMap } from "lib/teamsInfo";

const teamTableFunctionUrl =
  "https://functions-fhfhockey.vercel.app/api/fetch_team_table";
const TIME_ZONE = "America/New_York";

const MAX_DURATION_MS = 285_000;
const MIN_REQUEST_BUDGET_MS = 55_000;
const NST_INTER_REQUEST_DELAY_MS = 51_000;
const MAX_DATE_BASED_DATES_PER_RUN = 1;

export const config = {
  maxDuration: 300
};

/**
 * Query params:
 * - date: optional YYYY-MM-DD or "all"; defaults to "all".
 *
 * Cron-safe default:
 * - no params => date=all, resumable incremental mode
 */

const dateBasedResponseKeys: {
  [key: string]: { situation: string; rate: string; table: string };
} = {
  countsAll: { situation: "all", rate: "n", table: "nst_team_all" },
  counts5v5: { situation: "5v5", rate: "n", table: "nst_team_5v5" },
  countsPP: { situation: "pp", rate: "n", table: "nst_team_pp" },
  countsPK: { situation: "pk", rate: "n", table: "nst_team_pk" }
};

const seasonBasedResponseKeys: {
  [key: string]: { situation: string; rate: string; table: string };
} = {
  seasonStats: { situation: "all", rate: "n", table: "nst_team_stats" },
  lastSeasonStats: { situation: "all", rate: "n", table: "nst_team_stats_ly" }
};

interface PythonScriptOutput {
  debug?: { [key: string]: any };
  data: TeamStat[];
}

interface TeamStat {
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
}

let lastNstRequestCompletedAt = 0;

const normalizedTeamLookup = new Map<string, string>();

Object.entries(
  teamsInfo as Record<string, { name: string; shortName?: string }>
).forEach(([abbr, info]) => {
  normalizedTeamLookup.set(normalizeTeamName(info.name), abbr);
  if (info.shortName) {
    normalizedTeamLookup.set(normalizeTeamName(info.shortName), abbr);
  }
});

Object.entries(teamNameToAbbreviationMap as Record<string, string>).forEach(
  ([name, abbr]) => {
  normalizedTeamLookup.set(normalizeTeamName(name), abbr);
  }
);

function normalizeTeamName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "")
    .replace(/\s+/g, "")
    .trim()
    .toLowerCase();
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const safeParseNumber = (value: string): number | null => {
  if (value.trim() === "-") return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
};

export const convertToSeconds = (toi: string): number | null => {
  if (!toi || toi === "-") return null;
  const parts = toi.split(":");
  if (parts.length !== 2) return null;
  const minutes = parseInt(parts[0], 10);
  const seconds = parseInt(parts[1], 10);
  if (Number.isNaN(minutes) || Number.isNaN(seconds)) return null;
  return minutes * 60 + seconds;
};

function getTodayEstString(): string {
  return formatInTimeZone(new Date(), TIME_ZONE, "yyyy-MM-dd");
}

function resolveTeam(teamName: string): { abbreviation: string; name: string } | null {
  let teamAbbreviation: string | undefined = teamNameToAbbreviationMap[teamName];
  if (!teamAbbreviation) {
    teamAbbreviation = normalizedTeamLookup.get(normalizeTeamName(teamName));
  }
  if (!teamAbbreviation && teamName === "Utah Utah HC") {
    teamAbbreviation = "UTA";
  }
  if (!teamAbbreviation) {
    return null;
  }
  return {
    abbreviation: teamAbbreviation,
    name: teamsInfo[teamAbbreviation]?.name || teamName
  };
}

function mapStatToRow(stat: TeamStat, options: { date?: string; season?: string }) {
  const team = resolveTeam(stat.Team);
  if (!team) {
    console.error(`Unable to find abbreviation for team name "${stat.Team}".`);
    return null;
  }

  return {
    team_abbreviation: team.abbreviation,
    team_name: team.name,
    gp: safeParseNumber(stat.GP),
    toi: convertToSeconds(stat.TOI),
    w: safeParseNumber(stat.W),
    l: safeParseNumber(stat.L),
    otl: safeParseNumber(stat.OTL),
    points: safeParseNumber(stat.Points),
    cf: safeParseNumber(stat.CF),
    ca: safeParseNumber(stat.CA),
    cf_pct: stat.CFPct !== null ? parseFloat(stat.CFPct.toFixed(2)) : null,
    ff: safeParseNumber(stat.FF),
    fa: safeParseNumber(stat.FA),
    ff_pct: stat.FFPct !== null ? parseFloat(stat.FFPct.toFixed(2)) : null,
    sf: safeParseNumber(stat.SF),
    sa: safeParseNumber(stat.SA),
    sf_pct: stat.SFPct !== null ? parseFloat(stat.SFPct.toFixed(2)) : null,
    gf: safeParseNumber(stat.GF),
    ga: safeParseNumber(stat.GA),
    gf_pct: stat.GFPct !== null ? parseFloat(stat.GFPct.toFixed(2)) : null,
    xgf: safeParseNumber(stat.xGF),
    xga: safeParseNumber(stat.xGA),
    xgf_pct: stat.xGFPct !== null ? parseFloat(stat.xGFPct.toFixed(2)) : null,
    scf: safeParseNumber(stat.SCF),
    sca: safeParseNumber(stat.SCA),
    scf_pct: stat.SCFPct !== null ? parseFloat(stat.SCFPct.toFixed(2)) : null,
    hdcf: safeParseNumber(stat.HDCF),
    hdca: safeParseNumber(stat.HDCA),
    hdcf_pct:
      stat.HDCFPct !== null ? parseFloat(stat.HDCFPct.toFixed(2)) : null,
    hdsf: safeParseNumber(stat.HDSF),
    hdsa: safeParseNumber(stat.HDSA),
    hdsf_pct:
      stat.HDSFPct !== null ? parseFloat(stat.HDSFPct.toFixed(2)) : null,
    hdgf: safeParseNumber(stat.HDGF),
    hdga: safeParseNumber(stat.HDGA),
    hdgf_pct:
      stat.HDGFPct !== null ? parseFloat(stat.HDGFPct.toFixed(2)) : null,
    sh_pct: stat.SHPct !== null ? parseFloat(stat.SHPct.toFixed(2)) : null,
    sv_pct: stat.SVPct !== null ? parseFloat(stat.SVPct.toFixed(2)) : null,
    pdo: stat.PDO !== null ? parseFloat(stat.PDO) : null,
    situation: stat.situation || "all",
    ...(options.date ? { date: options.date } : {}),
    ...(options.season ? { season: options.season } : {})
  };
}

async function waitForNextNstRequestSlot() {
  if (lastNstRequestCompletedAt === 0) {
    return;
  }

  const elapsed = Date.now() - lastNstRequestCompletedAt;
  if (elapsed < NST_INTER_REQUEST_DELAY_MS) {
    await delay(NST_INTER_REQUEST_DELAY_MS - elapsed);
  }
}

async function fetchTeamTable(params: URLSearchParams): Promise<PythonScriptOutput> {
  await waitForNextNstRequestSlot();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  const fullUrl = `${teamTableFunctionUrl}?${params.toString()}`;

  try {
    const response = await fetch(fullUrl, { signal: controller.signal });
    const responseText = await response.text();
    lastNstRequestCompletedAt = Date.now();

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${responseText.slice(0, 300)}`);
    }

    const parsed = JSON.parse(responseText);
    return typeof parsed === "string"
      ? (JSON.parse(parsed) as PythonScriptOutput)
      : (parsed as PythonScriptOutput);
  } finally {
    clearTimeout(timeout);
  }
}

async function getLatestDate(supabase: any, table: string): Promise<string | null> {
  const { data, error } = await supabase
    .from(table)
    .select("date")
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error(`Error fetching latest date from ${table}:`, error.message);
    return null;
  }

  return data?.date || null;
}

function buildDateRange(startDate: Date, endDate: Date): string[] {
  const dates: string[] = [];
  let currentDate = startDate;

  while (!isAfter(currentDate, endDate)) {
    dates.push(format(currentDate, "yyyy-MM-dd"));
    currentDate = addDays(currentDate, 1);
  }

  return dates;
}

function hasBudgetForRequests(startedAt: number, requestCount: number) {
  const elapsed = Date.now() - startedAt;
  const remainingBudget = MAX_DURATION_MS - elapsed;
  return remainingBudget >= requestCount * MIN_REQUEST_BUDGET_MS;
}

export default adminOnly(async (req: any, res: NextApiResponse) => {
  const scriptStartTime = Date.now();
  const { supabase } = req;
  lastNstRequestCompletedAt = 0;

  try {
    const rawDate = Array.isArray(req.query.date)
      ? req.query.date[0]
      : req.query.date;
    const date =
      typeof rawDate === "string" && rawDate.trim() ? rawDate.trim() : "all";

    const currentSeason = await getCurrentSeason();
    const { seasonId, lastSeasonId, regularSeasonStartDate } = currentSeason;

    const today = parseISO(getTodayEstString());
    const fetchIssues: string[] = [];
    const processedDates: string[] = [];
    const processedTables: string[] = [];
    let remainingDates: string[] = [];
    let ranSeasonTables = false;

    let targetDates: string[] = [];
    if (date === "all") {
      const latestDates = await Promise.all(
        Object.values(dateBasedResponseKeys).map(({ table }) =>
          getLatestDate(supabase, table)
        )
      );
      const validDates = latestDates.filter((value): value is string => Boolean(value));
      const startDate =
        validDates.length > 0
          ? addDays(parseISO(validDates.reduce((a, b) => (a > b ? a : b))), 1)
          : parseISO(regularSeasonStartDate);

      if (isAfter(startDate, today)) {
        return res.status(200).json({
          message: "All date-based team statistics are up to date.",
          success: true,
          complete: true,
          processedDates: [],
          remainingDates: []
        });
      }

      targetDates = buildDateRange(startDate, today);
      remainingDates = targetDates.slice(MAX_DATE_BASED_DATES_PER_RUN);
      targetDates = targetDates.slice(0, MAX_DATE_BASED_DATES_PER_RUN);
    } else {
      const parsedDate = parseISO(date);
      if (Number.isNaN(parsedDate.getTime())) {
        return res.status(400).json({
          message: "Invalid 'date' query parameter. Use YYYY-MM-DD or 'all'.",
          success: false
        });
      }
      targetDates = [format(parsedDate, "yyyy-MM-dd")];
    }

    for (const formattedDate of targetDates) {
      if (!hasBudgetForRequests(scriptStartTime, 4)) {
        remainingDates = [formattedDate, ...remainingDates];
        break;
      }

      for (const { situation, rate, table } of Object.values(dateBasedResponseKeys)) {
        const queryParams = new URLSearchParams({
          sit: situation,
          rate,
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

        try {
          const scriptOutput = await fetchTeamTable(queryParams);
          if (!scriptOutput.data || scriptOutput.data.length === 0) {
            continue;
          }

          const upsertData = scriptOutput.data
            .map((stat) => mapStatToRow(stat, { date: formattedDate }))
            .filter(
              (entry): entry is NonNullable<typeof entry> => entry !== null
            );

          if (upsertData.length === 0) {
            continue;
          }

          const { error } = await supabase.from(table).upsert(upsertData, {
            onConflict: "team_abbreviation,date"
          });

          if (error) {
            throw new Error(`Supabase upsert error for ${table}: ${error.message}`);
          }

          processedTables.push(`${table}:${formattedDate}`);
        } catch (error: any) {
          const message = `Failed for ${table} on ${formattedDate}: ${
            error?.message ?? String(error)
          }`;
          console.error(message);
          fetchIssues.push(message);
        }
      }

      processedDates.push(formattedDate);
    }

    if (remainingDates.length === 0 && hasBudgetForRequests(scriptStartTime, 2)) {
      for (const [key, { situation, rate, table }] of Object.entries(
        seasonBasedResponseKeys
      )) {
        const season = key === "seasonStats" ? seasonId : lastSeasonId;
        const queryParams = new URLSearchParams({
          sit: situation,
          rate,
          from_season: season.toString(),
          thru_season: season.toString(),
          stype: "2",
          score: "all",
          team: "all",
          loc: "B",
          gpf: "410"
        });

        try {
          const scriptOutput = await fetchTeamTable(queryParams);
          if (!scriptOutput.data || scriptOutput.data.length === 0) {
            continue;
          }

          const upsertData = scriptOutput.data
            .map((stat) => mapStatToRow(stat, { season: season.toString() }))
            .filter(
              (entry): entry is NonNullable<typeof entry> => entry !== null
            );

          if (upsertData.length === 0) {
            continue;
          }

          const { error } = await supabase.from(table).upsert(upsertData, {
            onConflict: "team_abbreviation,season"
          });

          if (error) {
            throw new Error(`Supabase upsert error for ${table}: ${error.message}`);
          }

          processedTables.push(`${table}:${season}`);
        } catch (error: any) {
          const message = `Failed for ${table}: ${error?.message ?? String(error)}`;
          console.error(message);
          fetchIssues.push(message);
        }
      }

      ranSeasonTables = true;
    }

    const complete = remainingDates.length === 0;
    const durationSeconds = (Date.now() - scriptStartTime) / 1000;

    return res.status(200).json({
      message: complete
        ? `NST team stats completed in ${durationSeconds.toFixed(1)} seconds.`
        : `NST team stats processed ${processedDates.length} date(s) in ${durationSeconds.toFixed(
            1
          )} seconds and stopped before the Vercel timeout.`,
      success: fetchIssues.length === 0,
      complete,
      ranSeasonTables,
      processedDates,
      remainingDates,
      processedTables,
      issues: fetchIssues
    });
  } catch (error: any) {
    console.error("Error in nst-team-stats API:", error.message);
    return res.status(500).json({
      message: "Failed to upsert team statistics: " + error.message,
      success: false
    });
  }
});
