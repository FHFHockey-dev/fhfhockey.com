import type { NextApiRequest, NextApiResponse } from "next";

import {
  NHLSCRAPER_CONTRACTS_PACKAGE_VERSION,
  NHLSCRAPER_CONTRACTS_ROW_COUNT,
  buildNhlscraperContractRows,
  chunkRows,
  fetchContractPlayerRows,
  getNhlscraperContractSourceRows,
  type NhlPlayerContractDbRow,
} from "lib/NHL/nhlscraperContracts";
import { withCronJobAudit } from "lib/cron/withCronJobAudit";
import adminOnly from "utils/adminOnlyMiddleware";

const DEFAULT_BATCH_SIZE = 100;
const MAX_BATCH_SIZE = 500;

type QueryValue = string | string[] | undefined;

function firstQueryValue(value: QueryValue): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function parseBoolean(value: QueryValue, fallback = false): boolean {
  const raw = firstQueryValue(value);
  if (raw == null) return fallback;
  return ["1", "true", "yes", "y"].includes(raw.toLowerCase());
}

function parseOptionalInteger(value: QueryValue): number | null {
  const parsed = Number.parseInt(firstQueryValue(value) ?? "", 10);
  return Number.isInteger(parsed) ? parsed : null;
}

function parseBatchSize(value: QueryValue): number {
  const parsed = parseOptionalInteger(value) ?? DEFAULT_BATCH_SIZE;
  return Math.min(Math.max(parsed, 1), MAX_BATCH_SIZE);
}

function summarizeRows(rows: NhlPlayerContractDbRow[]) {
  const byResolutionStatus = rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.resolution_status] = (acc[row.resolution_status] ?? 0) + 1;
    return acc;
  }, {});

  const seasonIds = rows.flatMap((row) => [
    row.start_season_id,
    row.end_season_id,
  ]);

  return {
    rows: rows.length,
    matchedRows: byResolutionStatus.matched ?? 0,
    unmatchedRows: byResolutionStatus.unmatched ?? 0,
    ambiguousRows: byResolutionStatus.ambiguous ?? 0,
    notAttemptedRows: byResolutionStatus.not_attempted ?? 0,
    byResolutionStatus,
    minSeasonId: seasonIds.length ? Math.min(...seasonIds) : null,
    maxSeasonId: seasonIds.length ? Math.max(...seasonIds) : null,
  };
}

async function upsertContractRows(args: {
  supabase: any;
  rows: NhlPlayerContractDbRow[];
  batchSize: number;
}) {
  let rowsUpserted = 0;

  for (const batch of chunkRows(args.rows, args.batchSize)) {
    const { error } = await args.supabase
      .from("nhl_player_contracts")
      .upsert(batch as any, { onConflict: "contract_key" });

    if (error) {
      throw new Error(`Failed to upsert nhlscraper contract rows: ${error.message}`);
    }

    rowsUpserted += batch.length;
  }

  return rowsUpserted;
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).json({ success: false, error: "Method not allowed." });
  }

  const supabase = (req as any).supabase;
  const dryRun = parseBoolean(req.query.dryRun);
  const resolvePlayers = parseBoolean(req.query.resolvePlayers, true);
  const batchSize = parseBatchSize(req.query.batchSize);
  const limit = parseOptionalInteger(req.query.limit);
  const offset = Math.max(parseOptionalInteger(req.query.offset) ?? 0, 0);

  try {
    const sourceRows = getNhlscraperContractSourceRows();
    const selectedSourceRows =
      limit != null
        ? sourceRows.slice(offset, offset + Math.max(limit, 0))
        : sourceRows.slice(offset);

    const players = resolvePlayers
      ? await fetchContractPlayerRows(supabase)
      : [];

    const rows = buildNhlscraperContractRows({
      sourceRows: selectedSourceRows,
      players,
      resolvePlayers,
    });

    const summary = summarizeRows(rows);

    if (dryRun) {
      return res.status(200).json({
        success: true,
        dryRun,
        source: "nhlscraper",
        sourcePackageVersion: NHLSCRAPER_CONTRACTS_PACKAGE_VERSION,
        sourceRowsAvailable: NHLSCRAPER_CONTRACTS_ROW_COUNT,
        offset,
        limit,
        resolvePlayers,
        playerRowsLoaded: players.length,
        summary,
        samples: rows.slice(0, 5).map((row) => ({
          contractKey: row.contract_key,
          playerId: row.player_id,
          playerFullName: row.player_full_name,
          startSeasonId: row.start_season_id,
          endSeasonId: row.end_season_id,
          contractYears: row.contract_years,
          contractValue: row.contract_value,
          contractAav: row.contract_aav,
          signingBonus: row.signing_bonus,
          twoYearCash: row.two_year_cash,
          threeYearCash: row.three_year_cash,
          resolutionStatus: row.resolution_status,
        })),
      });
    }

    const rowsUpserted = await upsertContractRows({
      supabase,
      rows,
      batchSize,
    });

    return res.status(200).json({
      success: true,
      dryRun,
      source: "nhlscraper",
      sourcePackageVersion: NHLSCRAPER_CONTRACTS_PACKAGE_VERSION,
      sourceRowsAvailable: NHLSCRAPER_CONTRACTS_ROW_COUNT,
      offset,
      limit,
      batchSize,
      resolvePlayers,
      playerRowsLoaded: players.length,
      rowsUpserted,
      summary,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({
      success: false,
      error: message,
    });
  }
}

export default withCronJobAudit(adminOnly(handler as any), {
  jobName: "update-nhlscraper-contracts",
});
