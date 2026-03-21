import { NextApiResponse } from "next";
import { addDays, format, isAfter, parseISO } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import {
  NST_TEAM_STATS_SAFE_INTERVAL_MS,
  resolveNstTeamStatsRequestPlan
} from "lib/cron/nstBurstPlans";
import adminOnly from "utils/adminOnlyMiddleware";
import { getCurrentSeason } from "lib/NHL/server";
import { teamsInfo, teamNameToAbbreviationMap } from "lib/teamsInfo";

const teamTableFunctionUrl =
  "https://functions-fhfhockey.vercel.app/api/fetch_team_table";
const TIME_ZONE = "America/New_York";

const MAX_DURATION_MS = 285_000;
const MIN_REQUEST_BUDGET_MS = 55_000;
const MAX_DATE_BASED_DATES_PER_RUN = 1;

export const config = {
  maxDuration: 300
};

/**
 * Query params:
 * - date: optional YYYY-MM-DD or "all"; defaults to "all".
 * - startDate: optional YYYY-MM-DD. Manual backfill mode; processes one date
 *   per request and returns the next date to run.
 * - endDate: optional YYYY-MM-DD. When paired with startDate, runs a
 *   season-aware backward backfill from endDate down to startDate.
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

interface DateTarget {
  date: string;
  seasonId: number;
}

interface SeasonWindow {
  seasonId: number;
  startDate: string;
  endDate: string;
}

let lastNstRequestCompletedAt = 0;
let nstRequestSequence = 0;
let currentNstRequestIntervalMs = NST_TEAM_STATS_SAFE_INTERVAL_MS;

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

function formatDuration(ms: number): string {
  if (ms <= 0) {
    return "0s";
  }

  if (ms < 1000) {
    return `${ms}ms`;
  }

  const totalSeconds = ms / 1000;
  if (totalSeconds < 60) {
    return `${totalSeconds.toFixed(1)}s`;
  }

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds - minutes * 60;
  return `${minutes}m ${seconds.toFixed(1)}s`;
}

function formatRemainingWait(ms: number): string {
  return ms > 0 ? formatDuration(ms) : "no wait";
}

function logNst(message: string) {
  console.log(`[NST Team Stats] ${message}`);
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

async function waitForNextNstRequestSlot(): Promise<number> {
  if (lastNstRequestCompletedAt === 0) {
    return 0;
  }

  const elapsed = Date.now() - lastNstRequestCompletedAt;
  if (elapsed < currentNstRequestIntervalMs) {
    const waitMs = currentNstRequestIntervalMs - elapsed;
    await delay(waitMs);
    return waitMs;
  }

  return 0;
}

function getRemainingNstWaitMs(): number {
  if (lastNstRequestCompletedAt === 0) {
    return 0;
  }

  const elapsed = Date.now() - lastNstRequestCompletedAt;
  return elapsed < currentNstRequestIntervalMs
    ? currentNstRequestIntervalMs - elapsed
    : 0;
}

async function fetchTeamTable(
  params: URLSearchParams,
  context: {
    label: string;
    table: string;
    situation: string;
  }
) : Promise<
  PythonScriptOutput & {
    requestSequence: number;
    waitMs: number;
    fetchDurationMs: number;
  }
> {
  const requestSequence = ++nstRequestSequence;
  const waitMs = getRemainingNstWaitMs();
  logNst(
    `${context.label} | request ${requestSequence} | table=${context.table} | situation=${context.situation} | next fetch in ${formatRemainingWait(
      waitMs
    )}`
  );
  const actualWaitMs = await waitForNextNstRequestSlot();
  logNst(
    `${context.label} | request ${requestSequence} | starting fetch after waiting ${formatDuration(
      actualWaitMs
    )}`
  );

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  const fullUrl = `${teamTableFunctionUrl}?${params.toString()}`;
  const fetchStartedAt = Date.now();

  try {
    const response = await fetch(fullUrl, { signal: controller.signal });
    const responseText = await response.text();
    lastNstRequestCompletedAt = Date.now();

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${responseText.slice(0, 300)}`);
    }

    const parsed = JSON.parse(responseText);
    const output =
      typeof parsed === "string"
      ? (JSON.parse(parsed) as PythonScriptOutput)
      : (parsed as PythonScriptOutput);
    const fetchDurationMs = Date.now() - fetchStartedAt;

    logNst(
      `${context.label} | request ${requestSequence} | fetch completed in ${formatDuration(
        fetchDurationMs
      )} | raw rows=${output.data?.length ?? 0}`
    );

    return {
      ...output,
      requestSequence,
      waitMs: actualWaitMs,
      fetchDurationMs
    };
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

function maxDate(a: string, b: string): string {
  return a > b ? a : b;
}

function minDate(a: string, b: string): string {
  return a < b ? a : b;
}

async function getSeasonWindows(
  supabase: any,
  startDate: string,
  endDate: string
): Promise<SeasonWindow[]> {
  const { data, error } = await supabase
    .from("seasons")
    .select("id, startDate, endDate")
    .lte("startDate", endDate)
    .gte("endDate", startDate)
    .order("startDate", { ascending: true });

  if (error) {
    throw new Error(`Failed to load season windows: ${error.message}`);
  }

  return (data ?? []).map((row: any) => ({
    seasonId: Number(row.id),
    startDate: String(row.startDate).slice(0, 10),
    endDate: String(row.endDate).slice(0, 10)
  }));
}

function buildSeasonDateTargets(
  seasonWindows: SeasonWindow[],
  startDate: string,
  endDate: string,
  direction: "forward" | "backward"
): DateTarget[] {
  const targets: DateTarget[] = [];

  for (const seasonWindow of seasonWindows) {
    const rangeStart = maxDate(startDate, seasonWindow.startDate);
    const rangeEnd = minDate(endDate, seasonWindow.endDate);

    if (rangeStart > rangeEnd) {
      continue;
    }

    for (const date of buildDateRange(parseISO(rangeStart), parseISO(rangeEnd))) {
      targets.push({
        date,
        seasonId: seasonWindow.seasonId
      });
    }
  }

  return direction === "backward" ? targets.reverse() : targets;
}

async function getSeasonAwareDateTargets(
  supabase: any,
  startDate: string,
  endDate: string,
  direction: "forward" | "backward"
): Promise<DateTarget[]> {
  const seasonWindows = await getSeasonWindows(supabase, startDate, endDate);

  if (seasonWindows.length === 0) {
    logNst(
      `No overlapping season windows found for ${startDate} through ${endDate}; skipping date processing.`
    );
    return [];
  }

  return buildSeasonDateTargets(seasonWindows, startDate, endDate, direction);
}

async function resolveSeasonIdForDate(
  supabase: any,
  formattedDate: string
): Promise<number | null> {
  const { data, error } = await supabase
    .from("seasons")
    .select("id")
    .lte("startDate", formattedDate)
    .gte("endDate", formattedDate)
    .order("startDate", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Failed to resolve season for ${formattedDate}: ${error.message}`
    );
  }

  return data?.id ? Number(data.id) : null;
}

async function getEarliestIncompleteDate(
  supabase: any,
  tables: string[],
  startDate: string,
  endDate: string
): Promise<string | null> {
  const dateResults = await Promise.all(
    tables.map(async (table) => {
      const { data, error } = await supabase
        .from(table)
        .select("date")
        .gte("date", startDate)
        .lte("date", endDate)
        .order("date", { ascending: true });

      if (error) {
        throw new Error(
          `Failed to scan existing dates for ${table}: ${error.message}`
        );
      }

      return {
        table,
        dates: new Set(
          (data ?? [])
            .map((row: { date?: string | null }) => row.date)
            .filter(
              (value: string | null | undefined): value is string =>
                Boolean(value)
            )
        )
      };
    })
  );

  const dateRange = buildDateRange(parseISO(startDate), parseISO(endDate));
  for (const date of dateRange) {
    const missingTables = dateResults
      .filter(({ dates }) => !dates.has(date))
      .map(({ table }) => table);

    if (missingTables.length > 0) {
      logNst(
        `Found incomplete date ${date} | missing tables=${missingTables.join(", ")}`
      );
      return date;
    }
  }

  return null;
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
  nstRequestSequence = 0;
  currentNstRequestIntervalMs = NST_TEAM_STATS_SAFE_INTERVAL_MS;

  try {
    const rawDate = Array.isArray(req.query.date)
      ? req.query.date[0]
      : req.query.date;
    const rawStartDate = Array.isArray(req.query.startDate)
      ? req.query.startDate[0]
      : req.query.startDate;
    const rawEndDate = Array.isArray(req.query.endDate)
      ? req.query.endDate[0]
      : req.query.endDate;
    const date =
      typeof rawDate === "string" && rawDate.trim() ? rawDate.trim() : "all";
    const startDateParam =
      typeof rawStartDate === "string" && rawStartDate.trim()
        ? rawStartDate.trim()
        : null;
    const endDateParam =
      typeof rawEndDate === "string" && rawEndDate.trim()
        ? rawEndDate.trim()
        : null;

    if ((startDateParam || endDateParam) && date !== "all") {
      return res.status(400).json({
        message: "Use either 'date' or the startDate/endDate backfill params, not both.",
        success: false
      });
    }

    if (endDateParam && !startDateParam) {
      return res.status(400).json({
        message: "The 'endDate' query parameter requires 'startDate'.",
        success: false
      });
    }

    const currentSeason = await getCurrentSeason();
    const { seasonId, lastSeasonId, regularSeasonStartDate, seasonEndDate } =
      currentSeason;

    const today = parseISO(getTodayEstString());
    const todayString = format(today, "yyyy-MM-dd");
    const seasonEndDateString = String(seasonEndDate).slice(0, 10);
    const currentProcessingEndDate = minDate(todayString, seasonEndDateString);
    const latestCompleteCheckDate = minDate(
      format(addDays(today, -1), "yyyy-MM-dd"),
      currentProcessingEndDate
    );
    const fetchIssues: string[] = [];
    const processedDates: string[] = [];
    const processedTables: string[] = [];
    const dateBasedConfigs = Object.values(dateBasedResponseKeys);
    const seasonBasedConfigs = Object.entries(seasonBasedResponseKeys);
    let remainingDates: string[] = [];
    let remainingTargets: DateTarget[] = [];
    let ranSeasonTables = false;
    let totalDateCount = 0;
    const isManualStartDateMode = Boolean(startDateParam && !endDateParam);
    const isBackwardRangeMode = Boolean(startDateParam && endDateParam);

    let targetDateObjects: DateTarget[] = [];
    if (isBackwardRangeMode) {
      const parsedStartDate = parseISO(startDateParam!);
      const parsedEndDate = parseISO(endDateParam!);
      if (
        Number.isNaN(parsedStartDate.getTime()) ||
        Number.isNaN(parsedEndDate.getTime())
      ) {
        return res.status(400).json({
          message:
            "Invalid 'startDate' or 'endDate' query parameter. Use YYYY-MM-DD.",
          success: false
        });
      }

      if (startDateParam! > endDateParam!) {
        return res.status(400).json({
          message: "'startDate' must be on or before 'endDate'.",
          success: false
        });
      }

      targetDateObjects = await getSeasonAwareDateTargets(
        supabase,
        startDateParam!,
        endDateParam!,
        "backward"
      );

      if (targetDateObjects.length === 0) {
        return res.status(200).json({
          message:
            "No in-season dates were found in the requested backward range.",
          success: true,
          complete: true,
          processedDates: [],
          remainingDates: [],
          nextStartDate: null,
          nextEndDate: null
        });
      }

      totalDateCount = targetDateObjects.length;
      remainingTargets = targetDateObjects.slice(MAX_DATE_BASED_DATES_PER_RUN);
      targetDateObjects = targetDateObjects.slice(0, MAX_DATE_BASED_DATES_PER_RUN);
    } else if (isManualStartDateMode) {
      const forwardStartDate = startDateParam!;
      const parsedStartDate = parseISO(forwardStartDate);
      if (Number.isNaN(parsedStartDate.getTime())) {
        return res.status(400).json({
          message: "Invalid 'startDate' query parameter. Use YYYY-MM-DD.",
          success: false
        });
      }

      if (isAfter(parsedStartDate, today)) {
        return res.status(200).json({
          message: "NST team stats startDate is already past today.",
          success: true,
          complete: true,
          processedDates: [],
          remainingDates: [],
          nextStartDate: null,
          nextEndDate: null
        });
      }

      targetDateObjects = await getSeasonAwareDateTargets(
        supabase,
        forwardStartDate,
        todayString,
        "forward"
      );

      if (targetDateObjects.length === 0) {
        return res.status(200).json({
          message:
            "No in-season dates were found between the requested startDate and today.",
          success: true,
          complete: true,
          processedDates: [],
          remainingDates: [],
          nextStartDate: null,
          nextEndDate: null
        });
      }

      totalDateCount = targetDateObjects.length;
      remainingTargets = targetDateObjects.slice(MAX_DATE_BASED_DATES_PER_RUN);
      targetDateObjects = targetDateObjects.slice(0, MAX_DATE_BASED_DATES_PER_RUN);
    } else if (date === "all") {
      const earliestIncompleteDate =
        latestCompleteCheckDate >= regularSeasonStartDate
          ? await getEarliestIncompleteDate(
              supabase,
              dateBasedConfigs.map(({ table }) => table),
              regularSeasonStartDate,
              latestCompleteCheckDate
            )
          : null;

      if (!earliestIncompleteDate) {
        const latestDates = await Promise.all(
          dateBasedConfigs.map(({ table }) => getLatestDate(supabase, table))
        );
        const validDates = latestDates.filter(
          (value): value is string => Boolean(value)
        );
        const resumeFromDate =
          validDates.length > 0
            ? addDays(parseISO(validDates.reduce((a, b) => (a < b ? a : b))), 1)
            : parseISO(regularSeasonStartDate);

        if (format(resumeFromDate, "yyyy-MM-dd") > currentProcessingEndDate) {
          return res.status(200).json({
            message: "All date-based team statistics are up to date.",
            success: true,
            complete: true,
            processedDates: [],
            remainingDates: [],
            nextStartDate: null,
            nextEndDate: null
          });
        }

        targetDateObjects = buildDateRange(
          resumeFromDate,
          parseISO(currentProcessingEndDate)
        ).map((formattedDate) => ({
          date: formattedDate,
          seasonId
        }));
      } else {
        targetDateObjects = buildDateRange(
          parseISO(earliestIncompleteDate),
          parseISO(currentProcessingEndDate)
        ).map((formattedDate) => ({
          date: formattedDate,
          seasonId
        }));
      }

      totalDateCount = targetDateObjects.length;
      remainingTargets = targetDateObjects.slice(MAX_DATE_BASED_DATES_PER_RUN);
      targetDateObjects = targetDateObjects.slice(0, MAX_DATE_BASED_DATES_PER_RUN);
    } else {
      const parsedDate = parseISO(date);
      if (Number.isNaN(parsedDate.getTime())) {
        return res.status(400).json({
          message: "Invalid 'date' query parameter. Use YYYY-MM-DD or 'all'.",
          success: false
        });
      }

      const formattedDate = format(parsedDate, "yyyy-MM-dd");
      const resolvedSeasonId = await resolveSeasonIdForDate(supabase, formattedDate);
      if (!resolvedSeasonId) {
        return res.status(200).json({
          message: `No active season window contains ${formattedDate}; skipping NST team stats fetch.`,
          success: true,
          complete: true,
          processedDates: [],
          remainingDates: [],
          nextStartDate: null,
          nextEndDate: null
        });
      }

      targetDateObjects = [{ date: formattedDate, seasonId: resolvedSeasonId }];
      totalDateCount = 1;
    }

    remainingDates = remainingTargets.map((target) => target.date);
    const shouldRunSeasonTables =
      !isManualStartDateMode &&
      !isBackwardRangeMode &&
      remainingDates.length === 0 &&
      hasBudgetForRequests(scriptStartTime, 2);
    const nstRequestPlan = resolveNstTeamStatsRequestPlan({
      dateRequestCount: targetDateObjects.length * dateBasedConfigs.length,
      seasonRequestCount: shouldRunSeasonTables
        ? seasonBasedConfigs.length
        : 0
    });
    currentNstRequestIntervalMs = nstRequestPlan.requestIntervalMs;

    logNst(
      `Starting run | mode=${
        isBackwardRangeMode
          ? "end-date-backfill"
          : startDateParam
          ? "start-date-backfill"
          : date === "all"
            ? "incremental"
            : "single-date"
      } | requested date=${date} | startDate=${startDateParam ?? "n/a"} | endDate=${endDateParam ?? "n/a"} | dates this run=${targetDateObjects.length}/${totalDateCount} | remaining after slice=${remainingDates.length}`
    );

    for (const [dateIndex, target] of targetDateObjects.entries()) {
      const formattedDate = target.date;
      if (!hasBudgetForRequests(scriptStartTime, 4)) {
        logNst(
          `Stopping before date ${formattedDate} | insufficient runtime budget for 4 date-based requests`
        );
        remainingTargets = [target, ...remainingTargets];
        remainingDates = remainingTargets.map((remainingTarget) => remainingTarget.date);
        break;
      }

      logNst(
        `Date ${dateIndex + 1}/${totalDateCount} | processing ${formattedDate} | season=${target.seasonId} | strengths=${dateBasedConfigs.length}`
      );

      for (const [strengthIndex, { situation, rate, table }] of dateBasedConfigs.entries()) {
        const queryParams = new URLSearchParams({
          sit: situation,
          rate,
          fd: formattedDate,
          td: formattedDate,
          from_season: target.seasonId.toString(),
          thru_season: target.seasonId.toString(),
          stype: "2",
          score: "all",
          team: "all",
          loc: "B",
          gpf: "410"
        });
        const runLabel = `Date ${dateIndex + 1}/${totalDateCount} ${formattedDate} | season ${target.seasonId} | strength ${strengthIndex + 1}/${dateBasedConfigs.length}`;

        try {
          const scriptOutput = await fetchTeamTable(queryParams, {
            label: runLabel,
            table,
            situation
          });
          if (!scriptOutput.data || scriptOutput.data.length === 0) {
            logNst(
              `${runLabel} | request ${scriptOutput.requestSequence} | table=${table} | situation=${situation} | raw rows=0 | skipping upsert`
            );
            continue;
          }

          const upsertData = scriptOutput.data
            .map((stat) => mapStatToRow(stat, { date: formattedDate }))
            .filter(
              (entry): entry is NonNullable<typeof entry> => entry !== null
            );

          if (upsertData.length === 0) {
            logNst(
              `${runLabel} | request ${scriptOutput.requestSequence} | table=${table} | situation=${situation} | raw rows=${scriptOutput.data.length} | mapped rows=0 | skipping upsert`
            );
            continue;
          }

          const upsertStartedAt = Date.now();
          logNst(
            `${runLabel} | request ${scriptOutput.requestSequence} | table=${table} | situation=${situation} | raw rows=${scriptOutput.data.length} | mapped rows=${upsertData.length} | upserting=${upsertData.length}`
          );
          const { error } = await supabase.from(table).upsert(upsertData, {
            onConflict: "team_abbreviation,date"
          });

          if (error) {
            throw new Error(`Supabase upsert error for ${table}: ${error.message}`);
          }

          logNst(
            `${runLabel} | request ${scriptOutput.requestSequence} | table=${table} | situation=${situation} | upsert complete in ${formatDuration(
              Date.now() - upsertStartedAt
            )} | request cycle=${formatDuration(
              scriptOutput.waitMs + scriptOutput.fetchDurationMs + (Date.now() - upsertStartedAt)
            )}`
          );
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

    if (shouldRunSeasonTables) {
      logNst("Date backlog is clear; starting season-based refresh.");
      for (const [seasonIndex, [key, { situation, rate, table }]] of seasonBasedConfigs.entries()) {
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
        const runLabel = `Season ${season} | table ${key} ${seasonIndex + 1}/${seasonBasedConfigs.length}`;

        try {
          const scriptOutput = await fetchTeamTable(queryParams, {
            label: runLabel,
            table,
            situation
          });
          if (!scriptOutput.data || scriptOutput.data.length === 0) {
            logNst(
              `${runLabel} | request ${scriptOutput.requestSequence} | table=${table} | situation=${situation} | raw rows=0 | skipping upsert`
            );
            continue;
          }

          const upsertData = scriptOutput.data
            .map((stat) => mapStatToRow(stat, { season: season.toString() }))
            .filter(
              (entry): entry is NonNullable<typeof entry> => entry !== null
            );

          if (upsertData.length === 0) {
            logNst(
              `${runLabel} | request ${scriptOutput.requestSequence} | table=${table} | situation=${situation} | raw rows=${scriptOutput.data.length} | mapped rows=0 | skipping upsert`
            );
            continue;
          }

          const upsertStartedAt = Date.now();
          logNst(
            `${runLabel} | request ${scriptOutput.requestSequence} | table=${table} | situation=${situation} | raw rows=${scriptOutput.data.length} | mapped rows=${upsertData.length} | upserting=${upsertData.length}`
          );
          const { error } = await supabase.from(table).upsert(upsertData, {
            onConflict: "team_abbreviation,season"
          });

          if (error) {
            throw new Error(`Supabase upsert error for ${table}: ${error.message}`);
          }

          logNst(
            `${runLabel} | request ${scriptOutput.requestSequence} | table=${table} | situation=${situation} | upsert complete in ${formatDuration(
              Date.now() - upsertStartedAt
            )} | request cycle=${formatDuration(
              scriptOutput.waitMs + scriptOutput.fetchDurationMs + (Date.now() - upsertStartedAt)
            )}`
          );
          processedTables.push(`${table}:${season}`);
        } catch (error: any) {
          const message = `Failed for ${table}: ${error?.message ?? String(error)}`;
          console.error(message);
          fetchIssues.push(message);
        }
      }

      ranSeasonTables = true;
    } else if (isManualStartDateMode || isBackwardRangeMode) {
      logNst("Skipping season-based refresh because manual date-range backfill mode is date-only.");
    } else if (remainingDates.length > 0) {
      logNst(
        `Skipping season-based refresh because ${remainingDates.length} date(s) remain in the backlog.`
      );
    } else {
      logNst("Skipping season-based refresh because runtime budget is too low.");
    }

    const complete = remainingDates.length === 0;
    const durationSeconds = (Date.now() - scriptStartTime) / 1000;
    logNst(
      `Run finished in ${durationSeconds.toFixed(1)}s | processed dates=${processedDates.length} | processed tables=${processedTables.length} | issues=${fetchIssues.length} | remaining dates=${remainingDates.length}`
    );

    return res.status(200).json({
      message: complete
        ? `NST team stats completed in ${durationSeconds.toFixed(1)} seconds.`
        : isBackwardRangeMode
          ? `NST team stats processed ${processedDates.length} date(s) in ${durationSeconds.toFixed(
              1
            )} seconds. Continue with endDate=${remainingDates[0]}.`
          : isManualStartDateMode
          ? `NST team stats processed ${processedDates.length} date(s) in ${durationSeconds.toFixed(
              1
            )} seconds. Continue with startDate=${remainingDates[0]}.`
          : `NST team stats processed ${processedDates.length} date(s) in ${durationSeconds.toFixed(
              1
            )} seconds and stopped before the Vercel timeout.`,
      success: fetchIssues.length === 0,
      complete,
      ranSeasonTables,
      nstRequestPlan,
      processedDates,
      remainingDates,
      nextStartDate:
        isManualStartDateMode && !isBackwardRangeMode
          ? remainingDates[0] ?? null
          : null,
      nextEndDate: isBackwardRangeMode ? remainingDates[0] ?? null : null,
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
