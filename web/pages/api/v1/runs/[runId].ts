import type { NextApiRequest, NextApiResponse } from "next";

import { buildEndpointScanSummary } from "lib/api/scanSummary";
import { formatDurationMsToMMSS } from "lib/formatDurationMmSs";
import supabase from "lib/supabase/server";

function firstParam(value: string | string[] | undefined): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (Array.isArray(value) && typeof value[0] === "string" && value[0].trim()) {
    return value[0].trim();
  }
  return null;
}

function metricsObject(value: unknown): Record<string, unknown> {
  return value != null && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

async function countRows(table: string, runId: string): Promise<number | null> {
  const { count, error } = await (supabase as any)
    .from(table)
    .select("run_id", { count: "exact", head: true })
    .eq("run_id", runId);
  if (error) throw error;
  return typeof count === "number" ? count : null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const startedAt = Date.now();
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const runId = firstParam(req.query.runId);
  if (!runId) {
    return res.status(400).json({ error: "runId is required" });
  }

  try {
    if (!supabase) throw new Error("Supabase server client not available");

    const { data: run, error: runError } = await (supabase as any)
      .from("forge_runs")
      .select("*")
      .eq("run_id", runId)
      .maybeSingle();
    if (runError) throw runError;
    if (!run) {
      return res.status(404).json({
        durationMs: formatDurationMsToMMSS(Date.now() - startedAt),
        error: "Run not found",
        scanSummary: buildEndpointScanSummary({
          surface: "projection_run_detail",
          requestedDate: null,
          activeDataDate: null,
          fallbackApplied: false,
          status: "empty",
          rowCounts: {},
          blockingIssueCount: 0,
          notes: [`No forge_runs row found for ${runId}.`]
        })
      });
    }

    const [playerRows, teamRows, goalieRows] = await Promise.all([
      countRows("forge_player_projections", runId),
      countRows("forge_team_projections", runId),
      countRows("forge_goalie_projections", runId)
    ]);
    const metrics = metricsObject(run.metrics);

    return res.status(200).json({
      durationMs: formatDurationMsToMMSS(Date.now() - startedAt),
      data: {
        ...run,
        rowCounts: {
          playerRows,
          teamRows,
          goalieRows
        },
        preflight: metrics.preflight ?? null,
        warnings: Array.isArray(metrics.warnings) ? metrics.warnings : [],
        gates: metrics.gates ?? null
      },
      scanSummary: buildEndpointScanSummary({
        surface: "projection_run_detail",
        requestedDate: run.as_of_date ?? null,
        activeDataDate: run.as_of_date ?? null,
        fallbackApplied: false,
        status: run.status === "succeeded" ? "ready" : "partial",
        rowCounts: {
          playerRows,
          teamRows,
          goalieRows
        },
        blockingIssueCount: run.status === "failed" ? 1 : 0,
        notes: Array.isArray(metrics.warnings)
          ? metrics.warnings.filter((warning: unknown): warning is string => typeof warning === "string")
          : []
      })
    });
  } catch (error: any) {
    return res.status(500).json({
      durationMs: formatDurationMsToMMSS(Date.now() - startedAt),
      error: error?.message ?? String(error)
    });
  }
}
