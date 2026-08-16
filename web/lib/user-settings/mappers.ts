import type { Json, Database } from "lib/supabase/database-generated.types";

import {
  createDefaultUserLeagueSettings,
  type ActiveUserContext,
  type NumericSettingsMap,
  type UserLeagueSettings
} from "./defaults";

type UserSettingsRow = Database["public"]["Tables"]["user_settings"]["Row"];

function isJsonObject(value: Json | null | undefined): value is Record<string, Json> {
  return Boolean(value) && !Array.isArray(value) && typeof value === "object";
}

function coerceNumberMap<T extends NumericSettingsMap>(
  value: Json | null | undefined,
  fallback: T,
  preserveExact = false
): T {
  const next = (preserveExact ? {} : { ...fallback }) as T;

  if (!isJsonObject(value)) {
    return next;
  }

  for (const [key, rawValue] of Object.entries(value)) {
    if (typeof rawValue === "number" && Number.isFinite(rawValue)) {
      next[key as keyof T] = rawValue as T[keyof T];
    }
  }

  return next;
}

function coerceActiveContext(
  value: Json | null | undefined,
  fallback: ActiveUserContext
): ActiveUserContext {
  if (!isJsonObject(value)) {
    return { ...fallback };
  }

  return {
    source_type:
      typeof value.source_type === "string" && value.source_type
        ? value.source_type
        : fallback.source_type,
    provider: typeof value.provider === "string" ? value.provider : null,
    connected_account_id:
      typeof value.connected_account_id === "string"
        ? value.connected_account_id
        : null,
    external_league_id:
      typeof value.external_league_id === "string" ? value.external_league_id : null,
    external_team_id:
      typeof value.external_team_id === "string" ? value.external_team_id : null,
    external_league_key:
      typeof value.external_league_key === "string" ? value.external_league_key : null,
    external_team_key:
      typeof value.external_team_key === "string" ? value.external_team_key : null,
    applied_settings_hash:
      typeof value.applied_settings_hash === "string"
        ? value.applied_settings_hash
        : null,
    applied_at:
      typeof value.applied_at === "string" ? value.applied_at : null
  };
}

function coerceUiPreferences(
  value: Json | null | undefined,
  fallback: UserLeagueSettings["uiPreferences"]
): UserLeagueSettings["uiPreferences"] {
  const next = { ...fallback };

  if (!isJsonObject(value)) {
    return next;
  }

  for (const [key, rawValue] of Object.entries(value)) {
    if (
      typeof rawValue === "string" ||
      typeof rawValue === "boolean" ||
      rawValue === null
    ) {
      next[key] = rawValue;
    }
  }

  return next;
}

export function mapUserSettingsRowToLeagueSettings(
  row: Pick<
    UserSettingsRow,
    | "league_type"
    | "scoring_categories"
    | "goalie_scoring_categories"
    | "category_weights"
    | "roster_config"
    | "team_count"
    | "draft_order_type"
    | "ui_preferences"
    | "active_context"
  > | null
): UserLeagueSettings {
  const defaults = createDefaultUserLeagueSettings();

  if (!row) {
    return defaults;
  }

  const activeContext = coerceActiveContext(
    row.active_context,
    defaults.activeContext
  );
  const preserveExactProviderMapping =
    typeof activeContext.provider === "string" &&
    typeof activeContext.applied_settings_hash === "string";

  return {
    leagueType: row.league_type === "categories" ? "categories" : "points",
    scoringCategories: coerceNumberMap(
      row.scoring_categories,
      defaults.scoringCategories,
      preserveExactProviderMapping
    ),
    goalieScoringCategories: coerceNumberMap(
      row.goalie_scoring_categories,
      defaults.goalieScoringCategories,
      preserveExactProviderMapping
    ),
    categoryWeights: coerceNumberMap(
      row.category_weights,
      defaults.categoryWeights,
      preserveExactProviderMapping
    ),
    rosterConfig: coerceNumberMap(row.roster_config, defaults.rosterConfig),
    teamCount:
      Number.isInteger(row.team_count) && row.team_count >= 2 && row.team_count <= 40
        ? row.team_count
        : defaults.teamCount,
    draftOrderType:
      row.draft_order_type === "straight" ? "straight" : "snake",
    uiPreferences: coerceUiPreferences(row.ui_preferences, defaults.uiPreferences),
    activeContext
  };
}

export function mapLeagueSettingsToUserSettingsUpsert(
  userId: string,
  settings: UserLeagueSettings
): Database["public"]["Tables"]["user_settings"]["Insert"] {
  return {
    user_id: userId,
    league_type: settings.leagueType,
    scoring_categories: settings.scoringCategories,
    goalie_scoring_categories: settings.goalieScoringCategories,
    category_weights: settings.categoryWeights,
    roster_config: settings.rosterConfig,
    team_count: settings.teamCount,
    draft_order_type: settings.draftOrderType,
    ui_preferences: settings.uiPreferences,
    active_context: settings.activeContext
  };
}
