import type { NextApiRequest, NextApiResponse } from "next";
import { createHash } from "crypto";
import { requireApiUser } from "lib/api/requireApiUser";
import { isDraftProOwner } from "lib/draft-pro/ownerAccess";
import serviceRoleClient from "lib/supabase/server";
import { DIAGNOSTIC_SCOPE, diagnosticLocalOnly } from "lib/rosterScheduleOptimizer/diagnostic";

const object = (value: any): Record<string, any> => value && typeof value === "object" && !Array.isArray(value) ? value : {};
const text = (value: unknown) => typeof value === "string" && value.length <= 200 ? value : null;
const count = (value: unknown) => Array.isArray(value) ? value.length : null;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "private, no-store");
  if (!diagnosticLocalOnly(process.env.NODE_ENV, req.headers.host, req.socket.remoteAddress)) return res.status(404).end();
  if (req.method !== "GET") { res.setHeader("Allow", "GET"); return res.status(405).end(); }
  // No context overrides or preservation modes; one fixed scope per approved run.
  if (Object.keys(req.query).length) return res.status(400).end();
  const report: Record<string, any> = { kind: "rso-readonly-diagnostic-v1", scope: DIAGNOSTIC_SCOPE,
    startedAt: new Date().toISOString(), backendReads: 0, reads: [], status: "blocked", reason: "authentication_required",
    principalId: null, context: null, workspace: null };
  const finish = (code: number, reason: string) => res.status(code).json({ ...report, reason, completedAt: new Date().toISOString() });
  async function read<T>(name: string, operation: () => PromiseLike<T>): Promise<T> {
    if (report.backendReads >= 5) throw new Error("read_budget");
    report.backendReads++;
    const entry = { name, startedAt: new Date().toISOString(), completedAt: null as string | null, status: "attempted" };
    report.reads.push(entry);
    try { const value = await operation(); entry.status = (value as any)?.error ? "failed" : "returned"; return value; }
    catch { entry.status = "failed"; throw new Error("read_failed"); }
    finally { entry.completedAt = new Date().toISOString(); }
  }
  try {
    if (!req.headers.authorization?.startsWith("Bearer ")) return finish(401, "authentication_required");
    const user = await read("verify_session", () => requireApiUser(req, res, { onUnauthorized: () => undefined }));
    if (!user) return finish(401, "authentication_required");
    report.principalId = user.id;
    const db = serviceRoleClient as any;
    const owner = await read<any>("verify_owner", () => db.auth.admin.getUserById(user.id));
    if (owner.error || owner.data?.user?.id !== user.id || !isDraftProOwner(owner.data.user)) return finish(403, "owner_required");
    const leagues = await read<any>("cached_league", () => db.from("external_leagues")
      .select("id,connected_account_id,external_league_key,league_name,season_key,league_metadata,imported_at,updated_at")
      .eq("user_id", user.id).eq("provider", "yahoo").eq("league_name", DIAGNOSTIC_SCOPE.leagueName).limit(2));
    if (leagues.error) return finish(503, "league_read_failed");
    if (leagues.data?.length !== 1) return finish(409, "league_missing_or_ambiguous");
    const league = leagues.data[0];
    const leagueKey = /^([0-9]+)\.l\.([0-9]+)$/.exec(league.external_league_key ?? "");
    if (!leagueKey || league.season_key !== "2026") return finish(409, "league_season_unverified");
    const teams = await read<any>("cached_owned_team", () => db.from("external_teams")
      .select("id,connected_account_id,external_league_id,external_team_key,team_name,team_metadata,imported_at,updated_at")
      .eq("user_id", user.id).eq("provider", "yahoo").eq("external_league_id", league.id).eq("team_name", DIAGNOSTIC_SCOPE.teamName).limit(2));
    if (teams.error) return finish(503, "team_read_failed");
    if (teams.data?.length !== 1) return finish(409, "team_missing_or_ambiguous");
    const team = teams.data[0];
    if (team.connected_account_id !== league.connected_account_id || object(team.team_metadata).is_owned !== true ||
        !new RegExp(`^${leagueKey[1]}\\.l\\.${leagueKey[2]}\\.t\\.[0-9]+$`).test(team.external_team_key ?? "")) return finish(409, "team_binding_unverified");
    const metadata = object(league.league_metadata);
    report.context = { leagueId: league.id, leagueName: text(league.league_name), leagueKey: text(league.external_league_key),
      teamId: team.id, teamName: text(team.team_name), teamKey: text(team.external_team_key), ownedAtImport: true,
      gameKey: leagueKey[1], providerSeason: league.season_key,
      leagueImportedAt: text(league.imported_at), leagueUpdatedAt: text(league.updated_at),
      teamImportedAt: text(team.imported_at), teamUpdatedAt: text(team.updated_at),
      cachedReportedWeek: typeof metadata.current_week === "number" ? metadata.current_week : text(metadata.current_week),
      currentProviderMatchup: null, currentProviderStartDate: null, currentProviderEndDate: null, currentProviderTimeZone: null,
      provenance: "stored_import_only_not_live_provider_verification" };
    const saved = await read<any>("workspace_baseline", () => db.from("in_season_workspaces")
      .select("id,lock_version,workspace,snapshot,updated_at").eq("user_id", user.id).eq("provider", "yahoo")
      .eq("season_id", DIAGNOSTIC_SCOPE.seasonId).eq("league_id", league.id).eq("team_id", team.id)
      .eq("start_date", DIAGNOSTIC_SCOPE.startDate).eq("end_date", DIAGNOSTIC_SCOPE.endDate).maybeSingle());
    if (saved.error) return finish(503, "workspace_read_failed");
    const row = saved.data;
    if (!row) { report.workspace = { exists: false }; report.status = "read_complete"; return finish(200, "original_row_absent_account_save_blocked"); }
    const workspace = object(row.workspace), context = object(workspace.context), intent = object(workspace.intent);
    const matches = context.provider === "yahoo" && context.seasonId === DIAGNOSTIC_SCOPE.seasonId &&
      context.leagueId === league.id && context.teamId === team.id && context.startDate === DIAGNOSTIC_SCOPE.startDate && context.endDate === DIAGNOSTIC_SCOPE.endDate;
    if (!matches || !Number.isInteger(row.lock_version) || row.lock_version < 1) return finish(409, "saved_context_or_version_invalid");
    report.workspace = { exists: true, id: row.id, version: row.lock_version, updatedAt: text(row.updated_at),
      savedTimeZone: text(context.timeZone), savedAsOf: text(context.asOf),
      payloadSha256: createHash("sha256").update(JSON.stringify({ workspace: row.workspace, snapshot: row.snapshot })).digest("hex"),
      rosterCount: count(workspace.roster), stepCount: count(intent.steps), protectedCount: count(intent.protectedPlayerIds),
      excludedCount: count(intent.excludedPlayerIds), lockCount: count(workspace.lockedAssignments), snapshotPresent: row.snapshot != null,
      restorableBackup: false };
    report.status = "read_complete";
    return finish(200, "baseline_read_current_provider_context_still_unknown");
  } catch { return finish(503, "read_failed_no_retry"); }
}
