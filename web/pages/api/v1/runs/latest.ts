import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";

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
      return res.status(400).json({ error: "Invalid query parameters", details: parsed.error.flatten() });
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
        .json({ durationMs: formatDurationMsToMMSS(Date.now() - startedAt), error: "No runs found" });
    }
    return res.status(200).json({ durationMs: formatDurationMsToMMSS(Date.now() - startedAt), data });
  } catch (e) {
    return res
      .status(500)
      .json({ durationMs: formatDurationMsToMMSS(Date.now() - startedAt), error: (e as any)?.message ?? String(e) });
  }
}
