import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { requireApiUser } from "lib/api/requireApiUser";
import { loadInSeasonAccess, requireInSeasonCapability } from "lib/in-season/server";
import { saveWorkspaceSchema, workspaceQuerySchema } from "lib/in-season/workspaceSchema";
import serviceRoleClient from "lib/supabase/server";

export const config = { api: { bodyParser: { sizeLimit: "10mb" } } };

const fail = (res: NextApiResponse, status: number, code: string, message: string) => res.status(status).json({ error: { code, message } });
const select = "id,lock_version,workspace,snapshot,updated_at";
const contextFilter = (query: any, userId: string, context: z.infer<typeof workspaceQuerySchema>) => query.eq("user_id", userId).eq("provider", context.provider).eq("season_id", context.seasonId).eq("league_id", context.leagueId).eq("team_id", context.teamId).eq("start_date", context.startDate).eq("end_date", context.endDate);
const output = (row: any) => row ? { workspace: row.workspace, snapshot: row.snapshot, version: row.lock_version, updatedAt: row.updated_at } : null;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "private, no-store");
  if (req.method !== "GET" && req.method !== "PUT") { res.setHeader("Allow", "GET, PUT"); return fail(res, 405, "method_not_allowed", "GET or PUT is required."); }
  const user = await requireApiUser(req, res, { onUnauthorized: (message) => fail(res, 401, "authentication_required", message) });
  if (!user) return;
  try {
    // This table is created by the accompanying local migration, before generated types are refreshed.
    const db = serviceRoleClient as any;
    if (req.method === "GET") {
      const context = workspaceQuerySchema.parse({ ...req.query, seasonId: Number(req.query.seasonId) });
      const { data, error } = await contextFilter(db.from("in_season_workspaces").select(select), user.id, context).maybeSingle();
      if (error) throw error;
      return res.status(200).json({ data: output(data) });
    }
    const parsed = saveWorkspaceSchema.parse(req.body);
    const { provider, seasonId, leagueId, teamId, startDate, endDate } = parsed.workspace.context;
    const context = workspaceQuerySchema.parse({ provider, seasonId, leagueId, teamId, startDate, endDate });
    requireInSeasonCapability(await loadInSeasonAccess(user.id), "rso_account_save");
    const values = { workspace: parsed.workspace, snapshot: parsed.snapshot };
    if (parsed.expectedVersion === null) {
      const { data, error } = await db.from("in_season_workspaces").insert({ user_id: user.id, provider: context.provider, season_id: context.seasonId, league_id: context.leagueId, team_id: context.teamId, start_date: context.startDate, end_date: context.endDate, lock_version: 1, ...values }).select(select).single();
      if (error?.code === "23505") return fail(res, 409, "version_conflict", "This workspace was saved elsewhere. Reload before saving.");
      if (error) throw error;
      return res.status(200).json({ data: output(data) });
    }
    const { data, error } = await contextFilter(db.from("in_season_workspaces").update({ ...values, lock_version: parsed.expectedVersion + 1 }), user.id, context).eq("lock_version", parsed.expectedVersion).select(select).maybeSingle();
    if (error) throw error;
    if (!data) return fail(res, 409, "version_conflict", "This workspace changed elsewhere. Reload before saving.");
    return res.status(200).json({ data: output(data) });
  } catch (cause) {
    if (cause instanceof z.ZodError) return fail(res, 400, "invalid_request", cause.issues[0]?.message ?? "Invalid workspace.");
    const accessError = cause as { statusCode?: number; code?: string };
    if (accessError.statusCode) return fail(res, accessError.statusCode, accessError.code ?? "access_required", "In-season account saves require active access.");
    return fail(res, 503, "workspace_unavailable", "Saved workspace is temporarily unavailable. Your local plan is unchanged.");
  }
}
