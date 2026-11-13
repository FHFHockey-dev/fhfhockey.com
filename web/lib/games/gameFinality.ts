/**
 * Game finality contract (rule 19): a game is final when its stored NHL game
 * state says so. `public.games.game_state`, `game_schedule_state` and
 * `game_state_observed_at` are written by the schedule ingester
 * (`/api/v1/db/update-games`) from the NHL club schedules.
 *
 * The old date/time rule (start + 8 h) survives only as a labelled fallback,
 * used when the state is unknown: never stored, or a non-final state observed
 * before start + 8 h, which no longer says anything about the game now.
 * Changing this basis is a versioned contract shared by consumers.
 */
export const GAME_FINALITY_CONTRACT_VERSION = "nhl-game-state-v1" as const;

export const NHL_GAME_STATES = [
  "FUT",
  "PRE",
  "LIVE",
  "CRIT",
  "FINAL",
  "OFF",
] as const;
export type NhlGameState = (typeof NHL_GAME_STATES)[number];

export const NHL_GAME_SCHEDULE_STATES = [
  "OK",
  "TBD",
  "PPD",
  "SUSP",
  "CNCL",
] as const;
export type NhlGameScheduleState = (typeof NHL_GAME_SCHEDULE_STATES)[number];

const FINAL_GAME_STATES = new Set<NhlGameState>(["FINAL", "OFF"]);
const UNPLAYED_SCHEDULE_STATES = new Set<NhlGameScheduleState>([
  "PPD",
  "SUSP",
  "CNCL",
]);

/** Fallback only: a game this long past its start is assumed to be over. */
export const SCHEDULE_HEURISTIC_FINAL_AFTER_MS = 8 * 60 * 60 * 1000;

export type GameFinalityBasis = "game_state" | "schedule_heuristic_fallback";
export type GameFinalityReason =
  | "final_state"
  | "not_played_schedule_state"
  | "non_final_state"
  | "state_unknown"
  | "stale_non_final_state";

export type GameFinality = {
  isFinal: boolean;
  basis: GameFinalityBasis;
  reason: GameFinalityReason;
};

export type GameFinalityInput = {
  startTime?: string | null;
  game_state?: string | null;
  game_schedule_state?: string | null;
  game_state_observed_at?: string | null;
};

export function normalizeNhlGameState(value: unknown): NhlGameState | null {
  return typeof value === "string" &&
    (NHL_GAME_STATES as readonly string[]).includes(value)
    ? (value as NhlGameState)
    : null;
}

export function normalizeNhlGameScheduleState(
  value: unknown
): NhlGameScheduleState | null {
  return typeof value === "string" &&
    (NHL_GAME_SCHEDULE_STATES as readonly string[]).includes(value)
    ? (value as NhlGameScheduleState)
    : null;
}

// Direct `pg` reads return timestamptz values as Date objects.
function parseTime(value: unknown): number | null {
  const time =
    value instanceof Date
      ? value.getTime()
      : typeof value === "string"
        ? Date.parse(value)
        : Number.NaN;
  return Number.isFinite(time) ? time : null;
}

export function resolveGameFinality(
  game: GameFinalityInput,
  now: Date
): GameFinality {
  const state = normalizeNhlGameState(game.game_state);
  const scheduleState = normalizeNhlGameScheduleState(game.game_schedule_state);
  const observedAt = parseTime(game.game_state_observed_at);
  const start = parseTime(game.startTime);
  const heuristicFinalAt =
    start == null ? null : start + SCHEDULE_HEURISTIC_FINAL_AFTER_MS;

  if (observedAt != null && scheduleState != null &&
      UNPLAYED_SCHEDULE_STATES.has(scheduleState)) {
    return { isFinal: false, basis: "game_state", reason: "not_played_schedule_state" };
  }

  if (observedAt != null && state != null) {
    if (FINAL_GAME_STATES.has(state)) {
      return { isFinal: true, basis: "game_state", reason: "final_state" };
    }

    // A non-final state is trusted while it can still describe the game: it
    // was observed after start + 8 h, or start + 8 h has not been reached yet.
    if (
      heuristicFinalAt == null ||
      observedAt >= heuristicFinalAt ||
      now.getTime() < heuristicFinalAt
    ) {
      return { isFinal: false, basis: "game_state", reason: "non_final_state" };
    }

    return {
      isFinal: true,
      basis: "schedule_heuristic_fallback",
      reason: "stale_non_final_state",
    };
  }

  return {
    isFinal: heuristicFinalAt != null && heuristicFinalAt <= now.getTime(),
    basis: "schedule_heuristic_fallback",
    reason: "state_unknown",
  };
}
