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
  /**
   * Created-xG fields come only from a created-xG rolling row with the same
   * cutoff game and window as the core row; otherwise null, never 0 (W3-1 D7).
   */
  createdXg: number | null;
  shotAssistCreatedXg: number | null;
  shotAssistEvents: number | null;
  transitionCreatedXg: number | null;
  transitionEvents: number | null;
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
};

export type XgExplorerResponse = {
  success: true;
  generatedAt: string;
  scope: XgExplorerScope;
  /**
   * Registry-pinned model (L14 `fetchActiveXgModel`). Null = in-house xG
   * unavailable (decision 99), shown as unavailable, never as zero.
   */
  modelVersion: string | null;
  featureVersion: number | null;
  windowGames: number;
  seasonId: number | null;
  rows: Array<XgExplorerPlayerRow | XgExplorerTeamRow | XgExplorerGoalieRow>;
  counts: {
    rows: number;
  };
  coverage: XgExplorerCoverageReport;
  notes: string[];
};

export type XgExplorerCoverageReport = {
  status: "ok" | "warning";
  /** Rows served. */
  servedRows: number;
  /** Served rows whose supplemental fields cover the same window and cutoff. */
  alignedRows: number;
  warnings: string[];
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
  created_xg: number | null;
  shot_assist_created_xg: number | null;
  transition_created_xg: number | null;
  shot_assist_events?: number | null;
  transition_events?: number | null;
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


/**
 * Coverage from the rows actually served (W2-3 A4): "ok" only when every served
 * player row has created xG for the same window and cutoff. Raw row-count ratios
 * across tables prove nothing about entity, window or model overlap.
 */
export function buildXgExplorerCoverageReport(args: {
  scope: XgExplorerScope;
  rows: ReadonlyArray<XgExplorerPlayerRow | XgExplorerTeamRow | XgExplorerGoalieRow>;
}): XgExplorerCoverageReport {
  const servedRows = args.rows.length;
  const alignedRows =
    args.scope === "players"
      ? (args.rows as XgExplorerPlayerRow[]).filter((row) => row.createdXg != null).length
      : servedRows;
  const warnings: string[] = [];

  if (servedRows === 0) {
    warnings.push("No rows were served for this model, feature version, season and window.");
  } else if (alignedRows < servedRows) {
    warnings.push(
      `${servedRows - alignedRows} of ${servedRows} players have no created-xG row for the same window and cutoff; those fields show "—".`
    );
  }

  return {
    status: warnings.length ? "warning" : "ok",
    servedRows,
    alignedRows,
    warnings,
  };
}

const finiteOrNull = (value: unknown): number | null => {
  if (value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const roundOrNull = (value: unknown): number | null => {
  const parsed = finiteOrNull(value);
  return parsed == null ? null : roundMetric(parsed);
};

/** Descending with nulls last (rule 20); callers add an id tie-break. */
const compareDescNullsLast = (left: number | null, right: number | null) => {
  if (left == null && right == null) return 0;
  if (left == null) return 1;
  if (right == null) return -1;
  return right - left;
};

export function buildPlayerXgExplorerRows(args: {
  xgRows: PlayerXgRollingInput[];
  createdRows: CreatedXgRollingInput[];
  players: PlayerIdentityInput[];
  teams: TeamIdentityInput[];
  limit: number;
}): XgExplorerPlayerRow[] {
  // Keyed by (player, cutoff game, window) so a created row only pairs with the
  // core row for the same games (W3-1 D7); a different window or cutoff is null.
  const windowKey = (row: { player_id: number; as_of_game_id: number; games_count: number }) =>
    `${row.player_id}:${row.as_of_game_id}:${row.games_count}`;
  const createdByWindow = new Map(args.createdRows.map((row) => [windowKey(row), row]));
  const playerById = new Map(args.players.map((row) => [row.id, row]));
  const teamById = new Map(args.teams.map((row) => [row.id, row]));

  return latestByEntity(args.xgRows, "player_id", "as_of_game_date", "as_of_game_id")
    .map((row) => {
      const player = playerById.get(row.player_id);
      const teamId = row.team_id ?? player?.team_id ?? null;
      const team = teamId == null ? null : teamById.get(teamId) ?? null;
      const created = createdByWindow.get(windowKey(row));

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
        createdXg: roundOrNull(created?.created_xg),
        shotAssistCreatedXg: roundOrNull(created?.shot_assist_created_xg),
        shotAssistEvents: finiteOrNull(created?.shot_assist_events),
        transitionCreatedXg: roundOrNull(created?.transition_created_xg),
        transitionEvents: finiteOrNull(created?.transition_events),
      };
    })
    .sort(
      (left, right) =>
        compareDescNullsLast(left.createdXg, right.createdXg) ||
        right.ixg - left.ixg ||
        left.id - right.id
    )
    .slice(0, args.limit);
}

export function buildTeamXgExplorerRows(args: {
  xgRows: TeamXgRollingInput[];
  teams: TeamIdentityInput[];
  limit: number;
}): XgExplorerTeamRow[] {
  const teamById = new Map(args.teams.map((row) => [row.id, row]));

  return latestByEntity(args.xgRows, "team_id", "as_of_game_date", "as_of_game_id")
    .map((row) => {
      const team = teamById.get(row.team_id);
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
      };
    })
    .sort(
      (left, right) =>
        compareDescNullsLast(left.xgPct, right.xgPct) ||
        right.xgFor - left.xgFor ||
        left.id - right.id
    )
    .slice(0, args.limit);
}

export function buildGoalieXgExplorerRows(args: {
  xgRows: GoalieXgRollingInput[];
  players: PlayerIdentityInput[];
  teams: TeamIdentityInput[];
  limit: number;
}): XgExplorerGoalieRow[] {
  const playerById = new Map(args.players.map((row) => [row.id, row]));
  const teamById = new Map(args.teams.map((row) => [row.id, row]));

  return latestByEntity(args.xgRows, "goalie_player_id", "as_of_game_date", "as_of_game_id")
    .map((row) => {
      const player = playerById.get(row.goalie_player_id);
      const teamId = row.team_id ?? player?.team_id ?? null;
      const team = teamId == null ? null : teamById.get(teamId) ?? null;
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
      };
    })
    .sort(
      (left, right) =>
        right.goalsSavedAboveExpected - left.goalsSavedAboveExpected || left.id - right.id
    )
    .slice(0, args.limit);
}
