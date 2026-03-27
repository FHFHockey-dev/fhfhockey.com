import { DEFAULT_SKATER_FANTASY_POINTS } from "lib/projectionsConfig/fantasyPointsConfig";

export type LeagueType = "points" | "categories";

export type NumericSettingsMap = Record<string, number>;

export type RosterConfig = {
  [position: string]: number;
  bench: number;
  utility: number;
};

export type ActiveUserContext = {
  source_type: string;
  provider: string | null;
  external_league_id: string | null;
  external_team_id: string | null;
};

export type UserLeagueSettings = {
  leagueType: LeagueType;
  scoringCategories: NumericSettingsMap;
  categoryWeights: NumericSettingsMap;
  rosterConfig: RosterConfig;
  uiPreferences: Record<string, boolean | string | null>;
  activeContext: ActiveUserContext;
};

export const DEFAULT_CATEGORY_WEIGHTS: NumericSettingsMap = {
  GOALS: 1,
  ASSISTS: 1,
  PP_POINTS: 1,
  SHOTS_ON_GOAL: 1,
  HITS: 1,
  BLOCKED_SHOTS: 1,
  WINS_GOALIE: 1,
  SAVES_GOALIE: 1,
  SAVE_PERCENTAGE: 1
};

export const DEFAULT_ROSTER_CONFIG: RosterConfig = {
  C: 2,
  LW: 2,
  RW: 2,
  D: 4,
  G: 2,
  bench: 4,
  utility: 1
};

export const DEFAULT_UI_PREFERENCES = {
  account_settings_section: "profile",
  league_settings_panel_open: true
};

export const DEFAULT_ACTIVE_CONTEXT: ActiveUserContext = {
  source_type: "manual",
  provider: null,
  external_league_id: null,
  external_team_id: null
};

export function createDefaultUserLeagueSettings(): UserLeagueSettings {
  return {
    leagueType: "points",
    scoringCategories: { ...DEFAULT_SKATER_FANTASY_POINTS },
    categoryWeights: { ...DEFAULT_CATEGORY_WEIGHTS },
    rosterConfig: { ...DEFAULT_ROSTER_CONFIG },
    uiPreferences: { ...DEFAULT_UI_PREFERENCES },
    activeContext: { ...DEFAULT_ACTIVE_CONTEXT }
  };
}
