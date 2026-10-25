/**
 * Observed exact-five power-play units (offline proposal, sprint lane S-17).
 *
 * Pure, side-effect-free derivation of the exact five skaters a team had on
 * the ice during validated 5v4 / 5v3 time. It consumes inputs that have
 * already passed the existing shift/PBP validation in
 * `lib/projections/ingest/shifts.ts` (`buildShiftStrengthUpserts`) and the
 * roster-bound position scope; a game carrying any hold is excluded, never
 * repaired here.
 *
 * Interval semantics:
 * - Every interval is half-open `[startSecond, endSecond)` in whole seconds
 *   elapsed since the start of one period. Intervals never cross a period.
 * - A player's presence is the union of that player's shift intervals, so
 *   duplicate or overlapping shift rows never double count.
 * - Unit time is clock time: the measure of the union of the instants at which
 *   exactly those five skaters were on the ice. It is never a sum of player
 *   seconds (`team_unit_toi` pooled seconds) or of pairwise overlaps
 *   (`time_spent_with`).
 *
 * Manpower semantics (per team, per instant):
 * - The PBP situation code and the shift-derived on-ice counts must agree.
 *   PBP situation codes are sampled at events, so a penalty that expires
 *   between events leaves the code stale; the shift cross-check turns those
 *   seconds into `unknown` instead of misattributing them.
 * - Only `5v4` and `5v3` with both goalies in net qualify. `4v3`, any empty
 *   net, and other advantages are reported separately and never merged.
 */

export const EXACT_FIVE_PP_VERSION = "exact_five_pp_v1" as const;
export const EXACT_FIVE_UNIT_KEY_PREFIX = "x5" as const;

export type ExactFiveManpower = "5v4" | "5v3";

export type TeamSituationClass =
  | ExactFiveManpower
  | "4v3"
  | "own_net_empty"
  | "opponent_net_empty"
  | "other_advantage"
  | "even"
  | "shorthanded";

export type ExcludedAdvantageClass = Exclude<
  TeamSituationClass,
  ExactFiveManpower | "even" | "shorthanded"
>;

export type ExactFiveUnknownReason =
  | "unknown_position"
  | "goalie_presence_conflict"
  | "team_skater_count_mismatch"
  | "opponent_skater_count_mismatch";

export type ExactFiveGameHoldReason =
  | "shift_validation_not_passed"
  | "pbp_not_final"
  | "roster_scope_unbound"
  | "upstream_hold"
  | "invalid_shift_interval"
  | "shift_team_not_in_game"
  | "invalid_situation_timeline";

export type ExactFivePositionCode = "C" | "L" | "R" | "D" | "G";

export type ExactFiveShiftInput = {
  playerId: number;
  teamId: number;
  period: number;
  startSecond: number;
  endSecond: number;
};

export type ExactFiveSituationSegment = {
  startSecond: number;
  endSecond: number;
  /** NHL four-digit code: away goalie, away skaters, home skaters, home goalie. */
  situationCode: string;
};

export type ExactFivePeriodInput = {
  period: number;
  playedEndSecond: number;
  situationSegments: ExactFiveSituationSegment[];
};

export type ExactFiveGameInput = {
  gameId: number;
  seasonId: number;
  gameDate: string;
  homeTeamId: number;
  awayTeamId: number;
  periods: ExactFivePeriodInput[];
  shifts: ExactFiveShiftInput[];
  roster: Array<{
    playerId: number;
    teamId: number;
    positionCode: string | null;
  }>;
  validation: {
    shiftValidationPassed: boolean;
    pbpFinal: boolean;
    rosterScopeBound: boolean;
    upstreamHoldReasons: string[];
  };
};

export type ExactFiveInterval = {
  gameId: number;
  teamId: number;
  period: number;
  startSecond: number;
  endSecond: number;
  unitKey: string;
  playerIds: number[];
  manpower: ExactFiveManpower;
};

export type ManpowerSeconds = Record<ExactFiveManpower, number>;

export type ExactFiveTeamGameCoverage = {
  teamId: number;
  /** Seconds PBP labels this team 5v4/5v3 with both goalies in net. */
  pbpQualifyingSeconds: ManpowerSeconds;
  /** Qualifying seconds attributed to an exact five-skater unit. */
  attributedSeconds: ManpowerSeconds;
  /** Qualifying seconds left unattributed, by reason. */
  unknownSeconds: Record<ExactFiveUnknownReason, number>;
  /** Advantage time that never qualifies, kept apart by class. */
  excludedAdvantageSeconds: Record<ExcludedAdvantageClass, number>;
  /** Shifts show 5 vs 3/4 skaters while PBP says otherwise (diagnostic). */
  shiftOnlyAdvantageSeconds: number;
  /** Seconds where a player's own shift rows overlapped (counted once). */
  duplicateShiftSeconds: number;
};

export type ExactFiveGameResult = {
  version: typeof EXACT_FIVE_PP_VERSION;
  gameId: number;
  seasonId: number;
  gameDate: string;
  status: "included" | "excluded";
  holdReasons: ExactFiveGameHoldReason[];
  upstreamHoldReasons: string[];
  intervals: ExactFiveInterval[];
  teams: ExactFiveTeamGameCoverage[];
};

const UNKNOWN_REASONS: ExactFiveUnknownReason[] = [
  "unknown_position",
  "goalie_presence_conflict",
  "team_skater_count_mismatch",
  "opponent_skater_count_mismatch",
];

const EXCLUDED_ADVANTAGE_CLASSES: ExcludedAdvantageClass[] = [
  "4v3",
  "own_net_empty",
  "opponent_net_empty",
  "other_advantage",
];

const POSITION_CODES = new Set<ExactFivePositionCode>(["C", "L", "R", "D", "G"]);

function isPositiveSafeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) > 0;
}

/**
 * Canonical identity for one five-skater group: `x5:` followed by the five
 * distinct player ids in ascending numeric order. The key carries no team,
 * game or season; those travel beside it as time-valid context.
 */
export function buildExactFiveUnitKey(playerIds: readonly number[]): string {
  if (playerIds.length !== 5 || !playerIds.every(isPositiveSafeInteger)) {
    throw new Error("Exact-five unit requires five positive integer player ids");
  }
  const sorted = [...playerIds].sort((left, right) => left - right);
  if (new Set(sorted).size !== 5) {
    throw new Error("Exact-five unit requires five distinct player ids");
  }
  return `${EXACT_FIVE_UNIT_KEY_PREFIX}:${sorted.join("-")}`;
}

export function parseExactFiveUnitKey(unitKey: string): number[] | null {
  const match = /^x5:(\d+)-(\d+)-(\d+)-(\d+)-(\d+)$/.exec(unitKey);
  if (!match) return null;
  const ids = match.slice(1).map(Number);
  try {
    return buildExactFiveUnitKey(ids) === unitKey ? ids : null;
  } catch {
    return null;
  }
}

type SituationDigits = {
  awayGoalie: number;
  awaySkaters: number;
  homeSkaters: number;
  homeGoalie: number;
};

function parseSituation(code: string): SituationDigits | null {
  if (!/^[01][0-6][0-6][01]$/.test(code)) return null;
  return {
    awayGoalie: Number(code[0]),
    awaySkaters: Number(code[1]),
    homeSkaters: Number(code[2]),
    homeGoalie: Number(code[3]),
  };
}

export function classifyTeamSituation(
  situationCode: string,
  side: "home" | "away",
): TeamSituationClass | null {
  const digits = parseSituation(situationCode);
  if (!digits) return null;
  const ownGoalie = side === "home" ? digits.homeGoalie : digits.awayGoalie;
  const oppGoalie = side === "home" ? digits.awayGoalie : digits.homeGoalie;
  const ownSkaters = side === "home" ? digits.homeSkaters : digits.awaySkaters;
  const oppSkaters = side === "home" ? digits.awaySkaters : digits.homeSkaters;

  if (ownGoalie === 0) return "own_net_empty";
  if (oppGoalie === 0) return "opponent_net_empty";
  if (ownSkaters === oppSkaters) return "even";
  if (ownSkaters < oppSkaters) return "shorthanded";
  if (ownSkaters === 5 && oppSkaters === 4) return "5v4";
  if (ownSkaters === 5 && oppSkaters === 3) return "5v3";
  if (ownSkaters === 4 && oppSkaters === 3) return "4v3";
  return "other_advantage";
}

function zeroManpower(): ManpowerSeconds {
  return { "5v4": 0, "5v3": 0 };
}

function emptyCoverage(teamId: number): ExactFiveTeamGameCoverage {
  return {
    teamId,
    pbpQualifyingSeconds: zeroManpower(),
    attributedSeconds: zeroManpower(),
    unknownSeconds: Object.fromEntries(
      UNKNOWN_REASONS.map((reason) => [reason, 0]),
    ) as Record<ExactFiveUnknownReason, number>,
    excludedAdvantageSeconds: Object.fromEntries(
      EXCLUDED_ADVANTAGE_CLASSES.map((reason) => [reason, 0]),
    ) as Record<ExcludedAdvantageClass, number>,
    shiftOnlyAdvantageSeconds: 0,
    duplicateShiftSeconds: 0,
  };
}

/** Union of half-open integer intervals, sorted and merged. */
function unionIntervals(
  intervals: ReadonlyArray<readonly [number, number]>,
): Array<[number, number]> {
  const sorted = [...intervals].sort(
    (left, right) => left[0] - right[0] || left[1] - right[1],
  );
  const merged: Array<[number, number]> = [];
  for (const [start, end] of sorted) {
    const last = merged.at(-1);
    if (last && start <= last[1]) last[1] = Math.max(last[1], end);
    else merged.push([start, end]);
  }
  return merged;
}

function measure(intervals: ReadonlyArray<readonly [number, number]>): number {
  return intervals.reduce((sum, [start, end]) => sum + end - start, 0);
}

function validateGameHolds(input: ExactFiveGameInput): ExactFiveGameHoldReason[] {
  const holds = new Set<ExactFiveGameHoldReason>();
  if (!input.validation.shiftValidationPassed) holds.add("shift_validation_not_passed");
  if (!input.validation.pbpFinal) holds.add("pbp_not_final");
  if (!input.validation.rosterScopeBound) holds.add("roster_scope_unbound");
  if (input.validation.upstreamHoldReasons.length > 0) holds.add("upstream_hold");

  const periodEnds = new Map<number, number>();
  for (const period of input.periods) {
    const segments = [...period.situationSegments].sort(
      (left, right) => left.startSecond - right.startSecond,
    );
    const contiguous =
      isPositiveSafeInteger(period.period) &&
      isPositiveSafeInteger(period.playedEndSecond) &&
      !periodEnds.has(period.period) &&
      segments.length > 0 &&
      segments[0].startSecond === 0 &&
      segments.at(-1)!.endSecond === period.playedEndSecond &&
      segments.every(
        (segment, index) =>
          Number.isSafeInteger(segment.startSecond) &&
          Number.isSafeInteger(segment.endSecond) &&
          segment.endSecond > segment.startSecond &&
          parseSituation(segment.situationCode) !== null &&
          (index === 0 || segments[index - 1].endSecond === segment.startSecond),
      );
    if (!contiguous) holds.add("invalid_situation_timeline");
    periodEnds.set(period.period, period.playedEndSecond);
  }

  for (const shift of input.shifts) {
    if (shift.teamId !== input.homeTeamId && shift.teamId !== input.awayTeamId) {
      holds.add("shift_team_not_in_game");
    }
    const periodEnd = periodEnds.get(shift.period);
    if (
      !isPositiveSafeInteger(shift.playerId) ||
      !Number.isSafeInteger(shift.startSecond) ||
      !Number.isSafeInteger(shift.endSecond) ||
      periodEnd == null ||
      shift.startSecond < 0 ||
      shift.endSecond <= shift.startSecond ||
      shift.endSecond > periodEnd
    ) {
      holds.add("invalid_shift_interval");
    }
  }
  return Array.from(holds).sort();
}

/**
 * Derive exact-five 5v4/5v3 intervals and per-team coverage for one game.
 * Sweep-line over every shift and situation boundary in each period.
 */
export function buildExactFivePpGame(input: ExactFiveGameInput): ExactFiveGameResult {
  const holdReasons = validateGameHolds(input);
  const teamIds = [input.homeTeamId, input.awayTeamId];
  const base = {
    version: EXACT_FIVE_PP_VERSION,
    gameId: input.gameId,
    seasonId: input.seasonId,
    gameDate: input.gameDate,
    upstreamHoldReasons: [...input.validation.upstreamHoldReasons],
  };
  if (holdReasons.length > 0) {
    return {
      ...base,
      status: "excluded",
      holdReasons,
      intervals: [],
      teams: teamIds.map(emptyCoverage),
    };
  }

  const positionByPlayer = new Map<string, ExactFivePositionCode>();
  for (const spot of input.roster) {
    const code = (spot.positionCode ?? "").toUpperCase() as ExactFivePositionCode;
    if (POSITION_CODES.has(code)) {
      positionByPlayer.set(`${spot.teamId}:${spot.playerId}`, code);
    }
  }

  const coverage = new Map(teamIds.map((teamId) => [teamId, emptyCoverage(teamId)]));
  const intervals: ExactFiveInterval[] = [];

  for (const period of [...input.periods].sort((a, b) => a.period - b.period)) {
    // Presence per (team, player) is the union of that player's intervals.
    const rawByPlayer = new Map<string, Array<[number, number]>>();
    for (const shift of input.shifts) {
      if (shift.period !== period.period) continue;
      const key = `${shift.teamId}:${shift.playerId}`;
      const list = rawByPlayer.get(key) ?? [];
      list.push([shift.startSecond, shift.endSecond]);
      rawByPlayer.set(key, list);
    }
    const presence = new Map<string, Array<[number, number]>>();
    for (const [key, raw] of rawByPlayer) {
      const merged = unionIntervals(raw);
      presence.set(key, merged);
      const teamId = Number(key.split(":")[0]);
      coverage.get(teamId)!.duplicateShiftSeconds += measure(raw) - measure(merged);
    }

    const boundaries = new Set<number>([0, period.playedEndSecond]);
    for (const segment of period.situationSegments) {
      boundaries.add(segment.startSecond);
      boundaries.add(segment.endSecond);
    }
    for (const merged of presence.values()) {
      for (const [start, end] of merged) {
        boundaries.add(start);
        boundaries.add(end);
      }
    }
    const points = Array.from(boundaries).sort((a, b) => a - b);

    for (let index = 0; index < points.length - 1; index += 1) {
      const start = points[index];
      const end = points[index + 1];
      const seconds = end - start;
      const segment = period.situationSegments.find(
        (candidate) => candidate.startSecond <= start && end <= candidate.endSecond,
      )!;

      const onIce = new Map<number, number[]>(teamIds.map((teamId) => [teamId, []]));
      for (const [key, merged] of presence) {
        if (merged.some(([from, to]) => from <= start && end <= to)) {
          const [teamId, playerId] = key.split(":").map(Number);
          onIce.get(teamId)!.push(playerId);
        }
      }

      const counts = new Map<
        number,
        { skaters: number[]; goalies: number; unknownPosition: boolean }
      >();
      for (const teamId of teamIds) {
        const skaters: number[] = [];
        let goalies = 0;
        let unknownPosition = false;
        for (const playerId of onIce.get(teamId)!) {
          const position = positionByPlayer.get(`${teamId}:${playerId}`);
          if (!position) unknownPosition = true;
          else if (position === "G") goalies += 1;
          else skaters.push(playerId);
        }
        counts.set(teamId, { skaters, goalies, unknownPosition });
      }

      for (const teamId of teamIds) {
        const side = teamId === input.homeTeamId ? "home" : "away";
        const opponentId = side === "home" ? input.awayTeamId : input.homeTeamId;
        const teamCoverage = coverage.get(teamId)!;
        const situation = classifyTeamSituation(segment.situationCode, side)!;
        const own = counts.get(teamId)!;
        const opp = counts.get(opponentId)!;

        if (situation !== "5v4" && situation !== "5v3") {
          if ((EXCLUDED_ADVANTAGE_CLASSES as string[]).includes(situation)) {
            teamCoverage.excludedAdvantageSeconds[
              situation as ExcludedAdvantageClass
            ] += seconds;
          }
          if (
            !own.unknownPosition &&
            !opp.unknownPosition &&
            own.goalies === 1 &&
            opp.goalies === 1 &&
            own.skaters.length === 5 &&
            (opp.skaters.length === 4 || opp.skaters.length === 3)
          ) {
            teamCoverage.shiftOnlyAdvantageSeconds += seconds;
          }
          continue;
        }

        teamCoverage.pbpQualifyingSeconds[situation] += seconds;
        const expectedOpponentSkaters = situation === "5v4" ? 4 : 3;
        let reason: ExactFiveUnknownReason | null = null;
        if (own.unknownPosition || opp.unknownPosition) reason = "unknown_position";
        else if (own.goalies !== 1 || opp.goalies !== 1) reason = "goalie_presence_conflict";
        else if (own.skaters.length !== 5) reason = "team_skater_count_mismatch";
        else if (opp.skaters.length !== expectedOpponentSkaters) {
          reason = "opponent_skater_count_mismatch";
        }
        if (reason) {
          teamCoverage.unknownSeconds[reason] += seconds;
          continue;
        }

        teamCoverage.attributedSeconds[situation] += seconds;
        const playerIds = [...own.skaters].sort((left, right) => left - right);
        const unitKey = buildExactFiveUnitKey(playerIds);
        const previous = intervals.at(-1);
        if (
          previous &&
          previous.teamId === teamId &&
          previous.period === period.period &&
          previous.unitKey === unitKey &&
          previous.manpower === situation &&
          previous.endSecond === start
        ) {
          previous.endSecond = end;
          continue;
        }
        intervals.push({
          gameId: input.gameId,
          teamId,
          period: period.period,
          startSecond: start,
          endSecond: end,
          unitKey,
          playerIds,
          manpower: situation,
        });
      }
    }
  }

  return {
    ...base,
    status: "included",
    holdReasons: [],
    intervals: intervals.sort(
      (left, right) =>
        left.teamId - right.teamId ||
        left.period - right.period ||
        left.startSecond - right.startSecond,
    ),
    teams: teamIds.map((teamId) => coverage.get(teamId)!),
  };
}

export type ExactFiveUnitSummary = {
  teamId: number;
  unitKey: string;
  playerIds: number[];
  manpower: ExactFiveManpower;
  sharedClockSeconds: number;
  gameCount: number;
  gameIds: number[];
  firstGameDate: string;
  latestGameDate: string;
  latestGameId: number;
};

export type ExactFiveTeamSummary = {
  teamId: number;
  gamesIncluded: number;
  gamesExcluded: Array<{ gameId: number; holdReasons: ExactFiveGameHoldReason[] }>;
  pbpQualifyingSeconds: ManpowerSeconds;
  attributedSeconds: ManpowerSeconds;
  unknownSeconds: Record<ExactFiveUnknownReason, number>;
  excludedAdvantageSeconds: Record<ExcludedAdvantageClass, number>;
  shiftOnlyAdvantageSeconds: number;
  /** attributed / PBP-qualifying over included games; null when no PP time. */
  attributionCoverage: number | null;
};

/**
 * Roll per-game results into per-team unit summaries. Clock seconds are the
 * sum of per-game union measures, which is exact because a team's intervals
 * within one game are disjoint by construction.
 */
export function summarizeExactFivePp(results: readonly ExactFiveGameResult[]): {
  units: ExactFiveUnitSummary[];
  teams: ExactFiveTeamSummary[];
} {
  const units = new Map<string, ExactFiveUnitSummary>();
  const teams = new Map<number, ExactFiveTeamSummary>();

  const teamSummary = (teamId: number) => {
    let summary = teams.get(teamId);
    if (!summary) {
      const empty = emptyCoverage(teamId);
      summary = {
        teamId,
        gamesIncluded: 0,
        gamesExcluded: [],
        pbpQualifyingSeconds: empty.pbpQualifyingSeconds,
        attributedSeconds: empty.attributedSeconds,
        unknownSeconds: empty.unknownSeconds,
        excludedAdvantageSeconds: empty.excludedAdvantageSeconds,
        shiftOnlyAdvantageSeconds: 0,
        attributionCoverage: null,
      };
      teams.set(teamId, summary);
    }
    return summary;
  };

  const seenGames = new Set<number>();
  for (const result of results) {
    if (seenGames.has(result.gameId)) {
      throw new Error(`Duplicate exact-five game result ${result.gameId}`);
    }
    seenGames.add(result.gameId);

    for (const coverage of result.teams) {
      const summary = teamSummary(coverage.teamId);
      if (result.status === "excluded") {
        summary.gamesExcluded.push({ gameId: result.gameId, holdReasons: result.holdReasons });
        continue;
      }
      summary.gamesIncluded += 1;
      for (const manpower of ["5v4", "5v3"] as const) {
        summary.pbpQualifyingSeconds[manpower] += coverage.pbpQualifyingSeconds[manpower];
        summary.attributedSeconds[manpower] += coverage.attributedSeconds[manpower];
      }
      for (const reason of UNKNOWN_REASONS) {
        summary.unknownSeconds[reason] += coverage.unknownSeconds[reason];
      }
      for (const kind of EXCLUDED_ADVANTAGE_CLASSES) {
        summary.excludedAdvantageSeconds[kind] += coverage.excludedAdvantageSeconds[kind];
      }
      summary.shiftOnlyAdvantageSeconds += coverage.shiftOnlyAdvantageSeconds;
    }

    for (const interval of result.intervals) {
      const key = [interval.teamId, interval.manpower, interval.unitKey].join("|");
      let unit = units.get(key);
      if (!unit) {
        unit = {
          teamId: interval.teamId,
          unitKey: interval.unitKey,
          playerIds: interval.playerIds,
          manpower: interval.manpower,
          sharedClockSeconds: 0,
          gameCount: 0,
          gameIds: [],
          firstGameDate: result.gameDate,
          latestGameDate: result.gameDate,
          latestGameId: result.gameId,
        };
        units.set(key, unit);
      }
      unit.sharedClockSeconds += interval.endSecond - interval.startSecond;
      if (!unit.gameIds.includes(result.gameId)) {
        unit.gameIds.push(result.gameId);
        unit.gameCount += 1;
      }
      if (result.gameDate < unit.firstGameDate) unit.firstGameDate = result.gameDate;
      if (
        result.gameDate > unit.latestGameDate ||
        (result.gameDate === unit.latestGameDate && result.gameId > unit.latestGameId)
      ) {
        unit.latestGameDate = result.gameDate;
        unit.latestGameId = result.gameId;
      }
    }
  }

  for (const summary of teams.values()) {
    const qualifying =
      summary.pbpQualifyingSeconds["5v4"] + summary.pbpQualifyingSeconds["5v3"];
    const attributed = summary.attributedSeconds["5v4"] + summary.attributedSeconds["5v3"];
    summary.attributionCoverage = qualifying > 0 ? attributed / qualifying : null;
  }

  return {
    units: Array.from(units.values()).sort(
      (left, right) =>
        left.teamId - right.teamId ||
        left.manpower.localeCompare(right.manpower) ||
        right.sharedClockSeconds - left.sharedClockSeconds ||
        left.unitKey.localeCompare(right.unitKey),
    ),
    teams: Array.from(teams.values()).sort((left, right) => left.teamId - right.teamId),
  };
}
