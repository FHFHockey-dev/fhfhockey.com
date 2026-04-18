import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";

import { buildEndpointScanSummary } from "lib/api/scanSummary";
import supabase from "lib/supabase/server";
import { formatDurationMsToMMSS } from "lib/formatDurationMmSs";
import {
  getRunActivityAgeMs,
  isRunningRunStale,
  RUN_ACTIVE_WINDOW_MS
} from "lib/projections/queries/run-lifecycle-queries";

const querySchema = z.object({
  date: z
    .string()
    .regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/u, "date must be YYYY-MM-DD")
    .optional()
});

function getQueryStringParam(
  value: string | string[] | undefined
): string | undefined {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value[0];
  return undefined;
}

function readMetricNumber(metrics: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = Number(metrics[key]);
    if (Number.isFinite(value)) return value;
  }
  return null;
}

type ForgeRunRow = {
  run_id: string;
  as_of_date: string;
  status: string;
  created_at: string | null;
  updated_at: string | null;
  metrics: Record<string, unknown> | null;
};

function normalizeForgeRunRow(value: unknown): ForgeRunRow | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const runId = typeof row.run_id === "string" ? row.run_id : null;
  const asOfDate = typeof row.as_of_date === "string" ? row.as_of_date : null;
  const status = typeof row.status === "string" ? row.status : null;
  if (!runId || !asOfDate || !status) return null;
  return {
    run_id: runId,
    as_of_date: asOfDate,
    status,
    created_at: typeof row.created_at === "string" ? row.created_at : null,
    updated_at: typeof row.updated_at === "string" ? row.updated_at : null,
    metrics:
      row.metrics && typeof row.metrics === "object"
        ? (row.metrics as Record<string, unknown>)
        : {}
  };
}

function summarizeRowCounts(metrics: Record<string, unknown>) {
  return {
    gamesProcessed: readMetricNumber(metrics, ["games", "games_processed"]),
    playerRowsUpserted: readMetricNumber(metrics, ["player_rows"]),
    teamRowsUpserted: readMetricNumber(metrics, ["team_rows"]),
    goalieRowsUpserted: readMetricNumber(metrics, ["goalie_rows"])
  };
}

function buildRunNotes(args: {
  selected: ForgeRunRow;
  latestObserved: ForgeRunRow;
  staleObservedAgeMs: number | null;
}) {
  const notes: string[] = [];
  if (
    args.latestObserved.run_id !== args.selected.run_id &&
    args.latestObserved.status === "running"
  ) {
    const ageMinutes =
      args.staleObservedAgeMs == null
        ? "unknown"
        : `${Math.max(1, Math.round(args.staleObservedAgeMs / 60_000))}m`;
    notes.push(
      `Ignored stale running row ${args.latestObserved.run_id}; latest actionable run is ${args.selected.run_id}.`
    );
    notes.push(
      `Observed running row exceeded the ${Math.round(RUN_ACTIVE_WINDOW_MS / 60_000)}m active window (${ageMinutes} since last activity).`
    );
  } else if (
    args.latestObserved.run_id !== args.selected.run_id &&
    args.latestObserved.status === "failed"
  ) {
    notes.push(
      `Latest observed run ${args.latestObserved.run_id} failed; using latest succeeded run ${args.selected.run_id} as the actionable state.`
    );
  } else if (args.selected.status === "failed") {
    notes.push("Latest matching run is not in succeeded status.");
  }
  return notes;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const startedAt = Date.now();
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    if (!supabase) throw new Error("Supabase server client not available");

    const parsed = querySchema.safeParse({
      date: getQueryStringParam(req.query.date)
    });
    if (!parsed.success) {
      return res.status(400).json({
        error: "Invalid query parameters",
        details: parsed.error.flatten(),
        scanSummary: buildEndpointScanSummary({
          surface: "latest_run_reader",
          requestedDate: getQueryStringParam(req.query.date) ?? null,
          activeDataDate: null,
          fallbackApplied: false,
          status: "blocked",
          rowCounts: {},
          blockingIssueCount: 1,
          notes: ["Invalid query parameters."]
        })
      });
    }

    let query = supabase
      .from("forge_runs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(10);

    if (parsed.data.date) query = query.eq("as_of_date", parsed.data.date);

    const { data, error } = await query;
    if (error) throw error;

    const rows = Array.isArray(data)
      ? data.map(normalizeForgeRunRow).filter((row): row is ForgeRunRow => Boolean(row))
      : [];

    if (rows.length === 0) {
      return res
        .status(404)
        .json({
          durationMs: formatDurationMsToMMSS(Date.now() - startedAt),
          error: "No runs found",
          scanSummary: buildEndpointScanSummary({
            surface: "latest_run_reader",
            requestedDate: parsed.data.date ?? null,
            activeDataDate: parsed.data.date ?? null,
            fallbackApplied: false,
            status: "empty",
            rowCounts: {},
            blockingIssueCount: 0,
            notes: ["No matching projection runs were found."]
          })
        });
    }
    const latestObserved = rows[0];
    const latestSucceeded = rows.find((row) => row.status === "succeeded") ?? null;
    const staleObservedAgeMs =
      latestObserved.status === "running"
        ? getRunActivityAgeMs(latestObserved, Date.now())
        : null;
    const selected =
      latestSucceeded &&
      ((latestObserved.status === "running" &&
        isRunningRunStale(latestObserved, Date.now(), RUN_ACTIVE_WINDOW_MS)) ||
        latestObserved.status === "failed")
        ? latestSucceeded
        : latestObserved;
    const metrics = selected.metrics ?? {};
    const runStatus = selected.status;
    return res.status(200).json({
      durationMs: formatDurationMsToMMSS(Date.now() - startedAt),
      scanSummary: buildEndpointScanSummary({
        surface: "latest_run_reader",
        requestedDate: parsed.data.date ?? null,
        activeDataDate: selected.as_of_date,
        fallbackApplied: false,
        status:
          runStatus === "succeeded"
            ? "ready"
            : runStatus === "failed"
              ? "blocked"
              : "partial",
        rowCounts: summarizeRowCounts(metrics),
        blockingIssueCount: runStatus === "failed" ? 1 : 0,
        notes: buildRunNotes({
          selected,
          latestObserved,
          staleObservedAgeMs
        })
      }),
      data: selected,
      observedLatestRun:
        latestObserved.run_id !== selected.run_id ? latestObserved : undefined
    });
  } catch (e) {
    return res
      .status(500)
      .json({
        durationMs: formatDurationMsToMMSS(Date.now() - startedAt),
        error: (e as any)?.message ?? String(e),
        scanSummary: buildEndpointScanSummary({
          surface: "latest_run_reader",
          requestedDate: getQueryStringParam(req.query.date) ?? null,
          activeDataDate: getQueryStringParam(req.query.date) ?? null,
          fallbackApplied: false,
          status: "blocked",
          rowCounts: {},
          blockingIssueCount: 1,
          notes: [(e as any)?.message ?? String(e)]
        })
      });
  }
}
