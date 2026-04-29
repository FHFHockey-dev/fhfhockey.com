import type { NextApiRequest, NextApiResponse } from "next";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { fetchAccountabilityDashboard } from "lib/game-predictions/accountability";
import {
  BASELINE_MODEL_NAME,
  BASELINE_MODEL_VERSION,
} from "lib/game-predictions/baselineModel";
import { GAME_PREDICTION_FEATURE_SET_VERSION } from "lib/game-predictions/featureSources";
import type { Database } from "lib/supabase/database-generated.types";

let serverClient: SupabaseClient<Database> | null = null;

function getServerClient(): SupabaseClient<Database> {
  if (serverClient) return serverClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_SERVICE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLIC_KEY;

  if (!url || !key) {
    throw new Error("Supabase credentials missing for accountability API.");
  }

  serverClient = createClient<Database>(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
  return serverClient;
}

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseDate(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? undefined : value.slice(0, 10);
}

function parseLimit(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : undefined;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res
      .status(405)
      .json({ success: false, error: "Method not allowed" });
  }

  try {
    const payload = await fetchAccountabilityDashboard({
      client: getServerClient(),
      modelName: firstParam(req.query.modelName) ?? BASELINE_MODEL_NAME,
      modelVersion:
        firstParam(req.query.modelVersion) ?? BASELINE_MODEL_VERSION,
      featureSetVersion:
        firstParam(req.query.featureSetVersion) ??
        GAME_PREDICTION_FEATURE_SET_VERSION,
      fromDate: parseDate(firstParam(req.query.fromDate ?? req.query.since)),
      toDate: parseDate(firstParam(req.query.toDate ?? req.query.until)),
      limit: parseLimit(firstParam(req.query.limit)),
    });

    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=900");
    return res.status(200).json({ success: true, ...payload });
  } catch (error: any) {
    // eslint-disable-next-line no-console
    console.error(
      "game-predictions accountability error",
      error?.message ?? error,
    );
    return res.status(500).json({
      success: false,
      error: error?.message ?? "Unable to load prediction accountability",
    });
  }
}
