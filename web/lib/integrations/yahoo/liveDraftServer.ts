import serviceRoleClient from "lib/supabase/server";

import { getYahooClientCredentials, YAHOO_PROVIDER } from "./config";
import {
  assertYahooLeagueKey,
  applyYahooTeamDraftPositionDiagnostics,
  hashYahooDraftSnapshot,
  parseRetryAfterSeconds,
  parseYahooDraftResults,
  parseYahooDraftSettings,
  parseYahooDraftTeams,
  sessionStatusForProvider,
  yahooDraftPollDelaySeconds,
  yahooFantasyResourceUrl,
  yahooLeagueDraftUrl,
  YAHOO_LIVE_DRAFT_GAME_KEY,
  YAHOO_LIVE_DRAFT_SEASON,
  YAHOO_LIVE_DRAFT_TARGET_SEASON_ID,
  YahooLiveDraftError,
  type YahooDraftPick,
  type YahooDraftProviderStatus,
  type YahooDraftSettings,
  type YahooDraftTeam,
} from "./liveDraft";

type LiveDraftDb = any;
type FetchLike = typeof fetch;
type UnknownRecord = Record<string, any>;

type ExternalLeagueRow = {
  id: string;
  connected_account_id: string;
  user_id: string;
  external_league_key: string;
  league_name: string | null;
  season_key: string | null;
  league_metadata: unknown;
  scoring_settings: unknown;
  roster_settings: unknown;
};

type ExternalTeamRow = {
  id: string;
  external_league_id: string;
  connected_account_id: string;
  user_id: string;
  external_team_key: string;
  team_name: string | null;
  team_metadata: unknown;
};

type YahooDraftSessionRow = {
  id: string;
  user_id: string;
  connected_account_id: string;
  external_league_id: string;
  external_team_id: string;
  draft_ranking_id: string | null;
  yahoo_game_key: string;
  yahoo_season: number;
  target_season_id: number;
  yahoo_league_key: string;
  yahoo_team_key: string;
  normalized_settings: unknown;
  diagnostics: unknown;
  last_provider_sync_run_id: string | null;
  status: string;
  provider_status: string;
  snapshot_hash: string | null;
  snapshot_version: number;
  last_pick_number: number;
  last_snapshot_at: string | null;
  last_changed_at: string | null;
  next_poll_at: string;
  last_polled_at: string | null;
  consecutive_failures: number;
  last_error_code: string | null;
  last_error_message: string | null;
  started_at: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

type YahooDraftPickRow = {
  session_id: string;
  pick_number: number;
  round_number: number;
  pick_in_round: number;
  yahoo_team_key: string;
  external_team_id: string | null;
  yahoo_player_key: string;
  yahoo_player_id: string;
  fhfh_player_id: number | null;
  mapping_status: string;
  player_name: string | null;
  nhl_team_abbreviation: string | null;
  position: string | null;
  auction_cost: number | string | null;
  is_active: boolean;
  is_correction: boolean;
  revision: number;
  first_observed_at: string;
  last_observed_at: string;
};

type YahooTokenRow = {
  access_token: string | null;
  refresh_token: string | null;
  token_type: string | null;
  scopes: unknown;
  provider_user_id: string | null;
  refresh_expires_at: string | null;
  secret_metadata: unknown;
};

type OwnedYahooLeagueContext = {
  league: ExternalLeagueRow;
  ownedTeam: ExternalTeamRow;
};

type PollOptions = {
  client?: LiveDraftDb;
  fetchImpl?: FetchLike;
  now?: () => Date;
};

const SESSION_SELECT =
  "id,user_id,connected_account_id,external_league_id,external_team_id,draft_ranking_id,yahoo_game_key,yahoo_season,target_season_id,yahoo_league_key,yahoo_team_key,normalized_settings,diagnostics,last_provider_sync_run_id,status,provider_status,snapshot_hash,snapshot_version,last_pick_number,last_snapshot_at,last_changed_at,next_poll_at,last_polled_at,consecutive_failures,last_error_code,last_error_message,started_at,completed_at,created_at,updated_at";
const PICK_SELECT =
  "session_id,pick_number,round_number,pick_in_round,yahoo_team_key,external_team_id,yahoo_player_key,yahoo_player_id,fhfh_player_id,mapping_status,player_name,nhl_team_abbreviation,position,auction_cost,is_active,is_correction,revision,first_observed_at,last_observed_at";

function record(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {};
}

function firstRpcObject(value: unknown): UnknownRecord {
  return record(Array.isArray(value) ? value[0] : value);
}

function queryError(prefix: string, error: any) {
  return new Error(`${prefix}: ${error?.message || "unknown database error"}`);
}

function isoAfter(date: Date, seconds: number) {
  return new Date(date.getTime() + seconds * 1000).toISOString();
}

function yahooRequestSignal() {
  const timeout = (globalThis.AbortSignal as typeof AbortSignal & {
    timeout?: (milliseconds: number) => AbortSignal;
  }).timeout;
  return typeof timeout === "function" ? timeout(10_000) : undefined;
}

function liveDraftMetadata(league: ExternalLeagueRow) {
  return record(record(league.league_metadata).yahoo_live_draft);
}

function storedSettings(league: ExternalLeagueRow): YahooDraftSettings {
  const metadata = liveDraftMetadata(league);
  if (record(metadata.settings).normalized) {
    return metadata.settings as YahooDraftSettings;
  }
  return parseYahooDraftSettings({
    league_key: league.external_league_key,
    ...record(league.league_metadata),
    ...record(league.scoring_settings),
    ...record(league.roster_settings),
  });
}

function normalizedSettingsPayload(settings: YahooDraftSettings) {
  const { diagnostics: _diagnostics, ...normalized } = settings;
  return normalized;
}

function settingsWithTeamCount(
  settings: YahooDraftSettings,
  fallbackTeamCount: number,
) {
  if (settings.teamCount || fallbackTeamCount < 1) return settings;
  return {
    ...settings,
    teamCount: fallbackTeamCount,
    normalized: { ...settings.normalized, teamCount: fallbackTeamCount },
  };
}

function metadataTeamDraftPosition(team: ExternalTeamRow) {
  const value = Number(record(team.team_metadata).draft_position);
  return Number.isInteger(value) && value > 0 ? value : null;
}

function apiTeamFromRow(team: ExternalTeamRow) {
  const ownedValue = record(team.team_metadata).is_owned;
  const isOwned =
    ownedValue === true ||
    ownedValue === 1 ||
    ownedValue === "1" ||
    ownedValue === "true";
  return {
    externalTeamId: team.id,
    yahooTeamKey: team.external_team_key,
    name: team.team_name,
    draftPosition: metadataTeamDraftPosition(team),
    isOwned,
    isUserTeam: isOwned,
  };
}

function formatSession(row: YahooDraftSessionRow, now = new Date()) {
  const staleBasisMs = Date.parse(row.last_snapshot_at || row.started_at);
  return {
    id: row.id,
    externalLeagueId: row.external_league_id,
    externalTeamId: row.external_team_id,
    gameKey: row.yahoo_game_key,
    yahooSeason: row.yahoo_season,
    targetSeasonId: row.target_season_id,
    status: row.status,
    providerStatus: row.provider_status,
    snapshotVersion: Number(row.snapshot_version),
    lastSuccessfulPollAt: row.last_snapshot_at,
    lastPickNumber: row.last_pick_number,
    nextPollAt: row.next_poll_at,
    yahooLeagueUrl: yahooLeagueDraftUrl(row.yahoo_league_key),
    stale:
      row.status === "active" &&
      Number.isFinite(staleBasisMs) && staleBasisMs < now.getTime() - 15_000,
    draftRankingId: row.draft_ranking_id,
    consecutiveFailures: row.consecutive_failures,
    lastErrorCode: row.last_error_code,
    lastErrorMessage: row.last_error_message,
    diagnostics: record(row.diagnostics),
  };
}

function formatPicks(rows: YahooDraftPickRow[]) {
  return rows.map((row) => {
    return {
      pickNumber: row.pick_number,
      roundNumber: row.round_number,
      pickInRound: row.pick_in_round,
      yahooTeamKey: row.yahoo_team_key,
      externalTeamId: row.external_team_id,
      yahooPlayerKey: row.yahoo_player_key,
      yahooPlayerId: row.yahoo_player_id,
      fhfhPlayerId: row.fhfh_player_id,
      displayName: row.player_name,
      nhlTeamAbbreviation: row.nhl_team_abbreviation,
      position: row.position,
      mappingStatus: row.mapping_status,
      cost: row.auction_cost == null ? null : Number(row.auction_cost),
      active: row.is_active,
      isCorrection: row.is_correction,
      revision: Number(row.revision),
    };
  });
}

async function loadYahooTokens(
  client: LiveDraftDb,
  connectedAccountId: string,
  userId: string,
) {
  const { data, error } = await client.rpc("get_connected_account_tokens_secure", {
    p_connected_account_id: connectedAccountId,
    p_user_id: userId,
  });
  if (error) throw queryError("Failed to load Yahoo provider tokens", error);
  const token = (Array.isArray(data) ? data[0] : data) as YahooTokenRow | null;
  if (!token?.access_token || !token.refresh_token) {
    throw new YahooLiveDraftError(
      "Yahoo authorization is unavailable. Reconnect Yahoo and try again.",
      409,
      "yahoo_reauth_required",
    );
  }
  return token as YahooTokenRow & { access_token: string; refresh_token: string };
}

async function refreshYahooTokens(args: {
  client: LiveDraftDb;
  token: YahooTokenRow & { access_token: string; refresh_token: string };
  connectedAccountId: string;
  userId: string;
  fetchImpl: FetchLike;
  now: Date;
}) {
  const { clientId, clientSecret } = getYahooClientCredentials();
  let response: Response;
  try {
    response = await args.fetchImpl("https://api.login.yahoo.com/oauth2/get_token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: args.token.refresh_token,
      }),
      cache: "no-store",
      signal: yahooRequestSignal(),
    });
  } catch {
    throw new YahooLiveDraftError(
      "Yahoo authorization could not be refreshed.",
      502,
      "yahoo_oauth_unavailable",
    );
  }

  if (!response.ok) {
    if (response.status === 429) {
      throw new YahooLiveDraftError(
        "Yahoo asked the live draft companion to slow down.",
        429,
        "yahoo_rate_limited",
        parseRetryAfterSeconds(response.headers.get("retry-after"), args.now),
      );
    }
    if (response.status >= 500) {
      throw new YahooLiveDraftError(
        "Yahoo authorization could not be refreshed.",
        502,
        "yahoo_oauth_unavailable",
        parseRetryAfterSeconds(response.headers.get("retry-after"), args.now),
      );
    }
    throw new YahooLiveDraftError(
      "Yahoo authorization has expired. Reconnect Yahoo and try again.",
      409,
      "yahoo_reauth_required",
    );
  }
  let refreshed: UnknownRecord;
  try {
    refreshed = record(await response.json());
  } catch {
    throw new YahooLiveDraftError(
      "Yahoo returned an invalid authorization response.",
      502,
      "yahoo_oauth_invalid_response",
    );
  }
  const accessToken = String(refreshed.access_token || "");
  if (!accessToken) {
    throw new YahooLiveDraftError(
      "Yahoo authorization has expired. Reconnect Yahoo and try again.",
      409,
      "yahoo_reauth_required",
    );
  }
  const refreshToken = String(refreshed.refresh_token || args.token.refresh_token);
  const expiresIn = Number(refreshed.expires_in);
  const expiresAt = Number.isFinite(expiresIn)
    ? isoAfter(args.now, Math.max(0, expiresIn))
    : null;
  const { error } = await args.client.rpc("upsert_connected_account_tokens_secure", {
    p_connected_account_id: args.connectedAccountId,
    p_user_id: args.userId,
    p_provider: YAHOO_PROVIDER,
    p_access_token: accessToken,
    p_refresh_token: refreshToken,
    p_token_type: String(refreshed.token_type || args.token.token_type || "bearer"),
    p_scopes: args.token.scopes ?? [],
    p_provider_user_id:
      String(refreshed.xoauth_yahoo_guid || args.token.provider_user_id || "") || null,
    p_expires_at: expiresAt,
    p_refresh_expires_at: args.token.refresh_expires_at,
    p_last_refreshed_at: args.now.toISOString(),
    p_secret_metadata: record(args.token.secret_metadata),
  });
  if (error) throw queryError("Failed to store refreshed Yahoo tokens", error);
  return accessToken;
}

async function yahooResponseError(response: Response, now: Date) {
  if (response.status === 401) {
    return new YahooLiveDraftError(
      "Yahoo authorization has expired. Reconnect Yahoo and try again.",
      409,
      "yahoo_reauth_required",
    );
  }
  if (response.status === 429) {
    const retryAfterSeconds = parseRetryAfterSeconds(
      response.headers.get("retry-after"),
      now,
    );
    return new YahooLiveDraftError(
      "Yahoo asked the live draft companion to slow down.",
      429,
      "yahoo_rate_limited",
      retryAfterSeconds,
    );
  }
  if (response.status === 403) {
    return new YahooLiveDraftError(
      "Yahoo denied access to this league. Reconnect Yahoo and verify league access.",
      403,
      "yahoo_access_denied",
    );
  }
  if (response.status === 404) {
    return new YahooLiveDraftError(
      "Yahoo could not find this 2026-2027 league.",
      409,
      "yahoo_league_unavailable",
    );
  }
  return new YahooLiveDraftError(
    `Yahoo draft data is temporarily unavailable (HTTP ${response.status}).`,
    502,
    "yahoo_api_error",
  );
}

export async function fetchYahooJson(args: {
  client: LiveDraftDb;
  connectedAccountId: string;
  userId: string;
  url: string;
  fetchImpl: FetchLike;
  now: Date;
}) {
  const token = await loadYahooTokens(
    args.client,
    args.connectedAccountId,
    args.userId,
  );
  let accessToken = token.access_token;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    let response: Response;
    try {
      response = await args.fetchImpl(args.url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
          "Cache-Control": "no-cache",
        },
        cache: "no-store",
        signal: yahooRequestSignal(),
      });
    } catch {
      throw new YahooLiveDraftError(
        "Yahoo draft data is temporarily unavailable.",
        502,
        "yahoo_api_unavailable",
      );
    }
    if (response.ok) {
      try {
        return await response.json();
      } catch {
        throw new YahooLiveDraftError(
          "Yahoo returned an invalid draft response.",
          502,
          "yahoo_draft_response_invalid",
        );
      }
    }
    if (response.status === 401 && attempt === 0) {
      accessToken = await refreshYahooTokens({
        client: args.client,
        token,
        connectedAccountId: args.connectedAccountId,
        userId: args.userId,
        fetchImpl: args.fetchImpl,
        now: args.now,
      });
      continue;
    }
    throw await yahooResponseError(response, args.now);
  }
  throw new YahooLiveDraftError(
    "Yahoo authorization has expired. Reconnect Yahoo and try again.",
    409,
    "yahoo_reauth_required",
  );
}

export async function requireOwnedYahooDraftLeague(
  userId: string,
  externalLeagueId: string,
  client: LiveDraftDb = serviceRoleClient as any,
): Promise<OwnedYahooLeagueContext> {
  const { data: league, error: leagueError } = await client
    .from("external_leagues")
    .select(
      "id,connected_account_id,user_id,external_league_key,league_name,season_key,league_metadata,scoring_settings,roster_settings",
    )
    .eq("id", externalLeagueId)
    .eq("user_id", userId)
    .eq("provider", YAHOO_PROVIDER)
    .maybeSingle();
  if (leagueError) throw queryError("Failed to load Yahoo league", leagueError);
  if (!league) {
    throw new YahooLiveDraftError(
      "Yahoo league was not found.",
      404,
      "yahoo_league_not_found",
    );
  }
  assertYahooLeagueKey(league.external_league_key);

  const { data: teams, error: teamError } = await client
    .from("external_teams")
    .select(
      "id,external_league_id,connected_account_id,user_id,external_team_key,team_name,team_metadata",
    )
    .eq("external_league_id", league.id)
    .eq("user_id", userId)
    .eq("provider", YAHOO_PROVIDER);
  if (teamError) throw queryError("Failed to load Yahoo teams", teamError);
  const ownedTeam = (teams ?? []).find(
    (team: ExternalTeamRow) => {
      const value = record(team.team_metadata).is_owned;
      return value === true || value === 1 || value === "1" || value === "true";
    },
  );
  if (!ownedTeam) {
    throw new YahooLiveDraftError(
      "No owned Yahoo team is available for this league.",
      409,
      "yahoo_owned_team_missing",
    );
  }
  return { league, ownedTeam };
}

async function requireDraftRanking(
  client: LiveDraftDb,
  userId: string,
  rankingId: string,
) {
  const { data, error } = await client
    .from("draft_rankings")
    .select("id,user_id,target_season_id,status")
    .eq("id", rankingId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw queryError("Failed to load draft ranking", error);
  if (
    !data ||
    data.target_season_id !== YAHOO_LIVE_DRAFT_TARGET_SEASON_ID ||
    data.status !== "active"
  ) {
    throw new YahooLiveDraftError(
      "The selected 2026-2027 draft ranking was not found.",
      404,
      "draft_ranking_not_found",
    );
  }
  return data;
}

async function defaultDraftRanking(client: LiveDraftDb, userId: string) {
  const { data, error } = await client
    .from("draft_rankings")
    .select("id")
    .eq("user_id", userId)
    .eq("target_season_id", YAHOO_LIVE_DRAFT_TARGET_SEASON_ID)
    .eq("status", "active")
    .eq("is_default", true)
    .maybeSingle();
  if (error) throw queryError("Failed to load the default draft ranking", error);
  return data?.id ? String(data.id) : null;
}

async function loadLeagueTeams(
  client: LiveDraftDb,
  userId: string,
  externalLeagueId: string,
) {
  const { data, error } = await client
    .from("external_teams")
    .select(
      "id,external_league_id,connected_account_id,user_id,external_team_key,team_name,team_metadata",
    )
    .eq("external_league_id", externalLeagueId)
    .eq("user_id", userId)
    .eq("provider", YAHOO_PROVIDER);
  if (error) throw queryError("Failed to load Yahoo league teams", error);
  return (data ?? []) as ExternalTeamRow[];
}

export async function listYahooDraftLeagues(
  userId: string,
  client: LiveDraftDb = serviceRoleClient as any,
) {
  const { data: leagues, error: leagueError } = await client
    .from("external_leagues")
    .select(
      "id,connected_account_id,user_id,external_league_key,league_name,season_key,league_metadata,scoring_settings,roster_settings",
    )
    .eq("user_id", userId)
    .eq("provider", YAHOO_PROVIDER);
  if (leagueError) throw queryError("Failed to load Yahoo leagues", leagueError);
  const eligible = ((leagues ?? []) as ExternalLeagueRow[]).filter((league) =>
    /^477\.l\.\d+$/.test(league.external_league_key),
  );
  const [teamsResult, sessionsResult, rankingId] = await Promise.all([
    client
      .from("external_teams")
      .select(
        "id,external_league_id,connected_account_id,user_id,external_team_key,team_name,team_metadata",
      )
      .eq("user_id", userId)
      .eq("provider", YAHOO_PROVIDER),
    client
      .from("yahoo_draft_sessions")
      .select(SESSION_SELECT)
      .eq("user_id", userId)
      .eq("yahoo_game_key", YAHOO_LIVE_DRAFT_GAME_KEY),
    defaultDraftRanking(client, userId),
  ]);
  if (teamsResult.error) throw queryError("Failed to load Yahoo teams", teamsResult.error);
  if (sessionsResult.error) {
    throw queryError("Failed to load Yahoo draft sessions", sessionsResult.error);
  }
  const teamRows = (teamsResult.data ?? []) as ExternalTeamRow[];
  const sessionByLeagueId = new Map(
    ((sessionsResult.data ?? []) as YahooDraftSessionRow[]).map((session) => [
      session.external_league_id,
      session,
    ]),
  );

  return {
    enabled: true,
    leagues: eligible.flatMap((league) => {
      const ownedTeam = teamRows.find(
        (team) => {
          const value = record(team.team_metadata).is_owned;
          return (
            team.external_league_id === league.id &&
            (value === true || value === 1 || value === "1" || value === "true")
          );
        },
      );
      if (!ownedTeam) return [];
      const session = sessionByLeagueId.get(league.id);
      let settings: YahooDraftSettings | null = null;
      let unsupportedReason: string | null = null;
      try {
        settings = storedSettings(league);
        if (
          settings.normalized.draftType === "offline" ||
          settings.normalized.draftType === "autopick"
        ) {
          unsupportedReason = "yahoo_draft_type_unsupported";
        }
      } catch (error) {
        unsupportedReason =
          error instanceof YahooLiveDraftError
            ? error.code
            : "yahoo_settings_unavailable";
      }
      const discovery = record(liveDraftMetadata(league).discovery);
      return [
        {
          externalLeagueId: league.id,
          externalTeamId: ownedTeam.id,
          leagueName: league.league_name,
          teamName: ownedTeam.team_name,
          gameKey: YAHOO_LIVE_DRAFT_GAME_KEY,
          season: YAHOO_LIVE_DRAFT_SEASON,
          draftPosition: metadataTeamDraftPosition(ownedTeam),
          draftType:
            settings?.normalized.draftType ??
            (typeof discovery.draft_type === "string"
              ? discovery.draft_type
              : "unknown"),
          draftStatus:
            settings?.normalized.providerStatus ??
            (typeof discovery.draft_status === "string"
              ? discovery.draft_status
              : "unknown"),
          draftTime:
            settings?.normalized.draftTime ??
            (typeof discovery.draft_time === "string"
              ? discovery.draft_time
              : null),
          pickTime:
            settings?.normalized.pickTimeSeconds ??
            (Number.isFinite(Number(discovery.pick_time))
              ? Number(discovery.pick_time)
              : null),
          supported: unsupportedReason === null,
          unsupportedReason,
          yahooLeagueUrl: yahooLeagueDraftUrl(league.external_league_key),
          session: session ? formatSession(session) : null,
        },
      ];
    }),
    ranking: { available: Boolean(rankingId), id: rankingId },
  };
}

async function updateYahooDraftMetadata(args: {
  client: LiveDraftDb;
  league: ExternalLeagueRow;
  settings: YahooDraftSettings;
  teams: YahooDraftTeam[];
  fetchedAt: string;
}) {
  const leagueMetadata = record(args.league.league_metadata);
  const { error } = await args.client
    .from("external_leagues")
    .update({
      league_metadata: {
        ...leagueMetadata,
        yahoo_live_draft: {
          ...liveDraftMetadata(args.league),
          settings: args.settings,
          teams: args.teams,
          fetched_at: args.fetchedAt,
        },
      },
      updated_at: args.fetchedAt,
    })
    .eq("id", args.league.id)
    .eq("user_id", args.league.user_id);
  if (error) throw queryError("Failed to store Yahoo draft settings", error);

  for (const yahooTeam of args.teams) {
    const { data: row, error: rowError } = await args.client
      .from("external_teams")
      .select("id,team_metadata")
      .eq("external_league_id", args.league.id)
      .eq("user_id", args.league.user_id)
      .eq("external_team_key", yahooTeam.yahooTeamKey)
      .maybeSingle();
    if (rowError) throw queryError("Failed to load Yahoo draft team", rowError);
    if (!row) continue;
    const { error: updateError } = await args.client
      .from("external_teams")
      .update({
        team_metadata: {
          ...record(row.team_metadata),
          draft_position:
            yahooTeam.draftPosition ??
            record(row.team_metadata).draft_position ??
            null,
        },
        updated_at: args.fetchedAt,
      })
      .eq("id", row.id)
      .eq("user_id", args.league.user_id);
    if (updateError) throw queryError("Failed to store Yahoo draft team", updateError);
  }
}

async function resolveYahooDraftPicks(args: {
  client: LiveDraftDb;
  userId: string;
  externalLeagueId: string;
  teamCount: number | null;
  picks: YahooDraftPick[];
}) {
  if (args.picks.length === 0) return [];
  const playerKeys = [...new Set(args.picks.map((pick) => pick.yahooPlayerKey))];
  const teamKeys = [...new Set(args.picks.map((pick) => pick.yahooTeamKey))];
  const [playerResult, identityResult, teamResult] = await Promise.all([
    args.client
      .from("yahoo_players")
      .select(
        "player_key,player_id,full_name,player_name,editorial_team_abbreviation,display_position",
      )
      .in("player_key", playerKeys),
    args.client
      .from("fhfh_player_external_identities")
      .select("external_player_id,fhfh_player_id,is_primary,verification_status")
      .eq("provider", YAHOO_PROVIDER)
      .in("external_player_id", playerKeys)
      .order("is_primary", { ascending: false }),
    args.client
      .from("external_teams")
      .select("id,external_team_key")
      .eq("external_league_id", args.externalLeagueId)
      .eq("user_id", args.userId)
      .in("external_team_key", teamKeys),
  ]);
  const error = playerResult.error ?? identityResult.error ?? teamResult.error;
  if (error) throw queryError("Failed to resolve Yahoo draft picks", error);
  const playerByKey = new Map(
    (playerResult.data ?? []).map((player: UnknownRecord) => [player.player_key, player]),
  );
  const identityByKey = new Map<string, number>();
  const reviewRequiredKeys = new Set<string>();
  for (const identity of identityResult.data ?? []) {
    if (
      identity.verification_status === "verified" &&
      !identityByKey.has(identity.external_player_id)
    ) {
      identityByKey.set(identity.external_player_id, identity.fhfh_player_id);
    } else if (identity.verification_status === "review_required") {
      reviewRequiredKeys.add(identity.external_player_id);
    }
  }
  const externalTeamIdByKey = new Map(
    (teamResult.data ?? []).map((team: UnknownRecord) => [
      team.external_team_key,
      team.id,
    ]),
  );

  return args.picks.map((pick) => {
    const player = (playerByKey.get(pick.yahooPlayerKey) ?? {}) as UnknownRecord;
    if (!args.teamCount || args.teamCount < 1) {
      throw new YahooLiveDraftError(
        "Yahoo team count is required to normalize live draft picks.",
        422,
        "yahoo_settings_confirmation_required",
      );
    }
    const fhfhPlayerId = identityByKey.get(pick.yahooPlayerKey) ?? null;
    return {
      pick_number: pick.pickNumber,
      round_number: pick.roundNumber,
      pick_in_round: ((pick.pickNumber - 1) % args.teamCount) + 1,
      yahoo_team_key: pick.yahooTeamKey,
      external_team_id: externalTeamIdByKey.get(pick.yahooTeamKey) ?? null,
      yahoo_player_key: pick.yahooPlayerKey,
      yahoo_player_id: String(pick.yahooPlayerId),
      fhfh_player_id: fhfhPlayerId,
      mapping_status:
        fhfhPlayerId !== null
          ? "mapped"
          : reviewRequiredKeys.has(pick.yahooPlayerKey)
            ? "review_required"
            : "unmapped",
      player_name:
        pick.playerName || player.full_name || player.player_name || null,
      nhl_team_abbreviation:
        pick.nhlTeamAbbreviation || player.editorial_team_abbreviation || null,
      position: pick.position || player.display_position || null,
      auction_cost: pick.cost,
      is_correction: false,
    };
  });
}

async function auditStart(
  client: LiveDraftDb,
  userId: string,
  session: YahooDraftSessionRow,
  startedAt: string,
) {
  if (session.last_provider_sync_run_id) {
    return session.last_provider_sync_run_id;
  }
  const { data, error } = await client
    .from("provider_sync_runs")
    .insert({
      user_id: userId,
      provider: YAHOO_PROVIDER,
      connected_account_id: session.connected_account_id,
      external_league_id: session.external_league_id,
      external_team_id: session.external_team_id,
      trigger_source: "live_draft_poll",
      status: "running",
      started_at: startedAt,
    })
    .select("id")
    .single();
  if (error) return null;
  const auditId = data?.id ? String(data.id) : null;
  if (!auditId) return null;
  const { error: sessionError } = await client
    .from("yahoo_draft_sessions")
    .update({ last_provider_sync_run_id: auditId })
    .eq("id", session.id)
    .eq("user_id", userId)
    .is("last_provider_sync_run_id", null);
  if (sessionError) return null;
  return auditId;
}

async function auditFinish(
  client: LiveDraftDb,
  auditId: string | null,
  userId: string,
  update: UnknownRecord,
) {
  if (!auditId) return;
  await client
    .from("provider_sync_runs")
    .update(update)
    .eq("id", auditId)
    .eq("user_id", userId)
    .eq("status", "running");
}

async function auditHeartbeat(
  client: LiveDraftDb,
  auditId: string | null,
  userId: string,
  update: UnknownRecord,
) {
  if (!auditId) return;
  await client
    .from("provider_sync_runs")
    .update(update)
    .eq("id", auditId)
    .eq("user_id", userId)
    .eq("status", "running");
}

export async function loadYahooDraftSession(
  userId: string,
  sessionId: string,
  client: LiveDraftDb = serviceRoleClient as any,
  now = new Date(),
) {
  const { data: session, error: sessionError } = await client
    .from("yahoo_draft_sessions")
    .select(SESSION_SELECT)
    .eq("id", sessionId)
    .eq("user_id", userId)
    .maybeSingle();
  if (sessionError) throw queryError("Failed to load Yahoo draft session", sessionError);
  if (!session) {
    throw new YahooLiveDraftError(
      "Yahoo draft session was not found.",
      404,
      "yahoo_draft_session_not_found",
    );
  }
  const [picksResult, leagueResult, teams] = await Promise.all([
    client
      .from("yahoo_draft_picks")
      .select(PICK_SELECT)
      .eq("session_id", sessionId)
      .eq("user_id", userId)
      .order("pick_number", { ascending: true }),
    client
      .from("external_leagues")
      .select(
        "id,connected_account_id,user_id,external_league_key,league_name,season_key,league_metadata,scoring_settings,roster_settings",
      )
      .eq("id", session.external_league_id)
      .eq("user_id", userId)
      .maybeSingle(),
    loadLeagueTeams(client, userId, session.external_league_id),
  ]);
  if (picksResult.error) throw queryError("Failed to load Yahoo draft picks", picksResult.error);
  if (leagueResult.error || !leagueResult.data) {
    throw queryError("Failed to load Yahoo draft league", leagueResult.error);
  }
  const stored = record(session.normalized_settings);
  const settings = Object.keys(stored).length
    ? ({ ...stored, diagnostics: record(session.diagnostics) } as YahooDraftSettings)
    : storedSettings(leagueResult.data as ExternalLeagueRow);
  return {
    session: formatSession(session as YahooDraftSessionRow, now),
    teams: teams.map(apiTeamFromRow),
    settings,
    picks: formatPicks((picksResult.data ?? []) as YahooDraftPickRow[]),
  };
}

function sessionStatusAfterSnapshot(
  providerStatus: YahooDraftProviderStatus,
  currentStatus: string,
) {
  if (providerStatus === "unknown") {
    return currentStatus === "active" ? "active" : "predraft";
  }
  if (providerStatus === "predraft" && currentStatus === "active") {
    return "active";
  }
  return sessionStatusForProvider(providerStatus);
}

function inferProviderStatus(args: {
  parsed: YahooDraftProviderStatus;
  current: YahooDraftProviderStatus;
  pickCount: number;
  teamCount: number | null;
  rosterConfig: Record<string, number>;
  allowCompletionInference: boolean;
}) {
  const rosterSize = Object.values(args.rosterConfig).reduce(
    (sum, count) => sum + count,
    0,
  );
  const expectedPickCount =
    args.teamCount && rosterSize > 0 ? args.teamCount * rosterSize : null;
  if (args.parsed === "postdraft") return "postdraft";
  if (
    args.allowCompletionInference &&
    expectedPickCount &&
    args.pickCount >= expectedPickCount
  ) {
    return "postdraft";
  }
  if (
    args.parsed === "drafting" ||
    args.pickCount > 0 ||
    args.current === "drafting"
  ) {
    return "drafting";
  }
  if (args.parsed === "predraft") return "predraft";
  return args.current === "postdraft" ? "postdraft" : "predraft";
}

export async function pollYahooDraftSession(
  userId: string,
  sessionId: string,
  options: PollOptions = {},
) {
  const client = options.client ?? (serviceRoleClient as any);
  const fetchImpl = options.fetchImpl ?? fetch;
  const observedAt = (options.now ?? (() => new Date()))();
  const { data: claimData, error: claimError } = await client.rpc(
    "claim_yahoo_draft_poll",
    {
      p_session_id: sessionId,
      p_user_id: userId,
      p_lease_seconds: 30,
      p_claimed_at: observedAt.toISOString(),
    },
  );
  if (claimError) {
    if (String(claimError.message).includes("YAHOO_DRAFT_SESSION_NOT_FOUND")) {
      throw new YahooLiveDraftError(
        "Yahoo draft session was not found.",
        404,
        "yahoo_draft_session_not_found",
      );
    }
    throw queryError("Failed to claim Yahoo draft polling lease", claimError);
  }
  const claim = firstRpcObject(claimData);
  if (claim.claimed !== true) {
    const state = await loadYahooDraftSession(userId, sessionId, client, observedAt);
    const retryAt = Date.parse(String(claim.retryAt || state.session.nextPollAt));
    return {
      ...state,
      poll: {
        claimed: false,
        unchanged: true,
        retryAfterSeconds: Number.isFinite(retryAt)
          ? Math.max(0, Math.ceil((retryAt - observedAt.getTime()) / 1000))
          : 5,
      },
    };
  }
  const leaseToken = String(claim.leaseToken || "");
  if (!leaseToken) throw new Error("Yahoo draft poll lease did not return a token.");

  const { data: session, error: sessionError } = await client
    .from("yahoo_draft_sessions")
    .select(SESSION_SELECT)
    .eq("id", sessionId)
    .eq("user_id", userId)
    .maybeSingle();
  if (sessionError || !session) {
    throw sessionError
      ? queryError("Failed to load the claimed Yahoo draft session", sessionError)
      : new YahooLiveDraftError(
          "Yahoo draft session was not found.",
          404,
          "yahoo_draft_session_not_found",
        );
  }
  const auditId = await auditStart(
    client,
    userId,
    session,
    observedAt.toISOString(),
  );

  try {
    const payload = await fetchYahooJson({
      client,
      connectedAccountId: session.connected_account_id,
      userId,
      url: yahooFantasyResourceUrl(session.yahoo_league_key, "draftresults"),
      fetchImpl,
      now: observedAt,
    });
    const snapshot = parseYahooDraftResults(payload);
    if (snapshot.leagueKey && snapshot.leagueKey !== session.yahoo_league_key) {
      throw new YahooLiveDraftError(
        "Yahoo returned draft results for a different league.",
        502,
        "yahoo_draft_response_invalid",
      );
    }
    if (
      snapshot.picks.some(
        (pick) =>
          !pick.yahooTeamKey.startsWith(`${session.yahoo_league_key}.t.`),
      )
    ) {
      throw new YahooLiveDraftError(
        "Yahoo returned draft results for a different league.",
        502,
        "yahoo_draft_response_invalid",
      );
    }
    const { data: league, error: leagueError } = await client
      .from("external_leagues")
      .select(
        "id,connected_account_id,user_id,external_league_key,league_name,season_key,league_metadata,scoring_settings,roster_settings",
      )
      .eq("id", session.external_league_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (leagueError || !league) throw queryError("Failed to load Yahoo league settings", leagueError);
    const stored = record(session.normalized_settings);
    const settings = Object.keys(stored).length
      ? ({ ...stored, diagnostics: record(session.diagnostics) } as YahooDraftSettings)
      : storedSettings(league as ExternalLeagueRow);
    const providerStatus = inferProviderStatus({
      parsed: snapshot.providerStatus,
      current: session.provider_status as YahooDraftProviderStatus,
      pickCount: snapshot.picks.length,
      teamCount: settings.teamCount,
      rosterConfig: settings.rosterConfig,
      allowCompletionInference:
        settings.diagnostics.unsupportedRosterSlots.length === 0 &&
        settings.diagnostics.draftPositionsComplete,
    });
    snapshot.providerStatus = providerStatus;
    const picks = await resolveYahooDraftPicks({
      client,
      userId,
      externalLeagueId: session.external_league_id,
      teamCount: settings.normalized.teamCount,
      picks: snapshot.picks,
    });
    const status = sessionStatusAfterSnapshot(providerStatus, session.status);
    const delaySeconds =
      status === "active" ? 5 : yahooDraftPollDelaySeconds({ providerStatus });
    const nextPollAt = isoAfter(observedAt, delaySeconds);
    const { data: appliedData, error: applyError } = await client.rpc(
      "apply_yahoo_draft_snapshot",
      {
        p_session_id: sessionId,
        p_user_id: userId,
        p_lease_token: leaseToken,
        p_snapshot_hash: hashYahooDraftSnapshot(snapshot, picks),
        p_status: status,
        p_provider_status: providerStatus,
        p_normalized_settings: normalizedSettingsPayload(settings),
        p_diagnostics: settings.diagnostics,
        p_provider_sync_run_id: auditId,
        p_picks: picks,
        p_next_poll_at: nextPollAt,
        p_observed_at: observedAt.toISOString(),
      },
    );
    if (applyError) throw queryError("Failed to apply Yahoo draft snapshot", applyError);
    const applied = firstRpcObject(appliedData);
    const auditUpdate = {
      result_summary: {
        session_id: sessionId,
        changed: applied.changed === true,
        snapshot_version: applied.snapshotVersion,
        active_pick_count: applied.activePickCount,
        provider_status: providerStatus,
      },
      ...(status === "complete"
        ? { status: "succeeded", finished_at: new Date().toISOString() }
        : {}),
    };
    await auditHeartbeat(client, auditId, userId, auditUpdate);
    const state = await loadYahooDraftSession(userId, sessionId, client, observedAt);
    return {
      ...state,
      poll: {
        claimed: true,
        unchanged: applied.changed !== true,
        retryAfterSeconds: delaySeconds,
      },
    };
  } catch (error) {
    const controlled =
      error instanceof YahooLiveDraftError
        ? error
        : new YahooLiveDraftError(
            "Yahoo draft polling failed.",
            502,
            "yahoo_draft_poll_failed",
          );
    const status =
      controlled.code === "yahoo_reauth_required" ? "reauth_required" : null;
    const retryAfterSeconds = yahooDraftPollDelaySeconds({
      providerStatus: session.provider_status as YahooDraftProviderStatus,
      consecutiveFailures: Number(session.consecutive_failures) + 1,
      retryAfterSeconds: controlled.retryAfterSeconds,
    });
    const retryAt = isoAfter(observedAt, retryAfterSeconds);
    const { error: failureError } = await client.rpc(
      "record_yahoo_draft_poll_failure",
      {
        p_session_id: sessionId,
        p_user_id: userId,
        p_lease_token: leaseToken,
        p_error_code: controlled.code,
        p_error_message: controlled.message,
        p_retry_at: retryAt,
        p_status: status,
        p_failed_at: observedAt.toISOString(),
      },
    );
    const terminal = status === "reauth_required";
    await auditHeartbeat(client, auditId, userId, {
      ...(terminal
        ? { status: "failed", finished_at: new Date().toISOString() }
        : {}),
      error_details: { code: controlled.code, message: controlled.message },
      cooldown_until: retryAt,
    });
    if (failureError) throw queryError("Failed to record Yahoo draft poll failure", failureError);
    throw new YahooLiveDraftError(
      controlled.message,
      controlled.statusCode,
      controlled.code,
      retryAfterSeconds,
    );
  }
}

export async function createYahooDraftSession(
  userId: string,
  input: { externalLeagueId: string; draftRankingId?: string | null },
  options: PollOptions = {},
) {
  const client = options.client ?? (serviceRoleClient as any);
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = (options.now ?? (() => new Date()))();
  const context = await requireOwnedYahooDraftLeague(
    userId,
    input.externalLeagueId,
    client,
  );
  const rankingId =
    input.draftRankingId === undefined
      ? await defaultDraftRanking(client, userId)
      : input.draftRankingId;
  if (rankingId) await requireDraftRanking(client, userId, rankingId);

  // Yahoo HTTP is deliberately completed before the session upsert transaction.
  const settingsPayload = await fetchYahooJson({
    client,
    connectedAccountId: context.league.connected_account_id,
    userId,
    url: yahooFantasyResourceUrl(context.league.external_league_key, "settings"),
    fetchImpl,
    now,
  });
  let settings = parseYahooDraftSettings(settingsPayload);
  if (
    settings.normalized.draftType === "offline" ||
    settings.normalized.draftType === "autopick"
  ) {
    throw new YahooLiveDraftError(
      "This Yahoo draft type is not supported by live draft sync.",
      422,
      "yahoo_draft_type_unsupported",
    );
  }
  const teamsPayload = await fetchYahooJson({
    client,
    connectedAccountId: context.league.connected_account_id,
    userId,
    url: yahooFantasyResourceUrl(context.league.external_league_key, "teams"),
    fetchImpl,
    now,
  });
  const teams = parseYahooDraftTeams(teamsPayload);
  if (
    teams.length === 0 ||
    !teams.some(
      (team) => team.yahooTeamKey === context.ownedTeam.external_team_key,
    ) ||
    teams.some(
      (team) =>
        !team.yahooTeamKey.startsWith(
          `${context.league.external_league_key}.t.`,
        ),
    )
  ) {
    throw new YahooLiveDraftError(
      "Yahoo returned teams for a different or incomplete league.",
      502,
      "yahoo_draft_response_invalid",
    );
  }
  settings = settingsWithTeamCount(settings, teams.length);
  settings = applyYahooTeamDraftPositionDiagnostics(settings, teams);
  await updateYahooDraftMetadata({
    client,
    league: context.league,
    settings,
    teams,
    fetchedAt: now.toISOString(),
  });
  const providerStatus = settings.normalized.providerStatus;
  // POST means the user clicked Start; providerStatus remains independently
  // predraft until Yahoo begins, while the companion polls at live cadence.
  const initialStatus = "active";
  const { data: existingSession } = await client
    .from("yahoo_draft_sessions")
    .select("id,last_provider_sync_run_id")
    .eq("user_id", userId)
    .eq("yahoo_league_key", context.league.external_league_key)
    .maybeSingle();
  if (existingSession?.last_provider_sync_run_id) {
    await auditFinish(client, existingSession.last_provider_sync_run_id, userId, {
      status: "succeeded",
      finished_at: now.toISOString(),
      result_summary: {
        session_id: existingSession.id,
        restarted: true,
      },
    });
  }
  const { data: session, error } = await client
    .from("yahoo_draft_sessions")
    .upsert(
      {
        user_id: userId,
        connected_account_id: context.league.connected_account_id,
        external_league_id: context.league.id,
        external_team_id: context.ownedTeam.id,
        draft_ranking_id: rankingId ?? null,
        yahoo_game_key: YAHOO_LIVE_DRAFT_GAME_KEY,
        yahoo_season: Number(YAHOO_LIVE_DRAFT_SEASON),
        target_season_id: YAHOO_LIVE_DRAFT_TARGET_SEASON_ID,
        yahoo_league_key: context.league.external_league_key,
        yahoo_team_key: context.ownedTeam.external_team_key,
        normalized_settings: normalizedSettingsPayload(settings),
        diagnostics: settings.diagnostics,
        last_provider_sync_run_id: null,
        status: initialStatus,
        provider_status: providerStatus,
        poll_lease_token: null,
        poll_lease_expires_at: null,
        next_poll_at: now.toISOString(),
        consecutive_failures: 0,
        last_error_code: null,
        last_error_message: null,
        started_at: now.toISOString(),
        completed_at: null,
      },
      { onConflict: "user_id,yahoo_league_key" },
    )
    .select(SESSION_SELECT)
    .single();
  if (error || !session) throw queryError("Failed to create Yahoo draft session", error);
  return pollYahooDraftSession(userId, session.id, {
    client,
    fetchImpl,
    now: () => now,
  });
}

export async function stopYahooDraftSession(
  userId: string,
  sessionId: string,
  client: LiveDraftDb = serviceRoleClient as any,
) {
  const { data: existing, error: existingError } = await client
    .from("yahoo_draft_sessions")
    .select("last_provider_sync_run_id")
    .eq("id", sessionId)
    .eq("user_id", userId)
    .maybeSingle();
  if (existingError) throw queryError("Failed to load Yahoo draft session", existingError);
  const { data, error } = await client
    .from("yahoo_draft_sessions")
    .update({
      status: "stopped",
      poll_lease_token: null,
      poll_lease_expires_at: null,
      last_error_code: null,
      last_error_message: null,
      completed_at: null,
    })
    .eq("id", sessionId)
    .eq("user_id", userId)
    .select("id")
    .maybeSingle();
  if (error) throw queryError("Failed to stop Yahoo draft session", error);
  if (!data) {
    throw new YahooLiveDraftError(
      "Yahoo draft session was not found.",
      404,
      "yahoo_draft_session_not_found",
    );
  }
  if (existing?.last_provider_sync_run_id) {
    await auditFinish(client, existing.last_provider_sync_run_id, userId, {
      status: "succeeded",
      finished_at: new Date().toISOString(),
      result_summary: { session_id: sessionId, stopped_by_user: true },
    });
  }
  return loadYahooDraftSession(userId, sessionId, client);
}
