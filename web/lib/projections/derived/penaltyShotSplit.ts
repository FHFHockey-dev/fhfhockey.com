/**
 * Penalty shots: all-situations only (owner decision 149, Astra AF-07).
 *
 * `forge_player_game_strength` / `forge_team_game_strength` rows carry a
 * `penalty_shot_split_version` marker:
 * - null: a legacy row. The old builder counted a penalty shot (situation code
 *   1010 / 0101 outside the shootout) as ES, so ES + PP + PK is already the
 *   all-situation total and `shots_ps` / `goals_ps` are null.
 * - 1: a split row. Penalty shots are only in `shots_ps` / `goals_ps`, never
 *   in ES, PP or PK, so the all-situation total adds them.
 * There is no assists column: the NHL awards no assist on a penalty-shot goal.
 */
export const PENALTY_SHOT_SPLIT_VERSION = 1 as const;

function nonNegative(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : null;
}

/**
 * The all-situation count of one stored row: ES + PP + PK, plus the
 * penalty-shot column on a split row. Null when a needed value is missing or
 * negative, or the marker is unknown, so a reader can fail closed.
 */
export function allSituationCount(counts: {
  es: unknown;
  pp: unknown;
  pk: unknown;
  ps: unknown;
  splitVersion: unknown;
}): number | null {
  const buckets = [counts.es, counts.pp, counts.pk].map(nonNegative);
  if (buckets.some((value) => value == null)) return null;
  const strengthTotal = (buckets as number[]).reduce((sum, v) => sum + v, 0);
  if (counts.splitVersion == null) return strengthTotal;
  if (counts.splitVersion !== PENALTY_SHOT_SPLIT_VERSION) return null;
  const penaltyShots = nonNegative(counts.ps);
  return penaltyShots == null ? null : strengthTotal + penaltyShots;
}

/**
 * What a lenient reader (missing values read as 0) adds to ES + PP + PK for
 * penalty shots: the PS column on a split row, 0 on a legacy row, whose ES
 * already holds them.
 */
export function penaltyShotsBeyondStrength(
  value: unknown,
  splitVersion: unknown,
): number {
  return splitVersion === PENALTY_SHOT_SPLIT_VERSION
    ? (nonNegative(value) ?? 0)
    : 0;
}
