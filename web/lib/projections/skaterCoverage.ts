import { availabilityMultiplierForEvent, scratchGameIdOf } from "./stages/preflight-stage";
import type { RosterEventRow } from "./types/run-forge-projections.types";

/**
 * FORGE skater coverage (decision 132, W1 P0 #27). Every eligible skater (a skater on his team's current roster) gets
 * a projection: a lineup row or a reserve "if he plays" row. Availability is a separate state on that row, never folded
 * into the line: a confirmed out is 0.0 expected for that game with the line kept; uncertain availability has no
 * qualified participation probability yet, so it is labelled and left unknown; missing evidence is unknown, never 0.
 * Anyone still without a line is counted as unknown with a reason.
 */
export const SKATER_COVERAGE_VERSION = "forge-skater-coverage-v1";

/** How far back the coverage path looks for a long-absent skater's last active games: a bounded read scope (three
 * seasons), not a model coefficient. Beyond it he is unknown (no_nhl_usage_in_window). */
export const FORGE_LONG_ABSENCE_LOOKBACK_DAYS = 1095;

export type SkaterAvailabilityState = "projected_lineup" | "confirmed_out" | "uncertain" | "unknown";

export type SkaterAvailability = {
  version: typeof SKATER_COVERAGE_VERSION;
  game_id: number;
  state: SkaterAvailabilityState;
  /** The row's line is always his line if he plays; this is what he is expected to produce in this game when that is
   * known apart from the line (0 for a confirmed out). Null means "not separately known". */
  line_conditioning: "if_plays";
  expected_for_game: 0 | null;
  /** No qualified participation model exists yet (decision 132.3): always null, never a legacy multiplier. */
  participation_probability: null;
  participation_qualified: false;
  label: string;
  event_type: string | null;
  event_id: number | null;
};

type AvailabilityEvent = Pick<RosterEventRow, "event_id" | "event_type" | "confidence" | "payload">;

/** Availability of one skater for one game from the run's roster evidence. */
export function skaterAvailabilityForGame(args: { gameId: number; event: AvailabilityEvent | null | undefined; inLineup: boolean }): SkaterAvailability {
  const base = { version: SKATER_COVERAGE_VERSION as typeof SKATER_COVERAGE_VERSION, game_id: args.gameId, line_conditioning: "if_plays" as const,
    participation_probability: null, participation_qualified: false as const };
  // A scratch speaks only for its own game (decision 31).
  const event = args.event && (args.event.event_type !== "SCRATCH" || scratchGameIdOf(args.event) === args.gameId) ? args.event : null;
  const multiplier = event ? availabilityMultiplierForEvent(event.event_type, event.confidence) : null;
  const eventFields = { event_type: event?.event_type ?? null, event_id: event?.event_id ?? null };
  if (event && multiplier === 0) {
    return { ...base, ...eventFields, state: "confirmed_out", expected_for_game: 0,
      label: event.event_type === "SCRATCH" ? "scratched / not expected to dress" : `ruled out (${event.event_type.toLowerCase()})` };
  }
  if (event && multiplier !== null && multiplier < 1) {
    return { ...base, ...eventFields, state: "uncertain", expected_for_game: null,
      label: `${event.event_type === "DTD" ? "day-to-day" : event.event_type.toLowerCase()}: participation probability not qualified` };
  }
  if (args.inLineup) return { ...base, ...eventFields, state: "projected_lineup", expected_for_game: null, label: "in projected lineup" };
  return { ...base, ...eventFields, state: "unknown", expected_for_game: null,
    label: event?.event_type === "RETURN" ? "return reported, not in projected lineup: participation unknown"
      : "not in projected lineup: participation unknown" };
}

export type SkaterCoverageUnknownReason =
  | "reserve_pass_disabled"
  | "no_nhl_usage_in_window"
  | "team_lineup_unavailable"
  | "roster_team_conflict"
  | "missing_player_record";

export type TeamSkaterCoverage = {
  version: typeof SKATER_COVERAGE_VERSION;
  game_id: number;
  team_id: number;
  eligible: number;
  lineup: number;
  reserve: number;
  unknown: number;
  unknown_by_reason: Partial<Record<SkaterCoverageUnknownReason, number[]>>;
  complete: boolean;
};

/** One team's coverage for one game: each eligible skater is in exactly one of lineup, reserve or unknown (by reason). */
export function buildTeamSkaterCoverage(args: { gameId: number; teamId: number; eligibleIds: Iterable<number>;
  lineupIds: Iterable<number>; reserveIds: Iterable<number>; unknownReasonById: ReadonlyMap<number, SkaterCoverageUnknownReason>;
  defaultUnknownReason: SkaterCoverageUnknownReason }): TeamSkaterCoverage {
  const eligible = [...new Set(args.eligibleIds)].sort((a, b) => a - b);
  const lineup = new Set(args.lineupIds), reserve = new Set(args.reserveIds);
  const unknownByReason: Partial<Record<SkaterCoverageUnknownReason, number[]>> = {};
  let lineupCount = 0, reserveCount = 0, unknownCount = 0;
  for (const id of eligible) {
    if (lineup.has(id)) { lineupCount++; continue; }
    if (reserve.has(id)) { reserveCount++; continue; }
    const reason = args.unknownReasonById.get(id) ?? args.defaultUnknownReason;
    (unknownByReason[reason] ??= []).push(id);
    unknownCount++;
  }
  return { version: SKATER_COVERAGE_VERSION, game_id: args.gameId, team_id: args.teamId, eligible: eligible.length,
    lineup: lineupCount, reserve: reserveCount, unknown: unknownCount, unknown_by_reason: unknownByReason, complete: unknownCount === 0 };
}

/** Add one team's coverage to the run metrics (totals in data_quality, per-team detail in skater_coverage). */
export function recordTeamSkaterCoverage(metrics: Record<string, any>, coverage: TeamSkaterCoverage) {
  const dq = metrics.data_quality;
  dq.skater_coverage_eligible = (dq.skater_coverage_eligible ?? 0) + coverage.eligible;
  dq.skater_coverage_lineup = (dq.skater_coverage_lineup ?? 0) + coverage.lineup;
  dq.skater_coverage_reserve = (dq.skater_coverage_reserve ?? 0) + coverage.reserve;
  dq.skater_coverage_unknown = (dq.skater_coverage_unknown ?? 0) + coverage.unknown;
  (metrics.skater_coverage ??= []).push(coverage);
}
