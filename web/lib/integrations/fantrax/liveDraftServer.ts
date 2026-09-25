import type { SupabaseClient } from "@supabase/supabase-js";

import { getDraftProFeatureFlags } from "lib/draft-pro/features";
import { loadDraftProAccess } from "lib/draft-pro/server";
import type { Database, Json } from "lib/supabase/database-generated.types";
import serviceRoleClient from "lib/supabase/server";

import { FantraxApiError, getFantraxDraftResults, getFantraxPlayerIds, type FantraxPlayerInfo } from "./client";
import { FANTRAX_PROVIDER } from "./config";
import { normalizeFantraxDraftResults, type FantraxDraftSnapshot } from "./draftResults";
import { fantraxPlayerName, matchFantraxPlayerIds, normalizeName } from "./playerIdentity";
import {
  discoverLinkedFantraxLeagues,
  FantraxIntegrationError,
  getFantraxConnections,
  isFantraxApiEnabled,
} from "./server";

type DbClient = SupabaseClient<Database>;
type Session = Database["public"]["Tables"]["fantrax_draft_sessions"]["Row"];

const POLL_INTERVAL_MS = 30_000;
const IDENTITY_MATCH_VERSION = "fantrax-nhl-v3-canonical-name";
let playerCatalog: { value: Record<string, FantraxPlayerInfo>; expiresAt: number } | null = null;
let pendingCatalog: Promise<Record<string, FantraxPlayerInfo>> | null = null;

async function getPlayerCatalog() {
  if (playerCatalog && playerCatalog.expiresAt > Date.now()) return playerCatalog.value;
  pendingCatalog ??= getFantraxPlayerIds();
  try {
    const value = await pendingCatalog;
    playerCatalog = { value, expiresAt: Date.now() + 30 * 60_000 };
    return value;
  } finally {
    pendingCatalog = null;
  }
}

export function isFantraxLiveDraftEnabled(env: Readonly<Record<string, string | undefined>> = process.env) {
  return env.FANTRAX_LIVE_DRAFT_ENABLED === "true";
}

export async function requireFantraxDraftAccess(
  userId: string,
  options: { enabled?: boolean; loadAccess?: typeof loadDraftProAccess } = {},
) {
  if (!(options.enabled ?? (isFantraxLiveDraftEnabled() && isFantraxApiEnabled(userId)))) {
    throw new FantraxIntegrationError("Fantrax live draft sync is unavailable.", 503, "FANTRAX_LIVE_DRAFT_DISABLED");
  }
  const access = await (options.loadAccess ?? loadDraftProAccess)(userId, {
    now: new Date(),
    flags: getDraftProFeatureFlags(),
    patreonVerificationAvailable: true,
  });
  if (!access.eligible) {
    throw new FantraxIntegrationError("Draft Pro access is required for Fantrax live sync.", 403, "FANTRAX_DRAFT_PRO_REQUIRED");
  }
}

function requiredId(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new FantraxIntegrationError("Choose a linked Fantrax league and owned team.", 400, "FANTRAX_DRAFT_SELECTION_REQUIRED");
  }
  return value.trim();
}

async function ownedSession(client: DbClient, userId: string, sessionId: string) {
  const { data, error } = await client.from("fantrax_draft_sessions")
    .select("*").eq("id", sessionId).eq("user_id", userId).maybeSingle();
  if (error) throw error;
  if (!data) throw new FantraxIntegrationError("Fantrax draft session not found.", 404, "FANTRAX_DRAFT_SESSION_NOT_FOUND");
  return data;
}

async function enrichPickIdentities(client: DbClient, snapshot: FantraxDraftSnapshot): Promise<FantraxDraftSnapshot> {
  if (!snapshot.picks.length) return snapshot;
  let catalog: Record<string, FantraxPlayerInfo>;
  try {
    catalog = await getPlayerCatalog();
  } catch {
    console.warn(JSON.stringify({ event: "fantrax_player_catalog_unavailable" }));
    return snapshot;
  }
  const picks = snapshot.picks.map((pick) => ({
    ...pick,
    playerName: catalog[pick.playerId]?.fantraxId === pick.playerId
      ? fantraxPlayerName(catalog[pick.playerId])
      : null,
  }));
  const enriched = { ...snapshot, picks };
  try {
    const ids = [...new Set(picks.map((pick) => pick.playerId))];
    const { data: mapped, error: mappedError } = await client.from("fhfh_player_external_identities")
      .select("external_player_id").eq("provider", FANTRAX_PROVIDER).eq("context_key", "nhl")
      .eq("verification_status", "verified").in("external_player_id", ids);
    if (mappedError) throw mappedError;
    const existing = new Set((mapped ?? []).map((row) => row.external_player_id));
    const unresolved = picks.filter((pick) => !existing.has(pick.playerId) && pick.playerName).map((pick) => pick.playerId);
    if (!unresolved.length) return { ...enriched, identityMatchVersion: IDENTITY_MATCH_VERSION };
    const playerNames = [...new Set(unresolved.map((id) => fantraxPlayerName(catalog[id])).filter((name): name is string => Boolean(name)))];
    const names = [...new Set(playerNames.map(normalizeName))];
    const abbreviations = [...new Set(unresolved.map((id) => catalog[id]?.team).filter((team): team is string => Boolean(team && team !== "(N/A)")))];
    if (!names.length) return { ...enriched, identityMatchVersion: IDENTITY_MATCH_VERSION };
    const [teamsResult, aliasesResult, canonicalResult] = await Promise.all([
      abbreviations.length
        ? client.from("teams").select("id,abbreviation").in("abbreviation", abbreviations)
        : Promise.resolve({ data: [], error: null }),
      client.from("fhfh_player_identity_aliases")
        .select("fhfh_player_id,normalized_alias").in("normalized_alias", names).eq("verification_status", "verified"),
      client.from("fhfh_player_identities")
        .select("id,canonical_name,canonical_position,current_nhl_team_id,nhl_player_id")
        .in("canonical_name", playerNames).eq("verification_status", "verified").is("merged_into_id", null),
    ]);
    if (teamsResult.error || aliasesResult.error || canonicalResult.error) throw teamsResult.error ?? aliasesResult.error ?? canonicalResult.error;
    const identityIds = [...new Set((aliasesResult.data ?? []).map((alias) => alias.fhfh_player_id))];
    const identitiesResult = identityIds.length
      ? await client.from("fhfh_player_identities")
        .select("id,canonical_name,canonical_position,current_nhl_team_id,nhl_player_id")
        .in("id", identityIds).eq("verification_status", "verified").is("merged_into_id", null)
      : { data: [], error: null };
    if (identitiesResult.error) throw identitiesResult.error;
    const identities = [...new Map([...(identitiesResult.data ?? []), ...(canonicalResult.data ?? [])]
      .map((identity) => [identity.id, identity])).values()];
    const matches = matchFantraxPlayerIds(unresolved, catalog, teamsResult.data ?? [], identities, aliasesResult.data ?? []);
    if (matches.size) {
      const rows: Database["public"]["Tables"]["fhfh_player_external_identities"]["Insert"][] = [...matches].map(([externalId, identity]) => ({
        fhfh_player_id: identity.id,
        provider: FANTRAX_PROVIDER,
        context_key: "nhl",
        external_player_id: externalId,
        is_primary: false,
        match_method: "verified_alias_unique_or_exact_team_position",
        match_confidence: 0.98,
        verification_status: "verified",
        verified_at: new Date().toISOString(),
        verified_by_system: IDENTITY_MATCH_VERSION,
        source_provenance: {
          source: "fantrax_getPlayerIds",
          name: catalog[externalId].name,
          team: catalog[externalId].team,
          position: catalog[externalId].position,
        } as Json,
      }));
      const { error } = await client.from("fhfh_player_external_identities")
        .upsert(rows, { onConflict: "provider,context_key,external_player_id", ignoreDuplicates: true });
      if (error) throw error;
    }
  } catch {
    console.warn(JSON.stringify({ event: "fantrax_player_identity_unavailable" }));
    return enriched;
  }
  return { ...enriched, identityMatchVersion: IDENTITY_MATCH_VERSION };
}

async function mappedPicks(client: DbClient, snapshot: FantraxDraftSnapshot) {
  const ids = [...new Set(snapshot.picks.map((pick) => pick.playerId))];
  if (!ids.length) return snapshot.picks.map((pick) => ({ ...pick, nhlPlayerId: null }));
  const { data: mappings, error } = await client.from("fhfh_player_external_identities")
    .select("external_player_id,fhfh_player_id,verification_status")
    .eq("provider", FANTRAX_PROVIDER).eq("context_key", "nhl").in("external_player_id", ids);
  if (error) throw error;
  const verified = new Map<string, number>();
  const conflicting = new Set<string>();
  for (const mapping of mappings ?? []) {
    if (mapping.verification_status !== "verified") continue;
    const previous = verified.get(mapping.external_player_id);
    if (previous != null && previous !== mapping.fhfh_player_id) conflicting.add(mapping.external_player_id);
    verified.set(mapping.external_player_id, mapping.fhfh_player_id);
  }
  const identityIds = [...new Set([...verified.values()])];
  const identities = identityIds.length
    ? await client.from("fhfh_player_identities").select("id,nhl_player_id,verification_status,merged_into_id").in("id", identityIds)
    : { data: [], error: null };
  if (identities.error) throw identities.error;
  const nhlByIdentity = new Map((identities.data ?? [])
    .filter((identity) => identity.verification_status === "verified" && identity.merged_into_id == null)
    .map((identity) => [identity.id, identity.nhl_player_id]));
  const nhlUse = new Map<number, number>();
  for (const pick of snapshot.picks) {
    const nhlId = nhlByIdentity.get(verified.get(pick.playerId) ?? -1);
    if (nhlId != null) nhlUse.set(nhlId, (nhlUse.get(nhlId) ?? 0) + 1);
  }
  return snapshot.picks.map((pick) => {
    const nhlId = nhlByIdentity.get(verified.get(pick.playerId) ?? -1);
    return {
      ...pick,
      nhlPlayerId: !conflicting.has(pick.playerId) && nhlId != null && nhlUse.get(nhlId) === 1 ? nhlId : null,
    };
  });
}

async function response(client: DbClient, session: Session) {
  const snapshot = session.snapshot as unknown as FantraxDraftSnapshot;
  const safe = snapshot && Array.isArray(snapshot.picks) && snapshot.safeToApply === true;
  return {
    session: {
      id: session.id,
      status: session.status,
      providerStatus: session.provider_status,
      externalLeagueId: session.external_league_id,
      externalTeamId: session.external_team_id,
      lastPolledAt: session.last_polled_at,
      nextPollAt: session.next_poll_at,
      lastErrorCode: session.last_error_code,
    },
    draftOrder: safe ? snapshot.draftOrder : [],
    slots: safe ? snapshot.slots : [],
    picks: safe ? await mappedPicks(client, snapshot) : [],
    warning: safe ? snapshot.warning : "Fantrax draft data is unavailable. Continue manually.",
    pollIntervalMs: POLL_INTERVAL_MS,
  };
}

export async function listFantraxDraftSessions(args: { userId: string; client?: DbClient }) {
  const client = args.client ?? serviceRoleClient;
  const enabled = isFantraxLiveDraftEnabled() && isFantraxApiEnabled(args.userId);
  if (!enabled) return { enabled: false, eligible: false, sessions: [] };
  let eligible = false;
  try { await requireFantraxDraftAccess(args.userId); eligible = true; } catch { /* fail closed */ }
  const { data, error } = await client.from("fantrax_draft_sessions")
    .select("*").eq("user_id", args.userId).order("updated_at", { ascending: false }).limit(10);
  if (error) throw error;
  return { enabled, eligible, sessions: (data ?? []).map((session) => ({
    id: session.id, status: session.status, externalLeagueId: session.external_league_id,
  })) };
}

export async function getFantraxDraftSession(args: { userId: string; sessionId: string; client?: DbClient }) {
  const client = args.client ?? serviceRoleClient;
  return response(client, await ownedSession(client, args.userId, requiredId(args.sessionId)));
}

export async function startFantraxDraftSession(args: {
  userId: string;
  externalLeagueId: unknown;
  externalTeamId: unknown;
  client?: DbClient;
}) {
  await requireFantraxDraftAccess(args.userId);
  const client = args.client ?? serviceRoleClient;
  const leagueId = requiredId(args.externalLeagueId);
  const teamId = requiredId(args.externalTeamId);
  const connections = await getFantraxConnections({ userId: args.userId, client });
  const league = connections.accounts.flatMap((account) => account.leagues)
    .find((candidate) => candidate.id === leagueId);
  const team = league?.teams.find((candidate) => candidate.id === teamId && candidate.isOwned);
  if (!league || !team) {
    throw new FantraxIntegrationError("Choose a linked Fantrax league and a team you own.", 404, "FANTRAX_DRAFT_TEAM_NOT_OWNED");
  }
  const discovery = await discoverLinkedFantraxLeagues({ userId: args.userId, accountId: league.connectedAccountId, client });
  const current = discovery.leagues.find((candidate) => candidate.externalLeagueKey === league.externalLeagueKey);
  if (!current?.ownedTeams.some((candidate) => candidate.externalTeamKey === team.externalTeamKey && candidate.isOwned)) {
    throw new FantraxIntegrationError("Fantrax no longer lists this team as owned. Refresh your link.", 409, "FANTRAX_DRAFT_OWNERSHIP_CHANGED");
  }
  let snapshot: FantraxDraftSnapshot;
  try {
    snapshot = normalizeFantraxDraftResults(await getFantraxDraftResults(league.externalLeagueKey));
  } catch (error) {
    if (error instanceof FantraxApiError) throw new FantraxIntegrationError(error.message, error.statusCode, error.code, error.retryAfterSeconds);
    throw error;
  }
  if (!snapshot.safeToApply || snapshot.draftOrder.length !== league.teams.length) {
    throw new FantraxIntegrationError(snapshot.warning ?? "Fantrax draft order is incomplete. Continue manually.", 422, "FANTRAX_DRAFT_AMBIGUOUS");
  }
  const knownTeams = new Set(league.teams.map((candidate) => candidate.externalTeamKey));
  if (snapshot.draftOrder.some((id) => !knownTeams.has(id))) {
    throw new FantraxIntegrationError("Fantrax draft teams no longer match the linked league. Continue manually.", 422, "FANTRAX_DRAFT_TEAMS_CHANGED");
  }
  snapshot = await enrichPickIdentities(client, snapshot);
  const now = new Date().toISOString();
  const status = snapshot.providerStatus.toLowerCase() === "completed" ? "complete" : "active";
  const { data, error } = await client.from("fantrax_draft_sessions").upsert({
    user_id: args.userId,
    connected_account_id: league.connectedAccountId,
    external_league_id: league.id,
    external_team_id: team.id,
    status,
    provider_status: snapshot.providerStatus,
    snapshot: snapshot as unknown as Json,
    snapshot_hash: snapshot.hash,
    next_poll_at: new Date(Date.now() + POLL_INTERVAL_MS).toISOString(),
    last_polled_at: now,
    consecutive_failures: 0,
    last_error_code: null,
    poll_lease_token: null,
    poll_lease_expires_at: null,
    updated_at: now,
  }, { onConflict: "user_id,external_league_id" }).select("*").single();
  if (error || !data) throw error ?? new Error("Fantrax draft session could not start.");
  return response(client, data);
}

export async function pollFantraxDraftSession(args: { userId: string; sessionId: string; client?: DbClient }) {
  const client = args.client ?? serviceRoleClient;
  let session = await ownedSession(client, args.userId, requiredId(args.sessionId));
  if (session.status !== "active") return response(client, session);
  try {
    await requireFantraxDraftAccess(args.userId);
  } catch {
    const { data } = await client.from("fantrax_draft_sessions").update({ status: "stopped", last_error_code: "FANTRAX_DRAFT_ACCESS_LOST" })
      .eq("id", session.id).eq("user_id", args.userId).select("*").single();
    return response(client, data ?? { ...session, status: "stopped", last_error_code: "FANTRAX_DRAFT_ACCESS_LOST" });
  }
  const now = new Date();
  const { data: token, error: claimError } = await client.rpc("claim_fantrax_draft_poll", {
    p_session_id: session.id, p_user_id: args.userId, p_now: now.toISOString(),
  });
  if (claimError) throw claimError;
  if (!token) return response(client, await ownedSession(client, args.userId, session.id));
  try {
    const { data: league, error: leagueError } = await client.from("external_leagues")
      .select("external_league_key").eq("id", session.external_league_id).eq("user_id", args.userId).eq("provider", FANTRAX_PROVIDER).maybeSingle();
    if (leagueError || !league) throw leagueError ?? new Error("Fantrax league disappeared.");
    let snapshot = normalizeFantraxDraftResults(await getFantraxDraftResults(league.external_league_key));
    if (!snapshot.safeToApply) throw new FantraxIntegrationError(snapshot.warning ?? "Fantrax draft data is ambiguous.", 422, "FANTRAX_DRAFT_AMBIGUOUS");
    const previous = session.snapshot as unknown as FantraxDraftSnapshot;
    if (JSON.stringify(snapshot.draftOrder) !== JSON.stringify(previous.draftOrder)) {
      throw new FantraxIntegrationError("Fantrax draft order changed. Continue manually and review the league.", 422, "FANTRAX_DRAFT_ORDER_CHANGED");
    }
    const needsIdentityRefresh = snapshot.hash !== session.snapshot_hash ||
      previous.identityMatchVersion !== IDENTITY_MATCH_VERSION;
    if (needsIdentityRefresh) snapshot = await enrichPickIdentities(client, snapshot);
    const status = snapshot.providerStatus.toLowerCase() === "completed" ? "complete" : "active";
    const { data, error } = await client.from("fantrax_draft_sessions").update({
      status,
      provider_status: snapshot.providerStatus,
      ...(needsIdentityRefresh ? { snapshot: snapshot as unknown as Json, snapshot_hash: snapshot.hash } : {}),
      last_polled_at: now.toISOString(),
      next_poll_at: new Date(now.getTime() + POLL_INTERVAL_MS).toISOString(),
      consecutive_failures: 0,
      last_error_code: null,
      poll_lease_token: null,
      poll_lease_expires_at: null,
      updated_at: now.toISOString(),
    }).eq("id", session.id).eq("user_id", args.userId).eq("poll_lease_token", token).select("*").single();
    if (error || !data) throw error ?? new Error("Fantrax draft update failed.");
    return response(client, data);
  } catch (error) {
    const code = error instanceof FantraxIntegrationError || error instanceof FantraxApiError ? error.code : "FANTRAX_DRAFT_POLL_FAILED";
    const delay = error instanceof FantraxApiError && error.retryAfterSeconds
      ? Math.max(60, error.retryAfterSeconds) : 60;
    const { data } = await client.from("fantrax_draft_sessions").update({
      status: "error",
      last_error_code: code,
      consecutive_failures: session.consecutive_failures + 1,
      next_poll_at: new Date(now.getTime() + delay * 1000).toISOString(),
      poll_lease_token: null,
      poll_lease_expires_at: null,
      updated_at: now.toISOString(),
    }).eq("id", session.id).eq("user_id", args.userId).eq("poll_lease_token", token).select("*").single();
    session = data ?? { ...session, status: "error", last_error_code: code };
    return response(client, session);
  }
}

export async function stopFantraxDraftSession(args: { userId: string; sessionId: string; client?: DbClient }) {
  const client = args.client ?? serviceRoleClient;
  const session = await ownedSession(client, args.userId, requiredId(args.sessionId));
  const { data, error } = await client.from("fantrax_draft_sessions").update({
    status: "stopped", poll_lease_token: null, poll_lease_expires_at: null, updated_at: new Date().toISOString(),
  }).eq("id", session.id).eq("user_id", args.userId).select("*").single();
  if (error || !data) throw error ?? new Error("Fantrax draft session could not stop.");
  return response(client, data);
}
