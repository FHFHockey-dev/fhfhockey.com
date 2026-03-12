import type { NextApiRequest, NextApiResponse } from "next";
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

function parseStringParam(
  param: string | string[] | undefined
): string | undefined {
  if (!param) return undefined;
  return Array.isArray(param) ? param[0] : param;
}

function parseNumberParam(
  param: string | string[] | undefined
): number | undefined {
  const value = parseStringParam(param);
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseBooleanParam(
  param: string | string[] | undefined
): boolean | undefined {
  const value = parseStringParam(param);
  if (value == null) return undefined;
  return ["1", "true", "yes", "y"].includes(value.toLowerCase());
}

function parseStrength(
  param: string | string[] | undefined
): RollingPlayerValidationRequest["strength"] {
  const value = parseStringParam(param);
  if (value === "ev" || value === "pp" || value === "pk") return value;
  return "all";
}

function parseRequest(
  req: NextApiRequest
): RollingPlayerValidationRequest | { error: string } {
  const playerId = parseNumberParam(req.query.playerId);
  const season = parseNumberParam(req.query.season);
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
    teamId: parseNumberParam(req.query.teamId),
    gameId: parseNumberParam(req.query.gameId),
    gameDate: parseStringParam(req.query.gameDate),
    startDate: parseStringParam(req.query.startDate),
    endDate: parseStringParam(req.query.endDate),
    metric: parseStringParam(req.query.metric),
    metricFamily: parseStringParam(req.query.metricFamily),
    includeStoredRows: parseBooleanParam(req.query.includeStoredRows),
    includeRecomputedRows: parseBooleanParam(req.query.includeRecomputedRows),
    includeSourceRows: parseBooleanParam(req.query.includeSourceRows),
    includeDiagnostics: parseBooleanParam(req.query.includeDiagnostics)
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
