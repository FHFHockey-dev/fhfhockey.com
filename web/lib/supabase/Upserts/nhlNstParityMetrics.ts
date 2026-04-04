import type { Database } from "../database-generated.types";
import { evaluateNormalizedEventInclusion } from "./nhlEventInclusion";
import type { NhlShotFeatureRow } from "./nhlShotFeatureBuilder";
import {
  isOwnGoalPlayByPlayEvent,
  type ParsedNhlPbpEvent,
} from "./nhlPlayByPlayParser";
import {
  classifyTeamStrengthState,
  formatStrengthExact,
  parseSituationCode,
  type StrengthState,
} from "./nhlStrengthState";
import {
  buildOnIceAttributionForEvent,
  type EventOnIceAttribution,
} from "./nhlOnIceAttribution";
import {
  buildShiftStints,
  normalizeShiftIntervals,
  type NhlShiftInterval,
} from "./nhlShiftStints";

type ShiftRow = Pick<
  Database["public"]["Tables"]["nhl_api_shift_rows"]["Row"],
  | "game_id"
  | "shift_id"
  | "season_id"
  | "game_date"
  | "player_id"
  | "team_id"
  | "period"
  | "shift_number"
  | "start_seconds"
  | "end_seconds"
  | "duration_seconds"
>;

type SkaterSplitKey = "all" | "ev" | "fiveOnFive" | "pp" | "pk";
type GoalieSplitKey = "all" | "ev" | "fiveOnFive" | "pp" | "pk";
type TeamRelativeZoneCode = "O" | "N" | "D";
type DangerBucket = "high" | "medium" | "low";

export type SkaterCountsRow = {
  player_id: number;
  season: number | null;
  date_scraped: string;
  gp: number;
  toi: number;
  goals: number;
  total_assists: number;
  first_assists: number;
  second_assists: number;
  total_points: number;
  shots: number;
  ixg: number | null;
  icf: number;
  iff: number;
  iscfs: number | null;
  hdcf: number | null;
  rush_attempts: number;
  rebounds_created: number;
  pim: number;
  total_penalties: number;
  minor_penalties: number;
  major_penalties: number;
  misconduct_penalties: number;
  penalties_drawn: number;
  giveaways: number;
  takeaways: number;
  hits: number;
  hits_taken: number;
  shots_blocked: number;
  faceoffs_won: number;
  faceoffs_lost: number;
  ipp: number | null;
};

export type SkaterCountsOiRow = {
  player_id: number;
  season: number | null;
  date_scraped: string;
  gp: number;
  toi: number;
  cf: number;
  ca: number;
  cf_pct: number | null;
  ff: number;
  fa: number;
  ff_pct: number | null;
  sf: number;
  sa: number;
  sf_pct: number | null;
  gf: number;
  ga: number;
  gf_pct: number | null;
  xgf: number | null;
  xga: number | null;
  xgf_pct: number | null;
  scf: number | null;
  sca: number | null;
  scf_pct: number | null;
  hdcf: number | null;
  hdca: number | null;
  hdcf_pct: number | null;
  hdgf: number | null;
  hdga: number | null;
  hdgf_pct: number | null;
  mdcf: number | null;
  mdca: number | null;
  mdcf_pct: number | null;
  mdgf: number | null;
  mdga: number | null;
  mdgf_pct: number | null;
  ldcf: number | null;
  ldca: number | null;
  ldcf_pct: number | null;
  ldgf: number | null;
  ldga: number | null;
  ldgf_pct: number | null;
  on_ice_sh_pct: number | null;
  on_ice_sv_pct: number | null;
  off_zone_starts: number;
  neu_zone_starts: number;
  def_zone_starts: number;
  off_zone_start_pct: number | null;
  off_zone_faceoffs: number;
  neu_zone_faceoffs: number;
  def_zone_faceoffs: number;
  off_zone_faceoff_pct: number | null;
  pdo: number | null;
  shots_blocked: number;
};

export type SkaterRatesRow = {
  player_id: number;
  season: number | null;
  date_scraped: string;
  gp: number;
  toi: number;
  toi_per_gp: number;
  goals_per_60: number | null;
  total_assists_per_60: number | null;
  first_assists_per_60: number | null;
  second_assists_per_60: number | null;
  total_points_per_60: number | null;
  shots_per_60: number | null;
  ixg_per_60: number | null;
  icf_per_60: number | null;
  iff_per_60: number | null;
  iscfs_per_60: number | null;
  hdcf_per_60: number | null;
  rush_attempts_per_60: number | null;
  rebounds_created_per_60: number | null;
  pim_per_60: number | null;
  total_penalties_per_60: number | null;
  penalties_drawn_per_60: number | null;
  giveaways_per_60: number | null;
  takeaways_per_60: number | null;
  hits_per_60: number | null;
  hits_taken_per_60: number | null;
  shots_blocked_per_60: number | null;
  faceoffs_won_per_60: number | null;
  faceoffs_lost_per_60: number | null;
};

export type SkaterRatesOiRow = {
  player_id: number;
  season: number | null;
  date_scraped: string;
  gp: number;
  toi: number;
  toi_per_gp: number;
  cf_per_60: number | null;
  ca_per_60: number | null;
  cf_pct: number | null;
  ff_per_60: number | null;
  fa_per_60: number | null;
  ff_pct: number | null;
  sf_per_60: number | null;
  sa_per_60: number | null;
  sf_pct: number | null;
  gf_per_60: number | null;
  ga_per_60: number | null;
  gf_pct: number | null;
  xgf_per_60: number | null;
  xga_per_60: number | null;
  xgf_pct: number | null;
  scf_per_60: number | null;
  sca_per_60: number | null;
  scf_pct: number | null;
  hdcf_per_60: number | null;
  hdca_per_60: number | null;
  hdcf_pct: number | null;
  mdcf_per_60: number | null;
  mdca_per_60: number | null;
  mdcf_pct: number | null;
  ldcf_per_60: number | null;
  ldca_per_60: number | null;
  ldcf_pct: number | null;
  on_ice_sh_pct: number | null;
  on_ice_sv_pct: number | null;
  pdo: number | null;
  off_zone_start_pct: number | null;
  off_zone_faceoff_pct: number | null;
};

export type GoalieCountsRow = {
  player_id: number;
  season: number | null;
  date_scraped: string;
  gp: number;
  toi: number;
  shots_against: number;
  saves: number;
  goals_against: number;
  sv_percentage: number | null;
  gaa: number | null;
  gsaa: number | null;
  xg_against: number | null;
  hd_shots_against: number | null;
  hd_saves: number | null;
  hd_sv_percentage: number | null;
  hd_gaa: number | null;
  hd_gsaa: number | null;
  md_shots_against: number | null;
  md_saves: number | null;
  md_goals_against: number | null;
  md_sv_percentage: number | null;
  md_gaa: number | null;
  md_gsaa: number | null;
  ld_shots_against: number | null;
  ld_saves: number | null;
  ld_goals_against: number | null;
  ld_sv_percentage: number | null;
  ld_gaa: number | null;
  ld_gsaa: number | null;
  rush_attempts_against: number;
  rebound_attempts_against: number;
  avg_shot_distance: number | null;
  avg_goal_distance: number | null;
};

export type GoalieRatesRow = {
  player_id: number;
  season: number | null;
  date_scraped: string;
  gp: number;
  toi: number;
  toi_per_gp: number;
  shots_against_per_60: number | null;
  saves_per_60: number | null;
  sv_percentage: number | null;
  gaa: number | null;
  gsaa_per_60: number | null;
  xg_against_per_60: number | null;
  hd_shots_against_per_60: number | null;
  hd_saves_per_60: number | null;
  hd_sv_percentage: number | null;
  hd_gaa: number | null;
  hd_gsaa_per_60: number | null;
  md_shots_against_per_60: number | null;
  md_saves_per_60: number | null;
  md_sv_percentage: number | null;
  md_gaa: number | null;
  md_gsaa_per_60: number | null;
  ld_shots_against_per_60: number | null;
  ld_saves_per_60: number | null;
  ld_sv_percentage: number | null;
  ld_gaa: number | null;
  ld_gsaa_per_60: number | null;
  rush_attempts_against_per_60: number | null;
  rebound_attempts_against_per_60: number | null;
  avg_shot_distance: number | null;
  avg_goal_distance: number | null;
};

export type SkaterSplitParity = {
  counts: SkaterCountsRow[];
  rates: SkaterRatesRow[];
  countsOi: SkaterCountsOiRow[];
  ratesOi: SkaterRatesOiRow[];
};

export type GoalieSplitParity = {
  counts: GoalieCountsRow[];
  rates: GoalieRatesRow[];
};

export type NhlNstParityMetricsOutput = {
  skaters: Record<SkaterSplitKey, SkaterSplitParity>;
  goalies: Record<GoalieSplitKey, GoalieSplitParity>;
};

type ParityShotFeatureRow = NhlShotFeatureRow & {
  xgValue?: number | null;
  dangerBucket?: DangerBucket | null;
  isScoringChance?: boolean | null;
};

type StrengthSegment = {
  gameId: number;
  periodNumber: number;
  startSecond: number;
  endSecond: number;
  strengthExact: string | null;
  homeState: StrengthState | null;
  awayState: StrengthState | null;
};

type RawSkaterAccumulator = Omit<
  SkaterCountsRow,
  "player_id" | "season" | "date_scraped" | "gp" | "toi"
>;

type RawSkaterOiAccumulator = Omit<
  SkaterCountsOiRow,
  "player_id" | "season" | "date_scraped" | "gp" | "toi"
>;

type RawGoalieAccumulator = Omit<
  GoalieCountsRow,
  "player_id" | "season" | "date_scraped" | "gp" | "toi" | "avg_shot_distance" | "avg_goal_distance"
> & {
  shotDistanceTotal: number;
  shotDistanceCount: number;
  goalDistanceTotal: number;
  goalDistanceCount: number;
};

const SHOT_ATTEMPT_TYPES = new Set([
  "goal",
  "shot-on-goal",
  "missed-shot",
  "blocked-shot",
]);
const UNBLOCKED_ATTEMPT_TYPES = new Set([
  "goal",
  "shot-on-goal",
  "missed-shot",
]);
const SHOT_ON_GOAL_TYPES = new Set(["goal", "shot-on-goal"]);
const ZONE_START_PREVIOUS_TYPES = new Set([
  "stoppage",
  "period-start",
  "goal",
  "penalty",
  "delayed-penalty",
]);

function getEventOrder(event: ParsedNhlPbpEvent): number {
  return event.sort_order ?? event.event_id;
}

function sortEvents(events: ParsedNhlPbpEvent[]): ParsedNhlPbpEvent[] {
  return [...events].sort((left, right) => {
    if (left.game_id !== right.game_id) return left.game_id - right.game_id;
    const leftOrder = getEventOrder(left);
    const rightOrder = getEventOrder(right);
    if (leftOrder !== rightOrder) return leftOrder - rightOrder;
    return left.event_id - right.event_id;
  });
}

function getDangerBucket(shot: ParityShotFeatureRow): DangerBucket | null {
  if (shot.dangerBucket) return shot.dangerBucket;
  if (shot.shotDistanceFeet == null || shot.shotAngleDegrees == null) return null;
  if (shot.shotDistanceFeet <= 20 && shot.shotAngleDegrees <= 35) return "high";
  if (shot.shotDistanceFeet <= 40 && shot.shotAngleDegrees <= 50) return "medium";
  return "low";
}

function getApproximateXgValue(shot: ParityShotFeatureRow): number | null {
  if (shot.xgValue != null) return shot.xgValue;
  const dangerBucket = getDangerBucket(shot);
  if (dangerBucket == null) return null;

  let value =
    dangerBucket === "high" ? 0.18 : dangerBucket === "medium" ? 0.08 : 0.02;
  if (shot.isReboundShot) value += 0.03;
  if (shot.isRushShot) value += 0.02;
  if (shot.crossedRoyalRoad) value += 0.02;
  if (shot.isGoal) value = Math.max(value, 0.25);
  return Math.min(value, 0.95);
}

function isScoringChance(shot: ParityShotFeatureRow): boolean | null {
  if (shot.isScoringChance != null) return shot.isScoringChance;
  const bucket = getDangerBucket(shot);
  return bucket == null ? null : bucket !== "low";
}

function toPct(numerator: number | null, denominator: number | null): number | null {
  if (numerator == null || denominator == null || denominator <= 0) return null;
  return (numerator / denominator) * 100;
}

function toPer60(value: number | null, toiSeconds: number): number | null {
  if (value == null || toiSeconds <= 0) return null;
  return (value * 3600) / toiSeconds;
}

function invertZone(zoneCode: string | null): TeamRelativeZoneCode | null {
  if (zoneCode === "O") return "D";
  if (zoneCode === "D") return "O";
  if (zoneCode === "N") return "N";
  return null;
}

function getTeamRelativeZone(
  eventOwnerTeamId: number | null,
  teamId: number,
  zoneCode: string | null
): TeamRelativeZoneCode | null {
  if (zoneCode == null) return null;
  if (eventOwnerTeamId == null) return null;
  return eventOwnerTeamId === teamId
    ? (zoneCode as TeamRelativeZoneCode)
    : invertZone(zoneCode);
}

function defaultSkaterAccumulator(): RawSkaterAccumulator {
  return {
    goals: 0,
    total_assists: 0,
    first_assists: 0,
    second_assists: 0,
    total_points: 0,
    shots: 0,
    ixg: 0,
    icf: 0,
    iff: 0,
    iscfs: 0,
    hdcf: 0,
    rush_attempts: 0,
    rebounds_created: 0,
    pim: 0,
    total_penalties: 0,
    minor_penalties: 0,
    major_penalties: 0,
    misconduct_penalties: 0,
    penalties_drawn: 0,
    giveaways: 0,
    takeaways: 0,
    hits: 0,
    hits_taken: 0,
    shots_blocked: 0,
    faceoffs_won: 0,
    faceoffs_lost: 0,
    ipp: null,
  };
}

function defaultSkaterOiAccumulator(): RawSkaterOiAccumulator {
  return {
    cf: 0,
    ca: 0,
    cf_pct: null,
    ff: 0,
    fa: 0,
    ff_pct: null,
    sf: 0,
    sa: 0,
    sf_pct: null,
    gf: 0,
    ga: 0,
    gf_pct: null,
    xgf: 0,
    xga: 0,
    xgf_pct: null,
    scf: 0,
    sca: 0,
    scf_pct: null,
    hdcf: 0,
    hdca: 0,
    hdcf_pct: null,
    hdgf: 0,
    hdga: 0,
    hdgf_pct: null,
    mdcf: 0,
    mdca: 0,
    mdcf_pct: null,
    mdgf: 0,
    mdga: 0,
    mdgf_pct: null,
    ldcf: 0,
    ldca: 0,
    ldcf_pct: null,
    ldgf: 0,
    ldga: 0,
    ldgf_pct: null,
    on_ice_sh_pct: null,
    on_ice_sv_pct: null,
    off_zone_starts: 0,
    neu_zone_starts: 0,
    def_zone_starts: 0,
    off_zone_start_pct: null,
    off_zone_faceoffs: 0,
    neu_zone_faceoffs: 0,
    def_zone_faceoffs: 0,
    off_zone_faceoff_pct: null,
    pdo: null,
    shots_blocked: 0,
  };
}

function defaultGoalieAccumulator(): RawGoalieAccumulator {
  return {
    shots_against: 0,
    saves: 0,
    goals_against: 0,
    sv_percentage: null,
    gaa: null,
    gsaa: null,
    xg_against: 0,
    hd_shots_against: 0,
    hd_saves: 0,
    hd_sv_percentage: null,
    hd_gaa: null,
    hd_gsaa: null,
    md_shots_against: 0,
    md_saves: 0,
    md_goals_against: 0,
    md_sv_percentage: null,
    md_gaa: null,
    md_gsaa: null,
    ld_shots_against: 0,
    ld_saves: 0,
    ld_goals_against: 0,
    ld_sv_percentage: null,
    ld_gaa: null,
    ld_gsaa: null,
    rush_attempts_against: 0,
    rebound_attempts_against: 0,
    shotDistanceTotal: 0,
    shotDistanceCount: 0,
    goalDistanceTotal: 0,
    goalDistanceCount: 0,
  };
}

function getOrCreate<T>(
  map: Map<number, T>,
  playerId: number,
  create: () => T
): T {
  const existing = map.get(playerId);
  if (existing) return existing;
  const next = create();
  map.set(playerId, next);
  return next;
}

function buildStrengthSegments(
  events: ParsedNhlPbpEvent[],
  homeTeamId: number,
  awayTeamId: number
): StrengthSegment[] {
  const sorted = sortEvents(events).filter(
    (event) =>
      evaluateNormalizedEventInclusion(event).includeInOnIceParity &&
      event.period_number != null &&
      event.period_seconds_elapsed != null &&
      event.period_duration_seconds != null
  );
  const segments: StrengthSegment[] = [];

  for (let index = 0; index < sorted.length; index += 1) {
    const event = sorted[index];
    const next =
      index < sorted.length - 1 &&
      sorted[index + 1].game_id === event.game_id &&
      sorted[index + 1].period_number === event.period_number
        ? sorted[index + 1]
        : null;
    const parsed = parseSituationCode(event.situation_code);
    const startSecond = event.period_seconds_elapsed ?? null;
    const endSecond =
      next?.period_seconds_elapsed ?? event.period_duration_seconds ?? null;

    if (
      parsed == null ||
      startSecond == null ||
      endSecond == null ||
      endSecond <= startSecond
    ) {
      continue;
    }

    segments.push({
      gameId: event.game_id,
      periodNumber: event.period_number!,
      startSecond,
      endSecond,
      strengthExact: formatStrengthExact(parsed),
      homeState: classifyTeamStrengthState(parsed, homeTeamId, homeTeamId, awayTeamId),
      awayState: classifyTeamStrengthState(parsed, awayTeamId, homeTeamId, awayTeamId),
    });
  }

  return segments;
}

function accumulateToiBySplit(
  intervals: NhlShiftInterval[],
  segments: StrengthSegment[],
  homeTeamId: number,
  awayTeamId: number
): Record<SkaterSplitKey, Map<number, number>> {
  const splitMaps: Record<SkaterSplitKey, Map<number, number>> = {
    all: new Map<number, number>(),
    ev: new Map<number, number>(),
    fiveOnFive: new Map<number, number>(),
    pp: new Map<number, number>(),
    pk: new Map<number, number>(),
  };

  for (const interval of intervals) {
    splitMaps.all.set(
      interval.playerId,
      (splitMaps.all.get(interval.playerId) ?? 0) + interval.durationSeconds
    );

    const relevantSegments = segments.filter(
      (segment) =>
        segment.gameId === interval.gameId &&
        segment.periodNumber === interval.period
    );

    for (const segment of relevantSegments) {
      const overlapStart = Math.max(interval.startSecond, segment.startSecond);
      const overlapEnd = Math.min(interval.endSecond, segment.endSecond);
      if (overlapEnd <= overlapStart) continue;

      const duration = overlapEnd - overlapStart;
      const teamState =
        interval.teamId === homeTeamId ? segment.homeState : segment.awayState;

      if (teamState === "EV") {
        splitMaps.ev.set(
          interval.playerId,
          (splitMaps.ev.get(interval.playerId) ?? 0) + duration
        );
        if (segment.strengthExact === "5v5") {
          splitMaps.fiveOnFive.set(
            interval.playerId,
            (splitMaps.fiveOnFive.get(interval.playerId) ?? 0) + duration
          );
        }
      } else if (teamState === "PP") {
        splitMaps.pp.set(
          interval.playerId,
          (splitMaps.pp.get(interval.playerId) ?? 0) + duration
        );
      } else if (teamState === "SH") {
        splitMaps.pk.set(
          interval.playerId,
          (splitMaps.pk.get(interval.playerId) ?? 0) + duration
        );
      }
    }
  }

  return splitMaps;
}

function accumulateGoalieToiBySplit(
  intervals: NhlShiftInterval[],
  goalieIds: Set<number>,
  segments: StrengthSegment[],
  homeTeamId: number,
  awayTeamId: number
): Record<GoalieSplitKey, Map<number, number>> {
  const splitMaps: Record<GoalieSplitKey, Map<number, number>> = {
    all: new Map<number, number>(),
    ev: new Map<number, number>(),
    fiveOnFive: new Map<number, number>(),
    pp: new Map<number, number>(),
    pk: new Map<number, number>(),
  };

  for (const interval of intervals) {
    if (!goalieIds.has(interval.playerId)) continue;

    splitMaps.all.set(
      interval.playerId,
      (splitMaps.all.get(interval.playerId) ?? 0) + interval.durationSeconds
    );

    const relevantSegments = segments.filter(
      (segment) =>
        segment.gameId === interval.gameId &&
        segment.periodNumber === interval.period
    );

    for (const segment of relevantSegments) {
      const overlapStart = Math.max(interval.startSecond, segment.startSecond);
      const overlapEnd = Math.min(interval.endSecond, segment.endSecond);
      if (overlapEnd <= overlapStart) continue;

      const duration = overlapEnd - overlapStart;
      const teamState =
        interval.teamId === homeTeamId ? segment.homeState : segment.awayState;

      if (teamState === "EV") {
        splitMaps.ev.set(
          interval.playerId,
          (splitMaps.ev.get(interval.playerId) ?? 0) + duration
        );
      }
      if (segment.strengthExact === "5v5") {
        splitMaps.fiveOnFive.set(
          interval.playerId,
          (splitMaps.fiveOnFive.get(interval.playerId) ?? 0) + duration
        );
      }
      if (teamState === "PP") {
        splitMaps.pp.set(
          interval.playerId,
          (splitMaps.pp.get(interval.playerId) ?? 0) + duration
        );
      } else if (teamState === "SH") {
        splitMaps.pk.set(
          interval.playerId,
          (splitMaps.pk.get(interval.playerId) ?? 0) + duration
        );
      }
    }
  }

  return splitMaps;
}

function buildShiftStartPlayersByMoment(
  intervals: NhlShiftInterval[]
): Map<string, number[]> {
  const playersByMoment = new Map<string, Set<number>>();

  for (const interval of intervals) {
    const key = `${interval.period}:${interval.startSecond}`;
    const existing = playersByMoment.get(key);
    if (existing) {
      existing.add(interval.playerId);
      continue;
    }

    playersByMoment.set(key, new Set([interval.playerId]));
  }

  return new Map(
    Array.from(playersByMoment.entries()).map(([key, playerIds]) => [
      key,
      Array.from(playerIds).sort((left, right) => left - right),
    ])
  );
}

function getSkaterSplitKeys(
  teamState: StrengthState | null,
  strengthExact: string | null
): SkaterSplitKey[] {
  const splits: SkaterSplitKey[] = [];

  if (teamState === "EV") {
    splits.push("ev");
    if (strengthExact === "5v5") {
      splits.push("fiveOnFive");
    }
  } else if (teamState === "PP") {
    splits.push("pp");
  } else if (teamState === "SH") {
    splits.push("pk");
  }

  return splits;
}

function getGoalieSplitKeys(
  teamState: StrengthState | null,
  strengthExact: string | null
): GoalieSplitKey[] {
  const splits: GoalieSplitKey[] = ["all"];
  if (teamState === "EV") {
    splits.push("ev");
  }
  if (strengthExact === "5v5") {
    splits.push("fiveOnFive");
  }
  if (teamState === "PP") {
    splits.push("pp");
  } else if (teamState === "SH") {
    splits.push("pk");
  }
  return splits;
}

function addToNullableNumber(value: number | null, delta: number | null): number | null {
  if (delta == null) return value;
  return (value ?? 0) + delta;
}

export function buildNstParityMetrics(
  events: ParsedNhlPbpEvent[],
  shotFeatures: ParityShotFeatureRow[],
  shiftRows: ShiftRow[],
  options: {
    date: string;
    season: number | null;
    homeTeamId: number;
    awayTeamId: number;
  }
): NhlNstParityMetricsOutput {
  const sortedEvents = sortEvents(events);
  const normalizedIntervals = normalizeShiftIntervals(shiftRows);
  const stints = buildShiftStints(shiftRows);
  const playerTeamId = new Map<number, number>();
  for (const interval of normalizedIntervals) {
    playerTeamId.set(interval.playerId, interval.teamId);
  }

  const shotFeatureByEventId = new Map(
    shotFeatures.map((shot) => [shot.eventId, shot])
  );
  const goalieIds = new Set(
    shotFeatures
      .map((shot) => shot.goalieInNetId)
      .filter((goalieId): goalieId is number => goalieId != null)
  );
  const skaterIds = new Set(
    normalizedIntervals
      .map((interval) => interval.playerId)
      .filter((playerId) => !goalieIds.has(playerId))
  );
  const strengthSegments = buildStrengthSegments(
    sortedEvents,
    options.homeTeamId,
    options.awayTeamId
  );
  const shiftStartPlayersByMoment = buildShiftStartPlayersByMoment(
    normalizedIntervals.filter((interval) => skaterIds.has(interval.playerId))
  );
  const skaterToiBySplit = accumulateToiBySplit(
    normalizedIntervals.filter((interval) => skaterIds.has(interval.playerId)),
    strengthSegments,
    options.homeTeamId,
    options.awayTeamId
  );
  const goalieToiBySplit = accumulateGoalieToiBySplit(
    normalizedIntervals,
    goalieIds,
    strengthSegments,
    options.homeTeamId,
    options.awayTeamId
  );

  const skaterCountsAcc: Record<SkaterSplitKey, Map<number, RawSkaterAccumulator>> = {
    all: new Map(),
    ev: new Map(),
    fiveOnFive: new Map(),
    pp: new Map(),
    pk: new Map(),
  };
  const skaterOiAcc: Record<SkaterSplitKey, Map<number, RawSkaterOiAccumulator>> = {
    all: new Map(),
    ev: new Map(),
    fiveOnFive: new Map(),
    pp: new Map(),
    pk: new Map(),
  };
  const goalieAcc: Record<GoalieSplitKey, Map<number, RawGoalieAccumulator>> = {
    all: new Map(),
    ev: new Map(),
    fiveOnFive: new Map(),
    pp: new Map(),
    pk: new Map(),
  };

  for (let index = 0; index < sortedEvents.length; index += 1) {
    const event = sortedEvents[index];
    const inclusion = evaluateNormalizedEventInclusion(event);
    if (!inclusion.includeInParity) {
      continue;
    }

    const previous = index > 0 ? sortedEvents[index - 1] : null;
    const parsedSituation = parseSituationCode(event.situation_code);
    const homeState = classifyTeamStrengthState(
      parsedSituation,
      options.homeTeamId,
      options.homeTeamId,
      options.awayTeamId
    );
    const awayState = classifyTeamStrengthState(
      parsedSituation,
      options.awayTeamId,
      options.homeTeamId,
      options.awayTeamId
    );
    const shot = shotFeatureByEventId.get(event.event_id) ?? null;
    const attribution = buildOnIceAttributionForEvent(
      event,
      stints,
      options.homeTeamId,
      options.awayTeamId
    );

    const addSkaterStat = (
      playerId: number | null | undefined,
      increment: (acc: RawSkaterAccumulator) => void
    ) => {
      if (playerId == null) return;
      const teamId = playerTeamId.get(playerId);
      if (teamId == null) return;
      const teamState =
        teamId === options.homeTeamId ? homeState : awayState;
      const splits = getSkaterSplitKeys(teamState, event.strength_exact ?? null);
      increment(getOrCreate(skaterCountsAcc.all, playerId, defaultSkaterAccumulator));
      for (const split of splits) {
        increment(getOrCreate(skaterCountsAcc[split], playerId, defaultSkaterAccumulator));
      }
    };

    const addOnIceStat = (
      playerIds: number[],
      splits: readonly SkaterSplitKey[],
      increment: (acc: RawSkaterOiAccumulator) => void
    ) => {
      for (const playerId of playerIds) {
        increment(getOrCreate(skaterOiAcc.all, playerId, defaultSkaterOiAccumulator));
        for (const split of splits) {
          increment(getOrCreate(skaterOiAcc[split], playerId, defaultSkaterOiAccumulator));
        }
      }
    };

    if (event.type_desc_key === "goal") {
      addSkaterStat(event.scoring_player_id, (acc) => {
        acc.goals += 1;
        acc.total_points += 1;
      });
      addSkaterStat(event.assist1_player_id, (acc) => {
        acc.total_assists += 1;
        acc.first_assists += 1;
        acc.total_points += 1;
      });
      addSkaterStat(event.assist2_player_id, (acc) => {
        acc.total_assists += 1;
        acc.second_assists += 1;
        acc.total_points += 1;
      });
    }

    const shooterId = shot?.shooterPlayerId ?? event.shooting_player_id ?? event.scoring_player_id;
    const isOwnGoal = isOwnGoalPlayByPlayEvent(event);

    if (!isOwnGoal && SHOT_ON_GOAL_TYPES.has(event.type_desc_key ?? "")) {
      addSkaterStat(shooterId, (acc) => {
        acc.shots += 1;
      });
    }
    if (!isOwnGoal && SHOT_ATTEMPT_TYPES.has(event.type_desc_key ?? "")) {
      addSkaterStat(shooterId, (acc) => {
        acc.icf += 1;
        if (shot) {
          acc.ixg = addToNullableNumber(acc.ixg, getApproximateXgValue(shot));
          if (shot.isRushShot) acc.rush_attempts += 1;
          if (shot.createsRebound) acc.rebounds_created += 1;
          const scoringChance = isScoringChance(shot);
          const dangerBucket = getDangerBucket(shot);
          if (scoringChance) acc.iscfs = (acc.iscfs ?? 0) + 1;
          if (dangerBucket === "high") acc.hdcf = (acc.hdcf ?? 0) + 1;
        }
      });
    }
    if (!isOwnGoal && UNBLOCKED_ATTEMPT_TYPES.has(event.type_desc_key ?? "")) {
      addSkaterStat(shooterId, (acc) => {
        acc.iff += 1;
      });
    }

    if (event.type_desc_key === "penalty") {
      addSkaterStat(event.committed_by_player_id, (acc) => {
        acc.pim += event.penalty_duration_minutes ?? 0;
        acc.total_penalties += 1;
        if ((event.penalty_duration_minutes ?? 0) === 2) acc.minor_penalties += 1;
        else if ((event.penalty_duration_minutes ?? 0) >= 5) acc.major_penalties += 1;
        else acc.misconduct_penalties += 1;
      });
      addSkaterStat(event.drawn_by_player_id, (acc) => {
        acc.penalties_drawn += 1;
      });
    }

    if (event.type_desc_key === "giveaway") {
      addSkaterStat(event.player_id, (acc) => {
        acc.giveaways += 1;
      });
    }

    if (event.type_desc_key === "takeaway") {
      addSkaterStat(event.player_id, (acc) => {
        acc.takeaways += 1;
      });
    }

    if (event.type_desc_key === "hit") {
      addSkaterStat(event.hitting_player_id, (acc) => {
        acc.hits += 1;
      });
      addSkaterStat(event.hittee_player_id, (acc) => {
        acc.hits_taken += 1;
      });
    }

    if (event.type_desc_key === "blocked-shot") {
      addSkaterStat(event.blocking_player_id, (acc) => {
        acc.shots_blocked += 1;
      });
    }

    if (event.type_desc_key === "faceoff") {
      addSkaterStat(event.winning_player_id, (acc) => {
        acc.faceoffs_won += 1;
      });
      addSkaterStat(event.losing_player_id, (acc) => {
        acc.faceoffs_lost += 1;
      });
    }

    if (shot) {
      const ownerSplits = getSkaterSplitKeys(
        event.event_owner_team_id === options.homeTeamId ? homeState : awayState
        ,
        shot.strengthExact
      );
      const opponentSplits = getSkaterSplitKeys(
        event.event_owner_team_id === options.homeTeamId ? awayState : homeState
        ,
        shot.strengthExact
      );
      const xgValue = getApproximateXgValue(shot);
      const dangerBucket = getDangerBucket(shot);
      const scoringChance = isScoringChance(shot);

      addOnIceStat(attribution.ownerPlayerIds, ownerSplits, (acc) => {
        if (!shot.isOwnGoal && SHOT_ATTEMPT_TYPES.has(shot.shotEventType ?? "")) {
          acc.cf += 1;
        }
        if (!shot.isOwnGoal && UNBLOCKED_ATTEMPT_TYPES.has(shot.shotEventType ?? "")) {
          acc.ff += 1;
        }
        if (!shot.isOwnGoal && SHOT_ON_GOAL_TYPES.has(shot.shotEventType ?? "")) {
          acc.sf += 1;
        }
        if (shot.isGoal) acc.gf += 1;
        if (!shot.isOwnGoal && xgValue != null) {
          acc.xgf = addToNullableNumber(acc.xgf, xgValue);
        }
        if (!shot.isOwnGoal && scoringChance) acc.scf = (acc.scf ?? 0) + 1;
        if (!shot.isOwnGoal && dangerBucket === "high") {
          acc.hdcf = (acc.hdcf ?? 0) + 1;
          if (shot.isGoal) acc.hdgf = (acc.hdgf ?? 0) + 1;
        } else if (!shot.isOwnGoal && dangerBucket === "medium") {
          acc.mdcf = (acc.mdcf ?? 0) + 1;
          if (shot.isGoal) acc.mdgf = (acc.mdgf ?? 0) + 1;
        } else if (!shot.isOwnGoal && dangerBucket === "low") {
          acc.ldcf = (acc.ldcf ?? 0) + 1;
          if (shot.isGoal) acc.ldgf = (acc.ldgf ?? 0) + 1;
        }
      });

      addOnIceStat(attribution.opponentPlayerIds, opponentSplits, (acc) => {
        if (!shot.isOwnGoal && SHOT_ATTEMPT_TYPES.has(shot.shotEventType ?? "")) {
          acc.ca += 1;
        }
        if (!shot.isOwnGoal && UNBLOCKED_ATTEMPT_TYPES.has(shot.shotEventType ?? "")) {
          acc.fa += 1;
        }
        if (!shot.isOwnGoal && SHOT_ON_GOAL_TYPES.has(shot.shotEventType ?? "")) {
          acc.sa += 1;
        }
        if (shot.isGoal) acc.ga += 1;
        if (!shot.isOwnGoal && xgValue != null) {
          acc.xga = addToNullableNumber(acc.xga, xgValue);
        }
        if (!shot.isOwnGoal && scoringChance) acc.sca = (acc.sca ?? 0) + 1;
        if (!shot.isOwnGoal && dangerBucket === "high") {
          acc.hdca = (acc.hdca ?? 0) + 1;
          if (shot.isGoal) acc.hdga = (acc.hdga ?? 0) + 1;
        } else if (!shot.isOwnGoal && dangerBucket === "medium") {
          acc.mdca = (acc.mdca ?? 0) + 1;
          if (shot.isGoal) acc.mdga = (acc.mdga ?? 0) + 1;
        } else if (!shot.isOwnGoal && dangerBucket === "low") {
          acc.ldca = (acc.ldca ?? 0) + 1;
          if (shot.isGoal) acc.ldga = (acc.ldga ?? 0) + 1;
        }
      });

      if (shot.goalieInNetId != null) {
        const goalieTeamId =
          event.event_owner_team_id === options.homeTeamId
            ? options.awayTeamId
            : options.homeTeamId;
        const goalieState =
          goalieTeamId === options.homeTeamId ? homeState : awayState;
        const goalieSplits = getGoalieSplitKeys(goalieState, shot.strengthExact);

        for (const split of goalieSplits) {
          const acc = getOrCreate(goalieAcc[split], shot.goalieInNetId, defaultGoalieAccumulator);
          if (!shot.isOwnGoal && SHOT_ON_GOAL_TYPES.has(shot.shotEventType ?? "")) {
            acc.shots_against += 1;
            if (!shot.isGoal) acc.saves += 1;
            if (shot.shotDistanceFeet != null) {
              acc.shotDistanceTotal += shot.shotDistanceFeet;
              acc.shotDistanceCount += 1;
            }
          }
          if (shot.isGoal) {
            acc.goals_against += 1;
            if (!shot.isOwnGoal && shot.shotDistanceFeet != null) {
              acc.goalDistanceTotal += shot.shotDistanceFeet;
              acc.goalDistanceCount += 1;
            }
          }
          if (!shot.isOwnGoal && shot.isRushShot) acc.rush_attempts_against += 1;
          if (!shot.isOwnGoal && shot.isReboundShot) acc.rebound_attempts_against += 1;
          const xgValueForGoalie = getApproximateXgValue(shot);
          if (!shot.isOwnGoal) {
            acc.xg_against = addToNullableNumber(acc.xg_against, xgValueForGoalie);
          }
          const dangerBucket = getDangerBucket(shot);
          if (!shot.isOwnGoal && SHOT_ON_GOAL_TYPES.has(shot.shotEventType ?? "")) {
            if (dangerBucket === "high") {
              acc.hd_shots_against = (acc.hd_shots_against ?? 0) + 1;
              if (!shot.isGoal) acc.hd_saves = (acc.hd_saves ?? 0) + 1;
            } else if (dangerBucket === "medium") {
              acc.md_shots_against = (acc.md_shots_against ?? 0) + 1;
              if (!shot.isGoal) acc.md_saves = (acc.md_saves ?? 0) + 1;
              if (shot.isGoal) acc.md_goals_against = (acc.md_goals_against ?? 0) + 1;
            } else if (dangerBucket === "low") {
              acc.ld_shots_against = (acc.ld_shots_against ?? 0) + 1;
              if (!shot.isGoal) acc.ld_saves = (acc.ld_saves ?? 0) + 1;
              if (shot.isGoal) acc.ld_goals_against = (acc.ld_goals_against ?? 0) + 1;
            }
          }
        }
      }
    }

    if (event.type_desc_key === "faceoff") {
      const isZoneStart =
        previous != null &&
        ZONE_START_PREVIOUS_TYPES.has(previous.type_desc_key ?? "") &&
        event.period_number != null &&
        event.period_seconds_elapsed != null;
      const shiftStartPlayerIds = isZoneStart
        ? shiftStartPlayersByMoment.get(
            `${event.period_number}:${event.period_seconds_elapsed}`
          ) ?? []
        : [];
      for (const teamId of [options.homeTeamId, options.awayTeamId]) {
        const teamState = teamId === options.homeTeamId ? homeState : awayState;
        const splits = getSkaterSplitKeys(teamState, event.strength_exact ?? null);
        const playerIds =
          teamId === options.homeTeamId
            ? attribution.homeTeam.playerIds
            : attribution.awayTeam.playerIds;
        const zoneStartPlayerIds = isZoneStart
          ? playerIds.filter((playerId) => shiftStartPlayerIds.includes(playerId))
          : [];
        const zone = getTeamRelativeZone(
          event.event_owner_team_id ?? null,
          teamId,
          event.zone_code ?? null
        );
        if (zone == null) continue;

        addOnIceStat(playerIds, splits, (acc) => {
          if (zone === "O") acc.off_zone_faceoffs += 1;
          if (zone === "N") acc.neu_zone_faceoffs += 1;
          if (zone === "D") acc.def_zone_faceoffs += 1;
        });
        addOnIceStat(zoneStartPlayerIds, splits, (acc) => {
          if (zone === "O") acc.off_zone_starts += 1;
          if (zone === "N") acc.neu_zone_starts += 1;
          if (zone === "D") acc.def_zone_starts += 1;
        });
      }
    }
  }

  const buildSkaterSplitParity = (split: SkaterSplitKey): SkaterSplitParity => {
    const playerIds = Array.from(
      new Set([
        ...Array.from(skaterToiBySplit[split].keys()),
        ...Array.from(skaterCountsAcc[split].keys()),
        ...Array.from(skaterOiAcc[split].keys()),
      ])
    ).sort((left, right) => left - right);

    const counts = playerIds.map((playerId) => {
      const raw = skaterCountsAcc[split].get(playerId) ?? defaultSkaterAccumulator();
      const toi = skaterToiBySplit[split].get(playerId) ?? 0;
      const oi = skaterOiAcc[split].get(playerId) ?? defaultSkaterOiAccumulator();
      const ipp = oi.gf > 0 ? toPct(raw.goals + raw.total_assists, oi.gf) : null;

      return {
        player_id: playerId,
        season: options.season,
        date_scraped: options.date,
        gp: 1,
        toi,
        ...raw,
        ipp,
      };
    });

    const countsOi = playerIds.map((playerId) => {
      const raw = skaterOiAcc[split].get(playerId) ?? defaultSkaterOiAccumulator();
      const toi = skaterToiBySplit[split].get(playerId) ?? 0;
      const onIceShPct = toPct(raw.gf, raw.sf);
      const onIceSvPct = raw.sa > 0 ? ((raw.sa - raw.ga) / raw.sa) * 100 : null;

      return {
        player_id: playerId,
        season: options.season,
        date_scraped: options.date,
        gp: 1,
        toi,
        ...raw,
        cf_pct: toPct(raw.cf, raw.cf + raw.ca),
        ff_pct: toPct(raw.ff, raw.ff + raw.fa),
        sf_pct: toPct(raw.sf, raw.sf + raw.sa),
        gf_pct: toPct(raw.gf, raw.gf + raw.ga),
        xgf_pct:
          raw.xgf != null && raw.xga != null ? toPct(raw.xgf, raw.xgf + raw.xga) : null,
        scf_pct:
          raw.scf != null && raw.sca != null ? toPct(raw.scf, raw.scf + raw.sca) : null,
        hdcf_pct:
          raw.hdcf != null && raw.hdca != null
            ? toPct(raw.hdcf, raw.hdcf + raw.hdca)
            : null,
        hdgf_pct:
          raw.hdgf != null && raw.hdga != null
            ? toPct(raw.hdgf, raw.hdgf + raw.hdga)
            : null,
        mdcf_pct:
          raw.mdcf != null && raw.mdca != null
            ? toPct(raw.mdcf, raw.mdcf + raw.mdca)
            : null,
        mdgf_pct:
          raw.mdgf != null && raw.mdga != null
            ? toPct(raw.mdgf, raw.mdgf + raw.mdga)
            : null,
        ldcf_pct:
          raw.ldcf != null && raw.ldca != null
            ? toPct(raw.ldcf, raw.ldcf + raw.ldca)
            : null,
        ldgf_pct:
          raw.ldgf != null && raw.ldga != null
            ? toPct(raw.ldgf, raw.ldgf + raw.ldga)
            : null,
        on_ice_sh_pct: onIceShPct,
        on_ice_sv_pct: onIceSvPct,
        off_zone_start_pct: toPct(
          raw.off_zone_starts,
          raw.off_zone_starts + raw.neu_zone_starts + raw.def_zone_starts
        ),
        off_zone_faceoff_pct: toPct(
          raw.off_zone_faceoffs,
          raw.off_zone_faceoffs + raw.neu_zone_faceoffs + raw.def_zone_faceoffs
        ),
        pdo:
          onIceShPct != null && onIceSvPct != null ? onIceShPct + onIceSvPct : null,
      };
    });

    const rates = counts.map((row) => ({
      player_id: row.player_id,
      season: row.season,
      date_scraped: row.date_scraped,
      gp: row.gp,
      toi: row.toi,
      toi_per_gp: row.toi,
      goals_per_60: toPer60(row.goals, row.toi),
      total_assists_per_60: toPer60(row.total_assists, row.toi),
      first_assists_per_60: toPer60(row.first_assists, row.toi),
      second_assists_per_60: toPer60(row.second_assists, row.toi),
      total_points_per_60: toPer60(row.total_points, row.toi),
      shots_per_60: toPer60(row.shots, row.toi),
      ixg_per_60: toPer60(row.ixg, row.toi),
      icf_per_60: toPer60(row.icf, row.toi),
      iff_per_60: toPer60(row.iff, row.toi),
      iscfs_per_60: toPer60(row.iscfs, row.toi),
      hdcf_per_60: toPer60(row.hdcf, row.toi),
      rush_attempts_per_60: toPer60(row.rush_attempts, row.toi),
      rebounds_created_per_60: toPer60(row.rebounds_created, row.toi),
      pim_per_60: toPer60(row.pim, row.toi),
      total_penalties_per_60: toPer60(row.total_penalties, row.toi),
      penalties_drawn_per_60: toPer60(row.penalties_drawn, row.toi),
      giveaways_per_60: toPer60(row.giveaways, row.toi),
      takeaways_per_60: toPer60(row.takeaways, row.toi),
      hits_per_60: toPer60(row.hits, row.toi),
      hits_taken_per_60: toPer60(row.hits_taken, row.toi),
      shots_blocked_per_60: toPer60(row.shots_blocked, row.toi),
      faceoffs_won_per_60: toPer60(row.faceoffs_won, row.toi),
      faceoffs_lost_per_60: toPer60(row.faceoffs_lost, row.toi),
    }));

    const ratesOi = countsOi.map((row) => ({
      player_id: row.player_id,
      season: row.season,
      date_scraped: row.date_scraped,
      gp: row.gp,
      toi: row.toi,
      toi_per_gp: row.toi,
      cf_per_60: toPer60(row.cf, row.toi),
      ca_per_60: toPer60(row.ca, row.toi),
      cf_pct: row.cf_pct,
      ff_per_60: toPer60(row.ff, row.toi),
      fa_per_60: toPer60(row.fa, row.toi),
      ff_pct: row.ff_pct,
      sf_per_60: toPer60(row.sf, row.toi),
      sa_per_60: toPer60(row.sa, row.toi),
      sf_pct: row.sf_pct,
      gf_per_60: toPer60(row.gf, row.toi),
      ga_per_60: toPer60(row.ga, row.toi),
      gf_pct: row.gf_pct,
      xgf_per_60: toPer60(row.xgf, row.toi),
      xga_per_60: toPer60(row.xga, row.toi),
      xgf_pct: row.xgf_pct,
      scf_per_60: toPer60(row.scf, row.toi),
      sca_per_60: toPer60(row.sca, row.toi),
      scf_pct: row.scf_pct,
      hdcf_per_60: toPer60(row.hdcf, row.toi),
      hdca_per_60: toPer60(row.hdca, row.toi),
      hdcf_pct: row.hdcf_pct,
      mdcf_per_60: toPer60(row.mdcf, row.toi),
      mdca_per_60: toPer60(row.mdca, row.toi),
      mdcf_pct: row.mdcf_pct,
      ldcf_per_60: toPer60(row.ldcf, row.toi),
      ldca_per_60: toPer60(row.ldca, row.toi),
      ldcf_pct: row.ldcf_pct,
      on_ice_sh_pct: row.on_ice_sh_pct,
      on_ice_sv_pct: row.on_ice_sv_pct,
      pdo: row.pdo,
      off_zone_start_pct: row.off_zone_start_pct,
      off_zone_faceoff_pct: row.off_zone_faceoff_pct,
    }));

    return { counts, rates, countsOi, ratesOi };
  };

  const buildGoalieSplitParity = (split: GoalieSplitKey): GoalieSplitParity => {
    const playerIds = Array.from(
      new Set([
        ...Array.from(goalieToiBySplit[split].keys()),
        ...Array.from(goalieAcc[split].keys()),
      ])
    ).sort((left, right) => left - right);

    const counts = playerIds.map((playerId) => {
      const raw = goalieAcc[split].get(playerId) ?? defaultGoalieAccumulator();
      const toi = goalieToiBySplit[split].get(playerId) ?? 0;
      const svPercentage = raw.shots_against > 0 ? (raw.saves / raw.shots_against) * 100 : null;
      const gaa = toi > 0 ? (raw.goals_against * 3600) / toi : null;
      const xga = raw.xg_against ?? null;

      return {
        player_id: playerId,
        season: options.season,
        date_scraped: options.date,
        gp: 1,
        toi,
        shots_against: raw.shots_against,
        saves: raw.saves,
        goals_against: raw.goals_against,
        sv_percentage: svPercentage,
        gaa,
        gsaa:
          xga != null && svPercentage != null ? xga - raw.goals_against : null,
        xg_against: xga,
        hd_shots_against: raw.hd_shots_against,
        hd_saves: raw.hd_saves,
        hd_sv_percentage:
          raw.hd_shots_against != null && raw.hd_shots_against > 0
            ? ((raw.hd_saves ?? 0) / raw.hd_shots_against) * 100
            : null,
        hd_gaa:
          toi > 0 && raw.hd_shots_against != null
            ? (((raw.hd_shots_against - (raw.hd_saves ?? 0)) * 3600) / toi)
            : null,
        hd_gsaa: null,
        md_shots_against: raw.md_shots_against,
        md_saves: raw.md_saves,
        md_goals_against: raw.md_goals_against,
        md_sv_percentage:
          raw.md_shots_against != null && raw.md_shots_against > 0
            ? ((raw.md_saves ?? 0) / raw.md_shots_against) * 100
            : null,
        md_gaa:
          toi > 0 && raw.md_goals_against != null
            ? ((raw.md_goals_against * 3600) / toi)
            : null,
        md_gsaa: null,
        ld_shots_against: raw.ld_shots_against,
        ld_saves: raw.ld_saves,
        ld_goals_against: raw.ld_goals_against,
        ld_sv_percentage:
          raw.ld_shots_against != null && raw.ld_shots_against > 0
            ? ((raw.ld_saves ?? 0) / raw.ld_shots_against) * 100
            : null,
        ld_gaa:
          toi > 0 && raw.ld_goals_against != null
            ? ((raw.ld_goals_against * 3600) / toi)
            : null,
        ld_gsaa: null,
        rush_attempts_against: raw.rush_attempts_against,
        rebound_attempts_against: raw.rebound_attempts_against,
        avg_shot_distance:
          raw.shotDistanceCount > 0
            ? raw.shotDistanceTotal / raw.shotDistanceCount
            : null,
        avg_goal_distance:
          raw.goalDistanceCount > 0
            ? raw.goalDistanceTotal / raw.goalDistanceCount
            : null,
      };
    });

    const rates = counts.map((row) => ({
      player_id: row.player_id,
      season: row.season,
      date_scraped: row.date_scraped,
      gp: row.gp,
      toi: row.toi,
      toi_per_gp: row.toi,
      shots_against_per_60: toPer60(row.shots_against, row.toi),
      saves_per_60: toPer60(row.saves, row.toi),
      sv_percentage: row.sv_percentage,
      gaa: row.gaa,
      gsaa_per_60: toPer60(row.gsaa, row.toi),
      xg_against_per_60: toPer60(row.xg_against, row.toi),
      hd_shots_against_per_60: toPer60(row.hd_shots_against, row.toi),
      hd_saves_per_60: toPer60(row.hd_saves, row.toi),
      hd_sv_percentage: row.hd_sv_percentage,
      hd_gaa: row.hd_gaa,
      hd_gsaa_per_60: toPer60(row.hd_gsaa, row.toi),
      md_shots_against_per_60: toPer60(row.md_shots_against, row.toi),
      md_saves_per_60: toPer60(row.md_saves, row.toi),
      md_sv_percentage: row.md_sv_percentage,
      md_gaa: row.md_gaa,
      md_gsaa_per_60: toPer60(row.md_gsaa, row.toi),
      ld_shots_against_per_60: toPer60(row.ld_shots_against, row.toi),
      ld_saves_per_60: toPer60(row.ld_saves, row.toi),
      ld_sv_percentage: row.ld_sv_percentage,
      ld_gaa: row.ld_gaa,
      ld_gsaa_per_60: toPer60(row.ld_gsaa, row.toi),
      rush_attempts_against_per_60: toPer60(row.rush_attempts_against, row.toi),
      rebound_attempts_against_per_60: toPer60(row.rebound_attempts_against, row.toi),
      avg_shot_distance: row.avg_shot_distance,
      avg_goal_distance: row.avg_goal_distance,
    }));

    return { counts, rates };
  };

  return {
    skaters: {
      all: buildSkaterSplitParity("all"),
      ev: buildSkaterSplitParity("ev"),
      fiveOnFive: buildSkaterSplitParity("fiveOnFive"),
      pp: buildSkaterSplitParity("pp"),
      pk: buildSkaterSplitParity("pk"),
    },
    goalies: {
      all: buildGoalieSplitParity("all"),
      ev: buildGoalieSplitParity("ev"),
      fiveOnFive: buildGoalieSplitParity("fiveOnFive"),
      pp: buildGoalieSplitParity("pp"),
      pk: buildGoalieSplitParity("pk"),
    },
  };
}
