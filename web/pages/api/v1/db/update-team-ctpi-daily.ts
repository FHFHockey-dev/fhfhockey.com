import { withCronJobAudit } from "lib/cron/withCronJobAudit";
import { withNhlOffSeasonSkip } from "lib/cron/nhlOffSeason";
import type { NextApiRequest, NextApiResponse } from "next";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { fetchCurrentSeason } from "utils/fetchCurrentSeason";
import { fetchPaginatedRows } from "lib/power-ratings";
import {
  CTPI_VERSION_CONTRACTS,
  CTPI_WRITER_VERSION,
} from "lib/trends/ctpiVersions";
import {
  planRecentTeamFormCandidateReplay,
  type PersistedRecentTeamFormSnapshotProvenance,
  type RecentTeamFormSourceRow,
} from "lib/trends/recentTeamFormV2Provenance";
import {
  materializeRecentTeamFormCandidateSnapshot,
  RECENT_TEAM_FORM_V2_CANDIDATE_PUBLICATION_STATUS,
  type RecentTeamFormCandidateMaterializedRow,
} from "lib/trends/recentTeamFormV2Materialization";
import adminOnly from "utils/adminOnlyMiddleware";

dotenv.config({ path: "./../../../.env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing Supabase credentials for CTPI cron endpoint.");
}

const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey);

const AS_RATES_TABLE = "nst_team_gamelogs_as_rates";
const AS_COUNTS_TABLE = "nst_team_gamelogs_as_counts";
const PP_COUNTS_TABLE = "nst_team_gamelogs_pp_counts";
const PK_COUNTS_TABLE = "nst_team_gamelogs_pk_counts";
const DEST_TABLE = "team_ctpi_daily";
/** Row identity since migration 20261113160000 (one row per CTPI version). */
const DEST_CONFLICT_TARGET = "season_id,team,date,ctpi_version";
/** One run computes at most this many snapshot dates; backfill in bounded start/end chunks. */
export const CTPI_MAX_DATES_PER_RUN = 31;

const WRITER_CONTRACT = CTPI_VERSION_CONTRACTS[CTPI_WRITER_VERSION];

/** v1 rows (ctpi_version 1) are frozen issued history; this writer only issues v2. */
type CtpiRow = RecentTeamFormCandidateMaterializedRow & {
  ctpi_version: typeof CTPI_WRITER_VERSION;
};

type PersistedProvenanceRow = {
  date: string;
  team: string;
  formula_version: string | null;
  input_version: string | null;
  source_cutoff_exclusive: string | null;
  source_fingerprint: string | null;
  source_updated_through: string | null;
};

class CtpiRequestError extends Error {}

const hasTeamIdentity = (team: unknown): team is string =>
  typeof team === "string" && team.length > 0 && team === team.trim();

function latestTimestamp(...values: unknown[]): string | null {
  const parsed = values.flatMap((value) => {
    if (typeof value !== "string" || value.length === 0) return [];
    const time = new Date(value).getTime();
    return Number.isNaN(time) ? [] : [new Date(time).toISOString()];
  });
  return parsed.sort().at(-1) ?? null;
}

async function fetchGameRows(
  seasonId: number,
): Promise<RecentTeamFormSourceRow[]> {
  const baseSelect = [
    "team_abbreviation",
    "date",
    "gp",
    "xgf_per_60",
    "hdcf_per_60",
    "gf_per_60",
    "xga_per_60",
    "hdca_per_60",
    "ca_per_60",
    "cf_pct",
    "pdo",
    "updated_at",
  ].join(",");

  const [asRows, ppRows, pkRows, asCountRows] = await Promise.all([
    fetchPaginatedRows<any>(
      () =>
        supabase
          .from(AS_RATES_TABLE)
          .select(baseSelect)
          .eq("season_id", seasonId)
          .eq("gp", 1),
      ["date", "team_abbreviation"],
    ),
    fetchPaginatedRows<any>(
      () =>
        supabase
          .from(PP_COUNTS_TABLE)
          .select(
            ["team_abbreviation", "date", "gp", "xgf", "toi_seconds", "updated_at"].join(","),
          )
          .eq("season_id", seasonId)
          .eq("gp", 1),
      ["date", "team_abbreviation"],
    ),
    fetchPaginatedRows<any>(
      () =>
        supabase
          .from(PK_COUNTS_TABLE)
          .select(
            ["team_abbreviation", "date", "gp", "xga", "toi_seconds", "updated_at"].join(","),
          )
          .eq("season_id", seasonId)
          .eq("gp", 1),
      ["date", "team_abbreviation"],
    ),
    fetchPaginatedRows<any>(
      () =>
        supabase
          .from(AS_COUNTS_TABLE)
          .select(
            ["team_abbreviation", "date", "gp", "toi_seconds", "ga", "xga", "updated_at"].join(","),
          )
          .eq("season_id", seasonId)
          .eq("gp", 1),
      ["date", "team_abbreviation"],
    ),
  ]);

  const byKey = (rows: any[]) =>
    new Map<string, any>(
      (rows ?? []).map((row) => [`${row.team_abbreviation}|${row.date}`, row]),
    );
  const ppMap = byKey(ppRows);
  const pkMap = byKey(pkRows);
  const asCountMap = byKey(asCountRows);

  return (asRows ?? [])
    .filter((row: any) => hasTeamIdentity(row.team_abbreviation))
    .map((row: any): RecentTeamFormSourceRow => {
      const key = `${row.team_abbreviation}|${row.date}`;
      const pp = ppMap.get(key);
      const pk = pkMap.get(key);
      const asCount = asCountMap.get(key);
      return {
        team: row.team_abbreviation,
        date: row.date,
        gp: row.gp,
        xgf_per_60: row.xgf_per_60,
        hdcf_per_60: row.hdcf_per_60,
        gf_per_60: row.gf_per_60,
        xga_per_60: row.xga_per_60,
        hdca_per_60: row.hdca_per_60,
        ca_per_60: row.ca_per_60,
        sat_pct: row.cf_pct,
        // GSAx inputs come from the all-strength count table (goals and xG in goals).
        goals_against: asCount?.ga ?? null,
        xga: asCount?.xga ?? null,
        powerPlayToi: pp?.toi_seconds ?? null,
        pp_xgf: pp?.xgf ?? null,
        toi_shorthanded: pk?.toi_seconds ?? null,
        pk_xga: pk?.xga ?? null,
        pdo: row.pdo != null ? Number(row.pdo) : null,
        toi_all_seconds: asCount?.toi_seconds ?? null,
        sourceUpdatedAt: latestTimestamp(
          row.updated_at,
          asCount?.updated_at,
          pp?.updated_at,
          pk?.updated_at,
        ),
      };
    });
}

const addDays = (date: string, days: number) => {
  const next = new Date(`${date}T00:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
};

const buildDateRange = (start: string, end: string) => {
  const dates: string[] = [];
  for (let date = start; date <= end; date = addDays(date, 1)) {
    dates.push(date);
  }
  return dates;
};

const isCalendarDate = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(new Date(`${value}T00:00:00.000Z`).getTime()) &&
  new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;

function dateParam(value: unknown, name: string): string | undefined {
  if (value == null) return undefined;
  const raw = String(Array.isArray(value) ? value[0] : value).slice(0, 10);
  if (!isCalendarDate(raw)) {
    throw new CtpiRequestError(`${name} must be a YYYY-MM-DD date.`);
  }
  return raw;
}

/** Latest snapshot date already issued for the writer's version this season. */
async function latestWriterDate(seasonId: number): Promise<string | null> {
  const { data, error } = await supabase
    .from(DEST_TABLE)
    .select("date")
    .eq("season_id", seasonId)
    .eq("ctpi_version", CTPI_WRITER_VERSION)
    .order("date", { ascending: false })
    .limit(1);
  if (error) throw error;
  const lastDate = data?.[0]?.date as string | undefined;
  return lastDate ? lastDate.slice(0, 10) : null;
}

async function fetchPersistedProvenance(
  seasonId: number,
  startDate: string,
  endDate: string,
): Promise<PersistedRecentTeamFormSnapshotProvenance[]> {
  const rows = await fetchPaginatedRows<PersistedProvenanceRow>(
    () =>
      supabase
        .from(DEST_TABLE)
        .select(
          [
            "date",
            "team",
            "formula_version:payload->>formulaVersion",
            "input_version:payload->>inputVersion",
            "source_cutoff_exclusive:payload->>sourceCutoffExclusive",
            "source_fingerprint:payload->>sourceFingerprint",
            "source_updated_through:payload->>sourceUpdatedThrough",
          ].join(","),
        )
        .eq("season_id", seasonId)
        .eq("ctpi_version", CTPI_WRITER_VERSION)
        .gte("date", startDate)
        .lte("date", endDate),
    ["date", "team"],
  );
  return rows.map((row) => ({
    date: String(row.date).slice(0, 10),
    formulaVersion: row.formula_version,
    inputVersion: row.input_version,
    sourceCutoffExclusive: row.source_cutoff_exclusive,
    sourceFingerprint: row.source_fingerprint,
    sourceUpdatedThrough: row.source_updated_through,
  }));
}

async function upsertRows(rows: CtpiRow[]) {
  const identities = new Set<string>();
  for (const row of rows) {
    if (!hasTeamIdentity(row.team)) {
      throw new Error("Invalid CTPI destination identity");
    }
    if (
      row.ctpi_version !== CTPI_WRITER_VERSION ||
      row.payload.formulaVersion !== WRITER_CONTRACT.formulaVersion ||
      row.payload.inputVersion !== WRITER_CONTRACT.inputVersion
    ) {
      throw new Error("CTPI row is not the writer's version contract");
    }
    const identity = JSON.stringify([
      row.season_id,
      row.team,
      row.date,
      row.ctpi_version,
    ]);
    if (identities.has(identity)) {
      throw new Error("Duplicate CTPI destination identity");
    }
    identities.add(identity);
  }
  const chunkSize = 500;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const slice = rows.slice(i, i + chunkSize);
    const { error } = await supabase
      .from(DEST_TABLE)
      .upsert(slice, { onConflict: DEST_CONFLICT_TARGET });
    if (error) throw error;
  }
}

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const startParam = dateParam(req.query.start, "start");
    const endParam = dateParam(req.query.end, "end");
    const season = await fetchCurrentSeason();
    const seasonId = season.id;
    const seasonStart = season.startDate.slice(0, 10);
    const todayIso = new Date().toISOString().slice(0, 10);
    const seasonEnd = (
      season.endDate ||
      season.regularSeasonEndDate ||
      todayIso
    ).slice(0, 10);
    const lastAllowed = seasonEnd > todayIso ? todayIso : seasonEnd;
    const endDate =
      endParam && endParam < lastAllowed ? endParam : lastAllowed;
    const warnings: string[] = [];

    let startCandidate: string;
    if (startParam) {
      startCandidate = startParam;
    } else {
      // Re-check the latest issued date (late source rows), then continue to
      // today. A first run issues today only; history is an explicit backfill.
      const lastDate = await latestWriterDate(seasonId);
      startCandidate = lastDate && lastDate < endDate ? lastDate : endDate;
      const earliestAutomatic = addDays(endDate, -(CTPI_MAX_DATES_PER_RUN - 1));
      if (startCandidate < earliestAutomatic) {
        warnings.push(
          `CTPI v${CTPI_WRITER_VERSION} gap: dates ${addDays(startCandidate, 1)} to ${addDays(earliestAutomatic, -1)} were not computed; backfill them with start/end.`,
        );
        startCandidate = earliestAutomatic;
      }
    }
    const startDate =
      startCandidate < seasonStart ? seasonStart : startCandidate;

    if (startDate > endDate) {
      return res.status(200).json({
        message: "No dates to process (start is after today/season end).",
        success: true,
        skipped: true,
        outcome: "skipped",
        reason: "no_dates",
        ctpiVersion: CTPI_WRITER_VERSION,
        startDate,
        endDate,
        rowsUpserted: 0,
        datesComputed: 0,
      });
    }

    const dates = buildDateRange(startDate, endDate);
    if (dates.length > CTPI_MAX_DATES_PER_RUN) {
      return res.status(400).json({
        message: `Requested ${dates.length} dates; one run computes at most ${CTPI_MAX_DATES_PER_RUN}. Backfill in start/end chunks.`,
        error: "CTPI_DATE_SPAN_TOO_LARGE",
        startDate,
        endDate,
      });
    }

    const allRows = await fetchGameRows(seasonId);
    if (allRows.length === 0) {
      // Off-season runs are skipped upstream, so an empty pass here means the
      // NST team source has nothing for this season: not a refresh.
      const warning = `No CTPI rows for season ${seasonId} (${startDate} to ${endDate}): 0 NST team-game rows found.`;
      return res.status(200).json({
        message: `Skipped: ${warning}`,
        success: true,
        skipped: true,
        outcome: "skipped",
        reason: "no_source_rows",
        warnings: [...warnings, warning],
        ctpiVersion: CTPI_WRITER_VERSION,
        seasonId,
        datesComputed: dates.length,
        rowsUpserted: 0,
        sourceRows: 0,
        startDate,
        endDate,
      });
    }

    const persisted = await fetchPersistedProvenance(
      seasonId,
      startDate,
      endDate,
    );
    const plan = planRecentTeamFormCandidateReplay({
      sourceRows: allRows,
      consumerDates: dates,
      persisted,
    });

    const computedAt = new Date().toISOString();
    const insertRows: CtpiRow[] = [];
    let omittedRows = 0;
    for (const decision of plan.replay) {
      const materialized = materializeRecentTeamFormCandidateSnapshot({
        snapshot: decision.snapshot,
        seasonId,
        computedAt,
      });
      omittedRows += materialized.omitted.length;
      materialized.rows.forEach((row) =>
        insertRows.push({ ...row, ctpi_version: CTPI_WRITER_VERSION }),
      );
    }

    const summary = {
      ctpiVersion: CTPI_WRITER_VERSION,
      formulaVersion: WRITER_CONTRACT.formulaVersion,
      inputVersion: WRITER_CONTRACT.inputVersion,
      publicationStatus: RECENT_TEAM_FORM_V2_CANDIDATE_PUBLICATION_STATUS,
      label: WRITER_CONTRACT.label,
      seasonId,
      datesComputed: dates.length,
      datesReplayed: plan.replay.map((decision) => ({
        date: decision.date,
        reasons: decision.reasons,
      })),
      unchangedDates: plan.unchangedDates,
      omittedRows,
      sourceRows: allRows.length,
      startDate,
      endDate,
    };

    if (plan.replay.length > 0 && insertRows.length === 0) {
      const warning = `No team has a scorable CTPI v${CTPI_WRITER_VERSION} snapshot between ${startDate} and ${endDate} (${omittedRows} team-dates unavailable, e.g. fewer than 5 games).`;
      return res.status(200).json({
        message: `Skipped: ${warning}`,
        success: true,
        skipped: true,
        outcome: "skipped",
        reason: "no_scorable_teams",
        warnings: [...warnings, warning],
        rowsUpserted: 0,
        ...summary,
      });
    }

    await upsertRows(insertRows);

    return res.status(200).json({
      message:
        insertRows.length > 0
          ? "CTPI daily processed"
          : "CTPI daily unchanged",
      rowsUpserted: insertRows.length,
      ...(warnings.length > 0 ? { warnings } : {}),
      ...summary,
    });
  } catch (error: any) {
    if (error instanceof CtpiRequestError) {
      return res.status(400).json({
        message: error.message,
        error: "CTPI_INVALID_REQUEST",
      });
    }
    console.error("update-team-ctpi-daily error", error);
    return res.status(500).json({
      message: "Failed to compute daily CTPI.",
      error: error?.message ?? "Unknown error",
    });
  }
};

export default adminOnly(withCronJobAudit(withNhlOffSeasonSkip(handler as any), {
  jobName: "/api/v1/db/update-team-ctpi-daily",
}));
