import type { NextApiRequest, NextApiResponse } from "next";
import {
  parseQueryBoolean,
  parseQueryNumber,
  parseQueryString
} from "lib/api/queryParams";
import {
  buildRollingPlayerValidationPayload,
  type RollingPlayerValidationRequest
} from "lib/supabase/Upserts/rollingPlayerValidationPayload";

type ResponseBody =
  | {
      success: true;
      payload?: Awaited<ReturnType<typeof buildRollingPlayerValidationPayload>>;
      message?: string;
    }
  | {
      success: false;
      error: string;
    };

function parseStrength(
  param: string | string[] | undefined
): RollingPlayerValidationRequest["strength"] {
  const value = parseQueryString(param);
  if (value === "ev" || value === "pp" || value === "pk") return value;
  return "all";
}

function parseRequest(
  req: NextApiRequest
): RollingPlayerValidationRequest | { error: string } {
  const playerId = parseQueryNumber(req.query.playerId);
  const season = parseQueryNumber(req.query.season);
  if (!playerId) {
    return { error: "Missing required query param: playerId" };
  }
  if (!season) {
    return { error: "Missing required query param: season" };
  }

  return {
    playerId,
    season,
    strength: parseStrength(req.query.strength),
    teamId: parseQueryNumber(req.query.teamId),
    gameId: parseQueryNumber(req.query.gameId),
    gameDate: parseQueryString(req.query.gameDate),
    startDate: parseQueryString(req.query.startDate),
    endDate: parseQueryString(req.query.endDate),
    metric: parseQueryString(req.query.metric),
    metricFamily: parseQueryString(req.query.metricFamily),
    includeStoredRows: parseQueryBoolean(req.query.includeStoredRows),
    includeRecomputedRows: parseQueryBoolean(req.query.includeRecomputedRows),
    includeSourceRows: parseQueryBoolean(req.query.includeSourceRows),
    includeDiagnostics: parseQueryBoolean(req.query.includeDiagnostics),
    includeWindowMembership: parseQueryBoolean(
      req.query.includeWindowMembership
    ),
    includeContractMetadata: parseQueryBoolean(
      req.query.includeContractMetadata
    ),
    includeComparisons: parseQueryBoolean(req.query.includeComparisons)
  };
}

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseBody>
) {
  if (req.method === "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    res.status(200).json({
      success: true,
      message: "Rolling player metrics validation endpoint OK."
    });
    return;
  }

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET, HEAD");
    res.status(405).json({
      success: false,
      error: "Method not allowed"
    });
    return;
  }

  const parsed = parseRequest(req);
  if ("error" in parsed) {
    res.status(400).json({
      success: false,
      error: parsed.error
    });
    return;
  }

  try {
    const payload = await buildRollingPlayerValidationPayload(parsed);
    res.status(200).json({
      success: true,
      payload
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
}

export default handler;
