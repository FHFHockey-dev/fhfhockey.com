import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { NextApiRequest, NextApiResponse } from "next";

import supabase from "lib/supabase";
import type { Database } from "lib/supabase/database-generated.types";
import {
  getSustainabilityLeaderboardPayload,
  type SustainabilityLeaderboardOptions
} from "lib/sustainability/read";
import { SUSTAINABILITY_SCORE_WINDOW_CODES } from "lib/sustainability/runtimeContract";
import adminOnly from "utils/adminOnlyMiddleware";

type AuthorizedRequest = NextApiRequest & {
  supabase?: SupabaseClient<Database>;
};

function first(value: string | string[] | undefined): string | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function parseInteger(value: string | null, fallback: number) {
  if (value == null || value === "") return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

function parseBoolean(value: string | null, fallback: boolean) {
  if (value == null || value === "") return fallback;
  if (["1", "true", "yes"].includes(value.toLowerCase())) return true;
  if (["0", "false", "no"].includes(value.toLowerCase())) return false;
  return null;
}

export function parseLeaderboardOptions(
  query: NextApiRequest["query"]
): SustainabilityLeaderboardOptions | null {
  const windowCode = first(query.window_type) ?? "l10";
  const minGames = parseInteger(first(query.min_games), 0);
  const minScore = Number(first(query.min_score) ?? 0);
  const rookieOnly = parseBoolean(first(query.rookie_only), false);
  const page = parseInteger(first(query.page), 1);
  const pageSize = parseInteger(first(query.page_size), 50);
  const include = first(query.include);
  if (
    !SUSTAINABILITY_SCORE_WINDOW_CODES.includes(windowCode as any) ||
    minGames == null ||
    minGames < 0 ||
    !Number.isFinite(minScore) ||
    minScore < 0 ||
    minScore > 100 ||
    rookieOnly == null ||
    page == null ||
    page < 1 ||
    pageSize == null ||
    pageSize < 1 ||
    pageSize > 100 ||
    (include != null && include !== "components")
  ) {
    return null;
  }
  return {
    windowCode: windowCode as SustainabilityLeaderboardOptions["windowCode"],
    minGames,
    minScore,
    rookieOnly,
    page,
    pageSize,
    includeComponents: include === "components"
  };
}

export function buildLeaderboardEtag(payload: unknown) {
  const digest = createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("base64url");
  return `"${digest}"`;
}

async function handleLeaderboard(
  req: AuthorizedRequest,
  res: NextApiResponse
) {
  const options = parseLeaderboardOptions(req.query);
  if (!options) {
    return res.status(400).json({
      success: false,
      message: "Invalid leaderboard filters or pagination"
    });
  }

  try {
    const payload = await getSustainabilityLeaderboardPayload({
      client: req.supabase ?? supabase,
      options
    });
    if (!payload) {
      return res.status(404).json({
        success: false,
        message: "No sustainability snapshot found"
      });
    }
    const body = { success: true, ...payload };
    const etag = buildLeaderboardEtag(body);
    res.setHeader("ETag", etag);
    res.setHeader(
      "Cache-Control",
      options.includeComponents
        ? "private, no-store"
        : "public, max-age=60, s-maxage=300, stale-while-revalidate=600"
    );
    if (first(req.headers["if-none-match"]) === etag) {
      return res.status(304).end();
    }
    return res.status(200).json(body);
  } catch {
    return res.status(500).json({
      success: false,
      message: "Unable to load sustainability leaderboard"
    });
  }
}

const handleAuthorizedComponents = adminOnly(handleLeaderboard as any);

export default async function handler(
  req: AuthorizedRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({
      success: false,
      message: "Method not allowed"
    });
  }
  if (first(req.query.include) === "components") {
    return handleAuthorizedComponents(req as any, res);
  }
  return handleLeaderboard(req, res);
}
