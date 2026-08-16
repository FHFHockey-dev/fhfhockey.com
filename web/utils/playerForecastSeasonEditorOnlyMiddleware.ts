import type { SupabaseClient } from "@supabase/supabase-js";
import type { NextApiRequest, NextApiResponse } from "next";

import { playerForecastRuntimeBoundary } from "lib/player-forecasts/runtimeSafety";
import { createClientWithToken } from "lib/supabase";
import type { Database } from "lib/supabase/database-generated.types";
import { getServiceRoleClient } from "lib/supabase/server";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type PlayerForecastSeasonEditorRequest = NextApiRequest & {
  supabase: SupabaseClient<Database>;
  editorUserId: string;
};

type Handler = (
  req: PlayerForecastSeasonEditorRequest,
  res: NextApiResponse,
) => Promise<unknown>;

export function playerForecastEditorUserIds(
  environment: Record<string, string | undefined> = process.env,
): string[] {
  return Array.from(
    new Set(
      (environment.PLAYER_FORECAST_EDITOR_USER_IDS ?? "")
        .split(",")
        .map((value) => value.trim().toLowerCase())
        .filter((value) => UUID_PATTERN.test(value)),
    ),
  );
}

export function playerForecastEditorConfiguration(
  environment: Record<string, string | undefined> = process.env,
): { valid: boolean; userIds: string[] } {
  const userIds = playerForecastEditorUserIds(environment);
  return {
    valid: environment.NODE_ENV === "production" ? userIds.length === 1 : userIds.length > 0,
    userIds,
  };
}

export default function playerForecastSeasonEditorOnly(handler: Handler): Handler {
  return async (req, res) => {
    const boundary = playerForecastRuntimeBoundary();
    if (!boundary.allowed) {
      return res.status(503).json({
        success: false,
        code: "PLAYER_FORECAST_LOCAL_DATABASE_REQUIRED",
        message: boundary.message,
      });
    }
    const configuration = playerForecastEditorConfiguration();
    if (!configuration.valid) {
      return res.status(503).json({
        success: false,
        code: "PLAYER_FORECAST_EDITOR_CONFIGURATION_INVALID",
        message: "Projection editing is unavailable until the sole-editor allowlist is configured.",
      });
    }

    const bearerMatch = (req.headers.authorization ?? "").match(/^Bearer ([^\s]+)$/);
    if (!bearerMatch) {
      return res.status(401).json({ success: false, message: "Unauthorized." });
    }
    const authClient = createClientWithToken(bearerMatch[1]);
    const { data: authData, error: authError } = await authClient.auth.getUser();
    const userId = authData.user?.id?.toLowerCase();
    if (authError || !userId) {
      return res.status(401).json({ success: false, message: "Unauthorized." });
    }
    if (!configuration.userIds.includes(userId)) {
      return res.status(403).json({
        success: false,
        message: "This account is not the projection editor.",
      });
    }

    const serviceClient = getServiceRoleClient();
    const { data: profile, error: profileError } = await serviceClient
      .from("users")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();
    if (profileError) {
      return res.status(503).json({
        success: false,
        message: "Projection editor authorization could not be verified.",
      });
    }
    if (profile?.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Projection editing requires the admin role.",
      });
    }

    req.supabase = serviceClient;
    req.editorUserId = userId;
    return handler(req, res);
  };
}
