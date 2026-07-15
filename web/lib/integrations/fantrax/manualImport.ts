import Papa from "papaparse";
import type { SupabaseClient } from "@supabase/supabase-js";

import serviceRoleClient from "lib/supabase/server";
import { fetchAllSupabasePages } from "lib/supabase/pagination";
import type { Database, Json } from "lib/supabase/database-generated.types";

import {
  FANTRAX_IMPORT_MAX_BYTES,
  FANTRAX_IMPORT_MAX_CSV_ROWS,
  FANTRAX_IMPORT_MAX_LEAGUES,
  FANTRAX_IMPORT_MAX_TEAMS,
  FANTRAX_PROVIDER,
} from "./config";

const FANTRAX_IMPORT_COOLDOWN_MS = 15 * 1000;
const FANTRAX_IMPORT_STALE_MS = 10 * 60 * 1000;

export type ManualImportProviderConfig = {
  provider: string;
  displayName: string;
  defaultAccountLabel: string;
  cooldownMs: number;
  staleMs: number;
};

export const FANTRAX_MANUAL_IMPORT_CONFIG: ManualImportProviderConfig = {
  provider: FANTRAX_PROVIDER,
  displayName: "Fantrax",
  defaultAccountLabel: "Fantrax manual import",
  cooldownMs: FANTRAX_IMPORT_COOLDOWN_MS,
  staleMs: FANTRAX_IMPORT_STALE_MS,
};

type ProviderSyncRunRow =
  Database["public"]["Tables"]["provider_sync_runs"]["Row"];

export type FantraxImportTeam = {
  key: string;
  name: string;
  metadata: Json;
  roster: Json;
  isDefault: boolean;
};

export type FantraxImportLeague = {
  key: string;
  name: string;
  seasonKey: string | null;
  metadata: Json;
  scoringSettings: Json;
  rosterSettings: Json;
  teams: FantraxImportTeam[];
};

export type FantraxImportPayload = {
  accountLabel: string;
  leagues: FantraxImportLeague[];
};

export class FantraxImportError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "FantraxImportError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function textValue(value: unknown) {
  return typeof value === "string" || typeof value === "number"
    ? String(value).trim()
    : "";
}

function booleanValue(value: unknown) {
  if (typeof value === "boolean") return value;
  return ["1", "true", "yes", "y", "default"].includes(
    textValue(value).toLowerCase(),
  );
}

function jsonValue(value: unknown, field: string): Json {
  if (value == null || value === "") return {};
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as Json;
    } catch {
      throw new FantraxImportError(`${field} must contain valid JSON.`, 400);
    }
  }

  try {
    return JSON.parse(JSON.stringify(value)) as Json;
  } catch {
    throw new FantraxImportError(`${field} must be JSON-compatible.`, 400);
  }
}

function stableKey(value: string, prefix: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 160);
  return normalized || `${prefix}-unknown`;
}

function boundedKey(value: unknown, fallbackName: string, prefix: string) {
  return (textValue(value) || stableKey(fallbackName, prefix)).slice(0, 200);
}

function normalizeHeaders(row: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      key
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_"),
      value,
    ]),
  );
}

function first(row: Record<string, unknown>, aliases: string[]) {
  for (const alias of aliases) {
    if (row[alias] != null && row[alias] !== "") return row[alias];
  }
  return undefined;
}

function validatePayload(payload: FantraxImportPayload) {
  if (payload.leagues.length === 0) {
    throw new FantraxImportError(
      "The Fantrax import must include at least one league.",
      400,
    );
  }
  if (payload.leagues.length > FANTRAX_IMPORT_MAX_LEAGUES) {
    throw new FantraxImportError(
      `A single import can include at most ${FANTRAX_IMPORT_MAX_LEAGUES} leagues.`,
      413,
    );
  }

  const leagueKeys = new Set<string>();
  let teamCount = 0;
  for (const league of payload.leagues) {
    if (leagueKeys.has(league.key)) {
      throw new FantraxImportError(
        `League key "${league.key}" appears more than once.`,
        400,
      );
    }
    leagueKeys.add(league.key);

    if (league.teams.length === 0) {
      throw new FantraxImportError(
        `League "${league.name}" must include at least one team.`,
        400,
      );
    }

    const teamKeys = new Set<string>();
    for (const team of league.teams) {
      if (teamKeys.has(team.key)) {
        throw new FantraxImportError(
          `Team key "${team.key}" appears more than once in "${league.name}".`,
          400,
        );
      }
      teamKeys.add(team.key);
      teamCount += 1;
    }
  }

  if (teamCount > FANTRAX_IMPORT_MAX_TEAMS) {
    throw new FantraxImportError(
      `A single import can include at most ${FANTRAX_IMPORT_MAX_TEAMS} teams.`,
      413,
    );
  }

  return payload;
}

function normalizeJsonTeam(value: unknown, leagueName: string) {
  if (!isRecord(value)) {
    throw new FantraxImportError(
      `Every team in "${leagueName}" must be a JSON object.`,
      400,
    );
  }
  const name = textValue(value.name ?? value.team_name ?? value.teamName);
  if (!name) {
    throw new FantraxImportError(
      `Every team in "${leagueName}" needs a name.`,
      400,
    );
  }

  return {
    key: boundedKey(
      value.key ?? value.team_key ?? value.teamKey ?? value.id,
      name,
      "team",
    ),
    name: name.slice(0, 240),
    metadata: jsonValue(
      value.metadata ?? value.team_metadata ?? value.teamMetadata,
      `Team metadata for "${name}"`,
    ),
    roster: jsonValue(
      value.roster ?? value.roster_snapshot ?? value.players,
      `Roster for "${name}"`,
    ),
    isDefault: booleanValue(
      value.is_default ?? value.isDefault ?? value.default,
    ),
  } satisfies FantraxImportTeam;
}

function parseJsonPayload(content: unknown): FantraxImportPayload {
  let raw = content;
  if (typeof raw === "string") {
    if (Buffer.byteLength(raw, "utf8") > FANTRAX_IMPORT_MAX_BYTES) {
      throw new FantraxImportError(
        `Fantrax imports are limited to ${FANTRAX_IMPORT_MAX_BYTES / 1000} KB.`,
        413,
      );
    }
    try {
      raw = JSON.parse(raw);
    } catch {
      throw new FantraxImportError("The Fantrax JSON is invalid.", 400);
    }
  }

  if (!isRecord(raw) || !Array.isArray(raw.leagues)) {
    throw new FantraxImportError(
      "Fantrax JSON must be an object with a leagues array.",
      400,
    );
  }

  const leagues = raw.leagues.map((value, index) => {
    if (!isRecord(value)) {
      throw new FantraxImportError(
        `League ${index + 1} must be a JSON object.`,
        400,
      );
    }
    const name = textValue(value.name ?? value.league_name ?? value.leagueName);
    if (!name) {
      throw new FantraxImportError(`League ${index + 1} needs a name.`, 400);
    }
    if (!Array.isArray(value.teams)) {
      throw new FantraxImportError(
        `League "${name}" must include a teams array.`,
        400,
      );
    }

    return {
      key: boundedKey(
        value.key ?? value.league_key ?? value.leagueKey ?? value.id,
        name,
        "league",
      ),
      name: name.slice(0, 240),
      seasonKey:
        textValue(value.season_key ?? value.seasonKey ?? value.season) || null,
      metadata: jsonValue(
        value.metadata ?? value.league_metadata ?? value.leagueMetadata,
        `League metadata for "${name}"`,
      ),
      scoringSettings: jsonValue(
        value.scoring_settings ?? value.scoringSettings,
        `Scoring settings for "${name}"`,
      ),
      rosterSettings: jsonValue(
        value.roster_settings ?? value.rosterSettings,
        `Roster settings for "${name}"`,
      ),
      teams: value.teams.map((team) => normalizeJsonTeam(team, name)),
    } satisfies FantraxImportLeague;
  });

  return validatePayload({
    accountLabel:
      textValue(raw.account_label ?? raw.accountLabel) ||
      "Fantrax manual import",
    leagues,
  });
}

function parseCsvPayload(content: unknown): FantraxImportPayload {
  if (typeof content !== "string" || !content.trim()) {
    throw new FantraxImportError("The Fantrax CSV is empty.", 400);
  }
  if (Buffer.byteLength(content, "utf8") > FANTRAX_IMPORT_MAX_BYTES) {
    throw new FantraxImportError(
      `Fantrax imports are limited to ${FANTRAX_IMPORT_MAX_BYTES / 1000} KB.`,
      413,
    );
  }

  const parsed = Papa.parse<Record<string, unknown>>(content, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (header) =>
      header
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_"),
  });
  if (parsed.errors.length > 0) {
    throw new FantraxImportError(
      `The Fantrax CSV could not be read: ${parsed.errors[0].message}`,
      400,
    );
  }
  if (parsed.data.length > FANTRAX_IMPORT_MAX_CSV_ROWS) {
    throw new FantraxImportError(
      `Fantrax CSV imports are limited to ${FANTRAX_IMPORT_MAX_CSV_ROWS} rows.`,
      413,
    );
  }

  type MutableTeam = FantraxImportTeam & { playerRows: Json[] };
  type MutableLeague = Omit<FantraxImportLeague, "teams"> & {
    teams: Map<string, MutableTeam>;
  };
  const leagues = new Map<string, MutableLeague>();
  let accountLabel = "Fantrax manual import";

  for (const rawRow of parsed.data) {
    const row = normalizeHeaders(rawRow);
    accountLabel =
      textValue(first(row, ["account_label", "account"])) || accountLabel;
    const leagueName = textValue(
      first(row, ["league_name", "league", "league_title"]),
    );
    const teamName = textValue(
      first(row, ["team_name", "team", "fantasy_team"]),
    );
    if (!leagueName || !teamName) {
      throw new FantraxImportError(
        "Every CSV row needs league_name (or league) and team_name (or team).",
        400,
      );
    }

    const leagueKey = boundedKey(
      first(row, ["league_key", "league_id", "leagueid"]),
      leagueName,
      "league",
    );
    const teamKey = boundedKey(
      first(row, ["team_key", "team_id", "teamid"]),
      teamName,
      "team",
    );
    let league = leagues.get(leagueKey);
    if (!league) {
      league = {
        key: leagueKey,
        name: leagueName.slice(0, 240),
        seasonKey:
          textValue(first(row, ["season_key", "season", "season_id"])) || null,
        metadata: jsonValue(
          first(row, ["league_metadata_json", "league_metadata"]),
          `League metadata for "${leagueName}"`,
        ),
        scoringSettings: jsonValue(
          first(row, ["scoring_settings_json", "scoring_settings"]),
          `Scoring settings for "${leagueName}"`,
        ),
        rosterSettings: jsonValue(
          first(row, ["roster_settings_json", "roster_settings"]),
          `Roster settings for "${leagueName}"`,
        ),
        teams: new Map(),
      };
      leagues.set(leagueKey, league);
    }

    let team = league.teams.get(teamKey);
    if (!team) {
      team = {
        key: teamKey,
        name: teamName.slice(0, 240),
        metadata: jsonValue(
          first(row, ["team_metadata_json", "team_metadata"]),
          `Team metadata for "${teamName}"`,
        ),
        roster: {},
        isDefault: booleanValue(
          first(row, ["is_default", "default_team", "default"]),
        ),
        playerRows: [],
      };
      league.teams.set(teamKey, team);
    } else if (
      booleanValue(first(row, ["is_default", "default_team", "default"]))
    ) {
      team.isDefault = true;
    }

    const explicitRoster = first(row, ["roster_json", "roster_snapshot"]);
    if (explicitRoster != null && explicitRoster !== "") {
      team.roster = jsonValue(explicitRoster, `Roster for "${teamName}"`);
    } else {
      const playerName = textValue(
        first(row, ["player_name", "player", "name"]),
      );
      if (playerName) {
        team.playerRows.push({
          player_id:
            textValue(first(row, ["player_id", "player_key", "id"])) || null,
          name: playerName,
          position:
            textValue(first(row, ["position", "pos", "eligible_positions"])) ||
            null,
          status: textValue(first(row, ["status", "player_status"])) || null,
        });
      }
    }
  }

  const normalizedLeagues = Array.from(leagues.values()).map((league) => ({
    ...league,
    teams: Array.from(league.teams.values()).map(({ playerRows, ...team }) => ({
      ...team,
      roster: playerRows.length > 0 ? playerRows : team.roster,
    })),
  }));

  return validatePayload({ accountLabel, leagues: normalizedLeagues });
}

export function parseFantraxImport(
  content: unknown,
  format?: string | null,
): FantraxImportPayload {
  const normalizedFormat = textValue(format).toLowerCase();
  if (normalizedFormat === "json") return parseJsonPayload(content);
  if (normalizedFormat === "csv") return parseCsvPayload(content);
  if (typeof content === "string" && content.trimStart().startsWith("{")) {
    return parseJsonPayload(content);
  }
  return parseCsvPayload(content);
}

function secondsUntil(timestamp: string, now: Date) {
  return Math.max(
    1,
    Math.ceil((new Date(timestamp).getTime() - now.getTime()) / 1000),
  );
}

export function getManualProviderImportBlock(
  latestRun: Pick<
    ProviderSyncRunRow,
    "status" | "cooldown_until" | "started_at" | "created_at"
  > | null,
  now: Date,
  providerConfig: ManualImportProviderConfig,
) {
  if (latestRun?.status === "running" || latestRun?.status === "queued") {
    const startedAt = latestRun.started_at || latestRun.created_at;
    if (
      now.getTime() - new Date(startedAt).getTime() <
      providerConfig.staleMs
    ) {
      return new FantraxImportError(
        `A ${providerConfig.displayName} import is already in progress.`,
        409,
      );
    }
  }
  if (latestRun?.cooldown_until && new Date(latestRun.cooldown_until) > now) {
    const retryAfterSeconds = secondsUntil(latestRun.cooldown_until, now);
    return new FantraxImportError(
      `${providerConfig.displayName} import is cooling down. Try again in ${retryAfterSeconds} seconds.`,
      429,
      retryAfterSeconds,
    );
  }
  return null;
}

export function getFantraxImportBlock(
  latestRun: Pick<
    ProviderSyncRunRow,
    "status" | "cooldown_until" | "started_at" | "created_at"
  > | null,
  now: Date,
) {
  return getManualProviderImportBlock(
    latestRun,
    now,
    FANTRAX_MANUAL_IMPORT_CONFIG,
  );
}

async function findOrCreateAccount(
  client: SupabaseClient<Database>,
  userId: string,
  accountLabel: string,
  providerConfig: ManualImportProviderConfig,
) {
  const { data: existing, error: existingError } = await client
    .from("connected_accounts")
    .select("*")
    .eq("user_id", userId)
    .eq("provider", providerConfig.provider)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (existingError) {
    throw new Error(
      `Failed to load ${providerConfig.displayName} account: ${existingError.message}`,
    );
  }
  if (existing) return existing;

  const { data, error } = await client
    .from("connected_accounts")
    .insert({
      user_id: userId,
      provider: providerConfig.provider,
      provider_user_id: `manual:${userId}`,
      account_label: accountLabel,
      status: "connected",
      metadata: {
        integration_mode: "manual_import",
        credentials_stored: false,
      },
    })
    .select("*")
    .single();
  if (error?.code === "23505") {
    const { data: racedAccount, error: racedAccountError } = await client
      .from("connected_accounts")
      .select("*")
      .eq("user_id", userId)
      .eq("provider", providerConfig.provider)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!racedAccountError && racedAccount) return racedAccount;
  }
  if (error || !data) {
    throw new Error(
      `Failed to create ${providerConfig.displayName} account: ${error?.message || "No row returned"}`,
    );
  }
  return data;
}

async function latestRunForAccount(
  client: SupabaseClient<Database>,
  userId: string,
  connectedAccountId: string,
  providerConfig: ManualImportProviderConfig,
) {
  const { data, error } = await client
    .from("provider_sync_runs")
    .select("*")
    .eq("user_id", userId)
    .eq("provider", providerConfig.provider)
    .eq("connected_account_id", connectedAccountId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    throw new Error(
      `Failed to load ${providerConfig.displayName} import state: ${error.message}`,
    );
  }
  return data;
}

export async function runManualProviderImport({
  userId,
  content,
  format,
  providerConfig,
  parseImport,
  client = serviceRoleClient,
  now = () => new Date(),
}: {
  userId: string;
  content: unknown;
  format?: string | null;
  providerConfig: ManualImportProviderConfig;
  parseImport: (
    content: unknown,
    format?: string | null,
  ) => FantraxImportPayload;
  client?: SupabaseClient<Database>;
  now?: () => Date;
}) {
  const payload = parseImport(content, format);
  const account = await findOrCreateAccount(
    client,
    userId,
    payload.accountLabel,
    providerConfig,
  );
  const startedAt = now();
  const latestRun = await latestRunForAccount(
    client,
    userId,
    account.id,
    providerConfig,
  );
  const blocked = getManualProviderImportBlock(
    latestRun,
    startedAt,
    providerConfig,
  );
  if (blocked) throw blocked;

  if (
    latestRun &&
    (latestRun.status === "running" || latestRun.status === "queued")
  ) {
    await client
      .from("provider_sync_runs")
      .update({
        status: "failed",
        dedupe_key: null,
        finished_at: startedAt.toISOString(),
        error_details: {
          message: `Stale ${providerConfig.displayName} import was recovered.`,
        },
      })
      .eq("id", latestRun.id)
      .eq("user_id", userId);
  }

  const dedupeKey = `${providerConfig.provider}:${userId}:${account.id}:manual-import`;
  const { data: run, error: runError } = await client
    .from("provider_sync_runs")
    .insert({
      user_id: userId,
      provider: providerConfig.provider,
      connected_account_id: account.id,
      trigger_source: "manual_import",
      status: "running",
      dedupe_key: dedupeKey,
      started_at: startedAt.toISOString(),
    })
    .select("*")
    .single();
  if (runError || !run) {
    if (runError?.code === "23505") {
      throw new FantraxImportError(
        `A ${providerConfig.displayName} import is already in progress.`,
        409,
      );
    }
    throw new Error(
      `Failed to start ${providerConfig.displayName} import: ${runError?.message || "No run row"}`,
    );
  }

  await client
    .from("connected_accounts")
    .update({ status: "syncing" })
    .eq("id", account.id)
    .eq("user_id", userId);

  try {
    const importedAt = startedAt.toISOString();
    const leagueRows = payload.leagues.map((league) => ({
      connected_account_id: account.id,
      user_id: userId,
      provider: providerConfig.provider,
      external_league_key: league.key,
      league_name: league.name,
      season_key: league.seasonKey,
      league_metadata: league.metadata,
      scoring_settings: league.scoringSettings,
      roster_settings: league.rosterSettings,
      imported_at: importedAt,
      updated_at: importedAt,
    }));
    const { data: leagues, error: leagueError } = await client
      .from("external_leagues")
      .upsert(leagueRows, {
        onConflict: "connected_account_id,external_league_key",
      })
      .select("*");
    if (leagueError || !leagues) {
      throw new Error(
        `Failed to persist ${providerConfig.displayName} leagues: ${leagueError?.message || "No rows returned"}`,
      );
    }

    const leagueIdByKey = new Map(
      leagues.map((league) => [league.external_league_key, league.id]),
    );
    const teamRows = payload.leagues.flatMap((league) => {
      const externalLeagueId = leagueIdByKey.get(league.key);
      if (!externalLeagueId) {
        throw new Error(
          `${providerConfig.displayName} league "${league.key}" was not returned.`,
        );
      }
      return league.teams.map((team) => ({
        external_league_id: externalLeagueId,
        connected_account_id: account.id,
        user_id: userId,
        provider: providerConfig.provider,
        external_team_key: team.key,
        team_name: team.name,
        team_metadata: team.metadata,
        roster_snapshot: team.roster,
        imported_at: importedAt,
        updated_at: importedAt,
      }));
    });
    const { data: teams, error: teamError } = await client
      .from("external_teams")
      .upsert(teamRows, {
        onConflict: "external_league_id,external_team_key",
      })
      .select("*");
    if (teamError || !teams) {
      throw new Error(
        `Failed to persist ${providerConfig.displayName} teams: ${teamError?.message || "No rows returned"}`,
      );
    }

    const { data: existingPreferences, error: existingPreferenceError } =
      await client
        .from("user_provider_preferences")
        .select("*")
        .eq("user_id", userId)
        .eq("provider", providerConfig.provider)
        .maybeSingle();
    if (existingPreferenceError) {
      throw new Error(
        `Failed to load ${providerConfig.displayName} defaults: ${existingPreferenceError.message}`,
      );
    }

    const requestedDefault = payload.leagues
      .flatMap((league) =>
        league.teams.map((team) => ({ leagueKey: league.key, team })),
      )
      .find(({ team }) => team.isDefault);
    const requestedDefaultTeam = requestedDefault
      ? teams.find(
          (team) =>
            team.external_team_key === requestedDefault.team.key &&
            team.external_league_id ===
              leagueIdByKey.get(requestedDefault.leagueKey),
        )
      : null;
    const defaultTeamId =
      requestedDefaultTeam?.id ??
      existingPreferences?.default_external_team_id ??
      teams[0]?.id ??
      null;
    const defaultLeagueId =
      requestedDefaultTeam?.external_league_id ??
      existingPreferences?.default_external_league_id ??
      teams[0]?.external_league_id ??
      leagues[0]?.id ??
      null;
    const activeContext = requestedDefaultTeam
      ? {
          provider: providerConfig.provider,
          external_league_id: requestedDefaultTeam.external_league_id,
          external_team_id: requestedDefaultTeam.id,
        }
      : existingPreferences?.active_context &&
          Object.keys(existingPreferences.active_context as object).length > 0
        ? existingPreferences.active_context
        : defaultTeamId
          ? {
              provider: providerConfig.provider,
              external_league_id: defaultLeagueId,
              external_team_id: defaultTeamId,
            }
          : {};

    const { error: preferenceError } = await client
      .from("user_provider_preferences")
      .upsert(
        {
          user_id: userId,
          provider: providerConfig.provider,
          connected_account_id: account.id,
          default_external_league_id: defaultLeagueId,
          default_external_team_id: defaultTeamId,
          refresh_on_login: false,
          active_context: activeContext,
          updated_at: importedAt,
        },
        { onConflict: "user_id,provider" },
      );
    if (preferenceError) {
      throw new Error(
        `Failed to persist ${providerConfig.displayName} defaults: ${preferenceError.message}`,
      );
    }

    const finishedAt = now();
    const cooldownUntil = new Date(
      finishedAt.getTime() + providerConfig.cooldownMs,
    ).toISOString();
    const { error: finishError } = await client
      .from("provider_sync_runs")
      .update({
        status: "completed",
        dedupe_key: null,
        cooldown_until: cooldownUntil,
        finished_at: finishedAt.toISOString(),
        result_summary: {
          integration_mode: "manual_import",
          league_count: leagues.length,
          team_count: teams.length,
        },
        error_details: {},
      })
      .eq("id", run.id)
      .eq("user_id", userId);
    if (finishError) {
      throw new Error(
        `Failed to finish ${providerConfig.displayName} import: ${finishError.message}`,
      );
    }

    const { error: accountError } = await client
      .from("connected_accounts")
      .update({
        account_label: payload.accountLabel,
        status: "connected",
        last_synced_at: finishedAt.toISOString(),
        metadata: {
          integration_mode: "manual_import",
          credentials_stored: false,
          league_count: leagues.length,
          team_count: teams.length,
        },
      })
      .eq("id", account.id)
      .eq("user_id", userId);
    if (accountError) {
      throw new Error(
        `Failed to update ${providerConfig.displayName} account: ${accountError.message}`,
      );
    }

    return {
      runId: run.id,
      leagueCount: leagues.length,
      teamCount: teams.length,
      cooldownUntil,
      defaultTeamId,
    };
  } catch (error) {
    const finishedAt = now();
    const cooldownUntil = new Date(
      finishedAt.getTime() + providerConfig.cooldownMs,
    ).toISOString();
    await client
      .from("provider_sync_runs")
      .update({
        status: "failed",
        dedupe_key: null,
        cooldown_until: cooldownUntil,
        finished_at: finishedAt.toISOString(),
        error_details: {
          message:
            error instanceof Error
              ? error.message
              : `${providerConfig.displayName} import failed.`,
        },
      })
      .eq("id", run.id)
      .eq("user_id", userId);
    await client
      .from("connected_accounts")
      .update({ status: "error" })
      .eq("id", account.id)
      .eq("user_id", userId);
    throw new FantraxImportError(
      error instanceof Error
        ? error.message
        : `${providerConfig.displayName} import failed.`,
      500,
    );
  }
}

export async function runFantraxManualImport(args: {
  userId: string;
  content: unknown;
  format?: string | null;
  client?: SupabaseClient<Database>;
  now?: () => Date;
}) {
  return runManualProviderImport({
    ...args,
    providerConfig: FANTRAX_MANUAL_IMPORT_CONFIG,
    parseImport: parseFantraxImport,
  });
}

export async function setManualProviderDefaultTeam({
  userId,
  teamId,
  providerConfig,
  client = serviceRoleClient,
}: {
  userId: string;
  teamId: string;
  providerConfig: ManualImportProviderConfig;
  client?: SupabaseClient<Database>;
}) {
  const { data: team, error } = await client
    .from("external_teams")
    .select("*")
    .eq("id", teamId)
    .eq("user_id", userId)
    .eq("provider", providerConfig.provider)
    .maybeSingle();
  if (error) {
    throw new Error(
      `Failed to load ${providerConfig.displayName} team: ${error.message}`,
    );
  }
  if (!team) {
    throw new FantraxImportError(
      `${providerConfig.displayName} team was not found.`,
      404,
    );
  }

  const { error: preferenceError } = await client
    .from("user_provider_preferences")
    .upsert(
      {
        user_id: userId,
        provider: providerConfig.provider,
        connected_account_id: team.connected_account_id,
        default_external_league_id: team.external_league_id,
        default_external_team_id: team.id,
        active_context: {
          provider: providerConfig.provider,
          external_league_id: team.external_league_id,
          external_team_id: team.id,
        },
      },
      { onConflict: "user_id,provider" },
    );
  if (preferenceError) {
    throw new Error(
      `Failed to update ${providerConfig.displayName} default team: ${preferenceError.message}`,
    );
  }
  return { teamId: team.id };
}

export async function setManualProviderActiveTeam({
  userId,
  teamId,
  providerConfig,
  client = serviceRoleClient,
}: {
  userId: string;
  teamId: string;
  providerConfig: ManualImportProviderConfig;
  client?: SupabaseClient<Database>;
}) {
  const { data: team, error } = await client
    .from("external_teams")
    .select("*")
    .eq("id", teamId)
    .eq("user_id", userId)
    .eq("provider", providerConfig.provider)
    .maybeSingle();
  if (error) {
    throw new Error(
      `Failed to load ${providerConfig.displayName} team: ${error.message}`,
    );
  }
  if (!team) {
    throw new FantraxImportError(
      `${providerConfig.displayName} team was not found.`,
      404,
    );
  }

  const { error: preferenceError } = await client
    .from("user_provider_preferences")
    .upsert(
      {
        user_id: userId,
        provider: providerConfig.provider,
        connected_account_id: team.connected_account_id,
        active_context: {
          provider: providerConfig.provider,
          external_league_id: team.external_league_id,
          external_team_id: team.id,
        },
      },
      { onConflict: "user_id,provider" },
    );
  if (preferenceError) {
    throw new Error(
      `Failed to update ${providerConfig.displayName} active team: ${preferenceError.message}`,
    );
  }
  return { teamId: team.id };
}

export async function setFantraxDefaultTeam(args: {
  userId: string;
  teamId: string;
  client?: SupabaseClient<Database>;
}) {
  return setManualProviderDefaultTeam({
    ...args,
    providerConfig: FANTRAX_MANUAL_IMPORT_CONFIG,
  });
}

export async function setFantraxActiveTeam(args: {
  userId: string;
  teamId: string;
  client?: SupabaseClient<Database>;
}) {
  return setManualProviderActiveTeam({
    ...args,
    providerConfig: FANTRAX_MANUAL_IMPORT_CONFIG,
  });
}

export async function getManualProviderImportState({
  userId,
  providerConfig,
  client = serviceRoleClient,
}: {
  userId: string;
  providerConfig: ManualImportProviderConfig;
  client?: SupabaseClient<Database>;
}) {
  const { data: account, error: accountError } = await client
    .from("connected_accounts")
    .select("*")
    .eq("user_id", userId)
    .eq("provider", providerConfig.provider)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (accountError) throw accountError;

  const [leagues, teams] = await Promise.all([
    fetchAllSupabasePages((range) =>
      client
        .from("external_leagues")
        .select("*")
        .eq("user_id", userId)
        .eq("provider", providerConfig.provider)
        .order("id", { ascending: true })
        .range(range.from, range.to),
    ),
    fetchAllSupabasePages((range) =>
      client
        .from("external_teams")
        .select("*")
        .eq("user_id", userId)
        .eq("provider", providerConfig.provider)
        .order("id", { ascending: true })
        .range(range.from, range.to),
    ),
  ]);
  const [
    { data: preferences, error: preferenceError },
    { data: latestRun, error: runError },
  ] = await Promise.all([
    client
      .from("user_provider_preferences")
      .select("*")
      .eq("user_id", userId)
      .eq("provider", providerConfig.provider)
      .maybeSingle(),
    client
      .from("provider_sync_runs")
      .select("*")
      .eq("user_id", userId)
      .eq("provider", providerConfig.provider)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (preferenceError) throw preferenceError;
  if (runError) throw runError;

  return { account, leagues, teams, preferences, latestRun };
}

export async function getFantraxImportState(args: {
  userId: string;
  client?: SupabaseClient<Database>;
}) {
  return getManualProviderImportState({
    ...args,
    providerConfig: FANTRAX_MANUAL_IMPORT_CONFIG,
  });
}
