import serviceRoleClient from "lib/supabase/server";

import {
  getYahooLiveDraftResponseFormat,
  yahooLiveDraftComparisonEnabled,
  YAHOO_PROVIDER,
} from "./config";
import {
  assertYahooLeagueGameContext,
  resolveYahooGameContext,
  type YahooGameContext,
} from "./gameContext";
import {
  assertYahooLeagueKey,
  applyYahooTeamDraftPositionDiagnostics,
  hashYahooDraftSnapshot,
  parseYahooDraftResults,
  parseYahooDraftSettings,
  parseYahooDraftTeams,
  sessionStatusForProvider,
  yahooLeagueDraftUrl,
  YahooLiveDraftError,
  type YahooDraftPick,
  type YahooDraftProviderStatus,
  type YahooDraftSettings,
  type YahooDraftTeam,
} from "./liveDraft";
import type { YahooLiveDraftClient } from "./liveDraftDatabase";
import {
  recordYahooDraftPollObservation,
  transportObservation,
} from "./observability";
import {
  yahooDraftBurstEnabled,
  yahooDraftPollDelaySeconds,
} from "./pollPolicy";
import {
  fetchYahooDraftResource,
  YahooProviderRequestError,
  type YahooProviderTransportMetadata,
} from "./providerClient";

type LiveDraftDb = YahooLiveDraftClient;
type FetchLike = typeof fetch;
type UnknownRecord = Record<string, unknown>;

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
  last_nudged_at: string | null;
  last_worker_heartbeat_at: string | null;
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
  mapping_revision: number;
  correction_confirmed_at: string | null;
  first_observed_at: string;
  last_observed_at: string;
};

type OwnedYahooLeagueContext = {
  league: ExternalLeagueRow;
  ownedTeam: ExternalTeamRow;
};

type PollOptions = {
  client?: LiveDraftDb;
  context?: YahooGameContext;
  fetchImpl?: FetchLike;
  now?: () => Date;
  random?: () => number;
};

const SESSION_SELECT =
  "id,user_id,connected_account_id,external_league_id,external_team_id,draft_ranking_id,yahoo_game_key,yahoo_season,target_season_id,yahoo_league_key,yahoo_team_key,normalized_settings,diagnostics,last_provider_sync_run_id,status,provider_status,snapshot_hash,snapshot_version,last_pick_number,last_snapshot_at,last_changed_at,next_poll_at,last_polled_at,last_nudged_at,last_worker_heartbeat_at,consecutive_failures,last_error_code,last_error_message,started_at,completed_at,created_at,updated_at";
const PICK_SELECT =
  "session_id,pick_number,round_number,pick_in_round,yahoo_team_key,external_team_id,yahoo_player_key,yahoo_player_id,fhfh_player_id,mapping_status,player_name,nhl_team_abbreviation,position,auction_cost,is_active,is_correction,revision,mapping_revision,correction_confirmed_at,first_observed_at,last_observed_at";

function record(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {};
}

function firstRpcObject(value: unknown): UnknownRecord {
  return record(Array.isArray(value) ? value[0] : value);
}

function queryError(prefix: string, error: unknown) {
  const message =
    error && typeof error === "object" && "message" in error
      ? String(error.message)
      : "unknown database error";
  return new Error(`${prefix}: ${message}`);
}

function isoAfter(date: Date, seconds: number) {
  return new Date(date.getTime() + seconds * 1000).toISOString();
}

function liveDraftMetadata(league: ExternalLeagueRow) {
  return record(record(league.league_metadata).yahoo_live_draft);
}

function storedSettings(
  league: ExternalLeagueRow,
  context: YahooGameContext,
): YahooDraftSettings {
  const metadata = liveDraftMetadata(league);
  if (record(metadata.settings).normalized) {
    return metadata.settings as YahooDraftSettings;
  }
  return parseYahooDraftSettings(
    {
      league_key: league.external_league_key,
      ...record(league.league_metadata),
      ...record(league.scoring_settings),
      ...record(league.roster_settings),
    },
    context,
  );
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
  const staleAgeMs = Number.isFinite(staleBasisMs)
    ? now.getTime() - staleBasisMs
    : Number.POSITIVE_INFINITY;
  const staleSeverity =
    row.status === "active" && staleAgeMs > 60_000
      ? "critical"
      : row.status === "active" && staleAgeMs > 20_000
        ? "warning"
        : "fresh";
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
    lastWorkerHeartbeatAt: row.last_worker_heartbeat_at,
    yahooLeagueUrl: yahooLeagueDraftUrl(row.yahoo_league_key, {
      gameCode: "nhl",
      gameKey: row.yahoo_game_key,
      season: String(row.yahoo_season),
      targetSeasonId: row.target_season_id,
    }),
    stale: staleSeverity !== "fresh",
    staleSeverity,
    draftRankingId: row.draft_ranking_id,
    consecutiveFailures: row.consecutive_failures,
    lastErrorCode: row.last_error_code,
    lastErrorMessage: row.last_error_message,
    diagnostics: record(row.diagnostics),
  };
}

function formatPicks(
  rows: YahooDraftPickRow[],
  nhlPlayerIdByIdentityId: Map<number, number>,
  gameKey: string,
) {
  return rows.map((row) => {
    return {
      pickNumber: row.pick_number,
      roundNumber: row.round_number,
      pickInRound: row.pick_in_round,
      yahooTeamKey: row.yahoo_team_key,
      externalTeamId: row.external_team_id,
      yahooPlayerKey: row.yahoo_player_key,
      yahooPlayerId: row.yahoo_player_id,
      yahooGameKey: gameKey,
      fhfhPlayerId: row.fhfh_player_id,
      nhlPlayerId:
        row.fhfh_player_id === null
          ? null
          : (nhlPlayerIdByIdentityId.get(row.fhfh_player_id) ?? null),
      displayName: row.player_name,
      nhlTeamAbbreviation: row.nhl_team_abbreviation,
      position: row.position,
      mappingStatus: row.mapping_status,
      cost: row.auction_cost == null ? null : Number(row.auction_cost),
      active: row.is_active,
      isCorrection: row.is_correction,
      revision: Number(row.revision),
      mappingRevision: Number(row.mapping_revision),
      correctionConfirmedAt: row.correction_confirmed_at,
    };
  });
}

export async function requireOwnedYahooDraftLeague(
  userId: string,
  externalLeagueId: string,
  client: LiveDraftDb = serviceRoleClient as unknown as LiveDraftDb,
  configuredContext?: YahooGameContext,
): Promise<OwnedYahooLeagueContext> {
  const context =
    configuredContext ?? (await resolveYahooGameContext(client));
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
  assertYahooLeagueKey(league.external_league_key, context);
  assertYahooLeagueGameContext(league.external_league_key, context);

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
  context: YahooGameContext,
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
    data.target_season_id !== context.targetSeasonId ||
    data.status !== "active"
  ) {
    throw new YahooLiveDraftError(
      "The selected configured-season draft ranking was not found.",
      404,
      "draft_ranking_not_found",
    );
  }
  return data;
}

async function defaultDraftRanking(
  client: LiveDraftDb,
  userId: string,
  context: YahooGameContext,
) {
  const { data, error } = await client
    .from("draft_rankings")
    .select("id")
    .eq("user_id", userId)
    .eq("target_season_id", context.targetSeasonId)
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
  client: LiveDraftDb = serviceRoleClient as unknown as LiveDraftDb,
) {
  const context = await resolveYahooGameContext(client);
  const { data: leagues, error: leagueError } = await client
    .from("external_leagues")
    .select(
      "id,connected_account_id,user_id,external_league_key,league_name,season_key,league_metadata,scoring_settings,roster_settings",
    )
    .eq("user_id", userId)
    .eq("provider", YAHOO_PROVIDER);
  if (leagueError) throw queryError("Failed to load Yahoo leagues", leagueError);
  const eligible = ((leagues ?? []) as ExternalLeagueRow[]).filter((league) => {
    try {
      assertYahooLeagueKey(league.external_league_key, context);
      return true;
    } catch {
      return false;
    }
  });
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
      .eq("yahoo_game_key", context.gameKey),
    defaultDraftRanking(client, userId, context),
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
        settings = storedSettings(league, context);
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
          gameKey: context.gameKey,
          season: context.season,
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
          yahooLeagueUrl: yahooLeagueDraftUrl(
            league.external_league_key,
            context,
          ),
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
    const storedDraftPosition = Number(
      record(row.team_metadata).draft_position,
    );
    const { error: updateError } = await args.client
      .from("external_teams")
      .update({
        team_metadata: {
          ...record(row.team_metadata),
          draft_position:
            yahooTeam.draftPosition ??
            (Number.isInteger(storedDraftPosition) && storedDraftPosition > 0
              ? storedDraftPosition
              : null),
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
  context: YahooGameContext;
  userId: string;
  externalLeagueId: string;
  teamCount: number | null;
  picks: YahooDraftPick[];
}) {
  if (args.picks.length === 0) return [];
  const playerKeys = [...new Set(args.picks.map((pick) => pick.yahooPlayerKey))];
  const teamKeys = [...new Set(args.picks.map((pick) => pick.yahooTeamKey))];
  const identityContextKey = `yahoo:game:${args.context.gameKey}:season:${args.context.season}`;
  const [playerResult, identityResult, teamResult] = await Promise.all([
    args.client
      .from("yahoo_players")
      .select(
        "player_key,player_id,full_name,player_name,editorial_team_abbreviation,display_position",
      )
      .in("player_key", playerKeys),
    args.client
      .from("fhfh_player_external_identities")
      .select(
        "external_player_id,fhfh_player_id,is_primary,verification_status,context_key,season_id",
      )
      .eq("provider", YAHOO_PROVIDER)
      .eq("context_key", identityContextKey)
      .eq("season_id", args.context.targetSeasonId)
      .in("external_player_id", playerKeys)
      .order("is_primary", { ascending: false }),
    args.client
      .from("external_teams")
      .select("id,external_team_key")
      .eq("external_league_id", args.externalLeagueId)
      .eq("user_id", args.userId)
      .in("external_team_key", teamKeys),
  ]);
  const identityIds = [
    ...new Set(
      (identityResult.data ?? []).map((identity) => identity.fhfh_player_id),
    ),
  ];
  const canonicalResult = identityIds.length
    ? await args.client
        .from("fhfh_player_identities")
        .select("id,verification_status")
        .in("id", identityIds)
    : { data: [], error: null };
  const error =
    playerResult.error ??
    identityResult.error ??
    teamResult.error ??
    canonicalResult.error;
  if (error) throw queryError("Failed to resolve Yahoo draft picks", error);
  const playerByKey = new Map<string, UnknownRecord>(
    (playerResult.data ?? []).flatMap((player) =>
      typeof player.player_key === "string"
        ? [[player.player_key, player as UnknownRecord] as const]
        : [],
    ),
  );
  const verifiedCanonicalIds = new Set(
    (canonicalResult.data ?? [])
      .filter((identity) => identity.verification_status === "verified")
      .map((identity) => identity.id),
  );
  const identitiesByKey = new Map<string, Set<number>>();
  const reviewRequiredKeys = new Set<string>();
  for (const identity of identityResult.data ?? []) {
    if (
      identity.verification_status === "verified" &&
      verifiedCanonicalIds.has(identity.fhfh_player_id)
    ) {
      const ids = identitiesByKey.get(identity.external_player_id) ?? new Set<number>();
      ids.add(identity.fhfh_player_id);
      identitiesByKey.set(identity.external_player_id, ids);
    } else if (identity.verification_status === "review_required") {
      reviewRequiredKeys.add(identity.external_player_id);
    }
  }
  const identityByKey = new Map<string, number>();
  for (const [key, ids] of identitiesByKey) {
    if (ids.size === 1) identityByKey.set(key, [...ids][0]);
    else if (ids.size > 1) reviewRequiredKeys.add(key);
  }
  const externalTeamIdByKey = new Map<string, string>(
    (teamResult.data ?? []).flatMap((team) =>
      typeof team.external_team_key === "string" && typeof team.id === "string"
        ? [[team.external_team_key, team.id] as const]
        : [],
    ),
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
        pick.playerName ||
        (typeof player.full_name === "string" ? player.full_name : null) ||
        (typeof player.player_name === "string" ? player.player_name : null),
      nhl_team_abbreviation:
        pick.nhlTeamAbbreviation ||
        (typeof player.editorial_team_abbreviation === "string"
          ? player.editorial_team_abbreviation
          : null),
      position:
        pick.position ||
        (typeof player.display_position === "string"
          ? player.display_position
          : null),
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
  client: LiveDraftDb = serviceRoleClient as unknown as LiveDraftDb,
  now = new Date(),
  configuredContext?: YahooGameContext,
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
  const context =
    configuredContext ?? (await resolveYahooGameContext(client));
  if (
    session.yahoo_game_key !== context.gameKey ||
    Number(session.yahoo_season) !== Number(context.season) ||
    Number(session.target_season_id) !== context.targetSeasonId
  ) {
    throw new YahooLiveDraftError(
      "Yahoo draft session does not match the configured season.",
      409,
      "yahoo_game_context_mismatch",
    );
  }
  const { error: reconcileError } = await client.rpc(
    "reconcile_yahoo_draft_pick_identities",
    { p_session_id: sessionId },
  );
  if (reconcileError) {
    throw queryError("Failed to reconcile Yahoo draft-pick identities", reconcileError);
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
    : storedSettings(leagueResult.data as ExternalLeagueRow, context);
  const pickRows = (picksResult.data ?? []) as YahooDraftPickRow[];
  const identityIds = [
    ...new Set(
      pickRows.flatMap((pick) =>
        pick.fhfh_player_id === null ? [] : [pick.fhfh_player_id],
      ),
    ),
  ];
  const identityResult = identityIds.length
    ? await client
        .from("fhfh_player_identities")
        .select("id,nhl_player_id,verification_status")
        .in("id", identityIds)
    : { data: [], error: null };
  if (identityResult.error) {
    throw queryError("Failed to load canonical draft-pick identities", identityResult.error);
  }
  const nhlPlayerIdByIdentityId = new Map(
    (identityResult.data ?? [])
      .filter(
        (identity) =>
          identity.verification_status === "verified" &&
          identity.nhl_player_id !== null,
      )
      .map((identity) => [identity.id, Number(identity.nhl_player_id)]),
  );
  return {
    session: formatSession(session as YahooDraftSessionRow, now),
    teams: teams.map(apiTeamFromRow),
    settings,
    picks: formatPicks(pickRows, nhlPlayerIdByIdentityId, context.gameKey),
  };
}

function sessionStatusAfterSnapshot(
  providerStatus: YahooDraftProviderStatus,
  currentStatus: string,
  postdraftConfirmed: boolean,
) {
  if (providerStatus === "postdraft" && !postdraftConfirmed) return "active";
  if (providerStatus === "unknown")
    return currentStatus === "active" ? "active" : "predraft";
  return sessionStatusForProvider(providerStatus);
}

function inferProviderStatus(args: {
  parsed: YahooDraftProviderStatus;
  current: YahooDraftProviderStatus;
  pickCount: number;
}) {
  if (args.parsed === "postdraft") return "postdraft";
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

type ExistingYahooPick = Pick<
  YahooDraftPickRow,
  | "pick_number"
  | "round_number"
  | "auction_cost"
  | "yahoo_player_key"
  | "yahoo_team_key"
>;

function providerPickChanged(
  existing: ExistingYahooPick,
  incoming: YahooDraftPick,
) {
  return (
    incoming.roundNumber !== existing.round_number ||
    incoming.cost !==
      (existing.auction_cost === null ? null : Number(existing.auction_cost)) ||
    incoming.yahooPlayerKey !== existing.yahoo_player_key ||
    incoming.yahooTeamKey !== existing.yahoo_team_key
  );
}

export function correctedIncomingPickNumbers(
  existing: ExistingYahooPick[],
  incoming: YahooDraftPick[],
) {
  const existingByNumber = new Map(
    existing.map((pick) => [pick.pick_number, pick]),
  );
  return new Set(
    incoming.flatMap((pick) => {
      const previous = existingByNumber.get(pick.pickNumber);
      return previous && providerPickChanged(previous, pick)
        ? [pick.pickNumber]
        : [];
    }),
  );
}

export function snapshotRequiresCorrectionConfirmation(
  existing: ExistingYahooPick[],
  incoming: YahooDraftPick[],
) {
  if (incoming.some((pick, index) => pick.pickNumber !== index + 1)) {
    return true;
  }
  if (incoming.length < existing.length) return true;
  const incomingByNumber = new Map(
    incoming.map((pick) => [pick.pickNumber, pick]),
  );
  return (
    correctedIncomingPickNumbers(existing, incoming).size > 0 ||
    existing.some((pick) => !incomingByNumber.has(pick.pick_number))
  );
}

export function postdraftConfirmation(args: {
  diagnostics: UnknownRecord;
  observedAt: Date;
  providerStatus: YahooDraftProviderStatus;
  snapshotHash: string;
}) {
  if (args.providerStatus !== "postdraft") {
    return { confirmed: false, diagnostics: { ...args.diagnostics, postdraft: null } };
  }
  const previous = record(args.diagnostics.postdraft);
  const previousAt = Date.parse(String(previous.firstObservedAt ?? ""));
  const sameSnapshot = previous.snapshotHash === args.snapshotHash;
  const confirmed =
    Number(previous.observations ?? 0) >= 1 &&
    sameSnapshot &&
    Number.isFinite(previousAt) &&
    args.observedAt.getTime() - previousAt >= 5_000;
  return {
    confirmed,
    diagnostics: {
      ...args.diagnostics,
      postdraft: {
        firstObservedAt:
          sameSnapshot && Number.isFinite(previousAt)
            ? String(previous.firstObservedAt)
            : args.observedAt.toISOString(),
        observations: confirmed ? Number(previous.observations ?? 1) + 1 : 1,
        snapshotHash: args.snapshotHash,
      },
    },
  };
}

function adaptiveDiagnostics(args: {
  changed: boolean;
  diagnostics: UnknownRecord;
}) {
  const previousUnchanged = Number(args.diagnostics.unchangedPolls ?? 0);
  const previousBurst = Number(args.diagnostics.burstPollsRemaining ?? 0);
  return {
    ...args.diagnostics,
    burstPollsRemaining: args.changed
      ? 2
      : Math.max(0, previousBurst - 1),
    unchangedPolls: args.changed ? 0 : Math.max(0, previousUnchanged) + 1,
  };
}

function assertSnapshotMatchesSession(
  snapshot: ReturnType<typeof parseYahooDraftResults>,
  session: YahooDraftSessionRow,
) {
  if (snapshot.picks.some((pick, index) => pick.pickNumber !== index + 1)) {
    throw new YahooLiveDraftError(
      "Yahoo returned draft picks with missing or invalid ordering.",
      502,
      "yahoo_draft_response_invalid",
    );
  }
  if (snapshot.leagueKey && snapshot.leagueKey !== session.yahoo_league_key) {
    throw new YahooLiveDraftError(
      "Yahoo returned draft results for a different league.",
      502,
      "yahoo_draft_response_invalid",
    );
  }
  if (
    snapshot.picks.some(
      (pick) => !pick.yahooTeamKey.startsWith(`${session.yahoo_league_key}.t.`),
    )
  ) {
    throw new YahooLiveDraftError(
      "Yahoo returned draft results for a different league.",
      502,
      "yahoo_draft_response_invalid",
    );
  }
}

export async function pollYahooDraftSession(
  userId: string,
  sessionId: string,
  options: PollOptions = {},
) {
  const client =
    options.client ?? (serviceRoleClient as unknown as LiveDraftDb);
  const fetchImpl = options.fetchImpl ?? fetch;
  const observedAt = (options.now ?? (() => new Date()))();
  const context = options.context ?? (await resolveYahooGameContext(client));
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
    const state = await loadYahooDraftSession(
      userId,
      sessionId,
      client,
      observedAt,
      context,
    );
    const retryAt = Date.parse(String(claim.retryAt || state.session.nextPollAt));
    const connectedAccountId = String(claim.connectedAccountId ?? "");
    if (connectedAccountId) {
      await recordYahooDraftPollObservation({
        accountId: connectedAccountId,
        client,
        observation: {
          lease_claimed: false,
          local_status: state.session.status,
          next_poll_at: state.session.nextPollAt,
          outcome: "skipped",
          provider_status: state.session.providerStatus,
        },
        sessionId,
      });
    }
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
  if (
    session.yahoo_game_key !== context.gameKey ||
    Number(session.yahoo_season) !== Number(context.season) ||
    Number(session.target_season_id) !== context.targetSeasonId
  ) {
    throw new YahooLiveDraftError(
      "Yahoo draft session does not match the configured season.",
      409,
      "yahoo_game_context_mismatch",
    );
  }
  const auditId = await auditStart(
    client,
    userId,
    session,
    observedAt.toISOString(),
  );

  let transport: YahooProviderTransportMetadata | null = null;
  try {
    const responseFormat = getYahooLiveDraftResponseFormat();
    const providerResult = await fetchYahooDraftResource({
      client,
      connectedAccountId: session.connected_account_id,
      context,
      fetchImpl,
      format: responseFormat,
      leagueKey: session.yahoo_league_key,
      now: observedAt,
      resource: "draftresults",
      userId,
    });
    transport = providerResult.transport;
    const snapshot = parseYahooDraftResults(providerResult.payload, context);
    assertSnapshotMatchesSession(snapshot, session as YahooDraftSessionRow);

    let formatComparison: UnknownRecord | null = null;
    if (yahooLiveDraftComparisonEnabled()) {
      const comparisonFormat =
        responseFormat === "standard_json" ? "json_f" : "standard_json";
      const comparisonResult = await fetchYahooDraftResource({
        client,
        connectedAccountId: session.connected_account_id,
        context,
        fetchImpl,
        format: comparisonFormat,
        leagueKey: session.yahoo_league_key,
        now: observedAt,
        resource: "draftresults",
        userId,
      });
      const comparison = parseYahooDraftResults(
        comparisonResult.payload,
        context,
      );
      assertSnapshotMatchesSession(comparison, session as YahooDraftSessionRow);
      const matches =
        hashYahooDraftSnapshot(comparison) === hashYahooDraftSnapshot(snapshot);
      formatComparison = {
        comparedAt: observedAt.toISOString(),
        formats: [responseFormat, comparisonFormat],
        matches,
      };
      if (!matches) {
        throw new YahooLiveDraftError(
          "Yahoo response formats did not agree on the draft snapshot.",
          502,
          "yahoo_response_format_mismatch",
        );
      }
    }

    const [leagueResult, existingPickResult] = await Promise.all([
      client
        .from("external_leagues")
        .select(
          "id,connected_account_id,user_id,external_league_key,league_name,season_key,league_metadata,scoring_settings,roster_settings",
        )
        .eq("id", session.external_league_id)
        .eq("user_id", userId)
        .maybeSingle(),
      client
        .from("yahoo_draft_picks")
        .select(
          "pick_number,round_number,yahoo_team_key,yahoo_player_key,auction_cost",
        )
        .eq("session_id", sessionId)
        .eq("user_id", userId)
        .eq("is_active", true)
        .order("pick_number", { ascending: true }),
    ]);
    if (leagueResult.error || !leagueResult.data) {
      throw queryError(
        "Failed to load Yahoo league settings",
        leagueResult.error,
      );
    }
    if (existingPickResult.error) {
      throw queryError(
        "Failed to load the current Yahoo draft snapshot",
        existingPickResult.error,
      );
    }

    const anomalyDetected = snapshotRequiresCorrectionConfirmation(
      (existingPickResult.data ?? []) as ExistingYahooPick[],
      snapshot.picks,
    );
    const correctedPickNumbers = anomalyDetected
      ? correctedIncomingPickNumbers(
          (existingPickResult.data ?? []) as ExistingYahooPick[],
          snapshot.picks,
        )
      : new Set<number>();
    let correctionConfirmation = "not_required";
    if (anomalyDetected) {
      const confirmationResult = await fetchYahooDraftResource({
        client,
        connectedAccountId: session.connected_account_id,
        context,
        fetchImpl,
        format: responseFormat,
        leagueKey: session.yahoo_league_key,
        now: observedAt,
        resource: "draftresults",
        userId,
      });
      const confirmation = parseYahooDraftResults(
        confirmationResult.payload,
        context,
      );
      assertSnapshotMatchesSession(confirmation, session as YahooDraftSessionRow);
      if (
        hashYahooDraftSnapshot(confirmation) !== hashYahooDraftSnapshot(snapshot)
      ) {
        throw new YahooLiveDraftError(
          "Yahoo returned a destructive draft correction that could not be confirmed.",
          502,
          "yahoo_draft_correction_unconfirmed",
        );
      }
      correctionConfirmation = "confirmed_by_second_observation";
    }

    const stored = record(session.normalized_settings);
    const settings = Object.keys(stored).length
      ? ({
          ...stored,
          diagnostics: record(session.diagnostics),
        } as YahooDraftSettings)
      : storedSettings(leagueResult.data as ExternalLeagueRow, context);
    const providerStatus = inferProviderStatus({
      parsed: snapshot.providerStatus,
      current: session.provider_status as YahooDraftProviderStatus,
      pickCount: snapshot.picks.length,
    });
    snapshot.providerStatus = providerStatus;
    const picks = await resolveYahooDraftPicks({
      client,
      context,
      userId,
      externalLeagueId: session.external_league_id,
      teamCount: settings.normalized.teamCount,
      picks: snapshot.picks,
    });
    if (anomalyDetected) {
      for (const pick of picks) {
        pick.is_correction = correctedPickNumbers.has(pick.pick_number);
      }
    }
    const snapshotHash = hashYahooDraftSnapshot(snapshot);
    const completion = postdraftConfirmation({
      diagnostics: record(session.diagnostics),
      observedAt,
      providerStatus,
      snapshotHash,
    });
    const changed = session.snapshot_hash !== snapshotHash;
    const diagnostics = adaptiveDiagnostics({
      changed,
      diagnostics: {
        ...completion.diagnostics,
        ...(formatComparison ? { responseFormatComparison: formatComparison } : {}),
      },
    });
    const status = sessionStatusAfterSnapshot(
      providerStatus,
      session.status,
      completion.confirmed,
    );
    const delaySeconds = yahooDraftPollDelaySeconds(
      {
        burstPollsRemaining: Number(diagnostics.burstPollsRemaining ?? 0),
        draftTime: settings.normalized.draftTime,
        providerStatus,
        unchangedPolls: Number(diagnostics.unchangedPolls ?? 0),
      },
      {
        burstEnabled: yahooDraftBurstEnabled(),
        now: observedAt,
        random: options.random,
      },
    );
    const nextPollAt = isoAfter(observedAt, delaySeconds);
    const { data: appliedData, error: applyError } = await client.rpc(
      "apply_yahoo_draft_snapshot",
      {
        p_session_id: sessionId,
        p_user_id: userId,
        p_lease_token: leaseToken,
        p_snapshot_hash: snapshotHash,
        p_status: status,
        p_provider_status: providerStatus,
        p_normalized_settings: normalizedSettingsPayload(settings),
        p_diagnostics: diagnostics,
        p_provider_sync_run_id: auditId,
        p_picks: picks,
        p_next_poll_at: nextPollAt,
        p_observed_at: observedAt.toISOString(),
      },
    );
    if (applyError) throw queryError("Failed to apply Yahoo draft snapshot", applyError);
    const applied = firstRpcObject(appliedData);
    if (anomalyDetected) {
      await client
        .from("yahoo_draft_picks")
        .update({ correction_confirmed_at: observedAt.toISOString() })
        .eq("session_id", sessionId)
        .eq("user_id", userId)
        .eq("is_correction", true)
        .eq("last_observed_at", observedAt.toISOString());
    }
    await client.rpc("reconcile_yahoo_draft_pick_identities", {
      p_session_id: sessionId,
    });
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
    await recordYahooDraftPollObservation({
      accountId: session.connected_account_id,
      client,
      observation: {
        ...transportObservation(transport),
        anomaly_detected: anomalyDetected,
        changed: applied.changed === true,
        correction_confirmation: correctionConfirmation,
        due_poll_lag_ms: Math.max(
          0,
          observedAt.getTime() - Date.parse(session.next_poll_at),
        ),
        last_pick_number: snapshot.picks.reduce(
          (maximum, pick) => Math.max(maximum, pick.pickNumber),
          0,
        ),
        lease_claimed: true,
        local_status: status,
        next_poll_at: nextPollAt,
        outcome: applied.changed === true ? "changed" : "unchanged",
        pick_count: snapshot.picks.length,
        provider_status: providerStatus,
        snapshot_hash: snapshotHash,
        snapshot_version: Number(applied.snapshotVersion ?? 0),
      },
      requestId: transport?.requestId,
      sessionId,
    });
    const state = await loadYahooDraftSession(
      userId,
      sessionId,
      client,
      observedAt,
      context,
    );
    return {
      ...state,
      poll: {
        claimed: true,
        unchanged: applied.changed !== true,
        retryAfterSeconds: delaySeconds,
      },
    };
  } catch (error) {
    if (error instanceof YahooProviderRequestError) {
      transport = error.transport;
    }
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
    const retryAfterSeconds = yahooDraftPollDelaySeconds(
      {
        consecutiveFailures: Number(session.consecutive_failures) + 1,
        providerStatus: session.provider_status as YahooDraftProviderStatus,
        retryAfterSeconds: controlled.retryAfterSeconds,
      },
      { now: observedAt, random: options.random },
    );
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
    await recordYahooDraftPollObservation({
      accountId: session.connected_account_id,
      client,
      observation: {
        ...transportObservation(transport),
        anomaly_detected:
          controlled.code === "yahoo_draft_correction_unconfirmed",
        consecutive_failures: Number(session.consecutive_failures) + 1,
        due_poll_lag_ms: Math.max(
          0,
          observedAt.getTime() - Date.parse(session.next_poll_at),
        ),
        error_code: controlled.code,
        lease_claimed: true,
        local_status: status ?? session.status,
        next_poll_at: retryAt,
        outcome: "failed",
        provider_status: session.provider_status,
        retry_after_seconds: retryAfterSeconds,
      },
      requestId: transport?.requestId,
      sessionId,
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
  const client =
    options.client ?? (serviceRoleClient as unknown as LiveDraftDb);
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = (options.now ?? (() => new Date()))();
  const gameContext =
    options.context ?? (await resolveYahooGameContext(client));
  const leagueContext = await requireOwnedYahooDraftLeague(
    userId,
    input.externalLeagueId,
    client,
    gameContext,
  );
  const rankingId =
    input.draftRankingId === undefined
      ? await defaultDraftRanking(client, userId, gameContext)
      : input.draftRankingId;
  if (rankingId) {
    await requireDraftRanking(client, userId, rankingId, gameContext);
  }

  // Yahoo HTTP is deliberately completed before the session upsert transaction.
  const settingsResult = await fetchYahooDraftResource({
    client,
    connectedAccountId: leagueContext.league.connected_account_id,
    context: gameContext,
    fetchImpl,
    format: getYahooLiveDraftResponseFormat(),
    leagueKey: leagueContext.league.external_league_key,
    now,
    resource: "settings",
    userId,
  });
  let settings = parseYahooDraftSettings(settingsResult.payload, gameContext);
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
  const teamsResult = await fetchYahooDraftResource({
    client,
    connectedAccountId: leagueContext.league.connected_account_id,
    context: gameContext,
    fetchImpl,
    format: getYahooLiveDraftResponseFormat(),
    leagueKey: leagueContext.league.external_league_key,
    now,
    resource: "teams",
    userId,
  });
  const teams = parseYahooDraftTeams(teamsResult.payload, gameContext);
  if (
    teams.length === 0 ||
    !teams.some(
      (team) => team.yahooTeamKey === leagueContext.ownedTeam.external_team_key,
    ) ||
    teams.some(
      (team) =>
        !team.yahooTeamKey.startsWith(
          `${leagueContext.league.external_league_key}.t.`,
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
    league: leagueContext.league,
    settings,
    teams,
    fetchedAt: now.toISOString(),
  });
  const providerStatus = settings.normalized.providerStatus;
  const initialStatus =
    providerStatus === "predraft" || providerStatus === "unknown"
      ? "predraft"
      : "active";
  const { data: existingSession } = await client
    .from("yahoo_draft_sessions")
    .select("id,last_provider_sync_run_id")
    .eq("user_id", userId)
    .eq("yahoo_league_key", leagueContext.league.external_league_key)
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
        connected_account_id: leagueContext.league.connected_account_id,
        external_league_id: leagueContext.league.id,
        external_team_id: leagueContext.ownedTeam.id,
        draft_ranking_id: rankingId ?? null,
        yahoo_game_key: gameContext.gameKey,
        yahoo_season: Number(gameContext.season),
        target_season_id: gameContext.targetSeasonId,
        yahoo_league_key: leagueContext.league.external_league_key,
        yahoo_team_key: leagueContext.ownedTeam.external_team_key,
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
  return loadYahooDraftSession(
    userId,
    session.id,
    client,
    now,
    gameContext,
  );
}

export async function nudgeYahooDraftSession(
  userId: string,
  sessionId: string,
  client: LiveDraftDb = serviceRoleClient as unknown as LiveDraftDb,
) {
  const context = await resolveYahooGameContext(client);
  const { data, error } = await client.rpc("nudge_yahoo_draft_poll", {
    p_session_id: sessionId,
    p_user_id: userId,
  });
  if (error) {
    if (String(error.message).includes("YAHOO_DRAFT_SESSION_NOT_FOUND")) {
      throw new YahooLiveDraftError(
        "Yahoo draft session was not found.",
        404,
        "yahoo_draft_session_not_found",
      );
    }
    throw queryError("Failed to nudge Yahoo draft polling", error);
  }
  const nudge = firstRpcObject(data);
  const state = await loadYahooDraftSession(
    userId,
    sessionId,
    client,
    new Date(),
    context,
  );
  const retryAt = Date.parse(String(nudge.retryAt ?? state.session.nextPollAt));
  return {
    ...state,
    poll: {
      claimed: false,
      nudged: nudge.nudged === true,
      retryAfterSeconds: Number.isFinite(retryAt)
        ? Math.max(0, Math.ceil((retryAt - Date.now()) / 1000))
        : 5,
      unchanged: true,
    },
  };
}

export async function stopYahooDraftSession(
  userId: string,
  sessionId: string,
  client: LiveDraftDb = serviceRoleClient as unknown as LiveDraftDb,
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
