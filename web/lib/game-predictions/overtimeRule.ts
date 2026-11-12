/**
 * The one shared rule that turns regulation outcomes into final (OT/SO
 * included) win probabilities (owner decision 45). Client-safe: no imports.
 *
 * Until a split fitted on historical tied-after-regulation games beats 50/50
 * in time-ordered held-out testing (with season and rule context, sample size
 * and uncertainty), a regulation tie is split evenly with no assumed home
 * edge, and the split is labelled as an approximation wherever it is shown.
 */
export const OVERTIME_RULE = {
  version: "ot_split_50_50_v1",
  homeShareOfTie: 0.5,
  label: "Overtime/shootout split 50/50 (approximation)",
} as const;

/** Grids that capture less than this share of the score mass are rejected. */
const MIN_CAPTURED_MASS = 0.98;

export type FinalWinProbabilities = {
  home: number;
  away: number;
  homeRegulationWin: number;
  awayRegulationWin: number;
  regulationTie: number;
  homeOvertimeWin: number;
  awayOvertimeWin: number;
  /** Total regulation mass supplied (a truncated score grid is below 1). */
  capturedMass: number;
  rule: typeof OVERTIME_RULE;
};

/**
 * Final win probabilities from regulation win/tie probabilities. Inputs are
 * renormalised by their total (a truncated score grid) only when that total
 * is between MIN_CAPTURED_MASS and 1; invalid or incomplete inputs are null.
 */
export function finalWinProbabilitiesFromRegulation(args: {
  homeRegulationWin: number;
  awayRegulationWin: number;
  regulationTie: number;
}): FinalWinProbabilities | null {
  const parts = [args.homeRegulationWin, args.awayRegulationWin, args.regulationTie];
  if (parts.some((value) => !Number.isFinite(value) || value < 0)) return null;
  const capturedMass = parts[0]! + parts[1]! + parts[2]!;
  if (capturedMass < MIN_CAPTURED_MASS || capturedMass > 1 + 1e-9) return null;
  const homeRegulationWin = args.homeRegulationWin / capturedMass;
  const awayRegulationWin = args.awayRegulationWin / capturedMass;
  const regulationTie = args.regulationTie / capturedMass;
  const homeOvertimeWin = regulationTie * OVERTIME_RULE.homeShareOfTie;
  const awayOvertimeWin = regulationTie - homeOvertimeWin;
  return {
    home: homeRegulationWin + homeOvertimeWin,
    away: awayRegulationWin + awayOvertimeWin,
    homeRegulationWin,
    awayRegulationWin,
    regulationTie,
    homeOvertimeWin,
    awayOvertimeWin,
    capturedMass,
    rule: OVERTIME_RULE,
  };
}
