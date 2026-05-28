export type XgExplorerScope = "players" | "teams" | "goalies";

export type XgExplorerSortKey =
  | "actualRebounds"
  | "createdXg"
  | "entries"
  | "gsax"
  | "ixg"
  | "reboundSaved"
  | "teamXgPct"
  | "transitionXg"
  | "xgAgainst"
  | "xgFor";

export type XgExplorerPlayerRow = {
  id: number;
  name: string;
  teamId: number | null;
  teamAbbreviation: string | null;
  position: string | null;
  asOfGameDate: string | null;
  gamesCount: number;
  ixg: number;
  goals: number;
  shotAttempts: number;
  createdXg: number;
  shotAssistCreatedXg: number;
  shotAssistEvents: number;
  transitionCreatedXg: number;
  transitionEvents: number;
  transitionCreatedShots: number;
  expectedPrimaryAssists: number;
  controlledEntries: number;
  controlledExits: number;
  entryAssists: number;
  expectedReboundsCreated: number;
  actualReboundsCreated: number;
};

export type XgExplorerTeamRow = {
  id: number;
  name: string;
  abbreviation: string | null;
  asOfGameDate: string | null;
  gamesCount: number;
  xgFor: number;
  xgAgainst: number;
  xgPct: number | null;
  goalsFor: number;
  goalsAgainst: number;
  controlledEntries: number;
  controlledExits: number;
  failedExitsAgainst: number;
  transitionCreatedXg: number;
  expectedReboundsFor: number;
  expectedReboundsAgainst: number;
};

export type XgExplorerGoalieRow = {
  id: number;
  name: string;
  teamId: number | null;
  teamAbbreviation: string | null;
  asOfGameDate: string | null;
  gamesCount: number;
  xgAgainst: number;
  goalsAgainst: number;
  shotsAgainst: number;
  goalsSavedAboveExpected: number;
  expectedReboundsAllowed: number;
  actualReboundsAllowed: number;
  reboundControlSavedAboveExpected: number;
  goalieFreezes: number;
  coveredPucks: number;
};

export type XgExplorerResponse = {
  success: true;
  generatedAt: string;
  scope: XgExplorerScope;
  modelVersion: string | null;
  reboundModelVersion: string | null;
  featureVersion: number;
  windowGames: number;
  seasonId: number | null;
  rows: Array<XgExplorerPlayerRow | XgExplorerTeamRow | XgExplorerGoalieRow>;
  counts: {
    rows: number;
    sourceRows: number;
    supplementalRows: number;
  };
  notes: string[];
};

export type XgExplorerError = {
  error: string;
  issues?: string[];
};

export type PlayerXgRollingInput = {
  player_id: number;
  team_id: number | null;
  as_of_game_date: string | null;
  as_of_game_id: number;
  games_count: number;
  ixg: number;
  goals: number;
  shot_attempts: number;
};

export type CreatedXgRollingInput = {
  player_id: number;
  team_id: number | null;
  as_of_game_date: string | null;
  as_of_game_id: number;
  games_count: number;
  created_xg: number;
  shot_assist_created_xg: number;
  transition_created_xg: number;
  shot_assist_events?: number;
  transition_events?: number;
};

export type TransitionAggregateInput = {
  entity_type: "player" | "team";
  entity_id: number;
  controlled_entries: number;
  controlled_exits: number;
  failed_exits_against: number;
  entry_assists: number;
  transition_created_shots?: number;
  transition_created_xg: number;
};

export type ReboundPlayerInput = {
  player_id: number;
  expected_rebounds_created: number;
  actual_rebounds_created: number;
};

export type TeamXgRollingInput = {
  team_id: number;
  as_of_game_date: string | null;
  as_of_game_id: number;
  games_count: number;
  xg_for: number;
  xg_against: number;
  goals_for: number;
  goals_against: number;
};

export type ReboundTeamInput = {
  team_id: number;
  expected_rebounds_for: number;
  expected_rebounds_against: number;
};

export type GoalieXgRollingInput = {
  goalie_player_id: number;
  team_id: number | null;
  as_of_game_date: string | null;
  as_of_game_id: number;
  games_count: number;
  xg_against: number;
  goals_against: number;
  shots_against: number;
  goals_saved_above_expected: number;
};

export type ReboundGoalieInput = {
  goalie_player_id: number;
  expected_rebounds_allowed: number;
  actual_rebounds_allowed: number;
  rebound_control_saved_above_expected: number;
  actual_goalie_freezes: number;
  actual_covered_pucks: number;
};

export type PlayerIdentityInput = {
  id: number;
  fullName: string;
  team_id: number | null;
  position: string | null;
};

export type TeamIdentityInput = {
  id: number;
  abbreviation: string;
  name: string;
};

function roundMetric(value: number): number {
  return Number(value.toFixed(6));
}

function sumByEntity<T extends Record<string, unknown>>(
  rows: T[],
  key: keyof T,
  fields: Array<keyof T>
): Map<number, Record<string, number>> {
  const out = new Map<number, Record<string, number>>();
  for (const row of rows) {
    const entityId = Number(row[key]);
    if (!Number.isFinite(entityId)) continue;
    const current = out.get(entityId) ?? {};
    for (const field of fields) {
      current[String(field)] =
        (current[String(field)] ?? 0) + Number(row[field] ?? 0);
    }
    out.set(entityId, current);
  }
  return out;
}

function latestByEntity<T extends { [key: string]: unknown }>(
  rows: T[],
  idKey: keyof T,
  dateKey: keyof T,
  gameKey: keyof T
): T[] {
  const byId = new Map<number, T>();
  const sorted = [...rows].sort((left, right) => {
    const dateDelta = String(right[dateKey] ?? "").localeCompare(String(left[dateKey] ?? ""));
    if (dateDelta !== 0) return dateDelta;
    return Number(right[gameKey] ?? 0) - Number(left[gameKey] ?? 0);
  });
  for (const row of sorted) {
    const id = Number(row[idKey]);
    if (!Number.isFinite(id) || byId.has(id)) continue;
    byId.set(id, row);
  }
  return Array.from(byId.values());
}

function xgPct(forValue: number, againstValue: number): number | null {
  const total = forValue + againstValue;
  return total > 0 ? roundMetric(forValue / total) : null;
}

export function buildPlayerXgExplorerRows(args: {
  xgRows: PlayerXgRollingInput[];
  createdRows: CreatedXgRollingInput[];
  transitionRows: TransitionAggregateInput[];
  reboundRows: ReboundPlayerInput[];
  players: PlayerIdentityInput[];
  teams: TeamIdentityInput[];
  limit: number;
}): XgExplorerPlayerRow[] {
  const createdByPlayer = new Map(args.createdRows.map((row) => [row.player_id, row]));
  const transitionByPlayer = sumByEntity(args.transitionRows, "entity_id", [
    "controlled_entries",
    "controlled_exits",
    "entry_assists",
    "transition_created_shots",
    "transition_created_xg",
  ]);
  const reboundByPlayer = sumByEntity(args.reboundRows, "player_id", [
    "expected_rebounds_created",
    "actual_rebounds_created",
  ]);
  const playerById = new Map(args.players.map((row) => [row.id, row]));
  const teamById = new Map(args.teams.map((row) => [row.id, row]));

  return latestByEntity(args.xgRows, "player_id", "as_of_game_date", "as_of_game_id")
    .map((row) => {
      const player = playerById.get(row.player_id);
      const teamId = row.team_id ?? player?.team_id ?? null;
      const team = teamId == null ? null : teamById.get(teamId) ?? null;
      const created = createdByPlayer.get(row.player_id);
      const transition = transitionByPlayer.get(row.player_id) ?? {};
      const rebound = reboundByPlayer.get(row.player_id) ?? {};
      const shotAssistCreatedXg = Number(created?.shot_assist_created_xg ?? 0);

      return {
        id: row.player_id,
        name: player?.fullName ?? `Player ${row.player_id}`,
        teamId,
        teamAbbreviation: team?.abbreviation ?? null,
        position: player?.position ?? null,
        asOfGameDate: row.as_of_game_date,
        gamesCount: row.games_count,
        ixg: roundMetric(Number(row.ixg ?? 0)),
        goals: Number(row.goals ?? 0),
        shotAttempts: Number(row.shot_attempts ?? 0),
        createdXg: roundMetric(Number(created?.created_xg ?? 0)),
        shotAssistCreatedXg: roundMetric(shotAssistCreatedXg),
        shotAssistEvents: Number(created?.shot_assist_events ?? 0),
        transitionCreatedXg: roundMetric(Number(created?.transition_created_xg ?? transition.transition_created_xg ?? 0)),
        transitionEvents: Number(created?.transition_events ?? 0),
        transitionCreatedShots: Number(transition.transition_created_shots ?? created?.transition_events ?? 0),
        expectedPrimaryAssists: roundMetric(shotAssistCreatedXg),
        controlledEntries: Number(transition.controlled_entries ?? 0),
        controlledExits: Number(transition.controlled_exits ?? 0),
        entryAssists: Number(transition.entry_assists ?? 0),
        expectedReboundsCreated: roundMetric(Number(rebound.expected_rebounds_created ?? 0)),
        actualReboundsCreated: Number(rebound.actual_rebounds_created ?? 0),
      };
    })
    .sort((left, right) => right.createdXg - left.createdXg || right.ixg - left.ixg)
    .slice(0, args.limit);
}

export function buildTeamXgExplorerRows(args: {
  xgRows: TeamXgRollingInput[];
  transitionRows: TransitionAggregateInput[];
  reboundRows: ReboundTeamInput[];
  teams: TeamIdentityInput[];
  limit: number;
}): XgExplorerTeamRow[] {
  const transitionByTeam = sumByEntity(args.transitionRows, "entity_id", [
    "controlled_entries",
    "controlled_exits",
    "failed_exits_against",
    "transition_created_xg",
  ]);
  const reboundByTeam = sumByEntity(args.reboundRows, "team_id", [
    "expected_rebounds_for",
    "expected_rebounds_against",
  ]);
  const teamById = new Map(args.teams.map((row) => [row.id, row]));

  return latestByEntity(args.xgRows, "team_id", "as_of_game_date", "as_of_game_id")
    .map((row) => {
      const team = teamById.get(row.team_id);
      const transition = transitionByTeam.get(row.team_id) ?? {};
      const rebound = reboundByTeam.get(row.team_id) ?? {};

      return {
        id: row.team_id,
        name: team?.name ?? `Team ${row.team_id}`,
        abbreviation: team?.abbreviation ?? null,
        asOfGameDate: row.as_of_game_date,
        gamesCount: row.games_count,
        xgFor: roundMetric(Number(row.xg_for ?? 0)),
        xgAgainst: roundMetric(Number(row.xg_against ?? 0)),
        xgPct: xgPct(Number(row.xg_for ?? 0), Number(row.xg_against ?? 0)),
        goalsFor: Number(row.goals_for ?? 0),
        goalsAgainst: Number(row.goals_against ?? 0),
        controlledEntries: Number(transition.controlled_entries ?? 0),
        controlledExits: Number(transition.controlled_exits ?? 0),
        failedExitsAgainst: Number(transition.failed_exits_against ?? 0),
        transitionCreatedXg: roundMetric(Number(transition.transition_created_xg ?? 0)),
        expectedReboundsFor: roundMetric(Number(rebound.expected_rebounds_for ?? 0)),
        expectedReboundsAgainst: roundMetric(Number(rebound.expected_rebounds_against ?? 0)),
      };
    })
    .sort((left, right) => (right.xgPct ?? -1) - (left.xgPct ?? -1) || right.xgFor - left.xgFor)
    .slice(0, args.limit);
}

export function buildGoalieXgExplorerRows(args: {
  xgRows: GoalieXgRollingInput[];
  reboundRows: ReboundGoalieInput[];
  players: PlayerIdentityInput[];
  teams: TeamIdentityInput[];
  limit: number;
}): XgExplorerGoalieRow[] {
  const reboundByGoalie = sumByEntity(args.reboundRows, "goalie_player_id", [
    "expected_rebounds_allowed",
    "actual_rebounds_allowed",
    "rebound_control_saved_above_expected",
    "actual_goalie_freezes",
    "actual_covered_pucks",
  ]);
  const playerById = new Map(args.players.map((row) => [row.id, row]));
  const teamById = new Map(args.teams.map((row) => [row.id, row]));

  return latestByEntity(args.xgRows, "goalie_player_id", "as_of_game_date", "as_of_game_id")
    .map((row) => {
      const player = playerById.get(row.goalie_player_id);
      const teamId = row.team_id ?? player?.team_id ?? null;
      const team = teamId == null ? null : teamById.get(teamId) ?? null;
      const rebound = reboundByGoalie.get(row.goalie_player_id) ?? {};

      return {
        id: row.goalie_player_id,
        name: player?.fullName ?? `Goalie ${row.goalie_player_id}`,
        teamId,
        teamAbbreviation: team?.abbreviation ?? null,
        asOfGameDate: row.as_of_game_date,
        gamesCount: row.games_count,
        xgAgainst: roundMetric(Number(row.xg_against ?? 0)),
        goalsAgainst: Number(row.goals_against ?? 0),
        shotsAgainst: Number(row.shots_against ?? 0),
        goalsSavedAboveExpected: roundMetric(Number(row.goals_saved_above_expected ?? 0)),
        expectedReboundsAllowed: roundMetric(Number(rebound.expected_rebounds_allowed ?? 0)),
        actualReboundsAllowed: Number(rebound.actual_rebounds_allowed ?? 0),
        reboundControlSavedAboveExpected: roundMetric(Number(rebound.rebound_control_saved_above_expected ?? 0)),
        goalieFreezes: Number(rebound.actual_goalie_freezes ?? 0),
        coveredPucks: Number(rebound.actual_covered_pucks ?? 0),
      };
    })
    .sort(
      (left, right) =>
        right.goalsSavedAboveExpected - left.goalsSavedAboveExpected ||
        right.reboundControlSavedAboveExpected - left.reboundControlSavedAboveExpected
    )
    .slice(0, args.limit);
}
