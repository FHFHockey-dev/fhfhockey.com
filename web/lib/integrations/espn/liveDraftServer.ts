import type { SupabaseClient } from "@supabase/supabase-js";

import serviceRoleClient from "lib/supabase/server";
import type { Database, Json } from "lib/supabase/database-generated.types";

import { getEspnDraft } from "./client";
import type {
  EspnConnectionLeague,
  EspnDraftPick,
  EspnDraftState,
  EspnLeagueStateV1,
} from "./contracts";
import { ESPN_DRAFT_POLL_INTERVAL_MS, ESPN_PROVIDER } from "./config";
import { hashEspnValue, normalizeEspnDraftPayload } from "./normalize";
import {
  EspnIntegrationError,
  getEspnConnections,
  isEspnLiveDraftEnabled,
  loadEspnCredentials,
  mappedError,
  normalizedSettings,
  validateEspnSeason,
} from "./server";

type DbClient = SupabaseClient<Database>;
type SessionRow = Database["public"]["Tables"]["espn_draft_sessions"]["Row"];
type PickRow = Database["public"]["Tables"]["espn_draft_picks"]["Row"];
type LeagueRow = Database["public"]["Tables"]["external_leagues"]["Row"];
type AccountRow = Database["public"]["Tables"]["connected_accounts"]["Row"];
type UnknownRecord = Record<string, unknown>;

function object(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {};
}

function asJson(value: unknown): Json {
  return value as Json;
}

function assertLiveEnabled(userId: string) {
  if (!isEspnLiveDraftEnabled(userId)) {
    throw new EspnIntegrationError(
      "ESPN live draft sync is not enabled for this account.",
      404,
      "ESPN_LIVE_DRAFT_DISABLED",
    );
  }
}

async function ownedLeague(
  client: DbClient,
  userId: string,
  externalLeagueId: string,
) {
  const { data: league, error } = await client
    .from("external_leagues")
    .select("*")
    .eq("id", externalLeagueId)
    .eq("user_id", userId)
    .eq("provider", ESPN_PROVIDER)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!league) {
    throw new EspnIntegrationError(
      "ESPN league not found.",
      404,
      "ESPN_LEAGUE_NOT_FOUND",
    );
  }
  return league;
}

async function accountForLeague(client: DbClient, league: LeagueRow) {
  const { data: account, error } = await client
    .from("connected_accounts")
    .select("*")
    .eq("id", league.connected_account_id)
    .eq("user_id", league.user_id)
    .eq("provider", ESPN_PROVIDER)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!account) {
    throw new EspnIntegrationError(
      "ESPN account not found.",
      404,
      "ESPN_ACCOUNT_NOT_FOUND",
    );
  }
  return account;
}

async function ownedSession(client: DbClient, userId: string, sessionId: string) {
  const { data: session, error } = await client
    .from("espn_draft_sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!session) {
    throw new EspnIntegrationError(
      "ESPN draft session not found.",
      404,
      "ESPN_DRAFT_SESSION_NOT_FOUND",
    );
  }
  return session;
}

function validRequiredId(value: unknown, label: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new EspnIntegrationError(
      `${label} is required.`,
      400,
      "ESPN_DRAFT_REQUEST_INVALID",
    );
  }
  return value.trim();
}

function statusFromDraft(draft: {
  drafted: boolean;
  inProgress: boolean;
}): Pick<SessionRow, "status" | "provider_status"> {
  if (draft.inProgress) return { status: "active", provider_status: "drafting" };
  if (draft.drafted) return { status: "complete", provider_status: "postdraft" };
  return { status: "predraft", provider_status: "predraft" };
}

async function latestStoredDraft(client: DbClient, externalLeagueId: string) {
  const { data, error } = await client
    .from("external_league_state_snapshots")
    .select("normalized_state")
    .eq("external_league_id", externalLeagueId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const state = data?.normalized_state as unknown as EspnLeagueStateV1 | undefined;
  return state?.version === 1 ? state : null;
}

async function leagueForResponse(
  client: DbClient,
  userId: string,
  externalLeagueId: string,
): Promise<EspnConnectionLeague> {
  const connections = await getEspnConnections({ userId, client });
  const league = connections.accounts
    .flatMap((account) => account.leagues)
    .find((candidate) => candidate.id === externalLeagueId);
  if (!league) {
    throw new EspnIntegrationError(
      "ESPN league not found.",
      404,
      "ESPN_LEAGUE_NOT_FOUND",
    );
  }
  return league;
}

function pickFromRow(
  row: PickRow,
  nhlPlayerId: number | null,
): EspnDraftPick {
  return {
    externalPickKey: row.external_pick_key,
    pickNumber: row.pick_number,
    roundNumber: row.round_number,
    pickInRound: row.pick_in_round,
    externalTeamKey: row.espn_team_id,
    externalPlayerId: row.espn_player_id,
    playerName: row.player_name,
    position: row.position,
    proTeamId: row.pro_team_id,
    isKeeper: row.is_keeper,
    bidAmount: row.bid_amount,
    fhfhPlayerId: row.fhfh_player_id,
    nhlPlayerId,
    mappingStatus: row.mapping_status as EspnDraftPick["mappingStatus"],
  };
}

export async function getEspnDraftState(args: {
  userId: string;
  sessionId: string;
  client?: DbClient;
  poll?: EspnDraftState["poll"];
}): Promise<EspnDraftState> {
  const client = args.client ?? serviceRoleClient;
  const session = await ownedSession(client, args.userId, args.sessionId);
  const [{ data: rows, error: picksError }, league] = await Promise.all([
    client
      .from("espn_draft_picks")
      .select("*")
      .eq("session_id", session.id)
      .eq("user_id", args.userId)
      .eq("is_active", true)
      .order("pick_number", { ascending: true }),
    leagueForResponse(client, args.userId, session.external_league_id),
  ]);
  if (picksError) throw new Error(picksError.message);
  const picks = (rows ?? []) as PickRow[];
  const identityIds = [
    ...new Set(
      picks
        .map((pick) => pick.fhfh_player_id)
        .filter((id): id is number => typeof id === "number"),
    ),
  ];
  const nhlByIdentity = new Map<number, number>();
  if (identityIds.length) {
    const { data: identities, error } = await client
      .from("fhfh_player_identities")
      .select("id,nhl_player_id")
      .in("id", identityIds);
    if (error) throw new Error(error.message);
    for (const identity of identities ?? []) {
      if (identity.nhl_player_id != null) {
        nhlByIdentity.set(identity.id, identity.nhl_player_id);
      }
    }
  }
  return {
    session: {
      id: session.id,
      externalLeagueId: session.external_league_id,
      externalTeamId: session.external_team_id,
      status: session.status as EspnDraftState["session"]["status"],
      providerStatus:
        session.provider_status as EspnDraftState["session"]["providerStatus"],
      snapshotVersion: session.snapshot_version,
      lastSnapshotAt: session.last_snapshot_at,
      nextPollAt: session.next_poll_at,
      lastErrorCode: session.last_error_code,
      lastErrorMessage: session.last_error_message,
    },
    league,
    picks: picks.map((pick) =>
      pickFromRow(
        pick,
        pick.fhfh_player_id == null
          ? null
          : nhlByIdentity.get(pick.fhfh_player_id) ?? null,
      ),
    ),
    poll: args.poll ?? { claimed: false, retryAfterSeconds: 0 },
  };
}

export async function listEspnDraftLeagues(args: {
  userId: string;
  client?: DbClient;
}) {
  const client = args.client ?? serviceRoleClient;
  const connections = await getEspnConnections({ userId: args.userId, client });
  if (!isEspnLiveDraftEnabled(args.userId)) {
    return { enabled: false, leagues: [], sessions: [] };
  }
  const { data: sessions, error } = await client
    .from("espn_draft_sessions")
    .select("*")
    .eq("user_id", args.userId)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return {
    enabled: connections.liveDraftEnabled,
    leagues: connections.accounts.flatMap((account) => account.leagues),
    sessions: (sessions ?? []).map((session) => ({
      id: session.id,
      externalLeagueId: session.external_league_id,
      status: session.status,
      providerStatus: session.provider_status,
    })),
  };
}

export async function startEspnDraftSession(args: {
  userId: string;
  externalLeagueId: unknown;
  externalTeamId?: unknown;
  client?: DbClient;
  now?: Date;
}) {
  assertLiveEnabled(args.userId);
  const client = args.client ?? serviceRoleClient;
  const externalLeagueId = validRequiredId(args.externalLeagueId, "ESPN league");
  const league = await ownedLeague(client, args.userId, externalLeagueId);
  const settings = normalizedSettings(league);
  if (!settings?.liveDraftSupported || settings.draftOrder.length === 0) {
    throw new EspnIntegrationError(
      "This ESPN league does not expose a supported ordered draft.",
      422,
      "ESPN_DRAFT_UNSUPPORTED",
    );
  }
  const account = await accountForLeague(client, league);
  if (account.status === "reauth_required") {
    throw new EspnIntegrationError(
      "Replace the ESPN session credentials before starting live draft sync.",
      409,
      "ESPN_REAUTH_REQUIRED",
    );
  }
  let externalTeamId =
    typeof args.externalTeamId === "string" && args.externalTeamId.trim()
      ? args.externalTeamId.trim()
      : null;
  if (externalTeamId) {
    const { data: team, error } = await client
      .from("external_teams")
      .select("id")
      .eq("id", externalTeamId)
      .eq("external_league_id", league.id)
      .eq("user_id", args.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!team) {
      throw new EspnIntegrationError(
        "ESPN team not found.",
        404,
        "ESPN_TEAM_NOT_FOUND",
      );
    }
  } else {
    const { data: teams, error } = await client
      .from("external_teams")
      .select("id,team_metadata")
      .eq("external_league_id", league.id)
      .eq("user_id", args.userId);
    if (error) throw new Error(error.message);
    externalTeamId =
      teams?.find((team) => object(team.team_metadata).is_owned === true)?.id ??
      teams?.[0]?.id ??
      null;
  }
  const storedDraft = (await latestStoredDraft(client, league.id))?.draft ?? {
    drafted: false,
    inProgress: false,
  };
  const initialStatus = statusFromDraft(storedDraft);
  // Always take one authoritative draft-detail snapshot when a companion starts.
  // A completed draft may have been imported before draft-pick rows existed, so
  // returning the stored terminal status here would silently omit its picks.
  const sessionStatus =
    initialStatus.status === "complete" ? "active" : initialStatus.status;
  const now = args.now ?? new Date();
  const { data: session, error } = await client
    .from("espn_draft_sessions")
    .upsert(
      {
        user_id: args.userId,
        connected_account_id: account.id,
        external_league_id: league.id,
        external_team_id: externalTeamId,
        espn_league_id: settings.espnLeagueId,
        espn_season: validateEspnSeason(settings.seasonKey),
        normalized_settings: asJson(settings),
        diagnostics: asJson(settings.diagnostics),
        status: sessionStatus,
        provider_status: initialStatus.provider_status,
        next_poll_at: now.toISOString(),
        completed_at: null,
        poll_lease_token: null,
        poll_lease_expires_at: null,
        last_error_code: null,
        last_error_message: null,
      },
      { onConflict: "user_id,external_league_id" },
    )
    .select("*")
    .single();
  if (error || !session) {
    throw new Error(error?.message ?? "ESPN draft session could not be created.");
  }
  return pollEspnDraftSession({
    userId: args.userId,
    sessionId: session.id,
    client,
    now,
  });
}

async function pickCommitRows(args: {
  client: DbClient;
  session: SessionRow;
  draftPicks: EspnDraftPick[];
  storedState: EspnLeagueStateV1 | null;
}) {
  const storedPlayers = new Map<
    string,
    { playerName: string | null; position: string | null; proTeamId: number | null; fhfhPlayerId: number | null }
  >();
  for (const team of args.storedState?.teams ?? []) {
    for (const player of team.roster) {
      storedPlayers.set(player.externalPlayerId, {
        playerName: player.playerName,
        position: player.position,
        proTeamId: player.proTeamId,
        fhfhPlayerId: player.fhfhPlayerId ?? null,
      });
    }
  }
  for (const pick of args.storedState?.draft.picks ?? []) {
    storedPlayers.set(pick.externalPlayerId, {
      playerName: pick.playerName,
      position: pick.position,
      proTeamId: pick.proTeamId,
      fhfhPlayerId: pick.fhfhPlayerId ?? null,
    });
  }
  const externalIds = [...new Set(args.draftPicks.map((pick) => pick.externalPlayerId))];
  const { data: mappings, error: mappingError } = await args.client
    .from("fhfh_player_external_identities")
    .select("external_player_id,fhfh_player_id,verification_status")
    .eq("provider", ESPN_PROVIDER)
    .eq("context_key", "fhl")
    .in("external_player_id", externalIds);
  if (mappingError) throw new Error(mappingError.message);
  const mappedById = new Map(
    (mappings ?? [])
      .filter((mapping) => mapping.verification_status === "verified")
      .map((mapping) => [mapping.external_player_id, mapping.fhfh_player_id]),
  );
  const { data: teams, error: teamError } = await args.client
    .from("external_teams")
    .select("id,external_team_key")
    .eq("external_league_id", args.session.external_league_id)
    .eq("user_id", args.session.user_id);
  if (teamError) throw new Error(teamError.message);
  const teamByKey = new Map(
    (teams ?? []).map((team) => [team.external_team_key, team.id]),
  );
  return args.draftPicks.map((pick) => {
    const stored = storedPlayers.get(pick.externalPlayerId);
    const fhfhPlayerId =
      mappedById.get(pick.externalPlayerId) ?? stored?.fhfhPlayerId ?? null;
    const playerName = pick.playerName ?? stored?.playerName ?? null;
    return {
      external_pick_key: pick.externalPickKey,
      pick_number: pick.pickNumber,
      round_number: pick.roundNumber,
      pick_in_round: pick.pickInRound,
      espn_team_id: pick.externalTeamKey,
      external_team_id: teamByKey.get(pick.externalTeamKey) ?? null,
      espn_player_id: pick.externalPlayerId,
      fhfh_player_id: fhfhPlayerId,
      mapping_status: fhfhPlayerId
        ? "mapped"
        : playerName
          ? "review_required"
          : "unmapped",
      player_name: playerName,
      position: pick.position ?? stored?.position ?? null,
      pro_team_id: pick.proTeamId ?? stored?.proTeamId ?? null,
      is_keeper: pick.isKeeper,
      bid_amount: pick.bidAmount,
      is_correction: false,
    };
  });
}

export async function pollEspnDraftSession(args: {
  userId: string;
  sessionId: string;
  client?: DbClient;
  now?: Date;
}): Promise<EspnDraftState> {
  assertLiveEnabled(args.userId);
  const client = args.client ?? serviceRoleClient;
  const session = await ownedSession(client, args.userId, args.sessionId);
  if (!["predraft", "active"].includes(session.status)) {
    return getEspnDraftState({ userId: args.userId, sessionId: session.id, client });
  }
  const now = args.now ?? new Date();
  const { data: claimData, error: claimError } = await client.rpc(
    "claim_espn_draft_poll",
    {
      p_session_id: session.id,
      p_user_id: args.userId,
      p_lease_seconds: 45,
      p_claimed_at: now.toISOString(),
    },
  );
  if (claimError) throw new Error(claimError.message);
  const claim = object(claimData);
  const claimed = claim.claimed === true;
  const retryAt =
    typeof claim.retryAt === "string" ? new Date(claim.retryAt).getTime() : now.getTime();
  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((retryAt - now.getTime()) / 1000),
  );
  if (!claimed || typeof claim.leaseToken !== "string") {
    return getEspnDraftState({
      userId: args.userId,
      sessionId: session.id,
      client,
      poll: { claimed: false, retryAfterSeconds },
    });
  }
  const leaseToken = claim.leaseToken;
  const league = await ownedLeague(client, args.userId, session.external_league_id);
  const account = await accountForLeague(client, league);
  try {
    const credentials = await loadEspnCredentials(client, args.userId, account.id);
    const payload = await getEspnDraft({
      credentials,
      leagueId: session.espn_league_id,
      season: session.espn_season,
    });
    const draft = normalizeEspnDraftPayload({
      leagueId: session.espn_league_id,
      season: session.espn_season,
      swid: credentials.swid,
      payload,
      fetchedAt: now,
    });
    const storedState = await latestStoredDraft(client, session.external_league_id);
    const picks = await pickCommitRows({
      client,
      session,
      draftPicks: draft.picks,
      storedState,
    });
    const status = statusFromDraft(draft);
    const snapshotHash = hashEspnValue({
      draft: {
        drafted: draft.drafted,
        inProgress: draft.inProgress,
        completeDate: draft.completeDate,
      },
      picks,
    });
    const nextPollAt = new Date(
      now.getTime() + ESPN_DRAFT_POLL_INTERVAL_MS,
    ).toISOString();
    const { error: applyError } = await client.rpc("apply_espn_draft_snapshot", {
      p_session_id: session.id,
      p_user_id: args.userId,
      p_lease_token: leaseToken,
      p_snapshot_hash: snapshotHash,
      p_status: status.status,
      p_provider_status: status.provider_status,
      p_picks: asJson(picks),
      p_next_poll_at: nextPollAt,
      p_observed_at: now.toISOString(),
    });
    if (applyError) throw new Error(applyError.message);
    return getEspnDraftState({
      userId: args.userId,
      sessionId: session.id,
      client,
      poll: { claimed: true, retryAfterSeconds: 0 },
    });
  } catch (error) {
    const mapped = mappedError(error);
    const nextStatus = mapped.code === "ESPN_REAUTH_REQUIRED" ? "reauth_required" : null;
    if (nextStatus) {
      await client
        .from("connected_accounts")
        .update({ status: "reauth_required" })
        .eq("id", account.id)
        .eq("user_id", args.userId);
    }
    const { error: recordError } = await client.rpc(
      "record_espn_draft_poll_failure",
      {
        p_session_id: session.id,
        p_user_id: args.userId,
        p_lease_token: leaseToken,
        p_error_code: mapped.code,
        p_error_message: mapped.message,
        p_retry_at: new Date(
          now.getTime() + (mapped.retryAfterSeconds ?? 60) * 1000,
        ).toISOString(),
        p_status: nextStatus,
        p_failed_at: now.toISOString(),
      },
    );
    if (recordError) throw mapped;
    if (nextStatus) {
      return getEspnDraftState({
        userId: args.userId,
        sessionId: session.id,
        client,
        poll: { claimed: true, retryAfterSeconds: 0 },
      });
    }
    throw mapped;
  }
}

export async function stopEspnDraftSession(args: {
  userId: string;
  sessionId: string;
  client?: DbClient;
}) {
  const client = args.client ?? serviceRoleClient;
  const session = await ownedSession(client, args.userId, args.sessionId);
  const { error } = await client
    .from("espn_draft_sessions")
    .update({
      status: "stopped",
      completed_at: null,
      poll_lease_token: null,
      poll_lease_expires_at: null,
    })
    .eq("id", session.id)
    .eq("user_id", args.userId);
  if (error) throw new Error(error.message);
  return getEspnDraftState({ userId: args.userId, sessionId: session.id, client });
}
