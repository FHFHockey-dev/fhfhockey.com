import type { SupabaseClient } from "@supabase/supabase-js";

import serviceRoleClient from "lib/supabase/server";
import type { Database, Json } from "lib/supabase/database-generated.types";

import { FANTRAX_PROVIDER } from "./config";
import {
  FantraxApiError,
  getFantraxLeagueInfo,
  getFantraxLeagues,
} from "./client";
import {
  FANTRAX_CONSENT_VERSION,
  type FantraxConnectionAccount,
  type FantraxConnectionsResponse,
  type FantraxDiscoveredLeague,
  type FantraxLeagueSettingsV1,
} from "./contracts";
import {
  normalizeFantraxDiscovery,
  normalizeFantraxLeagueInfo,
  relevantFantraxRawSettings,
} from "./normalize";

type ConnectedAccountRow = Database["public"]["Tables"]["connected_accounts"]["Row"];
type ExternalLeagueRow = Database["public"]["Tables"]["external_leagues"]["Row"];
type ExternalTeamRow = Database["public"]["Tables"]["external_teams"]["Row"];
type SyncRunRow = Database["public"]["Tables"]["provider_sync_runs"]["Row"];
type DbClient = SupabaseClient<Database>;
type UnknownRecord = Record<string, unknown>;

const MAX_SELECTED_LEAGUES = 50;
const MANUAL_REFRESH_COOLDOWN_MS = 15 * 60 * 1000;
const SCHEDULED_FRESHNESS_MS = 24 * 60 * 60 * 1000;
const CRON_RUNTIME_BUDGET_MS = 200_000;
const SCHEDULED_REQUEST_HEADROOM_MS = 35_000;

export class FantraxIntegrationError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code: string,
    public readonly retryAfterSeconds: number | null = null,
  ) {
    super(message);
    this.name = "FantraxIntegrationError";
  }
}

function object(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {};
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function uniqueStrings(value: unknown) {
  return [...new Set(stringArray(value).map((item) => item.trim()).filter(Boolean))];
}

function asJson(value: unknown): Json {
  return value as Json;
}

function selectedLeagueKeys(value: unknown, allowEmpty = false) {
  const keys = uniqueStrings(value);
  if (!keys.length && !allowEmpty) {
    throw new FantraxIntegrationError(
      "Select at least one Fantrax league.",
      400,
      "FANTRAX_LEAGUE_REQUIRED",
    );
  }
  if (keys.length > MAX_SELECTED_LEAGUES) {
    throw new FantraxIntegrationError(
      `Select no more than ${MAX_SELECTED_LEAGUES} Fantrax leagues.`,
      400,
      "FANTRAX_TOO_MANY_LEAGUES",
    );
  }
  return keys;
}

export function validateFantraxSecretId(value: unknown) {
  if (typeof value !== "string") {
    throw new FantraxIntegrationError(
      "Fantrax Secret ID is required.",
      400,
      "FANTRAX_SECRET_REQUIRED",
    );
  }
  const secretId = value.trim();
  if (!secretId || secretId.length > 512 || /[\u0000-\u001f\u007f]/.test(secretId)) {
    throw new FantraxIntegrationError(
      "Fantrax Secret ID is invalid.",
      400,
      "FANTRAX_SECRET_INVALID",
    );
  }
  return secretId;
}

function validateAccountLabel(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    throw new FantraxIntegrationError(
      "Account label is required.",
      400,
      "FANTRAX_ACCOUNT_LABEL_REQUIRED",
    );
  }
  const label = value.trim();
  if (label.length > 80) {
    throw new FantraxIntegrationError(
      "Account label must be 80 characters or fewer.",
      400,
      "FANTRAX_ACCOUNT_LABEL_TOO_LONG",
    );
  }
  return label;
}

function mappedError(error: unknown): FantraxIntegrationError {
  if (error instanceof FantraxIntegrationError) return error;
  if (error instanceof FantraxApiError) {
    return new FantraxIntegrationError(
      error.message,
      error.statusCode,
      error.code,
      error.retryAfterSeconds,
    );
  }
  const databaseCode =
    error instanceof Error
      ? [
          "INVALID_FANTRAX_CONNECTION_PAYLOAD",
          "INVALID_FANTRAX_LEAGUE_PAYLOAD",
          "FANTRAX_SECRET_ALREADY_LINKED",
          "FANTRAX_ACCOUNT_NOT_FOUND",
        ].find((code) => error.message.includes(code))
      : null;
  if (databaseCode === "FANTRAX_SECRET_ALREADY_LINKED") {
    return new FantraxIntegrationError(
      "That Secret ID is already linked to another Fantrax card.",
      409,
      databaseCode,
    );
  }
  if (databaseCode === "FANTRAX_ACCOUNT_NOT_FOUND") {
    return new FantraxIntegrationError(
      "Fantrax account not found.",
      404,
      databaseCode,
    );
  }
  if (databaseCode) {
    return new FantraxIntegrationError(
      "The Fantrax connection data was invalid.",
      400,
      databaseCode,
    );
  }
  return new FantraxIntegrationError(
    "Fantrax integration failed.",
    500,
    "FANTRAX_INTERNAL_ERROR",
  );
}

export function isFantraxApiEnabled(userId?: string | null) {
  if (process.env.FANTRAX_API_ENABLED?.trim().toLowerCase() === "true") return true;
  if (!userId) return false;
  return uniqueStrings(process.env.FANTRAX_API_ALLOWED_USER_IDS?.split(",")).includes(
    userId,
  );
}

function assertFantraxApiEnabled(userId: string) {
  if (!isFantraxApiEnabled(userId)) {
    throw new FantraxIntegrationError(
      "Fantrax API linking is not enabled for this account.",
      404,
      "FANTRAX_API_DISABLED",
    );
  }
}

export async function discoverFantraxLeagues(args: {
  userId: string;
  secretId: unknown;
  selectedLeagueKeys?: unknown;
}) {
  assertFantraxApiEnabled(args.userId);
  const secretId = validateFantraxSecretId(args.secretId);
  try {
    const leagues = normalizeFantraxDiscovery(await getFantraxLeagues(secretId));
    if (!leagues.length) {
      throw new FantraxIntegrationError(
        "No NHL leagues were returned for that Fantrax Secret ID.",
        422,
        "FANTRAX_NO_NHL_LEAGUES",
      );
    }
    const selectedKeys =
      args.selectedLeagueKeys === undefined
        ? []
        : selectedLeagueKeys(args.selectedLeagueKeys);
    const previews = selectedKeys.length
      ? await selectedSnapshots({ selectedKeys, discovery: leagues })
      : [];
    return {
      leagues,
      previews: previews.map(({ settings }) => settings),
    };
  } catch (error) {
    throw mappedError(error);
  }
}

export async function discoverLinkedFantraxLeagues(args: {
  userId: string;
  accountId: unknown;
  selectedLeagueKeys?: unknown;
  client?: DbClient;
}) {
  assertFantraxApiEnabled(args.userId);
  if (typeof args.accountId !== "string" || !args.accountId.trim()) {
    throw new FantraxIntegrationError(
      "Fantrax account is required.",
      400,
      "FANTRAX_ACCOUNT_REQUIRED",
    );
  }
  const client = args.client ?? serviceRoleClient;
  const { data: account, error } = await client
    .from("connected_accounts")
    .select("id")
    .eq("id", args.accountId.trim())
    .eq("user_id", args.userId)
    .eq("provider", FANTRAX_PROVIDER)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!account) {
    throw new FantraxIntegrationError(
      "Fantrax account not found.",
      404,
      "FANTRAX_ACCOUNT_NOT_FOUND",
    );
  }
  const secretId = await loadFantraxSecret(client, args.userId, account.id);
  return discoverFantraxLeagues({
    userId: args.userId,
    secretId,
    selectedLeagueKeys: args.selectedLeagueKeys,
  });
}

async function selectedSnapshots(args: {
  selectedKeys: string[];
  discovery: FantraxDiscoveredLeague[];
  fetchedAt?: Date;
  rejectUnsupported?: boolean;
}) {
  const discoveredByKey = new Map(
    args.discovery.map((league) => [league.externalLeagueKey, league]),
  );
  for (const key of args.selectedKeys) {
    if (!discoveredByKey.has(key)) {
      throw new FantraxIntegrationError(
        "One or more selected Fantrax leagues are no longer available to this Secret ID.",
        400,
        "FANTRAX_SELECTION_INVALID",
      );
    }
  }
  const snapshots = [];
  for (const externalLeagueKey of args.selectedKeys) {
    const payload = await getFantraxLeagueInfo(externalLeagueKey);
    const discovered = discoveredByKey.get(externalLeagueKey)!;
    const settings = normalizeFantraxLeagueInfo({
      externalLeagueKey,
      payload,
      ownedTeams: discovered.ownedTeams,
      fetchedAt: args.fetchedAt,
    });
    if (
      args.rejectUnsupported &&
      settings.diagnostics.status === "unsupported"
    ) {
      throw new FantraxIntegrationError(
        `${settings.leagueName} does not expose an NHL scoring system FHFH can import safely.`,
        422,
        "FANTRAX_SETTINGS_UNSUPPORTED",
      );
    }
    snapshots.push({ payload, discovered, settings });
  }
  return snapshots;
}

function leagueCommitPayload(
  snapshots: Awaited<ReturnType<typeof selectedSnapshots>>,
) {
  return snapshots.map(({ payload, settings }) => ({
    externalLeagueKey: settings.externalLeagueKey,
    leagueName: settings.leagueName,
    seasonKey: settings.seasonKey,
    leagueMetadata: {
      api_sync_enabled: true,
      source_modes: ["api"],
      source_hash: settings.sourceHash,
      mapping_version: settings.mappingVersion,
      normalized_settings: settings,
      raw_settings: relevantFantraxRawSettings(payload),
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
      externalTeamKey: team.externalTeamKey,
      teamName: team.name,
      teamMetadata: {
        division: team.division,
        is_owned: team.isOwned,
        source_mode: "api",
        source_modes: ["api"],
      },
    })),
  }));
}

export async function linkFantraxAccount(args: {
  userId: string;
  secretId: unknown;
  accountLabel: unknown;
  selectedLeagueKeys: unknown;
  consentVersion: unknown;
  targetAccountId?: unknown;
  allowEmptySelection?: boolean;
  client?: DbClient;
}) {
  assertFantraxApiEnabled(args.userId);
  const secretId = validateFantraxSecretId(args.secretId);
  const accountLabel = validateAccountLabel(args.accountLabel);
  const selectedKeys = selectedLeagueKeys(
    args.selectedLeagueKeys,
    args.allowEmptySelection === true,
  );
  if (args.consentVersion !== FANTRAX_CONSENT_VERSION) {
    throw new FantraxIntegrationError(
      "Fantrax consent must be reviewed before linking.",
      400,
      "FANTRAX_CONSENT_REQUIRED",
    );
  }
  const targetAccountId =
    typeof args.targetAccountId === "string" && args.targetAccountId.trim()
      ? args.targetAccountId.trim()
      : null;
  try {
    const discovery = normalizeFantraxDiscovery(await getFantraxLeagues(secretId));
    const snapshots = await selectedSnapshots({
      selectedKeys,
      discovery,
      rejectUnsupported: true,
    });
    const client = args.client ?? serviceRoleClient;
    const { data, error } = await client.rpc(
      "commit_fantrax_connection_secure",
      {
        p_user_id: args.userId,
        p_target_account_id: targetAccountId,
        p_account_label: accountLabel,
        p_secret_id: secretId,
        p_consent_version: FANTRAX_CONSENT_VERSION,
        p_leagues: asJson(leagueCommitPayload(snapshots)),
      },
    );
    if (error) throw new Error(`Failed to save Fantrax connection: ${error.message}`);
    if (typeof data !== "string" || !data) {
      throw new Error("Failed to save Fantrax connection: account ID was not returned.");
    }
    return {
      accountId: data,
      leagues: snapshots.map(({ settings }) => settings),
    };
  } catch (error) {
    throw mappedError(error);
  }
}

async function loadFantraxSecret(
  client: DbClient,
  userId: string,
  connectedAccountId: string,
) {
  const { data, error } = await client.rpc(
    "get_connected_account_tokens_secure",
    {
      p_connected_account_id: connectedAccountId,
      p_user_id: userId,
    },
  );
  if (error) throw new Error(`Failed to load Fantrax credential: ${error.message}`);
  const token = (Array.isArray(data) ? data[0] : data) as
    | { access_token?: unknown; token_type?: unknown }
    | null;
  if (
    !token ||
    typeof token.access_token !== "string" ||
    token.token_type !== "fantrax_user_secret_id"
  ) {
    throw new FantraxIntegrationError(
      "This Fantrax account needs to be reconnected.",
      409,
      "FANTRAX_RECONNECT_REQUIRED",
    );
  }
  return token.access_token;
}

function normalizedSettings(row: ExternalLeagueRow): FantraxLeagueSettingsV1 | null {
  const value = object(object(row.league_metadata).normalized_settings);
  if (
    value.version !== 1 ||
    typeof value.externalLeagueKey !== "string" ||
    typeof value.sourceHash !== "string" ||
    (value.leagueType !== "points" && value.leagueType !== "categories")
  ) {
    return null;
  }
  return value as FantraxLeagueSettingsV1;
}

export async function getFantraxConnections(args: {
  userId: string;
  client?: DbClient;
}): Promise<FantraxConnectionsResponse> {
  const client = args.client ?? serviceRoleClient;
  const [accountsResult, leaguesResult, teamsResult, preferencesResult, settingsResult] =
    await Promise.all([
      client
        .from("connected_accounts")
        .select("*")
        .eq("user_id", args.userId)
        .eq("provider", FANTRAX_PROVIDER)
        .order("created_at", { ascending: true }),
      client
        .from("external_leagues")
        .select("*")
        .eq("user_id", args.userId)
        .eq("provider", FANTRAX_PROVIDER)
        .order("league_name", { ascending: true }),
      client
        .from("external_teams")
        .select("*")
        .eq("user_id", args.userId)
        .eq("provider", FANTRAX_PROVIDER)
        .order("team_name", { ascending: true }),
      client
        .from("user_provider_preferences")
        .select("*")
        .eq("user_id", args.userId)
        .eq("provider", FANTRAX_PROVIDER)
        .maybeSingle(),
      client
        .from("user_settings")
        .select("active_context")
        .eq("user_id", args.userId)
        .maybeSingle(),
    ]);
  for (const result of [
    accountsResult,
    leaguesResult,
    teamsResult,
    preferencesResult,
    settingsResult,
  ]) {
    if (result.error) throw new Error(result.error.message);
  }
  const accounts = (accountsResult.data ?? []) as ConnectedAccountRow[];
  const leagues = (leaguesResult.data ?? []) as ExternalLeagueRow[];
  const teams = (teamsResult.data ?? []) as ExternalTeamRow[];
  const preferences = preferencesResult.data;
  const activeContext = object(settingsResult.data?.active_context);
  const appliedHash =
    typeof activeContext.applied_settings_hash === "string"
      ? activeContext.applied_settings_hash
      : null;
  const accountPayload: FantraxConnectionAccount[] = accounts.map((account) => {
    const metadata = object(account.metadata);
    const accountLeagues = leagues.flatMap((league) => {
      if (league.connected_account_id !== account.id) return [];
      const settings = normalizedSettings(league);
      if (!settings) return [];
      return [
        {
          id: league.id,
          connectedAccountId: account.id,
          externalLeagueKey: league.external_league_key,
          name: league.league_name ?? settings.leagueName,
          seasonKey: league.season_key,
          importedAt: league.imported_at,
          settings,
          teams: teams
            .filter((team) => team.external_league_id === league.id)
            .map((team) => ({
              id: team.id,
              externalTeamKey: team.external_team_key,
              name: team.team_name ?? `Fantrax Team ${team.external_team_key}`,
              division:
                typeof object(team.team_metadata).division === "string"
                  ? String(object(team.team_metadata).division)
                  : null,
              isOwned: object(team.team_metadata).is_owned === true,
            })),
          isDefault: preferences?.default_external_league_id === league.id,
          settingsChanged:
            activeContext.external_league_id === league.id &&
            appliedHash != null &&
            appliedHash !== settings.sourceHash,
        },
      ];
    });
    return {
      id: account.id,
      label: account.account_label ?? "Fantrax",
      status: account.status,
      lastSyncedAt: account.last_synced_at,
      integrationModes: uniqueStrings(
        metadata.integration_modes ??
          (metadata.integration_mode ? [metadata.integration_mode] : []),
      ),
      leagues: accountLeagues,
    };
  });
  return {
    apiEnabled: isFantraxApiEnabled(args.userId),
    accounts: accountPayload,
    defaultExternalLeagueId: preferences?.default_external_league_id ?? null,
    defaultExternalTeamId: preferences?.default_external_team_id ?? null,
  };
}

function syncBucket(trigger: "manual" | "scheduled", now: Date) {
  const bucketMs = trigger === "manual" ? MANUAL_REFRESH_COOLDOWN_MS : 60 * 60 * 1000;
  return Math.floor(now.getTime() / bucketMs);
}

async function latestLeagueRun(client: DbClient, userId: string, leagueId: string) {
  const { data, error } = await client
    .from("provider_sync_runs")
    .select("*")
    .eq("user_id", userId)
    .eq("provider", FANTRAX_PROVIDER)
    .eq("external_league_id", leagueId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as SyncRunRow | null;
}

async function persistSyncedLeague(args: {
  client: DbClient;
  userId: string;
  account: ConnectedAccountRow;
  league: ExternalLeagueRow;
  payload: unknown;
  settings: FantraxLeagueSettingsV1;
  now: Date;
}) {
  const previous = normalizedSettings(args.league);
  if (previous?.sourceHash === args.settings.sourceHash) {
    const { error: freshnessError } = await args.client
      .from("external_leagues")
      .update({
        imported_at: args.now.toISOString(),
        updated_at: args.now.toISOString(),
      })
      .eq("id", args.league.id)
      .eq("user_id", args.userId);
    if (freshnessError) throw new Error(freshnessError.message);
    const { error: accountError } = await args.client
      .from("connected_accounts")
      .update({ status: "connected", last_synced_at: args.now.toISOString() })
      .eq("id", args.account.id)
      .eq("user_id", args.userId);
    if (accountError) throw new Error(accountError.message);
    return { changed: false, previousHash: previous.sourceHash };
  }
  const metadata = object(args.league.league_metadata);
  const nextMetadata = {
    ...metadata,
    api_sync_enabled: true,
    source_hash: args.settings.sourceHash,
    mapping_version: args.settings.mappingVersion,
    normalized_settings: args.settings,
    raw_settings: relevantFantraxRawSettings(args.payload),
  };
  const { error: leagueError } = await args.client
    .from("external_leagues")
    .update({
      league_name: args.settings.leagueName,
      season_key: args.settings.seasonKey,
      league_metadata: asJson(nextMetadata),
      scoring_settings: asJson({
        version: args.settings.version,
        mappingVersion: args.settings.mappingVersion,
        leagueType: args.settings.leagueType,
        skaterScoringCategories: args.settings.skaterScoringCategories,
        goalieScoringCategories: args.settings.goalieScoringCategories,
        categoryWeights: args.settings.categoryWeights,
        sourceHash: args.settings.sourceHash,
        diagnostics: args.settings.diagnostics,
      }),
      roster_settings: asJson({
        version: args.settings.version,
        rosterConfig: args.settings.rosterConfig,
        teamCount: args.settings.teamCount,
        draftOrderType: args.settings.draftOrderType,
        sourceHash: args.settings.sourceHash,
      }),
      imported_at: args.now.toISOString(),
      updated_at: args.now.toISOString(),
    })
    .eq("id", args.league.id)
    .eq("user_id", args.userId);
  if (leagueError) throw new Error(leagueError.message);

  if (args.settings.teams.length) {
    const { data: existingTeams, error: existingTeamsError } = await args.client
      .from("external_teams")
      .select("*")
      .eq("external_league_id", args.league.id)
      .eq("user_id", args.userId);
    if (existingTeamsError) throw new Error(existingTeamsError.message);
    const existingByKey = new Map(
      ((existingTeams ?? []) as ExternalTeamRow[]).map((team) => [
        team.external_team_key,
        team,
      ]),
    );
    const { error: teamError } = await args.client.from("external_teams").upsert(
      args.settings.teams.map((team) => {
        const existingMetadata = object(
          existingByKey.get(team.externalTeamKey)?.team_metadata,
        );
        const sourceModes = uniqueStrings(existingMetadata.source_modes);
        const hasManualSource =
          sourceModes.includes("manual_import") ||
          Boolean(existingMetadata.manual_snapshot);
        return {
          external_league_id: args.league.id,
          connected_account_id: args.account.id,
          user_id: args.userId,
          provider: FANTRAX_PROVIDER,
          external_team_key: team.externalTeamKey,
          team_name: team.name,
          team_metadata: asJson({
            ...existingMetadata,
            division: team.division,
            is_owned: team.isOwned,
            source_mode: "api",
            source_modes: hasManualSource
              ? ["manual_import", "api"]
              : ["api"],
          }),
          imported_at: args.now.toISOString(),
          updated_at: args.now.toISOString(),
        };
      }),
      { onConflict: "external_league_id,external_team_key" },
    );
    if (teamError) throw new Error(teamError.message);
  }
  const { error: accountError } = await args.client
    .from("connected_accounts")
    .update({ status: "connected", last_synced_at: args.now.toISOString() })
    .eq("id", args.account.id)
    .eq("user_id", args.userId);
  if (accountError) throw new Error(accountError.message);
  return {
    changed: previous?.sourceHash !== args.settings.sourceHash,
    previousHash: previous?.sourceHash ?? null,
  };
}

async function syncLeagueWithCredential(args: {
  client: DbClient;
  account: ConnectedAccountRow;
  league: ExternalLeagueRow;
  discoveryByKey: Map<string, FantraxDiscoveredLeague>;
  trigger: "manual" | "scheduled";
  now: Date;
}) {
  const latest = await latestLeagueRun(args.client, args.account.user_id, args.league.id);
  if (latest?.cooldown_until && new Date(latest.cooldown_until) > args.now) {
    const retryAfterSeconds = Math.ceil(
      (new Date(latest.cooldown_until).getTime() - args.now.getTime()) / 1000,
    );
    if (args.trigger === "manual") {
      throw new FantraxIntegrationError(
        "This Fantrax league is cooling down before another refresh.",
        429,
        "FANTRAX_REFRESH_COOLDOWN",
        retryAfterSeconds,
      );
    }
    return { skipped: true, reason: "cooldown" } as const;
  }
  if (
    args.trigger === "manual" &&
    latest?.finished_at &&
    args.now.getTime() - new Date(latest.finished_at).getTime() < MANUAL_REFRESH_COOLDOWN_MS
  ) {
    const retryAfterSeconds = Math.ceil(
      (MANUAL_REFRESH_COOLDOWN_MS -
        (args.now.getTime() - new Date(latest.finished_at).getTime())) /
        1000,
    );
    throw new FantraxIntegrationError(
      "This Fantrax league was refreshed recently.",
      429,
      "FANTRAX_REFRESH_COOLDOWN",
      retryAfterSeconds,
    );
  }
  const dedupeKey = `fantrax:${args.league.id}:${args.trigger}:${syncBucket(args.trigger, args.now)}`;
  const { data: run, error: runError } = await args.client
    .from("provider_sync_runs")
    .insert({
      user_id: args.account.user_id,
      provider: FANTRAX_PROVIDER,
      connected_account_id: args.account.id,
      external_league_id: args.league.id,
      trigger_source: args.trigger === "manual" ? "manual_refresh" : "scheduled_sync",
      status: "running",
      dedupe_key: dedupeKey,
      started_at: args.now.toISOString(),
    })
    .select("*")
    .single();
  if (runError?.code === "23505") return { skipped: true, reason: "duplicate" } as const;
  if (runError || !run) throw new Error(runError?.message ?? "Failed to start Fantrax sync.");
  try {
    const payload = await getFantraxLeagueInfo(args.league.external_league_key);
    const settings = normalizeFantraxLeagueInfo({
      externalLeagueKey: args.league.external_league_key,
      payload,
      ownedTeams:
        args.discoveryByKey.get(args.league.external_league_key)?.ownedTeams ?? [],
      fetchedAt: args.now,
    });
    if (settings.diagnostics.status === "unsupported") {
      throw new FantraxIntegrationError(
        "Fantrax settings can no longer be mapped safely; the last known-good settings were retained.",
        422,
        "FANTRAX_MAPPING_UNSUPPORTED",
      );
    }
    const result = await persistSyncedLeague({
      client: args.client,
      userId: args.account.user_id,
      account: args.account,
      league: args.league,
      payload,
      settings,
      now: args.now,
    });
    await args.client
      .from("provider_sync_runs")
      .update({
        status: "completed",
        finished_at: new Date().toISOString(),
        result_summary: asJson({
          changed: result.changed,
          previousHash: result.previousHash,
          sourceHash: settings.sourceHash,
          mappingStatus: settings.diagnostics.status,
          warningCount: settings.diagnostics.unsupported.length,
        }),
      })
      .eq("id", run.id)
      .eq("user_id", args.account.user_id);
    return { skipped: false, settings, ...result } as const;
  } catch (error) {
    const mapped = mappedError(error);
    const cooldownSeconds = mapped.retryAfterSeconds ?? (mapped.statusCode === 429 ? 3600 : 3600);
    await args.client
      .from("provider_sync_runs")
      .update({
        status: mapped.statusCode === 429 ? "rate_limited" : "failed",
        finished_at: new Date().toISOString(),
        cooldown_until: new Date(Date.now() + cooldownSeconds * 1000).toISOString(),
        error_details: asJson({ code: mapped.code, statusCode: mapped.statusCode }),
      })
      .eq("id", run.id)
      .eq("user_id", args.account.user_id);
    throw mapped;
  }
}

async function syncAccountLeagues(args: {
  client: DbClient;
  account: ConnectedAccountRow;
  leagues: ExternalLeagueRow[];
  trigger: "manual" | "scheduled";
  now: Date;
  shouldContinue?: () => boolean;
}) {
  const secretId = await loadFantraxSecret(args.client, args.account.user_id, args.account.id);
  const discovery = normalizeFantraxDiscovery(await getFantraxLeagues(secretId));
  const discoveryByKey = new Map(
    discovery.map((league) => [league.externalLeagueKey, league]),
  );
  const results = [];
  for (const league of args.leagues) {
    if (args.shouldContinue && !args.shouldContinue()) {
      results.push({ skipped: true, reason: "runtime_budget" } as const);
      break;
    }
    try {
      results.push(
        await syncLeagueWithCredential({
          ...args,
          league,
          discoveryByKey,
        }),
      );
    } catch (error) {
      if (args.trigger === "manual" || mappedError(error).statusCode === 429) {
        throw error;
      }
      results.push({
        skipped: true,
        reason: "failed",
        errorCode: mappedError(error).code,
      } as const);
    }
  }
  return results;
}

export async function refreshFantrax(args: {
  userId: string;
  accountId: unknown;
  externalLeagueId?: unknown;
  client?: DbClient;
  now?: Date;
}) {
  assertFantraxApiEnabled(args.userId);
  if (typeof args.accountId !== "string" || !args.accountId.trim()) {
    throw new FantraxIntegrationError(
      "Fantrax account is required.",
      400,
      "FANTRAX_ACCOUNT_REQUIRED",
    );
  }
  const client = args.client ?? serviceRoleClient;
  const { data: account, error: accountError } = await client
    .from("connected_accounts")
    .select("*")
    .eq("id", args.accountId.trim())
    .eq("user_id", args.userId)
    .eq("provider", FANTRAX_PROVIDER)
    .maybeSingle();
  if (accountError) throw new Error(accountError.message);
  if (!account) throw new FantraxIntegrationError("Fantrax account not found.", 404, "FANTRAX_ACCOUNT_NOT_FOUND");
  let leaguesQuery = client
    .from("external_leagues")
    .select("*")
    .eq("connected_account_id", account.id)
    .eq("user_id", args.userId)
    .eq("provider", FANTRAX_PROVIDER);
  if (typeof args.externalLeagueId === "string" && args.externalLeagueId.trim()) {
    leaguesQuery = leaguesQuery.eq("id", args.externalLeagueId.trim());
  }
  const { data: leagues, error: leaguesError } = await leaguesQuery;
  if (leaguesError) throw new Error(leaguesError.message);
  const selected = (leagues ?? []).filter(
    (league) => object(league.league_metadata).api_sync_enabled === true,
  );
  if (!selected.length) {
    throw new FantraxIntegrationError("No selected Fantrax leagues were found.", 404, "FANTRAX_LEAGUE_NOT_FOUND");
  }
  return syncAccountLeagues({
    client,
    account,
    leagues: selected,
    trigger: "manual",
    now: args.now ?? new Date(),
  });
}

export async function updateFantraxConnection(args: {
  userId: string;
  accountId: string;
  accountLabel?: unknown;
  selectedLeagueKeys?: unknown;
  client?: DbClient;
}) {
  assertFantraxApiEnabled(args.userId);
  const client = args.client ?? serviceRoleClient;
  const { data: account, error } = await client
    .from("connected_accounts")
    .select("*")
    .eq("id", args.accountId)
    .eq("user_id", args.userId)
    .eq("provider", FANTRAX_PROVIDER)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!account) throw new FantraxIntegrationError("Fantrax account not found.", 404, "FANTRAX_ACCOUNT_NOT_FOUND");
  if (args.selectedLeagueKeys === undefined) {
    const label = validateAccountLabel(args.accountLabel);
    const { error: updateError } = await client
      .from("connected_accounts")
      .update({ account_label: label })
      .eq("id", account.id)
      .eq("user_id", args.userId);
    if (updateError) throw new Error(updateError.message);
    return { accountId: account.id };
  }
  const secretId = await loadFantraxSecret(client, args.userId, account.id);
  return linkFantraxAccount({
    userId: args.userId,
    secretId,
    accountLabel: args.accountLabel ?? account.account_label ?? "Fantrax",
    selectedLeagueKeys: args.selectedLeagueKeys,
    consentVersion: FANTRAX_CONSENT_VERSION,
    targetAccountId: account.id,
    allowEmptySelection: true,
    client,
  });
}

export async function applyFantraxSettings(args: {
  userId: string;
  externalLeagueId: unknown;
  externalTeamId?: unknown;
  settingsHash: unknown;
  acknowledgeWarnings: unknown;
  client?: DbClient;
}) {
  assertFantraxApiEnabled(args.userId);
  if (typeof args.externalLeagueId !== "string" || !args.externalLeagueId.trim()) {
    throw new FantraxIntegrationError("Fantrax league is required.", 400, "FANTRAX_LEAGUE_REQUIRED");
  }
  if (typeof args.settingsHash !== "string" || !args.settingsHash.trim()) {
    throw new FantraxIntegrationError("Fantrax settings hash is required.", 400, "FANTRAX_SETTINGS_HASH_REQUIRED");
  }
  const client = args.client ?? serviceRoleClient;
  const { data, error } = await client.rpc("apply_fantrax_settings_secure", {
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
    const message = error.message ?? "Failed to apply Fantrax settings.";
    if (message.includes("FANTRAX_SETTINGS_STALE")) {
      throw new FantraxIntegrationError("Fantrax settings changed; review them again before applying.", 409, "FANTRAX_SETTINGS_STALE");
    }
    if (message.includes("FANTRAX_WARNINGS_UNACKNOWLEDGED")) {
      throw new FantraxIntegrationError("Review and acknowledge the Fantrax mapping warnings.", 409, "FANTRAX_WARNINGS_UNACKNOWLEDGED");
    }
    if (message.includes("FANTRAX_SETTINGS_UNSUPPORTED")) {
      throw new FantraxIntegrationError("These Fantrax settings cannot be applied safely.", 422, "FANTRAX_SETTINGS_UNSUPPORTED");
    }
    throw new Error(message);
  }
  return data;
}

export async function disconnectFantraxAccount(args: {
  userId: string;
  accountId: string;
  client?: DbClient;
}) {
  const client = args.client ?? serviceRoleClient;
  const { data, error } = await client.rpc(
    "disconnect_fantrax_account_secure",
    { p_user_id: args.userId, p_connected_account_id: args.accountId },
  );
  if (error) throw new Error(error.message);
  if (!data) throw new FantraxIntegrationError("Fantrax account not found.", 404, "FANTRAX_ACCOUNT_NOT_FOUND");
  return { disconnected: true };
}

export async function runFantraxScheduledSync(args: {
  client?: DbClient;
  now?: Date;
}) {
  const client = args.client ?? serviceRoleClient;
  const startedAt = Date.now();
  const now = args.now ?? new Date();
  const staleBefore = new Date(now.getTime() - SCHEDULED_FRESHNESS_MS);
  const globallyEnabled =
    process.env.FANTRAX_API_ENABLED?.trim().toLowerCase() === "true";
  const allowlistedUserIds = uniqueStrings(
    process.env.FANTRAX_API_ALLOWED_USER_IDS?.split(","),
  );
  if (!globallyEnabled && !allowlistedUserIds.length) {
    return { processed: 0, changed: 0, failed: 0, disabled: true };
  }
  let dueQuery = client
    .from("external_leagues")
    .select("*")
    .eq("provider", FANTRAX_PROVIDER)
    .contains("league_metadata", { api_sync_enabled: true })
    .or(`imported_at.is.null,imported_at.lt.${staleBefore.toISOString()}`)
    .order("imported_at", { ascending: true, nullsFirst: true });
  if (!globallyEnabled) {
    dueQuery = dueQuery.in("user_id", allowlistedUserIds);
  }
  const { data: leagueRows, error: leagueError } = await dueQuery.limit(6);
  if (leagueError) throw new Error(leagueError.message);
  const due = (leagueRows ?? [])
    .filter((league) => object(league.league_metadata).api_sync_enabled === true)
    .slice(0, 6);
  const accountIds = [...new Set(due.map((league) => league.connected_account_id))];
  if (!accountIds.length) return { processed: 0, changed: 0, failed: 0 };
  const { data: accountRows, error: accountError } = await client
    .from("connected_accounts")
    .select("*")
    .in("id", accountIds)
    .eq("provider", FANTRAX_PROVIDER);
  if (accountError) throw new Error(accountError.message);
  const accounts = new Map(
    ((accountRows ?? []) as ConnectedAccountRow[]).map((account) => [account.id, account]),
  );
  let processed = 0;
  let changed = 0;
  let failed = 0;
  let rateLimited = false;
  const hasRequestBudget = () =>
    !rateLimited &&
    Date.now() - startedAt <
      CRON_RUNTIME_BUDGET_MS - SCHEDULED_REQUEST_HEADROOM_MS;
  for (let index = 0; index < accountIds.length; index += 2) {
    if (!hasRequestBudget()) break;
    const batch = accountIds.slice(index, index + 2);
    const results = await Promise.all(
      batch.map(async (accountId) => {
        const account = accounts.get(accountId);
        if (!account) return [];
        try {
          return await syncAccountLeagues({
            client,
            account,
            leagues: due.filter((league) => league.connected_account_id === accountId),
            trigger: "scheduled",
            now,
            shouldContinue: hasRequestBudget,
          });
        } catch (error) {
          failed += 1;
          if (mappedError(error).statusCode === 429) {
            rateLimited = true;
            throw error;
          }
          return [];
        }
      }),
    ).catch((error) => {
      if (mappedError(error).statusCode === 429) return null;
      throw error;
    });
    if (results == null) break;
    for (const accountResults of results) {
      for (const result of accountResults) {
        if (result.skipped) {
          if (result.reason === "failed") failed += 1;
          continue;
        }
        processed += 1;
        if (result.changed) changed += 1;
      }
    }
  }
  return { processed, changed, failed };
}
