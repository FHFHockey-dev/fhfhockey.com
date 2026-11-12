export type TeamUnitToiUnitType =
  | "forward_line"
  | "defense_pair"
  | "power_play";

export type TeamUnitToiCoverageStatus = "complete" | "partial" | "source_gap";

export type TeamUnitToiShiftRow = {
  game_id: number;
  season_id: number | null;
  game_date: string | null;
  team_id: number;
  team_abbrev: string | null;
  player_id: number;
  period: number | null;
  start_seconds: number | null;
  end_seconds: number | null;
  duration_seconds: number | null;
};

export type TeamUnitToiPlayerPositionRow = {
  id: number;
  position: string | null;
};

export type TeamUnitToiPowerPlayRow = {
  gameId: number;
  playerId: number;
  unit: number | null;
  PPTOI: number | null;
};

export type TeamUnitToiInsert = {
  season_id: number;
  snapshot_date: string;
  game_id: number;
  game_date: string | null;
  team_id: number;
  team_abbrev: string | null;
  unit_type: TeamUnitToiUnitType;
  unit_number: number;
  player_ids: number[];
  player_count: number;
  unit_toi_seconds: number;
  team_unit_pool_toi_seconds: number;
  toi_basis: "pooled_player_seconds";
  source_table: "nhl_api_shift_rows" | "powerPlayCombinations";
  source_version: "team_unit_toi_v1";
  coverage_status: TeamUnitToiCoverageStatus;
  coverage_warnings: string[];
  metadata: Record<string, unknown>;
};

type NormalizedShift = {
  gameId: number;
  seasonId: number;
  gameDate: string | null;
  teamId: number;
  teamAbbrev: string | null;
  playerId: number;
  period: number;
  startSeconds: number;
  endSeconds: number;
  positionGroup: "forward" | "defense" | "goalie" | null;
};

type UnitAccumulator = {
  playerIds: number[];
  pooledSeconds: number;
};

type TeamGameAccumulator = {
  seasonId: number;
  gameId: number;
  gameDate: string | null;
  teamId: number;
  teamAbbrev: string | null;
  forwardPoolSeconds: number;
  defensePoolSeconds: number;
  forwardUnits: Map<string, UnitAccumulator>;
  defenseUnits: Map<string, UnitAccumulator>;
};

const SOURCE_VERSION = "team_unit_toi_v1" as const;

function finite(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function roundSeconds(value: number) {
  return Number(value.toFixed(6));
}

function positionGroup(position: string | null | undefined) {
  const normalized = (position ?? "").toUpperCase();
  if (normalized === "D") return "defense" as const;
  if (normalized === "G") return "goalie" as const;
  // players.position stores NHL's single-letter wing codes (L, R); keep LW/RW/F for other sources.
  if (["C", "L", "R", "LW", "RW", "F"].includes(normalized)) return "forward" as const;
  return null;
}

// Skaters whose position is missing or unrecognised, per game and team. Such a skater
// breaks the 5v5 skater count for every segment they are on, so their team-game's units
// are incomplete and must not be marked complete.
function unclassifiedSkatersByTeamGame(shifts: NormalizedShift[]) {
  const byKey = new Map<string, Set<number>>();
  for (const shift of shifts) {
    if (shift.positionGroup != null) continue;
    const key = [shift.seasonId, shift.gameId, shift.teamId].join(":");
    const ids = byKey.get(key) ?? new Set<number>();
    ids.add(shift.playerId);
    byKey.set(key, ids);
  }
  return byKey;
}

function dateOnly(value: string | null) {
  return value == null ? null : value.slice(0, 10);
}

function unitKey(playerIds: number[]) {
  return [...playerIds].sort((a, b) => a - b).join("-");
}

function unitPlayerIds(key: string) {
  return key.split("-").map((entry) => Number(entry));
}

function addUnit(
  units: Map<string, UnitAccumulator>,
  playerIds: number[],
  pooledSeconds: number,
) {
  const key = unitKey(playerIds);
  const existing = units.get(key);
  if (existing) {
    existing.pooledSeconds += pooledSeconds;
    return;
  }
  units.set(key, {
    playerIds: unitPlayerIds(key),
    pooledSeconds,
  });
}

function addTeamGame(
  accumulators: Map<string, TeamGameAccumulator>,
  shift: NormalizedShift,
) {
  const key = [shift.seasonId, shift.gameId, shift.teamId].join(":");
  const existing = accumulators.get(key);
  if (existing) return existing;

  const accumulator: TeamGameAccumulator = {
    seasonId: shift.seasonId,
    gameId: shift.gameId,
    gameDate: shift.gameDate,
    teamId: shift.teamId,
    teamAbbrev: shift.teamAbbrev,
    forwardPoolSeconds: 0,
    defensePoolSeconds: 0,
    forwardUnits: new Map(),
    defenseUnits: new Map(),
  };
  accumulators.set(key, accumulator);
  return accumulator;
}

function normalizeShifts(args: {
  shifts: TeamUnitToiShiftRow[];
  playersById: Map<number, TeamUnitToiPlayerPositionRow>;
  season: number;
}) {
  return args.shifts
    .map((row): NormalizedShift | null => {
      const seasonId = finite(row.season_id) ?? args.season;
      const period = finite(row.period);
      const startSeconds = finite(row.start_seconds);
      const endSeconds = finite(row.end_seconds);
      if (
        seasonId == null ||
        period == null ||
        startSeconds == null ||
        endSeconds == null ||
        endSeconds <= startSeconds
      ) {
        return null;
      }

      return {
        gameId: row.game_id,
        seasonId,
        gameDate: dateOnly(row.game_date),
        teamId: row.team_id,
        teamAbbrev: row.team_abbrev,
        playerId: row.player_id,
        period,
        startSeconds,
        endSeconds,
        positionGroup: positionGroup(args.playersById.get(row.player_id)?.position),
      };
    })
    .filter((row): row is NormalizedShift => row != null);
}

/**
 * Unions each player's shift intervals per game, team and period. Overlapping
 * or touching rows (a feed fault that is not an exact duplicate) would
 * otherwise put one player on the ice twice and build a "trio" like
 * [101, 101, 102]. After the union every active player appears once.
 */
function unionPlayerIntervals(shifts: NormalizedShift[]) {
  const byPlayer = new Map<string, NormalizedShift[]>();
  for (const shift of shifts) {
    const key = [shift.seasonId, shift.gameId, shift.teamId, shift.playerId, shift.period].join(":");
    const current = byPlayer.get(key) ?? [];
    current.push(shift);
    byPlayer.set(key, current);
  }
  const merged: NormalizedShift[] = [];
  for (const playerShifts of byPlayer.values()) {
    const sorted = [...playerShifts].sort(
      (left, right) => left.startSeconds - right.startSeconds || left.endSeconds - right.endSeconds,
    );
    let current = { ...sorted[0] };
    for (const next of sorted.slice(1)) {
      if (next.startSeconds <= current.endSeconds) {
        current.endSeconds = Math.max(current.endSeconds, next.endSeconds);
      } else {
        merged.push(current);
        current = { ...next };
      }
    }
    merged.push(current);
  }
  return merged;
}

function distinctPlayerIds(shifts: NormalizedShift[], group: NormalizedShift["positionGroup"]) {
  return Array.from(
    new Set(shifts.filter((shift) => shift.positionGroup === group).map((shift) => shift.playerId)),
  ).sort((a, b) => a - b);
}

function activeShiftsForSegment(
  shifts: NormalizedShift[],
  startSeconds: number,
  endSeconds: number,
) {
  return shifts.filter(
    (shift) =>
      shift.startSeconds <= startSeconds && shift.endSeconds >= endSeconds,
  );
}

function emitRankedRows(args: {
  accumulator: TeamGameAccumulator;
  unitType: TeamUnitToiUnitType;
  units: Map<string, UnitAccumulator>;
  poolSeconds: number;
  snapshotDate: string;
  sourceTable: TeamUnitToiInsert["source_table"];
  metadata: Record<string, unknown>;
  unclassifiedPlayerIds?: Set<number>;
  extraWarnings?: string[];
}) {
  if (args.poolSeconds <= 0) return [];
  const unclassified = [...(args.unclassifiedPlayerIds ?? [])].sort((a, b) => a - b);
  const coverageWarnings = [
    ...(unclassified.length > 0 ? [`unclassified_skater_positions:${unclassified.join(",")}`] : []),
    ...(args.extraWarnings ?? []),
  ];
  const coverageStatus: TeamUnitToiCoverageStatus =
    coverageWarnings.length > 0 ? "partial" : "complete";

  return Array.from(args.units.values())
    .filter((unit) => unit.pooledSeconds > 0)
    .sort((left, right) => {
      if (right.pooledSeconds !== left.pooledSeconds) {
        return right.pooledSeconds - left.pooledSeconds;
      }
      return unitKey(left.playerIds).localeCompare(unitKey(right.playerIds));
    })
    .map((unit, index): TeamUnitToiInsert => ({
      season_id: args.accumulator.seasonId,
      snapshot_date: args.snapshotDate,
      game_id: args.accumulator.gameId,
      game_date: args.accumulator.gameDate,
      team_id: args.accumulator.teamId,
      team_abbrev: args.accumulator.teamAbbrev,
      unit_type: args.unitType,
      unit_number: index + 1,
      player_ids: unit.playerIds,
      player_count: unit.playerIds.length,
      unit_toi_seconds: roundSeconds(unit.pooledSeconds),
      team_unit_pool_toi_seconds: roundSeconds(args.poolSeconds),
      toi_basis: "pooled_player_seconds",
      source_table: args.sourceTable,
      source_version: SOURCE_VERSION,
      coverage_status: coverageStatus,
      coverage_warnings: coverageWarnings,
      metadata: args.metadata,
    }));
}

export function buildEvenStrengthTeamUnitToiRows(args: {
  shifts: TeamUnitToiShiftRow[];
  players: TeamUnitToiPlayerPositionRow[];
  season: number;
  snapshotDate: string;
}) {
  const playersById = new Map(args.players.map((player) => [player.id, player]));
  const shifts = unionPlayerIntervals(
    normalizeShifts({
      shifts: args.shifts,
      playersById,
      season: args.season,
    }),
  );
  const accumulators = new Map<string, TeamGameAccumulator>();
  const unclassified = unclassifiedSkatersByTeamGame(shifts);
  // Seconds with five skaters a side where a team did not have exactly one
  // goalie on the ice. Strength cannot be verified there, so the segment is not
  // counted as 5v5 and both team-games are marked partial, never complete.
  const goalieGapSeconds = new Map<string, number>();

  const gamePeriodKeys = Array.from(
    new Set(shifts.map((shift) => [shift.gameId, shift.period].join(":"))),
  );
  for (const gamePeriodKey of gamePeriodKeys) {
    const [gameIdText, periodText] = gamePeriodKey.split(":");
    const gameId = Number(gameIdText);
    const period = Number(periodText);
    const periodShifts = shifts.filter(
      (shift) => shift.gameId === gameId && shift.period === period,
    );
    const boundaries = Array.from(
      new Set(
        periodShifts.flatMap((shift) => [shift.startSeconds, shift.endSeconds]),
      ),
    ).sort((a, b) => a - b);

    for (let index = 0; index < boundaries.length - 1; index += 1) {
      const startSeconds = boundaries[index];
      const endSeconds = boundaries[index + 1];
      const duration = endSeconds - startSeconds;
      if (duration <= 0) continue;

      const active = activeShiftsForSegment(
        periodShifts,
        startSeconds,
        endSeconds,
      );
      const activeByTeam = new Map<number, NormalizedShift[]>();
      for (const shift of active) {
        const teamShifts = activeByTeam.get(shift.teamId) ?? [];
        teamShifts.push(shift);
        activeByTeam.set(shift.teamId, teamShifts);
      }

      const teams = Array.from(activeByTeam.entries());
      const fiveSkatersEach =
        teams.length === 2 &&
        teams.every(([, teamShifts]) =>
          distinctPlayerIds(teamShifts, "forward").length +
            distinctPlayerIds(teamShifts, "defense").length ===
          5,
        );
      if (!fiveSkatersEach) continue;
      const oneGoalieEach = teams.every(
        ([, teamShifts]) => distinctPlayerIds(teamShifts, "goalie").length === 1,
      );
      if (!oneGoalieEach) {
        for (const [teamId] of teams) {
          const key = [teams[0][1][0].seasonId, gameId, teamId].join(":");
          goalieGapSeconds.set(key, (goalieGapSeconds.get(key) ?? 0) + duration);
        }
        continue;
      }

      for (const [, teamShifts] of teams) {
        const forwards = distinctPlayerIds(teamShifts, "forward");
        const defense = distinctPlayerIds(teamShifts, "defense");
        if (forwards.length !== 3 || defense.length !== 2) continue;

        const teamAnchor = teamShifts[0];
        const accumulator = addTeamGame(accumulators, teamAnchor);
        const forwardSeconds = duration * forwards.length;
        const defenseSeconds = duration * defense.length;
        accumulator.forwardPoolSeconds += forwardSeconds;
        accumulator.defensePoolSeconds += defenseSeconds;
        addUnit(accumulator.forwardUnits, forwards, forwardSeconds);
        addUnit(accumulator.defenseUnits, defense, defenseSeconds);
      }
    }
  }

  const metadata = {
    strengthFilter: "5v5_by_active_skater_count_and_one_goalie_each",
    secondsBasis: "overlap_segments_multiplied_by_unit_player_count",
    playerIntervals: "unioned_per_player_period",
    unitSemantics: "observed_cooccurrence_units_not_disjoint_lineup_slots",
  };
  return Array.from(accumulators.entries()).flatMap(([key, accumulator]) => {
    const gapSeconds = goalieGapSeconds.get(key) ?? 0;
    const extraWarnings =
      gapSeconds > 0 ? [`goalie_shift_missing_seconds:${roundSeconds(gapSeconds)}`] : [];
    return [
      ...emitRankedRows({
        accumulator,
        unclassifiedPlayerIds: unclassified.get(key),
        extraWarnings,
        unitType: "forward_line",
        units: accumulator.forwardUnits,
        poolSeconds: accumulator.forwardPoolSeconds,
        snapshotDate: args.snapshotDate,
        sourceTable: "nhl_api_shift_rows",
        metadata,
      }),
      ...emitRankedRows({
        accumulator,
        unclassifiedPlayerIds: unclassified.get(key),
        extraWarnings,
        unitType: "defense_pair",
        units: accumulator.defenseUnits,
        poolSeconds: accumulator.defensePoolSeconds,
        snapshotDate: args.snapshotDate,
        sourceTable: "nhl_api_shift_rows",
        metadata,
      }),
    ];
  });
}

export function buildPowerPlayTeamUnitToiRows(args: {
  ppRows: TeamUnitToiPowerPlayRow[];
  shifts: TeamUnitToiShiftRow[];
  season: number;
  snapshotDate: string;
}) {
  const playerTeamByGame = new Map<
    string,
    { teamId: number; teamAbbrev: string | null; gameDate: string | null }
  >();
  for (const shift of args.shifts) {
    playerTeamByGame.set([shift.game_id, shift.player_id].join(":"), {
      teamId: shift.team_id,
      teamAbbrev: shift.team_abbrev,
      gameDate: dateOnly(shift.game_date),
    });
  }

  const teamPools = new Map<string, number>();
  const units = new Map<
    string,
    {
      seasonId: number;
      gameId: number;
      gameDate: string | null;
      teamId: number;
      teamAbbrev: string | null;
      unit: number;
      playerIds: Set<number>;
      pooledSeconds: number;
    }
  >();

  for (const ppRow of args.ppRows) {
    const unit = finite(ppRow.unit);
    const ppToi = finite(ppRow.PPTOI);
    if (unit == null || unit <= 0 || ppToi == null || ppToi <= 0) continue;

    const team = playerTeamByGame.get([ppRow.gameId, ppRow.playerId].join(":"));
    if (!team) continue;

    const poolKey = [args.season, ppRow.gameId, team.teamId].join(":");
    teamPools.set(poolKey, (teamPools.get(poolKey) ?? 0) + ppToi);

    const unitKeyValue = [poolKey, unit].join(":");
    const existing = units.get(unitKeyValue) ?? {
      seasonId: args.season,
      gameId: ppRow.gameId,
      gameDate: team.gameDate,
      teamId: team.teamId,
      teamAbbrev: team.teamAbbrev,
      unit,
      playerIds: new Set<number>(),
      pooledSeconds: 0,
    };
    existing.playerIds.add(ppRow.playerId);
    existing.pooledSeconds += ppToi;
    units.set(unitKeyValue, existing);
  }

  return Array.from(units.values())
    .filter((unit) => (teamPools.get([unit.seasonId, unit.gameId, unit.teamId].join(":")) ?? 0) > 0)
    .sort((left, right) => {
      if (left.gameId !== right.gameId) return left.gameId - right.gameId;
      if (left.teamId !== right.teamId) return left.teamId - right.teamId;
      return left.unit - right.unit;
    })
    .map((unit): TeamUnitToiInsert => {
      const poolSeconds =
        teamPools.get([unit.seasonId, unit.gameId, unit.teamId].join(":")) ?? 0;
      return {
        season_id: unit.seasonId,
        snapshot_date: args.snapshotDate,
        game_id: unit.gameId,
        game_date: unit.gameDate,
        team_id: unit.teamId,
        team_abbrev: unit.teamAbbrev,
        unit_type: "power_play",
        unit_number: unit.unit,
        player_ids: Array.from(unit.playerIds).sort((a, b) => a - b),
        player_count: unit.playerIds.size,
        unit_toi_seconds: roundSeconds(unit.pooledSeconds),
        team_unit_pool_toi_seconds: roundSeconds(poolSeconds),
        toi_basis: "pooled_player_seconds",
        source_table: "powerPlayCombinations",
        source_version: SOURCE_VERSION,
        coverage_status: "complete",
        coverage_warnings: [],
        metadata: {
          secondsBasis: "sum_powerPlayCombinations_player_PPTOI_by_unit",
          teamResolution: "nhl_api_shift_rows_game_player_team",
        },
      };
    });
}

/** Home and away team ids per game, from the games table. */
export type TeamUnitToiGameTeams = Map<number, { homeTeamId: number; awayTeamId: number }>;

/**
 * Repairs known shift-feed faults before units are built:
 * - exact duplicates (same game, player, period, start and end) are collapsed. A doubled shift
 *   puts one player on the ice twice, which breaks the 5v5 skater count and drops the segment;
 * - shifts whose team is not the game's home or away team are dropped (NHL served game
 *   2025020565 with another game's VGK and SJS shifts mixed in). Games without known teams keep
 *   every team.
 */
export function cleanTeamUnitToiShifts(shifts: TeamUnitToiShiftRow[], gameTeams?: TeamUnitToiGameTeams) {
  const seen = new Set<string>();
  const kept: TeamUnitToiShiftRow[] = [];
  let droppedDuplicates = 0;
  let droppedOffGameTeam = 0;
  for (const shift of shifts) {
    const teams = gameTeams?.get(shift.game_id);
    if (teams && shift.team_id !== teams.homeTeamId && shift.team_id !== teams.awayTeamId) {
      droppedOffGameTeam += 1;
      continue;
    }
    const key = [shift.game_id, shift.player_id, shift.period, shift.start_seconds, shift.end_seconds].join(":");
    if (seen.has(key)) {
      droppedDuplicates += 1;
      continue;
    }
    seen.add(key);
    kept.push(shift);
  }
  return { shifts: kept, droppedDuplicates, droppedOffGameTeam };
}

export function buildTeamUnitToiRows(args: {
  shifts: TeamUnitToiShiftRow[];
  players: TeamUnitToiPlayerPositionRow[];
  ppRows: TeamUnitToiPowerPlayRow[];
  season: number;
  snapshotDate: string;
  gameTeams?: TeamUnitToiGameTeams;
}) {
  const { shifts } = cleanTeamUnitToiShifts(args.shifts, args.gameTeams);
  return [
    ...buildEvenStrengthTeamUnitToiRows({
      shifts,
      players: args.players,
      season: args.season,
      snapshotDate: args.snapshotDate,
    }),
    ...buildPowerPlayTeamUnitToiRows({
      ppRows: args.ppRows,
      shifts,
      season: args.season,
      snapshotDate: args.snapshotDate,
    }),
  ];
}
