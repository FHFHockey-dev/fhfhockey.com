import type { NextApiResponse } from "next";
import type { SupabaseClient } from "@supabase/supabase-js";

import { withCronJobAudit } from "lib/cron/withCronJobAudit";
import {
  buildPlayerImpactRatings,
  uniqueSnapshotDatesFromSources,
  type PlayerImpactRatingRow,
  type PlayerImpactSourceRow,
} from "lib/ratings/playerImpactRatings";
import type { Database } from "lib/supabase/database-generated.types";
import adminOnly from "utils/adminOnlyMiddleware";

type RequestWithSupabase = {
  method?: string;
  query: {
    seasonId?: string | string[];
    snapshotDate?: string | string[];
    startDate?: string | string[];
    endDate?: string | string[];
    dryRun?: string | string[];
    limitSnapshots?: string | string[];
  };
  supabase: SupabaseClient<Database>;
};

const SKATER_SELECT = [
  "player_id",
  "player_name",
  "team_id",
  "position_code",
  "season_id",
  "date",
  "games_played",
  "nst_toi",
  "toi_per_game",
  "nst_points_per_60",
  "nst_goals_per_60",
  "nst_first_assists_per_60",
  "nst_ixg_per_60",
  "nst_icf_per_60",
  "nst_shots_per_60",
  "nst_oi_xgf_per_60",
  "nst_oi_xga_per_60",
  "nst_oi_ca_per_60",
  "nst_oi_sca_per_60",
  "nst_oi_xgf_pct",
  "nst_oi_xgf_pct_rates",
  "nst_oi_cf_pct",
  "nst_oi_cf_pct_rates",
  "nst_shots_blocked_per_60",
  "nst_takeaways_per_60",
  "nst_giveaways_per_60",
  "nst_oi_def_zone_starts_per_60",
].join(",");

const GOALIE_SELECT = [
  "player_id",
  "player_name",
  "team_id",
  "season_id",
  "date",
  "games_played",
  "games_started",
  "time_on_ice",
  "save_pct",
  "saves",
  "shots_against",
  "goals_against",
  "quality_starts_pct",
  "nst_all_rates_gsaa_per_60",
  "nst_5v5_rates_gsaa_per_60",
  "nst_all_counts_gsaa",
  "nst_5v5_counts_gsaa",
].join(",");

function readSingleQueryValue(
  value: string | string[] | undefined,
): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function readInteger(value: string | string[] | undefined): number | undefined {
  const raw = readSingleQueryValue(value);
  if (!raw) return undefined;
  const parsed = Number(raw);
  return Number.isInteger(parsed) ? parsed : undefined;
}

function readBoolean(
  value: string | string[] | undefined,
): boolean | undefined {
  const raw = readSingleQueryValue(value);
  if (raw == null) return undefined;
  if (["1", "true", "yes"].includes(raw.toLowerCase())) return true;
  if (["0", "false", "no"].includes(raw.toLowerCase())) return false;
  return undefined;
}

function readDateParam(
  value: string | string[] | undefined,
): string | undefined {
  const raw = readSingleQueryValue(value);
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return undefined;
  return raw;
}

async function fetchAllRows(
  client: SupabaseClient<Database>,
  args: {
    table: "player_stats_unified" | "vw_goalie_stats_unified";
    select: string;
    seasonId: number;
    endDate: string;
  },
): Promise<PlayerImpactSourceRow[]> {
  const pageSize = 1000;
  const rows: PlayerImpactSourceRow[] = [];

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await client
      .from(args.table)
      .select(args.select)
      .eq("season_id", args.seasonId)
      .lte("date", args.endDate)
      .order("date", { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) {
      throw new Error(`Failed to fetch ${args.table}: ${error.message}`);
    }

    const page = ((data ?? []) as unknown) as PlayerImpactSourceRow[];
    rows.push(...page);
    if (page.length < pageSize) break;
  }

  return rows;
}

async function upsertRatingRows(
  client: SupabaseClient<Database>,
  table:
    | "skater_offensive_ratings_daily"
    | "skater_defensive_ratings_daily"
    | "goalie_ratings_daily",
  rows: PlayerImpactRatingRow[],
) {
  const chunkSize = 500;
  let rowsUpserted = 0;

  for (let index = 0; index < rows.length; index += chunkSize) {
    const chunk = rows.slice(index, index + chunkSize);
    const { error } = await client
      .from(table as any)
      .upsert(chunk as any, {
        onConflict: "snapshot_date,player_id,model_name,model_version",
      });

    if (error) {
      throw new Error(`Failed to upsert ${table}: ${error.message}`);
    }
    rowsUpserted += chunk.length;
  }

  return rowsUpserted;
}

async function handler(req: RequestWithSupabase, res: NextApiResponse) {
  if (req.method !== "POST" && req.method !== "GET") {
    res.setHeader("Allow", "GET, POST");
    return res
      .status(405)
      .json({ success: false, error: "Method not allowed" });
  }

  const seasonId = readInteger(req.query.seasonId);
  if (!seasonId) {
    return res.status(400).json({
      success: false,
      error: "A numeric seasonId query parameter is required.",
    });
  }

  const snapshotDate = readDateParam(req.query.snapshotDate);
  const startDate =
    snapshotDate ?? readDateParam(req.query.startDate) ?? `${String(seasonId).slice(0, 4)}-10-01`;
  const endDate =
    snapshotDate ?? readDateParam(req.query.endDate) ?? new Date().toISOString().slice(0, 10);
  const dryRun = readBoolean(req.query.dryRun) ?? true;
  const limitSnapshots = readInteger(req.query.limitSnapshots);

  if (startDate > endDate) {
    return res.status(400).json({
      success: false,
      error: "startDate must be before or equal to endDate.",
    });
  }

  const [skaterRows, goalieRows] = await Promise.all([
    fetchAllRows(req.supabase, {
      table: "player_stats_unified",
      select: SKATER_SELECT,
      seasonId,
      endDate,
    }),
    fetchAllRows(req.supabase, {
      table: "vw_goalie_stats_unified",
      select: GOALIE_SELECT,
      seasonId,
      endDate,
    }),
  ]);

  let snapshotDates = snapshotDate
    ? [snapshotDate]
    : uniqueSnapshotDatesFromSources(
        [...skaterRows, ...goalieRows],
        startDate,
        endDate,
      );
  if (limitSnapshots && limitSnapshots > 0) {
    snapshotDates = snapshotDates.slice(0, limitSnapshots);
  }

  let skaterOffenseRows = 0;
  let skaterDefenseRows = 0;
  let goalieRatingRows = 0;
  const sampleSnapshots = [];

  for (const date of snapshotDates) {
    const built = buildPlayerImpactRatings({
      seasonId,
      snapshotDate: date,
      skaterRows,
      goalieRows,
    });

    skaterOffenseRows += built.skaterOffenseRows.length;
    skaterDefenseRows += built.skaterDefenseRows.length;
    goalieRatingRows += built.goalieRows.length;

    if (sampleSnapshots.length < 3) {
      sampleSnapshots.push({
        snapshotDate: date,
        skaterOffenseRows: built.skaterOffenseRows.length,
        skaterDefenseRows: built.skaterDefenseRows.length,
        goalieRows: built.goalieRows.length,
        topSkaterOffense: built.skaterOffenseRows[0] ?? null,
        topSkaterDefense: built.skaterDefenseRows[0] ?? null,
        topGoalie: built.goalieRows[0] ?? null,
      });
    }

    if (!dryRun) {
      await upsertRatingRows(
        req.supabase,
        "skater_offensive_ratings_daily",
        built.skaterOffenseRows,
      );
      await upsertRatingRows(
        req.supabase,
        "skater_defensive_ratings_daily",
        built.skaterDefenseRows,
      );
      await upsertRatingRows(
        req.supabase,
        "goalie_ratings_daily",
        built.goalieRows,
      );
    }
  }

  return res.status(200).json({
    success: true,
    dryRun,
    seasonId,
    startDate,
    endDate,
    snapshotDates: snapshotDates.length,
    sourceRows: {
      skaters: skaterRows.length,
      goalies: goalieRows.length,
    },
    rowsUpserted: dryRun
      ? 0
      : skaterOffenseRows + skaterDefenseRows + goalieRatingRows,
    generatedRows: {
      skaterOffenseRows,
      skaterDefenseRows,
      goalieRatingRows,
    },
    sampleSnapshots,
  });
}

export default withCronJobAudit(adminOnly(handler as any), {
  jobName: "update-player-impact-ratings",
});
