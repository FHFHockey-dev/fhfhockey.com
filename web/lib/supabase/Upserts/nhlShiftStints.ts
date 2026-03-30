import type { Database } from "../database-generated.types";

type ShiftRow = Database["public"]["Tables"]["nhl_api_shift_rows"]["Row"];

export type NhlShiftInterval = {
  gameId: number;
  shiftId: number;
  seasonId: number | null;
  gameDate: string | null;
  teamId: number;
  playerId: number;
  period: number;
  startSecond: number;
  endSecond: number;
  durationSeconds: number;
  shiftNumber: number | null;
};

export type NhlShiftStintTeam = {
  teamId: number;
  playerIds: number[];
};

export type NhlShiftStint = {
  gameId: number;
  seasonId: number | null;
  gameDate: string | null;
  period: number;
  startSecond: number;
  endSecond: number;
  durationSeconds: number;
  teams: NhlShiftStintTeam[];
  onIcePlayerIds: number[];
};

function normalizeInteger(value: number | null | undefined): number | null {
  if (value == null) return null;
  return Number.isFinite(value) ? Math.trunc(value) : null;
}

function compareNumberArrays(left: number[], right: number[]): boolean {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

function compareStintTeams(left: NhlShiftStintTeam[], right: NhlShiftStintTeam[]): boolean {
  if (left.length !== right.length) return false;

  for (let index = 0; index < left.length; index += 1) {
    if (left[index].teamId !== right[index].teamId) return false;
    if (!compareNumberArrays(left[index].playerIds, right[index].playerIds)) {
      return false;
    }
  }

  return true;
}

export function normalizeShiftInterval(row: ShiftRow): NhlShiftInterval | null {
  const period = normalizeInteger(row.period);
  const startSecond = normalizeInteger(row.start_seconds);
  const endSecond = normalizeInteger(row.end_seconds);
  const durationSeconds = normalizeInteger(row.duration_seconds);

  if (
    period == null ||
    startSecond == null ||
    row.game_id == null ||
    row.shift_id == null ||
    row.team_id == null ||
    row.player_id == null
  ) {
    return null;
  }

  let normalizedEnd = endSecond;
  if (
    normalizedEnd == null ||
    normalizedEnd <= startSecond
  ) {
    if (durationSeconds == null || durationSeconds <= 0) {
      return null;
    }
    normalizedEnd = startSecond + durationSeconds;
  }

  const normalizedDuration = normalizedEnd - startSecond;
  if (normalizedDuration <= 0) return null;

  return {
    gameId: row.game_id,
    shiftId: row.shift_id,
    seasonId: row.season_id,
    gameDate: row.game_date,
    teamId: row.team_id,
    playerId: row.player_id,
    period,
    startSecond,
    endSecond: normalizedEnd,
    durationSeconds: normalizedDuration,
    shiftNumber: row.shift_number,
  };
}

export function normalizeShiftIntervals(rows: ShiftRow[]): NhlShiftInterval[] {
  return rows
    .map(normalizeShiftInterval)
    .filter((row): row is NhlShiftInterval => row !== null)
    .sort((left, right) => {
      if (left.period !== right.period) return left.period - right.period;
      if (left.startSecond !== right.startSecond) return left.startSecond - right.startSecond;
      if (left.endSecond !== right.endSecond) return left.endSecond - right.endSecond;
      if (left.teamId !== right.teamId) return left.teamId - right.teamId;
      if (left.playerId !== right.playerId) return left.playerId - right.playerId;
      return left.shiftId - right.shiftId;
    });
}

function buildStintTeams(
  intervals: NhlShiftInterval[],
  startSecond: number,
  endSecond: number
): NhlShiftStintTeam[] {
  const activeByTeam = new Map<number, Set<number>>();

  for (const interval of intervals) {
    if (interval.startSecond >= endSecond || interval.endSecond <= startSecond) {
      continue;
    }

    const existing = activeByTeam.get(interval.teamId);
    if (existing) {
      existing.add(interval.playerId);
      continue;
    }

    activeByTeam.set(interval.teamId, new Set([interval.playerId]));
  }

  return Array.from(activeByTeam.entries())
    .map(([teamId, playerIds]) => ({
      teamId,
      playerIds: Array.from(playerIds).sort((left, right) => left - right),
    }))
    .sort((left, right) => left.teamId - right.teamId);
}

export function buildShiftStints(rows: ShiftRow[]): NhlShiftStint[] {
  const intervals = normalizeShiftIntervals(rows);
  if (intervals.length === 0) return [];

  const grouped = new Map<string, NhlShiftInterval[]>();
  for (const interval of intervals) {
    const key = `${interval.gameId}:${interval.period}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.push(interval);
    } else {
      grouped.set(key, [interval]);
    }
  }

  const stints: NhlShiftStint[] = [];

  for (const periodIntervals of grouped.values()) {
    const boundaries = Array.from(
      new Set(
        periodIntervals.flatMap((interval) => [interval.startSecond, interval.endSecond])
      )
    ).sort((left, right) => left - right);

    for (let index = 0; index < boundaries.length - 1; index += 1) {
      const startSecond = boundaries[index];
      const endSecond = boundaries[index + 1];
      if (endSecond <= startSecond) continue;

      const teams = buildStintTeams(periodIntervals, startSecond, endSecond);
      if (teams.length === 0) continue;

      const onIcePlayerIds = teams
        .flatMap((team) => team.playerIds)
        .sort((left, right) => left - right);

      const previous = stints[stints.length - 1];
      const currentGameId = periodIntervals[0].gameId;
      const currentPeriod = periodIntervals[0].period;
      const seasonId = periodIntervals[0].seasonId;
      const gameDate = periodIntervals[0].gameDate;

      if (
        previous &&
        previous.gameId === currentGameId &&
        previous.period === currentPeriod &&
        previous.endSecond === startSecond &&
        compareStintTeams(previous.teams, teams)
      ) {
        previous.endSecond = endSecond;
        previous.durationSeconds = previous.endSecond - previous.startSecond;
        previous.onIcePlayerIds = onIcePlayerIds;
        continue;
      }

      stints.push({
        gameId: currentGameId,
        seasonId,
        gameDate,
        period: currentPeriod,
        startSecond,
        endSecond,
        durationSeconds: endSecond - startSecond,
        teams,
        onIcePlayerIds,
      });
    }
  }

  return stints.sort((left, right) => {
    if (left.period !== right.period) return left.period - right.period;
    return left.startSecond - right.startSecond;
  });
}

export function findShiftStintAtTime(
  stints: NhlShiftStint[],
  period: number,
  second: number
): NhlShiftStint | null {
  return (
    stints.find(
      (stint) =>
        stint.period === period &&
        stint.startSecond <= second &&
        second < stint.endSecond
    ) ?? null
  );
}

export function getOnIcePlayersForTeam(
  stints: NhlShiftStint[],
  period: number,
  second: number,
  teamId: number
): number[] {
  const stint = findShiftStintAtTime(stints, period, second);
  if (!stint) return [];
  return stint.teams.find((team) => team.teamId === teamId)?.playerIds ?? [];
}
