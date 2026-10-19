import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { createHash, randomUUID } from "crypto";
import { requireApiUser } from "lib/api/requireApiUser";
import { loadInSeasonAccess, requireInSeasonCapability } from "lib/in-season/server";
import { contextSchema, saveWorkspaceSchema, workspaceQuerySchema } from "lib/in-season/workspaceSchema";
import { isDraftProOwner } from "lib/draft-pro/ownerAccess";
import { preservationJson, validatePreservation, workspaceContextKey, type WorkspacePreservation } from "lib/rosterScheduleOptimizer/workspace";
import serviceRoleClient from "lib/supabase/server";

export const config = { api: { bodyParser: { sizeLimit: "10mb" } } };

const fail = (res: NextApiResponse, status: number, code: string, message: string) => res.status(status).json({ error: { code, message } });
const select = "id,lock_version,workspace,snapshot,updated_at";
const contextFilter = (query: any, userId: string, context: z.infer<typeof workspaceQuerySchema>) => query.eq("user_id", userId).eq("provider", context.provider).eq("season_id", context.seasonId).eq("league_id", context.leagueId).eq("team_id", context.teamId).eq("start_date", context.startDate).eq("end_date", context.endDate);
const output = (row: any) => row ? { workspace: row.workspace, snapshot: row.snapshot, version: row.lock_version, updatedAt: row.updated_at } : null;
type PreservationReceipt = { principalId: string; contextKey: string; original: any; lastVersion: number | null; acknowledgedVersion: number | null; lastPayload: string; checksum: string | null; localHash: string | null };
// Read receipts are process-local. A restart loses admission and fails closed; the downloaded full backup is retained.
const preservationReceipts = new Map<string, PreservationReceipt>();
const hash = (value: unknown) => createHash("sha256").update(preservationJson(value)).digest("hex");
const payload = (row: any) => preservationJson(row ? { workspace: row.workspace, snapshot: row.snapshot } : null);

async function preserve(req: NextApiRequest, res: NextApiResponse, userId: string) {
  const db = serviceRoleClient as any;
  // Do not use entitlement loaders or grant helpers here, including on a failed owner check.
  const owner = await db.auth.admin.getUserById(userId);
  if (owner.error || owner.data?.user?.id !== userId || !isDraftProOwner(owner.data.user)) return fail(res, 403, "owner_required", "Verified owner access is required for preservation.");
  const mode = req.query.preservation;
  if (req.method === "PUT" && mode !== "restore" && mode !== "write" || req.method === "GET" && !["read", "seal", "verify", "ack", "local_ack", "release"].includes(String(mode))) return fail(res, 400, "invalid_preservation", "Unsupported preservation operation.");
  const restored = mode === "restore" ? z.object({ backup: z.any(), expectedVersion: z.number().int().positive() }).strict().parse(req.body) : null;
  const saved = mode === "write" ? saveWorkspaceSchema.parse(req.body) : null;
  const rawContext = restored?.backup?.workspace?.context ?? saved?.workspace.context ?? { ...req.query, seasonId: Number(req.query.seasonId) };
  const context = contextSchema.parse(Object.fromEntries(["provider", "seasonId", "leagueId", "teamId", "startDate", "endDate", "timeZone", "asOf"].map(key => [key, rawContext[key]])));
  if (context.provider !== "yahoo") return fail(res, 409, "owned_team_required", "Preservation requires the selected owned Yahoo team.");
  const teamResult = await db.from("external_teams").select("id,external_league_id,external_team_key,connected_account_id,team_metadata")
    .eq("user_id", userId).eq("provider", "yahoo").eq("id", context.teamId).maybeSingle();
  const team = teamResult.data;
  if (teamResult.error) throw teamResult.error;
  if (!team || team.external_league_id !== context.leagueId || team.team_metadata?.is_owned !== true) return fail(res, 403, "owned_team_required", "The selected team is not owned by this principal.");
  const leagueResult = await db.from("external_leagues").select("id,external_league_key,connected_account_id")
    .eq("user_id", userId).eq("provider", "yahoo").eq("id", context.leagueId).maybeSingle();
  if (leagueResult.error) throw leagueResult.error;
  const league = leagueResult.data;
  if (!league || league.connected_account_id !== team.connected_account_id || !league.external_league_key || !team.external_team_key) return fail(res, 403, "owned_team_required", "League and team account binding could not be verified.");
  const current = await contextFilter(db.from("in_season_workspaces").select("*"), userId, context).maybeSingle();
  if (current.error) throw current.error;
  const row = current.data;
  const key = workspaceContextKey(context);
  if (row && (workspaceContextKey(saveWorkspaceSchema.parse({ workspace: row.workspace, snapshot: row.snapshot, expectedVersion: row.lock_version }).workspace.context) !== key || !row.id)) return fail(res, 409, "context_conflict", "Saved context differs, including its time zone. Nothing was changed.");
  const receiptId = typeof req.query.receipt === "string" ? req.query.receipt : restored?.backup?.remote?.receiptId;
  let receipt = typeof receiptId === "string" ? preservationReceipts.get(receiptId) : undefined;
  let id = receiptId;
  if (mode === "read" && !receiptId) {
    if (preservationReceipts.size >= 32) return fail(res, 503, "preservation_capacity", "Preservation receipt capacity reached. Existing backups remain held.");
    id = randomUUID();
    receipt = { principalId: userId, contextKey: key, original: row ? JSON.parse(JSON.stringify(row)) : null,
      lastVersion: row?.lock_version ?? null, acknowledgedVersion: row?.lock_version ?? null, lastPayload: payload(row), checksum: null, localHash: null };
    preservationReceipts.set(id, receipt);
  }
  if (!receipt || receipt.principalId !== userId || receipt.contextKey !== key) return fail(res, 409, "preservation_lost", "Preservation receipt is unavailable or belongs to another context. Keep the downloaded backup; do not resume the test.");
  if ((row?.lock_version ?? null) !== receipt.lastVersion || payload(row) !== receipt.lastPayload || row?.id !== receipt.original?.id) return fail(res, 409, "preservation_conflict", "Another writer changed the account record. Nothing was overwritten.");
  if (mode !== "ack" && mode !== "read" && receipt.acknowledgedVersion !== receipt.lastVersion) return fail(res, 409, "unacknowledged_write", "A dispatched write lacks its acknowledgement. Preservation remains held.");
  if (mode === "seal") {
    const checksum = z.string().regex(/^[a-f0-9]{64}$/).parse(req.query.checksum);
    if (receipt.checksum && receipt.checksum !== checksum) return fail(res, 409, "backup_conflict", "This receipt is already bound to another backup.");
    receipt.checksum = checksum;
    const localHash = z.string().regex(/^[a-f0-9]{64}$/).parse(req.query.localHash);
    if (receipt.localHash && receipt.localHash !== localHash) return fail(res, 409, "local_conflict", "The original local binding is already sealed.");
    receipt.localHash = localHash;
  }
  if (mode === "local_ack") {
    const next = z.string().regex(/^[a-f0-9]{64}$/).parse(req.query.localHash);
    if (!receipt.checksum || req.query.checksum !== receipt.checksum || req.query.previousLocalHash !== receipt.localHash) return fail(res, 409, "local_conflict", "Local writer binding changed. Nothing was adopted.");
    receipt.localHash = next;
  }
  if (mode === "ack") {
    if (!receipt.checksum || Number(req.query.version) !== receipt.lastVersion) return fail(res, 409, "ack_conflict", "Only this writer's returned version can be acknowledged.");
    receipt.acknowledgedVersion = receipt.lastVersion;
  }
  if (mode === "release") {
    if (payload(row) !== payload(receipt.original)) return fail(res, 409, "restore_required", "Restore the original account payload before resuming.");
    preservationReceipts.delete(id);
  }
  if (req.method === "GET") return res.status(200).json({ data: output(row), preservation: {
    principalId: userId, ownerVerified: true, contextKey: key, receiptId: id,
    ownedTeam: { leagueKey: league.external_league_key, teamKey: team.external_team_key },
    row, originalRowHash: hash(receipt.original), checksum: receipt.checksum, lastVersion: receipt.lastVersion,
    accountSaveAllowed: receipt.original !== null, acknowledgedVersion: receipt.acknowledgedVersion, localHash: receipt.localHash, released: mode === "release", runtimeBound: true,
  } });
  if (receipt.original === null) return fail(res, 409, "absence_restore_unavailable", "Originally absent account records cannot be restored to absence. Account saves remain blocked.");
  if (!receipt.checksum) return fail(res, 409, "backup_unsealed", "A complete sealed backup is required before writing.");
  let values;
  let expectedVersion;
  if (restored) {
    const backup = restored.backup as WorkspacePreservation;
    await validatePreservation(backup, userId, key, async value => hash(value));
    if (backup.checksum !== receipt.checksum || hash(backup.remote.row) !== hash(receipt.original)) return fail(res, 409, "backup_conflict", "Backup payload differs from the admitted original.");
    expectedVersion = restored.expectedVersion;
    values = { workspace: receipt.original.workspace, snapshot: receipt.original.snapshot };
  } else {
    expectedVersion = saved!.expectedVersion;
    values = { workspace: saved!.workspace, snapshot: saved!.snapshot };
  }
  if (expectedVersion !== receipt.lastVersion) return fail(res, 409, "version_conflict", "Expected version was not acknowledged by this preservation writer.");
  const result = await contextFilter(db.from("in_season_workspaces").update({ ...values, lock_version: expectedVersion! + 1 }), userId, context)
    .eq("id", receipt.original.id).eq("lock_version", expectedVersion).select("*").maybeSingle();
  if (result.error) throw result.error;
  if (!result.data) return fail(res, 409, "version_conflict", "Concurrent account change rejected. Nothing was overwritten.");
  receipt.lastVersion = result.data.lock_version; receipt.lastPayload = payload(result.data);
  return res.status(200).json({ data: output(result.data), preservation: { principalId: userId, contextKey: key, receiptId: id,
    checksum: receipt.checksum, restored: Boolean(restored), lastVersion: receipt.lastVersion,
    originalPayloadHash: hash({ workspace: receipt.original.workspace, snapshot: receipt.original.snapshot }) } });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "private, no-store");
  if (req.method !== "GET" && req.method !== "PUT") { res.setHeader("Allow", "GET, PUT"); return fail(res, 405, "method_not_allowed", "GET or PUT is required."); }
  const user = await requireApiUser(req, res, { onUnauthorized: (message) => fail(res, 401, "authentication_required", message) });
  if (!user) return;
  try {
    if (req.query.preservation !== undefined) return await preserve(req, res, user.id);
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
