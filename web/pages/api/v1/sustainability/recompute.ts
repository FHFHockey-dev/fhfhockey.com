import type { NextApiRequest, NextApiResponse } from "next";

import { withCronJobTiming } from "lib/cron/timingContract";
import { runSustainabilityRecompute } from "lib/sustainability/recompute";
import adminOnly from "utils/adminOnlyMiddleware";

function first(value: string | string[] | undefined): string | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function yesterdayUtc(): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function parseDate(value: string | null): string {
  const date = value?.trim() || yesterdayUtc();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00.000Z`))) {
    throw new Error("date must be a valid YYYY-MM-DD value");
  }
  return date;
}

function parseBoundedInt(value: string | null, fallback: number, min: number, max: number) {
  const parsed = value == null ? fallback : Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

export async function recomputeHandler(req: any, res: NextApiResponse) {
  const started = Date.now();
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json(
      withCronJobTiming({ success: false, message: "Method not allowed" }, started)
    );
  }

  try {
    const snapshotDate = parseDate(first(req.query.date));
    const limit = parseBoundedInt(first(req.query.limit), 25, 1, 50);
    const offset = parseBoundedInt(first(req.query.offset), 0, 0, 100_000);
    const dry = ["1", "true", "yes"].includes(first(req.query.dry)?.toLowerCase() ?? "");
    const result = await runSustainabilityRecompute({
      client: req.supabase,
      snapshotDate,
      offset,
      limit,
      dry
    });
    const status = result.failures.length > 0 ? 207 : 200;
    return res.status(status).json(
      withCronJobTiming(
        {
          success: result.failures.length === 0,
          partial: result.failures.length > 0,
          snapshotDate,
          dry,
          ...result
        },
        started
      )
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = message.startsWith("date must") ? 400 : 500;
    return res.status(status).json(
      withCronJobTiming({ success: false, message }, started)
    );
  }
}

export default adminOnly(recomputeHandler as (req: NextApiRequest, res: NextApiResponse) => Promise<any>);
