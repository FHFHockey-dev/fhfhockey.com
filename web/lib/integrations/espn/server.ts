import { createHash } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import serviceRoleClient from "lib/supabase/server";
import type { Database, Json } from "lib/supabase/database-generated.types";

import {
  getEspnLeague,
  getEspnTransactions,
  EspnApiError,
  type EspnCredentials,
} from "./client";
import {
  ESPN_CONSENT_VERSION,
  type EspnConnectionAccount,
  type EspnConnectionLeague,
  type EspnConnectionsResponse,
  type EspnLeagueSettingsV1,
  type EspnLeagueStateV1,
  type EspnNormalizedPlayer,
} from "./contracts";
import {
  ESPN_MANUAL_REFRESH_COOLDOWN_MS,
  ESPN_MAX_LINKED_LEAGUES,
  ESPN_PROVIDER,
  ESPN_SCHEDULED_FRESHNESS_MS,
} from "./config";
import {
  hashEspnLeagueState,
  normalizeEspnLeaguePayload,
  normalizeEspnTransactions,
} from "./normalize";

type DbClient = SupabaseClient<Database>;
type ConnectedAccountRow = Database["public"]["Tables"]["connected_accounts"]["Row"];
type ExternalLeagueRow = Database["public"]["Tables"]["external_leagues"]["Row"];
type ExternalTeamRow = Database["public"]["Tables"]["external_teams"]["Row"];
type SyncRunRow = Database["public"]["Tables"]["provider_sync_runs"]["Row"];
type UnknownRecord = Record<string, unknown>;

const TRANSACTION_PERIODS_PER_SYNC = 12;
const TRANSACTION_PAGE_SIZE = 100;
const TRANSACTION_MAX_PAGES_PER_PERIOD = 20;
const TRANSACTION_BACKFILL_BUDGET_MS = 90_000;
const TRANSACTION_REQUEST_HEADROOM_MS = 15_000;
const CRON_RUNTIME_BUDGET_MS = 200_000;
const CRON_REQUEST_HEADROOM_MS = 35_000;
const NHL_ABBREVIATION_BY_ESPN_TEAM_ID: Record<number, string> = {
  1: "BOS", 2: "BUF", 3: "CGY", 4: "CHI", 5: "DET", 6: "EDM",
  7: "CAR", 8: "LAK", 9: "DAL", 10: "MTL", 11: "NJD", 12: "NYI",
  13: "NYR", 14: "OTT", 15: "PHI", 16: "PIT", 17: "COL", 18: "SJS",
  19: "STL", 20: "TBL", 21: "TOR", 22: "VAN", 23: "WSH", 25: "ANA",
  26: "FLA", 27: "NSH", 28: "WPG", 29: "CBJ", 30: "MIN", 37: "VGK",
  124292: "SEA", 129764: "UTA",
};

export class EspnIntegrationError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code: string,
    public readonly retryAfterSeconds: number | null = null,
  ) {
    super(message);
    this.name = "EspnIntegrationError";
  }
}

function object(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {};
}

function asJson(value: unknown): Json {
  return value as Json;
}

function uniqueStrings(value: unknown) {
  return [
    ...new Set(
      (Array.isArray(value) ? value : [])
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
}

function mappedError(error: unknown): EspnIntegrationError {
  if (error instanceof EspnIntegrationError) return error;
  if (error instanceof EspnApiError) {
    return new EspnIntegrationError(
      error.message,
      error.statusCode,
      error.code,
      error.retryAfterSeconds,
    );
  }
  const message = error instanceof Error ? error.message : "";
  const databaseCode = [
    "INVALID_ESPN_CONNECTION_PAYLOAD",
    "INVALID_ESPN_LEAGUE_PAYLOAD",
    "ESPN_CREDENTIAL_ALREADY_LINKED",
    "ESPN_ACCOUNT_NOT_FOUND",
    "ESPN_LEAGUE_NOT_FOUND",
    "ESPN_TEAM_NOT_FOUND",
    "ESPN_LEAGUE_LIMIT_REACHED",
  ].find((code) => message.includes(code));
  if (databaseCode === "ESPN_CREDENTIAL_ALREADY_LINKED") {
    return new EspnIntegrationError(
      "That ESPN session is already linked to another account card.",
      409,
      databaseCode,
    );
  }
  if (databaseCode === "ESPN_LEAGUE_LIMIT_REACHED") {
    return new EspnIntegrationError(
      `An ESPN connection can contain at most ${ESPN_MAX_LINKED_LEAGUES} leagues in this beta.`,
      409,
      databaseCode,
    );
  }
  if (databaseCode?.includes("NOT_FOUND")) {
    return new EspnIntegrationError("ESPN account or league not found.", 404, databaseCode);
  }
  if (databaseCode) {
    return new EspnIntegrationError(
      "The ESPN connection data was invalid.",
      400,
      databaseCode,
    );
  }
  return new EspnIntegrationError(
    "ESPN Fantasy integration failed.",
    500,
    "ESPN_INTERNAL_ERROR",
  );
}

export function isEspnFantasyEnabled(userId?: string | null) {
  if (
    process.env.ESPN_FANTASY_API_ENABLED?.trim().toLowerCase() !== "true" ||
    !userId
  ) {
    return false;
  }
  return uniqueStrings(
    process.env.ESPN_FANTASY_ALLOWED_USER_IDS?.split(","),
  ).includes(userId);
}

export function isEspnLiveDraftEnabled(userId?: string | null) {
  return (
    isEspnFantasyEnabled(userId) &&
    process.env.ESPN_FANTASY_LIVE_DRAFT_ENABLED?.trim().toLowerCase() === "true"
  );
}

function assertEnabled(userId: string) {
  if (!isEspnFantasyEnabled(userId)) {
    throw new EspnIntegrationError(
      "ESPN Fantasy linking is not enabled for this account.",
      404,
      "ESPN_API_DISABLED",
    );
  }
}

export function validateEspnSwid(value: unknown) {
  if (typeof value !== "string") {
    throw new EspnIntegrationError("SWID is required.", 400, "ESPN_SWID_REQUIRED");
  }
  const swid = value.trim().replace(/^"|"$/g, "");
  if (
    !/^\{?[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\}?$/.test(
      swid,
    )
  ) {
    throw new EspnIntegrationError(
      "SWID must be the UUID-shaped value from an active ESPN session.",
      400,
      "ESPN_SWID_INVALID",
    );
  }
  return `{${swid.replace(/^\{|\}$/g, "").toUpperCase()}}`;
}

export function validateEspnS2(value: unknown) {
  if (typeof value !== "string") {
    throw new EspnIntegrationError(
      "espn_s2 is required.",
      400,
      "ESPN_S2_REQUIRED",
    );
  }
  const espnS2 = value.trim().replace(/^"|"$/g, "");
  if (!espnS2 || espnS2.length > 4096 || /[\u0000-\u001f\u007f]/.test(espnS2)) {
    throw new EspnIntegrationError(
      "espn_s2 is invalid.",
      400,
      "ESPN_S2_INVALID",
    );
  }
  return espnS2;
}

function validateAccountLabel(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    throw new EspnIntegrationError(
      "Account label is required.",
      400,
      "ESPN_ACCOUNT_LABEL_REQUIRED",
    );
  }
  const label = value.trim();
  if (label.length > 80) {
    throw new EspnIntegrationError(
      "Account label must be 80 characters or fewer.",
      400,
      "ESPN_ACCOUNT_LABEL_TOO_LONG",
    );
  }
  return label;
}

export function parseEspnLeagueRef(value: unknown) {
  if (typeof value !== "string" && typeof value !== "number") {
    throw new EspnIntegrationError(
      "ESPN league URL or ID is required.",
      400,
      "ESPN_LEAGUE_REQUIRED",
    );
  }
  const raw = String(value).trim();
  if (/^\d{1,20}$/.test(raw)) return raw;
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new EspnIntegrationError(
      "Enter a numeric ESPN league ID or a valid ESPN league URL.",
      400,
      "ESPN_LEAGUE_REF_INVALID",
    );
  }
  const hostname = parsed.hostname.toLowerCase();
  if (
    parsed.protocol !== "https:" ||
    (hostname !== "espn.com" && !hostname.endsWith(".espn.com"))
  ) {
    throw new EspnIntegrationError(
      "The league URL must be hosted on espn.com.",
      400,
      "ESPN_LEAGUE_REF_INVALID",
    );
  }
  const queryId = parsed.searchParams.get("leagueId");
  const pathId = parsed.pathname.match(/\/leagues?\/(\d+)/i)?.[1];
  const leagueId = queryId ?? pathId;
  if (!leagueId || !/^\d{1,20}$/.test(leagueId)) {
    throw new EspnIntegrationError(
      "The ESPN URL does not contain a league ID.",
      400,
      "ESPN_LEAGUE_REF_INVALID",
    );
  }
  return leagueId;
}

export function validateEspnSeason(value: unknown) {
  const season =
    typeof value === "number"
      ? value
      : typeof value === "string" && /^\d{4}$/.test(value.trim())
        ? Number(value.trim())
        : Number.NaN;
  if (!Number.isInteger(season) || season < 2000 || season > 3000) {
    throw new EspnIntegrationError(
      "ESPN season must be a four-digit year.",
      400,
      "ESPN_SEASON_INVALID",
    );
  }
  return season;
}

function providerUserDigest(swid: string) {
  return createHash("sha256").update(swid.toUpperCase()).digest("hex");
}

async function loadEspnCredentials(
  client: DbClient,
  userId: string,
  accountId: string,
): Promise<EspnCredentials> {
  const { data, error } = await client.rpc("get_connected_account_tokens_secure", {
    p_connected_account_id: accountId,
    p_user_id: userId,
  });
  if (error) throw new Error(`Failed to load ESPN credentials: ${error.message}`);
  const token = (Array.isArray(data) ? data[0] : data) as
    | { access_token?: unknown; refresh_token?: unknown; token_type?: unknown }
    | null;
  if (
    !token ||
    token.token_type !== "espn_session_cookies_v1" ||
    typeof token.access_token !== "string" ||
    typeof token.refresh_token !== "string"
  ) {
    throw new EspnIntegrationError(
      "This ESPN account needs updated session credentials.",
      409,
      "ESPN_REAUTH_REQUIRED",
    );
  }
  return { swid: token.access_token, espnS2: token.refresh_token };
}

function normalizedPosition(position: string | null) {
  if (position === "LW") return "L";
  if (position === "RW") return "R";
  return position;
}

function normalizedName(value: string | null) {
  return value?.trim().replace(/\s+/g, " ").toLocaleLowerCase() ?? "";
}

export async function resolveEspnPlayers(
  client: DbClient,
  state: EspnLeagueStateV1,
) {
  const playerByExternalId = new Map<string, EspnNormalizedPlayer>();
  for (const team of state.teams) {
    for (const player of team.roster) {
      playerByExternalId.set(player.externalPlayerId, player);
    }
  }
  for (const pick of state.draft.picks) {
    if (!playerByExternalId.has(pick.externalPlayerId)) {
      playerByExternalId.set(pick.externalPlayerId, {
        externalPlayerId: pick.externalPlayerId,
        playerName: pick.playerName,
        position: pick.position,
        proTeamId: pick.proTeamId,
        lineupSlotId: null,
        acquisitionType: "DRAFT",
        injuryStatus: null,
      });
    }
  }
  const externalIds = [...playerByExternalId.keys()];
  if (!externalIds.length) return state;

  const { data: mappingRows, error: mappingError } = await client
    .from("fhfh_player_external_identities")
    .select("external_player_id,fhfh_player_id,verification_status")
    .eq("provider", ESPN_PROVIDER)
    .eq("context_key", "fhl")
    .in("external_player_id", externalIds);
  if (mappingError) throw new Error(mappingError.message);
  const resolved = new Map<string, number>();
  for (const row of mappingRows ?? []) {
    if (row.verification_status === "verified") {
      resolved.set(row.external_player_id, row.fhfh_player_id);
    }
  }

  const unresolvedPlayers = [...playerByExternalId.values()].filter(
    (player) => !resolved.has(player.externalPlayerId) && player.playerName,
  );
  const candidateNames = [
    ...new Set(
      unresolvedPlayers
        .map((player) => player.playerName)
        .filter((value): value is string => Boolean(value)),
    ),
  ];
  if (candidateNames.length) {
    const teamAbbreviations = [
      ...new Set(
        unresolvedPlayers
          .map((player) =>
            player.proTeamId == null
              ? null
              : NHL_ABBREVIATION_BY_ESPN_TEAM_ID[player.proTeamId] ?? null,
          )
          .filter((value): value is string => Boolean(value)),
      ),
    ];
    const { data: nhlTeams, error: nhlTeamError } = teamAbbreviations.length
      ? await client
          .from("teams")
          .select("id,abbreviation")
          .in("abbreviation", teamAbbreviations)
      : { data: [], error: null };
    if (nhlTeamError) throw new Error(nhlTeamError.message);
    const internalTeamByAbbreviation = new Map(
      (nhlTeams ?? []).map((team) => [team.abbreviation, team.id]),
    );
    const candidateTeamIds = [...internalTeamByAbbreviation.values()];
    const { data: identities, error: identityError } = candidateTeamIds.length
      ? await client
          .from("fhfh_player_identities")
          .select("id,canonical_name,canonical_position,current_nhl_team_id")
          .in("current_nhl_team_id", candidateTeamIds)
          .is("merged_into_id", null)
      : { data: [], error: null };
    if (identityError) throw new Error(identityError.message);
    const byName = new Map<string, NonNullable<typeof identities>>();
    for (const identity of identities ?? []) {
      const key = normalizedName(identity.canonical_name);
      byName.set(key, [...(byName.get(key) ?? []), identity]);
    }
    const inserts: Database["public"]["Tables"]["fhfh_player_external_identities"]["Insert"][] = [];
    for (const player of unresolvedPlayers) {
      const nhlAbbreviation =
        player.proTeamId == null
          ? null
          : NHL_ABBREVIATION_BY_ESPN_TEAM_ID[player.proTeamId] ?? null;
      const currentNhlTeamId = nhlAbbreviation
        ? internalTeamByAbbreviation.get(nhlAbbreviation)
        : null;
      if (currentNhlTeamId == null || !player.position) continue;
      const candidates = (byName.get(normalizedName(player.playerName)) ?? []).filter(
        (candidate) =>
          candidate.canonical_position === normalizedPosition(player.position) &&
          candidate.current_nhl_team_id === currentNhlTeamId,
      );
      if (candidates.length !== 1) continue;
      const candidate = candidates[0];
      resolved.set(player.externalPlayerId, candidate.id);
      inserts.push({
        fhfh_player_id: candidate.id,
        provider: ESPN_PROVIDER,
        external_player_id: player.externalPlayerId,
        context_key: "fhl",
        is_primary: false,
        match_method: "exact_name_team_position",
        match_confidence: 1,
        verification_status: "verified",
        verified_at: new Date().toISOString(),
        verified_by_system: "espn-fhl-v1-exact-name-team-position",
        source_provenance: asJson({
          source: "espn_fantasy_api",
          playerName: player.playerName,
          position: player.position,
          proTeamId: player.proTeamId,
          nhlTeamAbbreviation: nhlAbbreviation,
        }),
      });
    }
    if (inserts.length) {
      const { error: insertError } = await client
        .from("fhfh_player_external_identities")
        .upsert(inserts, {
          onConflict: "provider,context_key,external_player_id",
          ignoreDuplicates: true,
        });
      if (insertError) throw new Error(insertError.message);
    }
  }

  return {
    ...state,
    teams: state.teams.map((team) => ({
      ...team,
      roster: team.roster.map((player) => ({
        ...player,
        fhfhPlayerId: resolved.get(player.externalPlayerId) ?? null,
        mappingStatus: resolved.has(player.externalPlayerId)
          ? "mapped"
          : player.playerName
            ? "review_required"
            : "unmapped",
      })),
    })),
    draft: {
      ...state.draft,
      picks: state.draft.picks.map((pick) => ({
        ...pick,
        fhfhPlayerId: resolved.get(pick.externalPlayerId) ?? null,
        mappingStatus: resolved.has(pick.externalPlayerId)
          ? "mapped"
          : pick.playerName
            ? "review_required"
            : "unmapped",
      })),
    },
  } satisfies EspnLeagueStateV1;
}

async function previousSnapshot(client: DbClient, externalLeagueId?: string | null) {
  if (!externalLeagueId) return null;
  const { data, error } = await client
    .from("external_league_state_snapshots")
    .select("normalized_state,sync_cursor")
    .eq("external_league_id", externalLeagueId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as unknown as
    | { normalized_state?: EspnLeagueStateV1; sync_cursor?: UnknownRecord }
    | null;
}

export async function backfillEspnTransactions(args: {
  credentials: EspnCredentials;
  leagueId: string;
  season: number;
  state: EspnLeagueStateV1;
  previous: Awaited<ReturnType<typeof previousSnapshot>>;
}) {
  const currentPeriod = Math.max(0, args.state.currentScoringPeriodId ?? 0);
  const previousCursor = object(args.previous?.sync_cursor);
  let nextPeriod = Number(previousCursor.nextScoringPeriodId ?? 1);
  if (!Number.isInteger(nextPeriod) || nextPeriod < 1) nextPeriod = 1;
  let transactionOffset = Number(previousCursor.transactionOffset ?? 0);
  if (!Number.isInteger(transactionOffset) || transactionOffset < 0) {
    transactionOffset = 0;
  }
  const transactionById = new Map(
    [
      ...((args.previous?.normalized_state?.transactions ?? []) as EspnLeagueStateV1["transactions"]),
      ...args.state.transactions,
    ].map((transaction) => [transaction.id, transaction]),
  );
  const lastPeriod = Math.min(currentPeriod, nextPeriod + TRANSACTION_PERIODS_PER_SYNC - 1);
  const deadline = Date.now() + TRANSACTION_BACKFILL_BUDGET_MS;
  let stop = false;
  let interruptionCode: string | null = null;
  while (nextPeriod <= lastPeriod && !stop) {
    let pageCount = 0;
    let previousPageSignature: string | null = null;
    while (!stop) {
      if (Date.now() + TRANSACTION_REQUEST_HEADROOM_MS >= deadline) {
        interruptionCode = "ESPN_TRANSACTION_BACKFILL_BUDGET";
        stop = true;
        break;
      }
      const requestedOffset = transactionOffset;
      try {
        const payload = await getEspnTransactions({
          leagueId: args.leagueId,
          season: args.season,
          credentials: args.credentials,
          scoringPeriodId: nextPeriod,
          transactionOffset: requestedOffset,
          transactionLimit: TRANSACTION_PAGE_SIZE,
        });
        const page = normalizeEspnTransactions(payload);
        for (const transaction of page) {
          transactionById.set(transaction.id, transaction);
        }
        const rawCount = Array.isArray(payload.transactions)
          ? payload.transactions.length
          : page.length;
        const pageSignature = page.map((transaction) => transaction.id).join(":");
        const repeatedPage =
          requestedOffset > 0 &&
          previousPageSignature != null &&
          pageSignature === previousPageSignature;
        if (repeatedPage) {
          interruptionCode = "ESPN_TRANSACTION_PAGE_REPEATED";
          stop = true;
          break;
        }
        if (rawCount < TRANSACTION_PAGE_SIZE) {
          nextPeriod += 1;
          transactionOffset = 0;
          break;
        }
        transactionOffset += TRANSACTION_PAGE_SIZE;
        previousPageSignature = pageSignature;
        pageCount += 1;
        if (pageCount >= TRANSACTION_MAX_PAGES_PER_PERIOD) {
          interruptionCode = "ESPN_TRANSACTION_PAGE_LIMIT";
          stop = true;
        }
      } catch (error) {
        if (
          error instanceof EspnApiError &&
          ["ESPN_REAUTH_REQUIRED", "ESPN_RATE_LIMITED"].includes(error.code)
        ) {
          throw error;
        }
        interruptionCode =
          error instanceof EspnApiError
            ? error.code
            : "ESPN_TRANSACTION_BACKFILL_INTERRUPTED";
        stop = true;
      }
    }
  }
  const complete = currentPeriod === 0 || nextPeriod > currentPeriod;
  const stateWithoutHash = {
    ...args.state,
    transactions: [...transactionById.values()].sort(
      (left, right) =>
        (left.proposedDate ?? "").localeCompare(right.proposedDate ?? "") ||
        left.id.localeCompare(right.id),
    ),
    cursor: {
      transactionCount: transactionById.size,
      complete,
    },
  };
  return {
    state: {
      ...stateWithoutHash,
      sourceHash: hashEspnLeagueState(stateWithoutHash),
    },
    syncCursor: {
      nextScoringPeriodId: complete ? currentPeriod + 1 : nextPeriod,
      transactionOffset: complete ? 0 : transactionOffset,
      transactionBackfillComplete: complete,
      transactionBackfillErrorCode: complete ? null : interruptionCode,
    },
  };
}

function leagueCommitPayload(settings: EspnLeagueSettingsV1, state: EspnLeagueStateV1) {
  const stateTeamById = new Map(
    state.teams.map((team) => [team.externalTeamKey, team]),
  );
  return {
    externalLeagueKey: settings.externalLeagueKey,
    leagueName: settings.leagueName,
    seasonKey: settings.seasonKey,
    leagueMetadata: {
      api_sync_enabled: true,
      source_modes: ["api"],
      espn_league_id: settings.espnLeagueId,
      source_hash: settings.sourceHash,
      mapping_version: settings.mappingVersion,
      is_active: state.isActive,
      normalized_settings: settings,
    },
    scoringSettings: {
      version: settings.version,
      mappingVersion: settings.mappingVersion,
      leagueType: settings.leagueType,
      skaterScoringCategories: settings.skaterScoringCategories,
      goalieScoringCategories: settings.goalieScoringCategories,
      categoryWeights: settings.categoryWeights,
      sourceHash: settings.sourceHash,
      diagnostics: settings.diagnostics,
    },
    rosterSettings: {
      version: settings.version,
      rosterConfig: settings.rosterConfig,
      teamCount: settings.teamCount,
      draftOrderType: settings.draftOrderType,
      sourceHash: settings.sourceHash,
    },
    teams: settings.teams.map((team) => ({
      external_team_key: team.externalTeamKey,
      team_name: team.name,
      team_metadata: {
        abbreviation: team.abbreviation,
        division_id: team.divisionId,
        is_owned: team.isOwned,
        source_mode: "api",
        source_modes: ["api"],
      },
      roster_snapshot: {
        version: 1,
        fetchedAt: state.fetchedAt,
        entries: stateTeamById.get(team.externalTeamKey)?.roster ?? [],
      },
    })),
  };
}

async function fetchNormalizedLeague(args: {
  client: DbClient;
  credentials: EspnCredentials;
  leagueId: string;
  season: number;
  externalLeagueId?: string | null;
  now: Date;
}) {
  const previous = await previousSnapshot(args.client, args.externalLeagueId);
  const payload = await getEspnLeague({
    leagueId: args.leagueId,
    season: args.season,
    credentials: args.credentials,
  });
  if (String(payload.id) !== args.leagueId || Number(payload.seasonId) !== args.season) {
    throw new EspnIntegrationError(
      "ESPN returned a different league or season than requested.",
      502,
      "ESPN_IDENTITY_MISMATCH",
    );
  }
  const rawPayload = payload as unknown as UnknownRecord;
  const rawSettings = object(rawPayload.settings);
  const rawScoringSettings = object(rawSettings.scoringSettings);
  if (
    !rawPayload.settings ||
    typeof rawPayload.settings !== "object" ||
    !Array.isArray(rawScoringSettings.scoringItems) ||
    !rawSettings.rosterSettings ||
    typeof rawSettings.rosterSettings !== "object" ||
    !rawSettings.draftSettings ||
    typeof rawSettings.draftSettings !== "object" ||
    !Array.isArray(rawPayload.teams) ||
    rawPayload.teams.length === 0 ||
    (!rawPayload.draftDetail && !previous?.normalized_state?.draft) ||
    (!rawPayload.status && !previous?.normalized_state)
  ) {
    throw new EspnIntegrationError(
      "ESPN returned an incomplete hockey league response; the last good state was retained.",
      502,
      "ESPN_SCHEMA_MISMATCH",
    );
  }
  const normalized = normalizeEspnLeaguePayload({
    leagueId: args.leagueId,
    season: args.season,
    swid: args.credentials.swid,
    payload,
    fetchedAt: args.now,
  });
  const previousState = previous?.normalized_state;
  const mergedState: EspnLeagueStateV1 = previousState
    ? {
        ...normalized.state,
        teams: Array.isArray(rawPayload.teams)
          ? normalized.state.teams
          : previousState.teams,
        matchups: Array.isArray(rawPayload.schedule)
          ? normalized.state.matchups
          : previousState.matchups,
        draft:
          rawPayload.draftDetail && typeof rawPayload.draftDetail === "object"
            ? normalized.state.draft
            : previousState.draft,
        currentMatchupPeriodId:
          rawPayload.status && typeof rawPayload.status === "object"
            ? normalized.state.currentMatchupPeriodId
            : previousState.currentMatchupPeriodId,
        isActive:
          rawPayload.status && typeof rawPayload.status === "object"
            ? normalized.state.isActive
            : previousState.isActive,
        sectionFreshness: {
          ...previousState.sectionFreshness,
          settings: normalized.state.sectionFreshness.settings,
          ...(Array.isArray(rawPayload.teams)
            ? {
                teams: normalized.state.sectionFreshness.teams,
                rosters: normalized.state.sectionFreshness.rosters,
                standings: normalized.state.sectionFreshness.standings,
              }
            : {}),
          ...(Array.isArray(rawPayload.schedule)
            ? { matchups: normalized.state.sectionFreshness.matchups }
            : {}),
          ...(Array.isArray(rawPayload.transactions)
            ? { transactions: normalized.state.sectionFreshness.transactions }
            : {}),
          ...(rawPayload.draftDetail && typeof rawPayload.draftDetail === "object"
            ? { draft: normalized.state.sectionFreshness.draft }
            : {}),
        },
      }
    : normalized.state;
  const resolvedState = await resolveEspnPlayers(args.client, {
    ...mergedState,
    sourceHash: hashEspnLeagueState(mergedState),
  });
  const transactionResult = await backfillEspnTransactions({
    credentials: args.credentials,
    leagueId: args.leagueId,
    season: args.season,
    state: resolvedState,
    previous,
  });
  return {
    settings: normalized.settings,
    state: transactionResult.state,
    syncCursor: transactionResult.syncCursor,
  };
}

async function commitLeague(args: {
  client: DbClient;
  userId: string;
  targetAccountId: string | null;
  accountLabel: string;
  credentials: EspnCredentials;
  normalized: Awaited<ReturnType<typeof fetchNormalizedLeague>>;
}) {
  const { data, error } = await args.client.rpc("commit_espn_connection_secure", {
    p_user_id: args.userId,
    p_target_account_id: args.targetAccountId,
    p_account_label: args.accountLabel,
    p_provider_user_digest: providerUserDigest(args.credentials.swid),
    p_swid: args.credentials.swid,
    p_espn_s2: args.credentials.espnS2,
    p_consent_version: ESPN_CONSENT_VERSION,
    p_league: asJson(leagueCommitPayload(args.normalized.settings, args.normalized.state)),
    p_snapshot: asJson({
      schemaVersion: 1,
      normalizedState: args.normalized.state,
      snapshotHash: args.normalized.state.sourceHash,
      syncCursor: args.normalized.syncCursor,
    }),
  });
  if (error) throw new Error(error.message);
  const result = object(data);
  if (typeof result.accountId !== "string" || typeof result.externalLeagueId !== "string") {
    throw new Error("ESPN connection commit did not return account and league IDs.");
  }
  return {
    accountId: result.accountId,
    externalLeagueId: result.externalLeagueId,
  };
}

export async function linkEspnAccount(args: {
  userId: string;
  accountLabel: unknown;
  swid: unknown;
  espnS2: unknown;
  leagueRef: unknown;
  season: unknown;
  consentVersion: unknown;
  targetAccountId?: unknown;
  client?: DbClient;
  now?: Date;
}) {
  assertEnabled(args.userId);
  if (args.consentVersion !== ESPN_CONSENT_VERSION) {
    throw new EspnIntegrationError(
      "Review and accept the ESPN private-beta consent before linking.",
      400,
      "ESPN_CONSENT_REQUIRED",
    );
  }
  const credentials = {
    swid: validateEspnSwid(args.swid),
    espnS2: validateEspnS2(args.espnS2),
  };
  const accountLabel = validateAccountLabel(args.accountLabel);
  const leagueId = parseEspnLeagueRef(args.leagueRef);
  const season = validateEspnSeason(args.season);
  const targetAccountId =
    typeof args.targetAccountId === "string" && args.targetAccountId.trim()
      ? args.targetAccountId.trim()
      : null;
  const client = args.client ?? serviceRoleClient;
  try {
    const normalized = await fetchNormalizedLeague({
      client,
      credentials,
      leagueId,
      season,
      now: args.now ?? new Date(),
    });
    const committed = await commitLeague({
      client,
      userId: args.userId,
      targetAccountId,
      accountLabel,
      credentials,
      normalized,
    });
    return { ...committed, settings: normalized.settings };
  } catch (error) {
    throw mappedError(error);
  }
}

export async function addEspnLeague(args: {
  userId: string;
  accountId: string;
  leagueRef: unknown;
  season: unknown;
  client?: DbClient;
  now?: Date;
}) {
  assertEnabled(args.userId);
  const client = args.client ?? serviceRoleClient;
  const { data: account, error } = await client
    .from("connected_accounts")
    .select("*")
    .eq("id", args.accountId)
    .eq("user_id", args.userId)
    .eq("provider", ESPN_PROVIDER)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!account) throw mappedError(new Error("ESPN_ACCOUNT_NOT_FOUND"));
  const credentials = await loadEspnCredentials(client, args.userId, account.id);
  const leagueId = parseEspnLeagueRef(args.leagueRef);
  const season = validateEspnSeason(args.season);
  try {
    const normalized = await fetchNormalizedLeague({
      client,
      credentials,
      leagueId,
      season,
      now: args.now ?? new Date(),
    });
    const committed = await commitLeague({
      client,
      userId: args.userId,
      targetAccountId: account.id,
      accountLabel: account.account_label ?? "My ESPN leagues",
      credentials,
      normalized,
    });
    return { ...committed, settings: normalized.settings };
  } catch (error) {
    throw mappedError(error);
  }
}

function normalizedSettings(row: ExternalLeagueRow): EspnLeagueSettingsV1 | null {
  const value = object(object(row.league_metadata).normalized_settings);
  if (
    value.version !== 1 ||
    value.mappingVersion !== "espn-fhl-v1" ||
    typeof value.externalLeagueKey !== "string" ||
    typeof value.espnLeagueId !== "string" ||
    typeof value.sourceHash !== "string" ||
    (value.leagueType !== "points" && value.leagueType !== "categories")
  ) {
    return null;
  }
  return value as EspnLeagueSettingsV1;
}

export async function getEspnConnections(args: {
  userId: string;
  client?: DbClient;
}): Promise<EspnConnectionsResponse> {
  const client = args.client ?? serviceRoleClient;
  const [
    accountsResult,
    leaguesResult,
    teamsResult,
    preferencesResult,
    settingsResult,
    runsResult,
    snapshotsResult,
  ] = await Promise.all([
      client
        .from("connected_accounts")
        .select("*")
        .eq("user_id", args.userId)
        .eq("provider", ESPN_PROVIDER)
        .order("created_at", { ascending: true }),
      client
        .from("external_leagues")
        .select("*")
        .eq("user_id", args.userId)
        .eq("provider", ESPN_PROVIDER)
        .order("league_name", { ascending: true }),
      client
        .from("external_teams")
        .select("*")
        .eq("user_id", args.userId)
        .eq("provider", ESPN_PROVIDER)
        .order("team_name", { ascending: true }),
      client
        .from("user_provider_preferences")
        .select("*")
        .eq("user_id", args.userId)
        .eq("provider", ESPN_PROVIDER)
        .maybeSingle(),
      client
        .from("user_settings")
        .select("active_context")
        .eq("user_id", args.userId)
        .maybeSingle(),
      client
        .from("provider_sync_runs")
        .select("*")
        .eq("user_id", args.userId)
        .eq("provider", ESPN_PROVIDER)
        .order("created_at", { ascending: false })
        .limit(100),
      client
        .from("external_league_state_snapshots")
        .select("external_league_id,sync_cursor")
        .eq("user_id", args.userId)
        .eq("provider", ESPN_PROVIDER),
    ]);
  for (const result of [
    accountsResult,
    leaguesResult,
    teamsResult,
    preferencesResult,
    settingsResult,
    runsResult,
    snapshotsResult,
  ]) {
    if (result.error) throw new Error(result.error.message);
  }
  const accounts = ((accountsResult.data ?? []) as ConnectedAccountRow[]).filter(
    (account) => {
      const metadata = object(account.metadata);
      return (
        typeof account.provider_user_id === "string" ||
        metadata.api_linked === true ||
        (Array.isArray(metadata.integration_modes) &&
          metadata.integration_modes.includes("api"))
      );
    },
  );
  const leagues = (leaguesResult.data ?? []) as ExternalLeagueRow[];
  const teams = (teamsResult.data ?? []) as ExternalTeamRow[];
  const preferences = preferencesResult.data;
  const activeContext = object(settingsResult.data?.active_context);
  const snapshotCursorByLeague = new Map(
    (snapshotsResult.data ?? []).map((snapshot) => [
      snapshot.external_league_id,
      object(snapshot.sync_cursor),
    ]),
  );
  const latestRunByLeague = new Map<string, SyncRunRow>();
  for (const run of (runsResult.data ?? []) as SyncRunRow[]) {
    if (run.external_league_id && !latestRunByLeague.has(run.external_league_id)) {
      latestRunByLeague.set(run.external_league_id, run);
    }
  }
  const accountPayload: EspnConnectionAccount[] = accounts.map((account) => ({
    id: account.id,
    label: account.account_label ?? "ESPN",
    status: account.status,
    lastSyncedAt: account.last_synced_at,
    leagues: leagues.flatMap((league): EspnConnectionLeague[] => {
      if (league.connected_account_id !== account.id) return [];
      const settings = normalizedSettings(league);
      if (!settings) return [];
      const run = latestRunByLeague.get(league.id);
      const snapshotCursor = snapshotCursorByLeague.get(league.id);
      return [
        {
          id: league.id,
          connectedAccountId: account.id,
          externalLeagueKey: league.external_league_key,
          espnLeagueId: settings.espnLeagueId,
          name: league.league_name ?? settings.leagueName,
          seasonKey: league.season_key ?? settings.seasonKey,
          importedAt: league.imported_at,
          settings,
          teams: teams
            .filter((team) => team.external_league_id === league.id)
            .map((team) => ({
              id: team.id,
              externalTeamKey: team.external_team_key,
              name: team.team_name ?? `ESPN Team ${team.external_team_key}`,
              abbreviation:
                typeof object(team.team_metadata).abbreviation === "string"
                  ? String(object(team.team_metadata).abbreviation)
                  : null,
              divisionId:
                typeof object(team.team_metadata).division_id === "number"
                  ? Number(object(team.team_metadata).division_id)
                  : null,
              isOwned: object(team.team_metadata).is_owned === true,
            })),
          isDefault: preferences?.default_external_league_id === league.id,
          settingsChanged:
            activeContext.external_league_id === league.id &&
            typeof activeContext.applied_settings_hash === "string" &&
            activeContext.applied_settings_hash !== settings.sourceHash,
          syncStatus: run?.status ?? (league.imported_at ? "completed" : null),
          syncErrorCode:
            typeof object(run?.error_details).code === "string"
              ? String(object(run?.error_details).code)
              : null,
          transactionBackfillComplete:
            snapshotCursor == null
              ? null
              : snapshotCursor.transactionBackfillComplete === true,
          transactionBackfillErrorCode:
            typeof snapshotCursor?.transactionBackfillErrorCode === "string"
              ? snapshotCursor.transactionBackfillErrorCode
              : null,
        },
      ];
    }),
  }));
  return {
    apiEnabled: isEspnFantasyEnabled(args.userId),
    liveDraftEnabled: isEspnLiveDraftEnabled(args.userId),
    accounts: accountPayload,
    defaultExternalLeagueId: preferences?.default_external_league_id ?? null,
    defaultExternalTeamId: preferences?.default_external_team_id ?? null,
  };
}

function syncBucket(trigger: "manual" | "scheduled", now: Date) {
  const bucketMs = trigger === "manual" ? ESPN_MANUAL_REFRESH_COOLDOWN_MS : 60 * 60 * 1000;
  return Math.floor(now.getTime() / bucketMs);
}

async function latestLeagueRun(client: DbClient, userId: string, leagueId: string) {
  const { data, error } = await client
    .from("provider_sync_runs")
    .select("*")
    .eq("user_id", userId)
    .eq("provider", ESPN_PROVIDER)
    .eq("external_league_id", leagueId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as SyncRunRow | null;
}

async function syncLeague(args: {
  client: DbClient;
  account: ConnectedAccountRow;
  league: ExternalLeagueRow;
  credentials: EspnCredentials;
  trigger: "manual" | "scheduled";
  now: Date;
}) {
  const latest = await latestLeagueRun(
    args.client,
    args.account.user_id,
    args.league.id,
  );
  const lastRefreshAt = [latest?.finished_at, args.league.imported_at]
    .filter((value): value is string => Boolean(value))
    .map((value) => new Date(value).getTime())
    .filter(Number.isFinite)
    .reduce<number | null>(
      (mostRecent, value) =>
        mostRecent == null ? value : Math.max(mostRecent, value),
      null,
    );
  if (
    args.trigger === "manual" &&
    lastRefreshAt != null &&
    args.now.getTime() - lastRefreshAt < ESPN_MANUAL_REFRESH_COOLDOWN_MS
  ) {
    const retryAfterSeconds = Math.ceil(
      (ESPN_MANUAL_REFRESH_COOLDOWN_MS -
        (args.now.getTime() - lastRefreshAt)) /
        1000,
    );
    throw new EspnIntegrationError(
      "This ESPN league was refreshed recently.",
      429,
      "ESPN_REFRESH_COOLDOWN",
      retryAfterSeconds,
    );
  }
  const dedupeKey = `espn:${args.league.id}:${args.trigger}:${syncBucket(args.trigger, args.now)}`;
  const { data: leaseData, error: leaseError } = await args.client.rpc(
    "claim_espn_sync_lease",
    {
      p_user_id: args.account.user_id,
      p_connected_account_id: args.account.id,
      p_external_league_id: args.league.id,
      p_trigger_source:
        args.trigger === "manual" ? "manual_refresh" : "scheduled_sync",
      p_dedupe_key: dedupeKey,
      p_lease_seconds: 240,
      p_claimed_at: args.now.toISOString(),
    },
  );
  if (leaseError) throw new Error(leaseError.message);
  const lease = object(leaseData);
  if (lease.claimed !== true || typeof lease.runId !== "string") {
    return { skipped: true, reason: "duplicate" } as const;
  }
  const runId = lease.runId;
  try {
    const metadata = object(args.league.league_metadata);
    const leagueId = String(metadata.espn_league_id ?? "");
    const season = validateEspnSeason(args.league.season_key);
    if (!leagueId) throw new Error("INVALID_ESPN_LEAGUE_PAYLOAD");
    const normalized = await fetchNormalizedLeague({
      client: args.client,
      credentials: args.credentials,
      leagueId,
      season,
      externalLeagueId: args.league.id,
      now: args.now,
    });
    const previous = normalizedSettings(args.league);
    await commitLeague({
      client: args.client,
      userId: args.account.user_id,
      targetAccountId: args.account.id,
      accountLabel: args.account.account_label ?? "My ESPN leagues",
      credentials: args.credentials,
      normalized,
    });
    await args.client
      .from("provider_sync_runs")
      .update({
        status: "completed",
        finished_at: new Date().toISOString(),
        result_summary: asJson({
          changed: previous?.sourceHash !== normalized.settings.sourceHash,
          previousHash: previous?.sourceHash ?? null,
          sourceHash: normalized.settings.sourceHash,
          stateHash: normalized.state.sourceHash,
          mappingStatus: normalized.settings.diagnostics.status,
          transactionBackfillComplete:
            normalized.syncCursor.transactionBackfillComplete,
          transactionBackfillErrorCode:
            normalized.syncCursor.transactionBackfillErrorCode,
        }),
      })
      .eq("id", runId)
      .eq("user_id", args.account.user_id);
    return {
      skipped: false,
      changed: previous?.sourceHash !== normalized.settings.sourceHash,
      settings: normalized.settings,
    } as const;
  } catch (error) {
    const mapped = mappedError(error);
    if (mapped.code === "ESPN_REAUTH_REQUIRED") {
      await args.client
        .from("connected_accounts")
        .update({ status: "reauth_required" })
        .eq("id", args.account.id)
        .eq("user_id", args.account.user_id);
    }
    const cooldownSeconds = mapped.retryAfterSeconds ?? 3600;
    await args.client
      .from("provider_sync_runs")
      .update({
        status: mapped.statusCode === 429 ? "rate_limited" : "failed",
        finished_at: new Date().toISOString(),
        cooldown_until: new Date(Date.now() + cooldownSeconds * 1000).toISOString(),
        error_details: asJson({ code: mapped.code, statusCode: mapped.statusCode }),
      })
      .eq("id", runId)
      .eq("user_id", args.account.user_id);
    throw mapped;
  }
}

export async function refreshEspnLeague(args: {
  userId: string;
  externalLeagueId: unknown;
  client?: DbClient;
  now?: Date;
}) {
  assertEnabled(args.userId);
  if (typeof args.externalLeagueId !== "string" || !args.externalLeagueId.trim()) {
    throw new EspnIntegrationError(
      "ESPN league is required.",
      400,
      "ESPN_LEAGUE_REQUIRED",
    );
  }
  const client = args.client ?? serviceRoleClient;
  const { data: league, error: leagueError } = await client
    .from("external_leagues")
    .select("*")
    .eq("id", args.externalLeagueId.trim())
    .eq("user_id", args.userId)
    .eq("provider", ESPN_PROVIDER)
    .maybeSingle();
  if (leagueError) throw new Error(leagueError.message);
  if (!league) throw mappedError(new Error("ESPN_LEAGUE_NOT_FOUND"));
  const { data: account, error: accountError } = await client
    .from("connected_accounts")
    .select("*")
    .eq("id", league.connected_account_id)
    .eq("user_id", args.userId)
    .eq("provider", ESPN_PROVIDER)
    .maybeSingle();
  if (accountError) throw new Error(accountError.message);
  if (!account) throw mappedError(new Error("ESPN_ACCOUNT_NOT_FOUND"));
  const credentials = await loadEspnCredentials(client, args.userId, account.id);
  return syncLeague({
    client,
    account,
    league,
    credentials,
    trigger: "manual",
    now: args.now ?? new Date(),
  });
}

export async function updateEspnConnection(args: {
  userId: string;
  accountId: string;
  accountLabel?: unknown;
  swid?: unknown;
  espnS2?: unknown;
  client?: DbClient;
  now?: Date;
}) {
  assertEnabled(args.userId);
  const client = args.client ?? serviceRoleClient;
  const { data: account, error } = await client
    .from("connected_accounts")
    .select("*")
    .eq("id", args.accountId)
    .eq("user_id", args.userId)
    .eq("provider", ESPN_PROVIDER)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!account) throw mappedError(new Error("ESPN_ACCOUNT_NOT_FOUND"));
  const accountLabel =
    args.accountLabel === undefined
      ? account.account_label ?? "My ESPN leagues"
      : validateAccountLabel(args.accountLabel);
  const replacingCredentials = args.swid !== undefined || args.espnS2 !== undefined;
  if (!replacingCredentials) {
    const { error: updateError } = await client
      .from("connected_accounts")
      .update({ account_label: accountLabel })
      .eq("id", account.id)
      .eq("user_id", args.userId);
    if (updateError) throw new Error(updateError.message);
    return { accountId: account.id };
  }
  const credentials = {
    swid: validateEspnSwid(args.swid),
    espnS2: validateEspnS2(args.espnS2),
  };
  const { data: league, error: leagueError } = await client
    .from("external_leagues")
    .select("*")
    .eq("connected_account_id", account.id)
    .eq("user_id", args.userId)
    .eq("provider", ESPN_PROVIDER)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (leagueError) throw new Error(leagueError.message);
  if (!league) throw mappedError(new Error("ESPN_LEAGUE_NOT_FOUND"));
  const metadata = object(league.league_metadata);
  const normalized = await fetchNormalizedLeague({
    client,
    credentials,
    leagueId: String(metadata.espn_league_id ?? ""),
    season: validateEspnSeason(league.season_key),
    externalLeagueId: league.id,
    now: args.now ?? new Date(),
  });
  return commitLeague({
    client,
    userId: args.userId,
    targetAccountId: account.id,
    accountLabel,
    credentials,
    normalized,
  });
}

export async function applyEspnSettings(args: {
  userId: string;
  externalLeagueId: unknown;
  externalTeamId?: unknown;
  settingsHash: unknown;
  acknowledgeWarnings: unknown;
  client?: DbClient;
}) {
  assertEnabled(args.userId);
  if (typeof args.externalLeagueId !== "string" || !args.externalLeagueId.trim()) {
    throw new EspnIntegrationError("ESPN league is required.", 400, "ESPN_LEAGUE_REQUIRED");
  }
  if (typeof args.settingsHash !== "string" || !args.settingsHash.trim()) {
    throw new EspnIntegrationError(
      "ESPN settings hash is required.",
      400,
      "ESPN_SETTINGS_HASH_REQUIRED",
    );
  }
  const client = args.client ?? serviceRoleClient;
  const { data, error } = await client.rpc("apply_espn_settings_secure", {
    p_user_id: args.userId,
    p_external_league_id: args.externalLeagueId.trim(),
    p_external_team_id:
      typeof args.externalTeamId === "string" && args.externalTeamId.trim()
        ? args.externalTeamId.trim()
        : null,
    p_settings_hash: args.settingsHash.trim(),
    p_acknowledge_warnings: args.acknowledgeWarnings === true,
  });
  if (error) {
    if (error.message.includes("ESPN_SETTINGS_STALE")) {
      throw new EspnIntegrationError(
        "ESPN settings changed; review them again before applying.",
        409,
        "ESPN_SETTINGS_STALE",
      );
    }
    if (error.message.includes("ESPN_WARNINGS_UNACKNOWLEDGED")) {
      throw new EspnIntegrationError(
        "Review and acknowledge the ESPN mapping warnings.",
        409,
        "ESPN_WARNINGS_UNACKNOWLEDGED",
      );
    }
    if (error.message.includes("ESPN_SETTINGS_UNSUPPORTED")) {
      throw new EspnIntegrationError(
        "These ESPN settings cannot be applied safely.",
        422,
        "ESPN_SETTINGS_UNSUPPORTED",
      );
    }
    throw new Error(error.message);
  }
  return data;
}

export async function disconnectEspnAccount(args: {
  userId: string;
  accountId: string;
  client?: DbClient;
}) {
  const client = args.client ?? serviceRoleClient;
  const { data, error } = await client.rpc("disconnect_espn_account_secure", {
    p_user_id: args.userId,
    p_connected_account_id: args.accountId,
  });
  if (error) throw new Error(error.message);
  if (!data) throw mappedError(new Error("ESPN_ACCOUNT_NOT_FOUND"));
  return { disconnected: true };
}

export async function deleteEspnLeague(args: {
  userId: string;
  accountId: string;
  externalLeagueId: string;
  client?: DbClient;
}) {
  const client = args.client ?? serviceRoleClient;
  const { data, error } = await client.rpc("delete_espn_league_secure", {
    p_user_id: args.userId,
    p_connected_account_id: args.accountId,
    p_external_league_id: args.externalLeagueId,
  });
  if (error) throw new Error(error.message);
  if (!data) throw mappedError(new Error("ESPN_LEAGUE_NOT_FOUND"));
  return { deleted: true };
}

export async function runEspnScheduledSync(args: {
  client?: DbClient;
  now?: Date;
}) {
  const client = args.client ?? serviceRoleClient;
  const startedAt = Date.now();
  const now = args.now ?? new Date();
  const globallyEnabled =
    process.env.ESPN_FANTASY_API_ENABLED?.trim().toLowerCase() === "true";
  const allowlisted = uniqueStrings(
    process.env.ESPN_FANTASY_ALLOWED_USER_IDS?.split(","),
  );
  if (!globallyEnabled || !allowlisted.length) {
    return { processed: 0, changed: 0, failed: 0, disabled: true };
  }
  const staleBefore = new Date(now.getTime() - ESPN_SCHEDULED_FRESHNESS_MS);
  let dueQuery = client
    .from("external_leagues")
    .select("*")
    .eq("provider", ESPN_PROVIDER)
    .contains("league_metadata", { api_sync_enabled: true, is_active: true })
    .or(`imported_at.is.null,imported_at.lt.${staleBefore.toISOString()}`)
    .order("imported_at", { ascending: true, nullsFirst: true });
  dueQuery = dueQuery.in("user_id", allowlisted);
  const { data: leagues, error } = await dueQuery.limit(6);
  if (error) throw new Error(error.message);
  const due = (leagues ?? []) as ExternalLeagueRow[];
  if (!due.length) return { processed: 0, changed: 0, failed: 0 };
  const accountIds = [...new Set(due.map((league) => league.connected_account_id))];
  const { data: accounts, error: accountError } = await client
    .from("connected_accounts")
    .select("*")
    .eq("provider", ESPN_PROVIDER)
    .in("id", accountIds);
  if (accountError) throw new Error(accountError.message);
  const accountById = new Map(
    ((accounts ?? []) as ConnectedAccountRow[]).map((account) => [account.id, account]),
  );
  let processed = 0;
  let changed = 0;
  let failed = 0;
  for (const league of due) {
    if (Date.now() - startedAt >= CRON_RUNTIME_BUDGET_MS - CRON_REQUEST_HEADROOM_MS) break;
    const account = accountById.get(league.connected_account_id);
    if (!account) continue;
    try {
      const credentials = await loadEspnCredentials(client, account.user_id, account.id);
      const result = await syncLeague({
        client,
        account,
        league,
        credentials,
        trigger: "scheduled",
        now,
      });
      if (!result.skipped) {
        processed += 1;
        if (result.changed) changed += 1;
      }
    } catch (syncError) {
      failed += 1;
      if (mappedError(syncError).statusCode === 429) break;
    }
  }
  return { processed, changed, failed };
}

export { loadEspnCredentials, mappedError, normalizedSettings };
