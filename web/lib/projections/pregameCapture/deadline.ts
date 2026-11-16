import { MICROS_PER_MINUTE, MICROS_PER_MS, minMicros, parseInstantMicros, type Micros } from "./time";

/** A capture qualifies only when its verified acknowledgement is at or before T−60 minutes. */
export const ACK_LEAD_MINUTES = BigInt(60);

export interface StartClocks {
  /** Official scheduled puck drop pinned with the calendar revision. */
  scheduledStart: string;
  /** Latest scheduled puck drop observed at check time (a reschedule may move it earlier). */
  currentScheduledStart?: string | null;
  /** Actual start once known (game state live/final or a recorded start). */
  actualStart?: string | null;
}

/** Earliest of every start we know about. Earlier puck drops always tighten the window. */
export function effectiveStartMicros(clocks: StartClocks): Micros {
  const values = [parseInstantMicros(clocks.scheduledStart)];
  if (clocks.currentScheduledStart) values.push(parseInstantMicros(clocks.currentScheduledStart));
  if (clocks.actualStart) values.push(parseInstantMicros(clocks.actualStart));
  return minMicros(...values);
}

export function ackDeadlineMicros(clocks: StartClocks): Micros {
  return effectiveStartMicros(clocks) - ACK_LEAD_MINUTES * MICROS_PER_MINUTE;
}

export interface StartBudget {
  /** Conservative upper bound on "now" (local clock plus its error bound). */
  nowUpper: Micros;
  /** Measured or budgeted durations, milliseconds. */
  readMs: number; saveMs: number; verifyMs: number; marginMs: number;
}

export type StartDecision =
  | { ok: true; deadline: Micros; slackMicros: Micros }
  | { ok: false; reason: "late_start" | "insufficient_time"; deadline: Micros; slackMicros: Micros };

/** Refuses a start that cannot finish read + save + verified acknowledgement by T−60. */
export function decideStart(clocks: StartClocks, budget: StartBudget): StartDecision {
  for (const ms of [budget.readMs, budget.saveMs, budget.verifyMs, budget.marginMs]) {
    if (!Number.isFinite(ms) || ms < 0) throw new Error("invalid_budget");
  }
  const deadline = ackDeadlineMicros(clocks);
  const needed = BigInt(Math.ceil(budget.readMs + budget.saveMs + budget.verifyMs + budget.marginMs)) * MICROS_PER_MS;
  const slackMicros = deadline - budget.nowUpper - needed;
  if (budget.nowUpper >= deadline) return { ok: false, reason: "late_start", deadline, slackMicros };
  if (slackMicros < BigInt(0)) return { ok: false, reason: "insufficient_time", deadline, slackMicros };
  return { ok: true, deadline, slackMicros };
}

/**
 * Qualifies an acknowledgement: its conservative upper bound must be at or before
 * T−60 of the earliest known start, and strictly before that start.
 */
export function ackQualifies(ackUpper: Micros, clocks: StartClocks): boolean {
  const start = effectiveStartMicros(clocks);
  return ackUpper <= start - ACK_LEAD_MINUTES * MICROS_PER_MINUTE && ackUpper < start;
}
