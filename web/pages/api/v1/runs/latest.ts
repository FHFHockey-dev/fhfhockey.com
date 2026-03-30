import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";

import { buildEndpointScanSummary } from "lib/api/scanSummary";
import supabase from "lib/supabase/server";
import { formatDurationMsToMMSS } from "lib/formatDurationMmSs";

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
      .limit(1);

    if (parsed.data.date) query = query.eq("as_of_date", parsed.data.date);

    const { data, error } = await query.maybeSingle();
    if (error) throw error;

    if (!data) {
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
    const record = data as Record<string, unknown>;
    const metrics =
      record.metrics && typeof record.metrics === "object"
        ? (record.metrics as Record<string, unknown>)
        : {};
    const runStatus = typeof record.status === "string" ? record.status : null;
    return res.status(200).json({
      durationMs: formatDurationMsToMMSS(Date.now() - startedAt),
      scanSummary: buildEndpointScanSummary({
        surface: "latest_run_reader",
        requestedDate: parsed.data.date ?? null,
        activeDataDate:
          typeof record.as_of_date === "string" ? record.as_of_date : null,
        fallbackApplied: false,
        status:
          runStatus === "succeeded"
            ? "ready"
            : runStatus === "failed"
              ? "blocked"
              : "partial",
        rowCounts: {
          gamesProcessed: readMetricNumber(metrics, ["games", "games_processed"]),
          playerRowsUpserted: readMetricNumber(metrics, ["player_rows"]),
          teamRowsUpserted: readMetricNumber(metrics, ["team_rows"]),
          goalieRowsUpserted: readMetricNumber(metrics, ["goalie_rows"])
        },
        blockingIssueCount: runStatus === "failed" ? 1 : 0,
        notes: [
          runStatus === "failed" ? "Latest matching run is not in succeeded status." : null
        ]
      }),
      data
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
