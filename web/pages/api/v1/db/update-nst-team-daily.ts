import { withCronJobAudit } from "lib/cron/withCronJobAudit";
import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";
import * as cheerio from "cheerio";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { addDays, isAfter, isBefore, parseISO } from "date-fns";
import { toZonedTime, format as tzFormat } from "date-fns-tz";
import { fetchCurrentSeason } from "utils/fetchCurrentSeason";
import { teamNameToAbbreviationMap, teamsInfo } from "lib/teamsInfo";

/**
 * URL Examples:
 *
 * Incremental mode (default - processes new dates since last update):
 * GET /api/v1/db/update-nst-team-daily
 * POST /api/v1/db/update-nst-team-daily
 *
 * Forward mode (processes dates from start of season or specified date forward):
 * GET /api/v1/db/update-nst-team-daily?runMode=forward
 * GET /api/v1/db/update-nst-team-daily?runMode=forward&startDate=2024-10-01
 * GET /api/v1/db/update-nst-team-daily?runMode=forward&startDate=2024-10-01&endDate=2024-11-05
 *
 * Reverse mode (processes dates from today or specified date backward):
 * GET /api/v1/db/update-nst-team-daily?runMode=reverse
 * GET /api/v1/db/update-nst-team-daily?runMode=reverse&startDate=2024-11-05&endDate=2024-10-01
 *
 * With overwrite flag (force update existing data):
 * GET /api/v1/db/update-nst-team-daily?runMode=forward&overwrite=true
 * GET /api/v1/db/update-nst-team-daily?startDate=2024-11-01&endDate=2024-11-05&overwrite=true
 *
 * Single date processing:
 * GET /api/v1/db/update-nst-team-daily?runMode=forward&startDate=2024-11-05&endDate=2024-11-05
 *
 * Parameters:
 * - runMode: "incremental" | "forward" | "reverse" (default: "incremental")
 * - startDate: YYYY-MM-DD format (ISO 8601)
 * - endDate: YYYY-MM-DD format (ISO 8601)
 * - overwrite: "true" | "false" | "1" | "0" | "yes" | "y" (default varies by runMode)
 *
 * Methods supported: GET, POST
 * For POST requests, parameters can be sent in the request body as JSON
 */

dotenv.config({ path: "./../../../.env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Supabase URL or Service Role Key is missing.");
  process.exit(1);
}

const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey);

type RunMode = "incremental" | "forward" | "reverse";

interface DatasetConfig {
  key: string;
  table: string;
  sit: string;
  rate: "n" | "y";
  description: string;
  isRateTable: boolean;
  situationLabel: string;
}

const DEFAULT_REQUEST_INTERVAL_MS = 0;
const SMALL_MULTI_REQUEST_INTERVAL_MS = 3000;
const MULTI_DATE_REQUEST_INTERVAL_MS = 30000;
const NST_BASE_URL = "https://www.naturalstattrick.com/teamtable.php";
const TIME_ZONE = "America/New_York";

const DATASETS: DatasetConfig[] = [
  {
    key: "as_counts",
    table: "nst_team_gamelogs_as_counts",
    sit: "all",
    rate: "n",
    description: "All strengths counts",
    isRateTable: false,
    situationLabel: "all"
  },
  {
    key: "as_rates",
    table: "nst_team_gamelogs_as_rates",
    sit: "all",
    rate: "y",
    description: "All strengths rates",
    isRateTable: true,
    situationLabel: "all"
  },
  {
    key: "es_counts",
    table: "nst_team_gamelogs_es_counts",
    sit: "5v5",
    rate: "n",
    description: "Even strength counts",
    isRateTable: false,
    situationLabel: "5v5"
  },
  {
    key: "es_rates",
    table: "nst_team_gamelogs_es_rates",
    sit: "5v5",
    rate: "y",
    description: "Even strength rates",
    isRateTable: true,
    situationLabel: "5v5"
  },
  {
    key: "pp_counts",
    table: "nst_team_gamelogs_pp_counts",
    sit: "pp",
    rate: "n",
    description: "Power play counts",
    isRateTable: false,
    situationLabel: "pp"
  },
  {
    key: "pp_rates",
    table: "nst_team_gamelogs_pp_rates",
    sit: "pp",
    rate: "y",
    description: "Power play rates",
    isRateTable: true,
    situationLabel: "pp"
  },
  {
    key: "pk_counts",
    table: "nst_team_gamelogs_pk_counts",
    sit: "pk",
    rate: "n",
    description: "Penalty kill counts",
    isRateTable: false,
    situationLabel: "pk"
  },
  {
    key: "pk_rates",
    table: "nst_team_gamelogs_pk_rates",
    sit: "pk",
    rate: "y",
    description: "Penalty kill rates",
    isRateTable: true,
    situationLabel: "pk"
  }
];

const TEAM_TABLES = DATASETS.map((dataset) => dataset.table);

const sharedHeaderMap: Record<string, string> = {
  gp: "gp",
  w: "wins",
  l: "losses",
  otl: "otl",
  row: "row_wins",
  points: "points",
  "point%": "point_pct",
  "cf%": "cf_pct",
  "ff%": "ff_pct",
  "sf%": "sf_pct",
  "gf%": "gf_pct",
  "xgf%": "xgf_pct",
  "scf%": "scf_pct",
  "scsf%": "scsf_pct",
  "scgf%": "scgf_pct",
  "scsh%": "scsh_pct",
  "scsv%": "scsv_pct",
  "hdcf%": "hdcf_pct",
  "hdsf%": "hdsf_pct",
  "hdgf%": "hdgf_pct",
  "hdsh%": "hdsh_pct",
  "hdsv%": "hdsv_pct",
  "mdcf%": "mdcf_pct",
  "mdsf%": "mdsf_pct",
  "mdgf%": "mdgf_pct",
  "mdsh%": "mdsh_pct",
  "mdsv%": "mdsv_pct",
  "ldcf%": "ldcf_pct",
  "ldsf%": "ldsf_pct",
  "ldgf%": "ldgf_pct",
  "ldsh%": "ldsh_pct",
  "ldsv%": "ldsv_pct",
  "sh%": "sh_pct",
  "sv%": "sv_pct",
  pdo: "pdo"
};

const countsHeaderMap: Record<string, string> = {
  toi: "toi_seconds",
  cf: "cf",
  ca: "ca",
  ff: "ff",
  fa: "fa",
  sf: "sf",
  sa: "sa",
  gf: "gf",
  ga: "ga",
  xgf: "xgf",
  xga: "xga",
  scf: "scf",
  sca: "sca",
  scsf: "scsf",
  scsa: "scsa",
  scgf: "scgf",
  scga: "scga",
  hdcf: "hdcf",
  hdca: "hdca",
  hdsf: "hdsf",
  hdsa: "hdsa",
  hdgf: "hdgf",
  hdga: "hdga",
  mdcf: "mdcf",
  mdca: "mdca",
  mdsf: "mdsf",
  mdsa: "mdsa",
  mdgf: "mdgf",
  mdga: "mdga",
  ldcf: "ldcf",
  ldca: "ldca",
  ldsf: "ldsf",
  ldsa: "ldsa",
  ldgf: "ldgf",
  ldga: "ldga"
};

const ratesHeaderMap: Record<string, string> = {
  "toi/gp": "toi_per_gp_seconds",
  "cf/60": "cf_per_60",
  "ca/60": "ca_per_60",
  "ff/60": "ff_per_60",
  "fa/60": "fa_per_60",
  "sf/60": "sf_per_60",
  "sa/60": "sa_per_60",
  "gf/60": "gf_per_60",
  "ga/60": "ga_per_60",
  "xgf/60": "xgf_per_60",
  "xga/60": "xga_per_60",
  "scf/60": "scf_per_60",
  "sca/60": "sca_per_60",
  "scsf/60": "scsf_per_60",
  "scsa/60": "scsa_per_60",
  "scgf/60": "scgf_per_60",
  "scga/60": "scga_per_60",
  "hdcf/60": "hdcf_per_60",
  "hdca/60": "hdca_per_60",
  "hdsf/60": "hdsf_per_60",
  "hdsa/60": "hdsa_per_60",
  "hdgf/60": "hdgf_per_60",
  "hdga/60": "hdga_per_60",
  "mdcf/60": "mdcf_per_60",
  "mdca/60": "mdca_per_60",
  "mdsf/60": "mdsf_per_60",
  "mdsa/60": "mdsa_per_60",
  "mdgf/60": "mdgf_per_60",
  "mdga/60": "mdga_per_60",
  "ldcf/60": "ldcf_per_60",
  "ldca/60": "ldca_per_60",
  "ldsf/60": "ldsf_per_60",
  "ldsa/60": "ldsa_per_60",
  "ldgf/60": "ldgf_per_60",
  "ldga/60": "ldga_per_60"
};

type RawRow = Record<string, string | null>;

type TeamGamelogInsert = {
  team_abbreviation: string;
  team_name: string;
  season_id: number;
  date: string;
  situation: string;
  updated_at?: string;
} & Record<string, number | string | null | undefined>;

const normalizedTeamLookup = new Map<string, string>();

Object.entries(teamsInfo).forEach(([abbr, info]) => {
  normalizedTeamLookup.set(normalizeTeamName(info.name), abbr);
  if (info.shortName) {
    normalizedTeamLookup.set(normalizeTeamName(info.shortName), abbr);
  }
});

Object.entries(teamNameToAbbreviationMap).forEach(([name, abbr]) => {
  normalizedTeamLookup.set(normalizeTeamName(name), abbr);
});

const unknownTeams = new Set<string>();
let lastNstRequestAt = 0;
let currentRequestIntervalMs = DEFAULT_REQUEST_INTERVAL_MS;

function normalizeHeaderKey(text: string): string {
  return text
    .replace(/\u00a0/g, " ")
    .replace(/\s+\/\s+/g, "/")
    .replace(/\s+%/g, "%")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function normalizeTeamName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "")
    .replace(/\s+/g, "")
    .toLowerCase();
}

function convertTimeToSeconds(value: string | null | undefined): number | null {
  if (!value || value === "-") return null;
  const parts = value.split(":");
  if (parts.length !== 2) return null;
  const minutes = Number(parts[0]);
  const seconds = Number(parts[1]);
  if (Number.isNaN(minutes) || Number.isNaN(seconds)) return null;
  return minutes * 60 + seconds;
}

function parseNumeric(value: string | null | undefined): number | null {
  if (!value || value === "-") return null;
  const cleaned = value.replace(/,/g, "");
  const num = Number(cleaned);
  return Number.isNaN(num) ? null : num;
}

function parsePercentage(value: string | null | undefined): number | null {
  const parsed = parseNumeric(value);
  if (parsed === null) return null;
  return parsed;
}

function formatEstDate(date: Date): string {
  return tzFormat(toZonedTime(date, TIME_ZONE), "yyyy-MM-dd", {
    timeZone: TIME_ZONE
  });
}

function seasonIdFromDate(dateString: string): number {
  const parsed = parseISO(dateString);
  const year = parsed.getUTCFullYear();
  const month = parsed.getUTCMonth();
  const startYear = month >= 6 ? year : year - 1;
  const endYear = startYear + 1;
  return Number(`${startYear}${endYear}`);
}

async function nstGet(url: string): Promise<string> {
  const now = Date.now();
  const elapsed = now - lastNstRequestAt;
  if (currentRequestIntervalMs > 0 && elapsed < currentRequestIntervalMs) {
    await delay(currentRequestIntervalMs - elapsed);
  }
  lastNstRequestAt = Date.now();
  const headers = {
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    Referer: "https://www.naturalstattrick.com/",
    "Cache-Control": "no-cache",
    Pragma: "no-cache"
  };
  const response = await axios.get(url, {
    headers,
    timeout: 45000,
    maxRedirects: 3,
    responseType: "text"
  });
  return response.data;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseTeamTable(html: string): RawRow[] {
  const $ = cheerio.load(html);
  const table = $("#teams");
  if (table.length === 0) {
    return [];
  }

  const bodyRows = table.find("tbody tr");
  if (bodyRows.length === 0) {
    return [];
  }

  const theadRows = table.find("thead tr");
  const tdCount = bodyRows.first().find("td").length;
  let headerRow = theadRows.last();
  theadRows.each((_, tr) => {
    const thCount = $(tr).find("th").length;
    if (thCount === tdCount) {
      headerRow = $(tr);
      return false;
    }
    return undefined;
  });

  const headers: Array<string | null> = [];
  headerRow.find("th").each((index, th) => {
    const raw = $(th).text();
    const normalized = normalizeHeaderKey(raw);
    if (normalized === "" && index === 0) {
      headers.push(null);
      return;
    }
    headers.push(normalized);
  });

  const rows: RawRow[] = [];
  bodyRows.each((_, tr) => {
    const row: RawRow = {};
    $(tr)
      .find("td")
      .each((idx, td) => {
        const header = headers[idx];
        if (!header) {
          return;
        }
        const text = $(td).text().replace(/\s+/g, " ").trim();
        row[header] = text === "" || text === "-" ? null : text;
      });
    if (Object.keys(row).length > 0) {
      rows.push(row);
    }
  });
  return rows;
}

function resolveTeam(
  teamLabel: string
): { abbreviation: string; name: string } | null {
  const trimmed = teamLabel.trim();
  const direct = teamNameToAbbreviationMap[trimmed];
  const normalized = normalizeTeamName(trimmed);
  const fallback = normalizedTeamLookup.get(normalized);
  const abbreviation = direct || fallback;
  if (!abbreviation) {
    if (!unknownTeams.has(trimmed)) {
      console.warn(
        `Unable to match team name "${trimmed}" to an abbreviation.`
      );
      unknownTeams.add(trimmed);
    }
    return null;
  }
  const canonical = teamsInfo[abbreviation]?.name ?? trimmed;
  return { abbreviation, name: canonical };
}

function buildHeaderMap(isRateTable: boolean): Record<string, string> {
  if (isRateTable) {
    return { ...sharedHeaderMap, ...ratesHeaderMap };
  }
  return { ...sharedHeaderMap, ...countsHeaderMap };
}

function buildDatasetUrl(
  date: string,
  dataset: DatasetConfig,
  seasonId: string
) {
  const query = new URLSearchParams({
    fromseason: seasonId,
    thruseason: seasonId,
    stype: "2",
    sit: dataset.sit,
    score: "all",
    rate: dataset.rate,
    team: "all",
    loc: "B",
    gpf: "410",
    fd: date,
    td: date
  });
  return `${NST_BASE_URL}?${query.toString()}`;
}

async function getLatestProcessedDate(): Promise<string | null> {
  let latest: string | null = null;
  for (const table of TEAM_TABLES) {
    const { data, error } = await supabase
      .from(table)
      .select("date")
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data?.date) continue;
    if (!latest || data.date > latest) {
      latest = data.date;
    }
  }
  return latest;
}

async function dateHasData(date: string): Promise<boolean> {
  const table = "nst_team_gamelogs_as_counts";
  const { error, count } = await supabase
    .from(table)
    .select("team_abbreviation", { count: "exact", head: true })
    .eq("date", date);
  if (error) {
    console.warn(`Supabase check failed for ${date}: ${error.message}`);
    return false;
  }
  return (count ?? 0) > 0;
}

function parseDateInput(value: string | undefined): Date | null {
  if (!value) return null;
  const parsed = parseISO(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function buildDateQueue(
  runMode: RunMode,
  today: Date,
  seasonStart: Date,
  latestDate: string | null,
  startDateInput?: Date | null,
  endDateInput?: Date | null
): string[] {
  const dates: string[] = [];
  const todayStr = formatEstDate(today);
  const todayDate = parseISO(todayStr);
  const seasonStartDate = parseISO(formatEstDate(seasonStart));

  const clampToToday = (date: Date) =>
    isAfter(date, todayDate) ? todayDate : date;

  if (runMode === "reverse") {
    const start = clampToToday(startDateInput ?? todayDate);
    const end = endDateInput ? endDateInput : seasonStartDate;
    if (isBefore(start, end)) {
      return [];
    }
    let cursor = start;
    while (!isBefore(cursor, end)) {
      dates.push(formatEstDate(cursor));
      cursor = addDays(cursor, -1);
    }
    return dates;
  }

  let start: Date;
  if (startDateInput) {
    start = startDateInput;
  } else if (latestDate) {
    start = addDays(parseISO(latestDate), 1);
  } else {
    start = seasonStartDate;
  }

  const end = clampToToday(endDateInput ?? todayDate);

  if (isAfter(start, end)) {
    return [];
  }

  let cursor = start;
  while (!isAfter(cursor, end)) {
    dates.push(formatEstDate(cursor));
    cursor = addDays(cursor, 1);
  }
  return dates;
}

function mapRowToInsert(
  raw: RawRow,
  dataset: DatasetConfig,
  date: string
): TeamGamelogInsert | null {
  const teamLabel = raw["team"];
  if (!teamLabel) return null;
  const team = resolveTeam(teamLabel);
  if (!team) return null;
  const headerMap = buildHeaderMap(dataset.isRateTable);
  const row: TeamGamelogInsert = {
    team_abbreviation: team.abbreviation,
    team_name: team.name,
    season_id: seasonIdFromDate(date),
    date,
    situation: dataset.situationLabel,
    updated_at: new Date().toISOString()
  };

  for (const [headerKey, columnName] of Object.entries(headerMap)) {
    const value = raw[headerKey];
    if (value === undefined) continue;
    if (columnName === "toi_seconds" || columnName === "toi_per_gp_seconds") {
      row[columnName] = convertTimeToSeconds(value);
    } else if (headerKey.includes("%")) {
      row[columnName] = parsePercentage(value);
    } else {
      row[columnName] = parseNumeric(value);
    }
  }
  return row;
}

async function processDatasetForDate(
  date: string,
  dataset: DatasetConfig
): Promise<{ inserted: number; table: string }> {
  const seasonId = seasonIdFromDate(date).toString();
  const url = buildDatasetUrl(date, dataset, seasonId);
  console.log(`[NST] Fetching ${dataset.description} for ${date} -> ${url}`);
  const html = await nstGet(url);
  const rawRows = parseTeamTable(html);
  if (rawRows.length === 0) {
    console.log(`[NST] No ${dataset.description} rows for ${date}`);
    return { inserted: 0, table: dataset.table };
  }
  const rows = rawRows
    .map((raw) => mapRowToInsert(raw, dataset, date))
    .filter(
      (row): row is TeamGamelogInsert =>
        row !== null && row.team_abbreviation !== undefined
    );
  if (rows.length === 0) {
    console.log(
      `[NST] All ${dataset.description} rows skipped for ${date} after mapping.`
    );
    return { inserted: 0, table: dataset.table };
  }
  const { error } = await supabase
    .from(dataset.table)
    .upsert(rows, { onConflict: "team_abbreviation,date" });
  if (error) {
    throw new Error(
      `Supabase upsert failed for ${dataset.table} (${date}): ${error.message}`
    );
  }
  console.log(
    `[NST] Upserted ${rows.length} rows into ${dataset.table} for ${date}`
  );
  return { inserted: rows.length, table: dataset.table };
}

function coerceParam(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (Array.isArray(value)) {
    return value[0];
  }
  if (typeof value === "string") return value;
  return String(value);
}

function parseBooleanParam(
  value: string | undefined,
  defaultValue: boolean
): boolean {
  if (value === undefined) return defaultValue;
  return ["true", "1", "yes", "y"].includes(value.toLowerCase());
}

const handler = async (
  req: NextApiRequest,
  res: NextApiResponse
) => {
  const startedAt = Date.now();
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET,POST");
    return res.status(405).json({ message: "Method not allowed" });
  }

  const params = req.method === "GET" ? req.query : (req.body ?? {});
  const runModeParam = coerceParam(params.runMode)?.toLowerCase();
  const runMode: RunMode = (runModeParam as RunMode) || "incremental";
  if (!["incremental", "forward", "reverse"].includes(runMode)) {
    return res.status(400).json({
      message:
        "Invalid runMode. Use incremental (default), forward, or reverse."
    });
  }

  const startDateParam = coerceParam(params.startDate);
  const endDateParam = coerceParam(params.endDate);
  const overwriteParam = coerceParam(params.overwrite);

  const startDateParsed = parseDateInput(startDateParam);
  const endDateParsed = parseDateInput(endDateParam);

  if (startDateParam && !startDateParsed) {
    return res.status(400).json({ message: "Invalid startDate value." });
  }
  if (endDateParam && !endDateParsed) {
    return res.status(400).json({ message: "Invalid endDate value." });
  }

  const overwriteDefault = runMode === "incremental" ? false : true;
  const overwrite = parseBooleanParam(overwriteParam, overwriteDefault);

  try {
    const season = await fetchCurrentSeason();
    const todayEst = toZonedTime(new Date(), TIME_ZONE);
    const seasonStart = parseISO(season.startDate);
    const latestDate = await getLatestProcessedDate();
    const targetDates = buildDateQueue(
      runMode,
      todayEst,
      seasonStart,
      runMode === "forward" ? null : latestDate,
      startDateParsed,
      endDateParsed
    );

    if (targetDates.length === 0) {
      return res.status(200).json({
        message: "No dates to process for the provided parameters.",
        runMode,
        overwrite
      });
    }

    currentRequestIntervalMs =
      targetDates.length <= 1
        ? DEFAULT_REQUEST_INTERVAL_MS
        : targetDates.length <= 2
          ? SMALL_MULTI_REQUEST_INTERVAL_MS
          : MULTI_DATE_REQUEST_INTERVAL_MS;

    const summary = {
      runMode,
      overwrite,
      totalDates: targetDates.length,
      processedDates: 0,
      skippedDates: 0,
      datasetResults: [] as Array<{
        date: string;
        table: string;
        inserted: number;
      }>,
      errors: [] as string[]
    };

    for (const date of targetDates) {
      if (!overwrite) {
        const alreadyExists = await dateHasData(date);
        if (alreadyExists) {
          summary.skippedDates += 1;
          continue;
        }
      }

      for (const dataset of DATASETS) {
        try {
          const result = await processDatasetForDate(date, dataset);
          if (result.inserted > 0) {
            summary.datasetResults.push({
              date,
              table: result.table,
              inserted: result.inserted
            });
          }
        } catch (error: any) {
          const message =
            error instanceof Error ? error.message : String(error);
          console.error(message);
          summary.errors.push(message);
        }
      }
      summary.processedDates += 1;
    }

    const statusCode = summary.errors.length > 0 ? 207 : 200;
    return res.status(statusCode).json({
      message: `Processed ${summary.processedDates} day(s); ${summary.skippedDates} skipped.`,
      durationMs: Date.now() - startedAt,
      summary
    });
  } catch (error: any) {
    console.error("update-nst-team-daily failed:", error);
    return res.status(500).json({
      message: "Unexpected error while updating NST team gamelogs.",
      durationMs: Date.now() - startedAt,
      error: error?.message ?? error
    });
  }
};

export default withCronJobAudit(handler);
