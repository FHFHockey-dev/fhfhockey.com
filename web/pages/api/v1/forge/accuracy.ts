import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";

import supabase from "lib/supabase/server";
import { formatDurationMsToMMSS } from "lib/formatDurationMmSs";
import { dateSchema, getQueryStringParam } from "pages/api/v1/projections/_helpers";

const querySchema = z.object({
  endDate: dateSchema.optional(),
  days: z.coerce.number().int().min(1).max(90).default(30),
  scope: z.enum(["overall", "skater", "goalie"]).default("overall")
});

function parseQuery(req: NextApiRequest) {
  const parsed = querySchema.safeParse({
    endDate: getQueryStringParam(req.query.endDate),
    days: getQueryStringParam(req.query.days),
    scope: getQueryStringParam(req.query.scope)
  });
  if (!parsed.success) {
    const err = new Error("Invalid query parameters");
    (err as any).statusCode = 400;
    (err as any).details = parsed.error.flatten();
    throw err;
  }
  return parsed.data;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const startedAt = Date.now();
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    if (!supabase) throw new Error("Supabase server client not available");
    const q = parseQuery(req);
    const targetDate = q.endDate ?? new Date().toISOString().slice(0, 10);

    const { data, error } = await supabase
      .from("forge_projection_accuracy_daily")
      .select("date,accuracy_avg")
      .eq("scope", q.scope)
      .lte("date", targetDate)
      .order("date", { ascending: false })
      .limit(q.days);

    if (error) throw error;

    const series = (data ?? [])
      .map((row: any) => ({
        date: row.date,
        accuracy: Number.isFinite(row.accuracy_avg)
          ? Number((row.accuracy_avg * 100).toFixed(2))
          : 0
      }))
      .reverse();

    if (series.length === 0 || series.every((s) => s.accuracy === 0)) {
      throw new Error("No valid accuracy data available");
    }

    return res.status(200).json({
      durationMs: formatDurationMsToMMSS(Date.now() - startedAt),
      scope: q.scope,
      endDate: targetDate,
      days: q.days,
      data: series
    });
  } catch (e) {
    const statusCode = (e as any)?.statusCode ?? 500;
    return res.status(statusCode).json({
      durationMs: formatDurationMsToMMSS(Date.now() - startedAt),
      error: (e as any)?.message ?? String(e),
      details: (e as any)?.details
    });
  }
}
