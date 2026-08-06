import type { NextApiResponse } from "next";

import { createClientWithToken } from "lib/supabase";
import { verifyPlayerForecastReviewToken } from "lib/player-forecasts/reviewToken";
import {
  playerForecastErrorMessage,
  playerForecastRuntimeBoundary,
} from "lib/player-forecasts/runtimeSafety";
import serviceRoleClient from "lib/supabase/server";
import playerForecastAdminOnly from "utils/playerForecastAdminOnlyMiddleware";

function stringValue(value: unknown): string | null {
  if (Array.isArray(value)) return typeof value[0] === "string" ? value[0] : null;
  return typeof value === "string" ? value : null;
}

async function resolverIdentity(req: any): Promise<{ id: string | null; email: string | null }> {
  const authorization = String(req.headers.authorization ?? "");
  const token = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";
  if (!token || token === process.env.CRON_SECRET) return { id: null, email: null };
  const { data } = await createClientWithToken(token).auth.getUser(token);
  return { id: data.user?.id ?? null, email: data.user?.email ?? null };
}

async function handleGet(req: any, res: NextApiResponse) {
  const conflictId = stringValue(req.query.conflictId);
  let query = req.supabase
    .from("player_forecast_observation_conflicts")
    .select("*")
    .order("detected_at", { ascending: false })
    .limit(100);
  if (conflictId) query = query.eq("id", conflictId);
  const { data, error } = await query;
  if (error) throw error;
  const conflictIds = (data ?? []).map((conflict: any) => conflict.id);
  const [{ data: members, error: memberError }, { data: resolutions, error: resolutionQueryError }] = conflictIds.length > 0
    ? await Promise.all([
      req.supabase.from("player_forecast_conflict_members").select("*").in("conflict_id", conflictIds),
      req.supabase.from("player_forecast_conflict_resolutions").select("*").in("conflict_id", conflictIds),
    ])
    : [{ data: [], error: null }, { data: [], error: null }];
  if (memberError) throw memberError;
  if (resolutionQueryError) throw resolutionQueryError;
  const hydrated = (data ?? []).map((conflict: any) => ({
    ...conflict,
    player_forecast_conflict_members: (members ?? []).filter((member: any) => member.conflict_id === conflict.id),
    player_forecast_conflict_resolutions: (resolutions ?? []).filter((resolution: any) => resolution.conflict_id === conflict.id),
  }));
  const conflicts = hydrated.filter(
    (conflict: any) =>
      conflictId || (conflict.player_forecast_conflict_resolutions ?? []).length === 0,
  );
  const goalieMemberIds = conflicts.flatMap((conflict: any) =>
    (conflict.player_forecast_conflict_members ?? [])
      .filter((member: any) => member.observation_type === "goalie_start")
      .map((member: any) => member.observation_id),
  );
  let goalieObservations: any[] = [];
  if (goalieMemberIds.length > 0) {
    const { data: rows, error: goalieError } = await req.supabase
      .from("player_forecast_goalie_start_observations")
      .select("id,game_id,team_id,player_id,raw_player_name,observation_status,source_key,source_account,source_url,available_at,raw_status")
      .in("id", goalieMemberIds);
    if (goalieError) throw goalieError;
    goalieObservations = rows ?? [];
  }
  return res.json({ success: true, conflicts, goalieObservations });
}

async function handlePost(req: any, res: NextApiResponse) {
  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body ?? {};
  const conflictId = stringValue(body.conflictId);
  const action = stringValue(body.action);
  if (!conflictId || !action || !["select_observation", "accept_mixture", "dismiss"].includes(action)) {
    return res.status(400).json({ success: false, message: "Invalid conflict resolution." });
  }
  const selectedObservationId = stringValue(body.selectedObservationId);
  const selectedObservationType = stringValue(body.selectedObservationType);
  if (action === "select_observation" && (!selectedObservationId || !selectedObservationType)) {
    return res.status(400).json({ success: false, message: "Select an observation." });
  }
  const { data: conflict, error: conflictError } = await req.supabase
    .from("player_forecast_observation_conflicts")
    .select("id,game_id,team_id,conflict_version")
    .eq("id", conflictId)
    .single();
  if (conflictError) throw conflictError;
  const { data: previousResolutions, error: previousResolutionError } = await req.supabase
    .from("player_forecast_conflict_resolutions")
    .select("resolution_version")
    .eq("conflict_id", conflictId);
  if (previousResolutionError) throw previousResolutionError;
  const identity = req.hasValidReviewToken
    ? { id: null, email: "signed-review-link" }
    : await resolverIdentity(req);
  const priorVersions = (previousResolutions ?? []).map(
    (row: any) => Number(row.resolution_version),
  );
  const resolvedAt = new Date().toISOString();
  const { data: resolution, error: resolutionError } = await req.supabase
    .from("player_forecast_conflict_resolutions")
    .insert({
      conflict_id: conflictId,
      resolution_version: Math.max(0, ...priorVersions) + 1,
      action,
      selected_observation_type: selectedObservationType,
      selected_observation_id: selectedObservationId,
      resolved_by: identity.id,
      resolver_email: identity.email,
      note: stringValue(body.note),
      resolved_at: resolvedAt,
    })
    .select("*")
    .single();
  if (resolutionError) throw resolutionError;
  if (conflict.game_id != null && conflict.team_id != null) {
    const { error: queueError } = await req.supabase.rpc("enqueue_player_forecast_job", {
      p_scope_key: `game:${conflict.game_id}:team:${conflict.team_id}`,
      p_game_id: conflict.game_id,
      p_team_id: conflict.team_id,
      p_team_game_horizon: null,
      p_reason: "conflict_resolution",
      p_observed_at: resolvedAt,
      p_not_before: resolvedAt,
      p_metadata: { conflictId, resolutionId: resolution.id },
    });
    if (queueError) throw queueError;
  }
  return res.json({ success: true, resolution, requeued: conflict.game_id != null });
}

async function conflictHandler(req: any, res: NextApiResponse) {
  try {
    if (req.method === "GET") return await handleGet(req, res);
    if (req.method === "POST") return await handlePost(req, res);
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ success: false, message: "Method not allowed." });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: playerForecastErrorMessage(error),
    });
  }
}

const adminHandler = playerForecastAdminOnly(conflictHandler);

export default async function handler(req: any, res: NextApiResponse) {
  const boundary = playerForecastRuntimeBoundary();
  if (!boundary.allowed) {
    return res.status(503).json({
      success: false,
      code: "PLAYER_FORECAST_LOCAL_DATABASE_REQUIRED",
      message: boundary.message,
      databaseTarget: boundary.databaseTarget,
    });
  }
  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body ?? {};
  const conflictId = req.method === "GET"
    ? stringValue(req.query.conflictId)
    : stringValue(body.conflictId);
  const reviewToken = req.method === "GET"
    ? stringValue(req.query.reviewToken)
    : stringValue(body.reviewToken);
  if (verifyPlayerForecastReviewToken({ token: reviewToken, conflictId })) {
    req.body = body;
    req.supabase = serviceRoleClient;
    req.hasValidReviewToken = true;
    return conflictHandler(req, res);
  }
  return adminHandler(req, res);
}
