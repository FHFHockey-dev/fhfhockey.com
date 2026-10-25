// Declared percentage units and exposure-correct share aggregation.
//
// A raw 0.5 is 0.5% in percentage points but 50% as a fraction, so callers
// must say which unit a source field uses; magnitude is never used to guess.

export type PercentUnit = "fraction" | "percentagePoints";

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

/** Converts a declared-unit percentage to a fraction (0-1). Missing stays null. */
export function toFraction(
  value: number | null | undefined,
  unit: PercentUnit
): number | null {
  if (!isFiniteNumber(value)) return null;
  return unit === "percentagePoints" ? value / 100 : value;
}

/** Formats a fraction (0-1) as a percentage; missing values render as an em dash. */
export function formatFractionPercent(
  value: number | null | undefined,
  digits = 1
): string {
  if (!isFiniteNumber(value)) return "—";
  return `${(value * 100).toFixed(digits)}%`;
}

/** numerator / denominator, or null when the denominator has no exposure. */
export function ratio(
  numerator: number | null,
  denominator: number | null
): number | null {
  if (!isFiniteNumber(numerator) || !isFiniteNumber(denominator)) return null;
  if (denominator <= 0) return null;
  return numerator / denominator;
}

/** Full-sample sum: null for an empty sample or any missing/nonfinite value. */
export function sumField<T>(
  rows: readonly T[],
  read: (row: T) => number | null | undefined
): number | null {
  let total: number | null = null;
  for (const row of rows) {
    const value = read(row);
    if (!isFiniteNumber(value)) return null;
    total = (total ?? 0) + value;
  }
  return total;
}

/** for / (for + against) from summed counts. */
export function shareOfSums(
  forTotal: number | null,
  againstTotal: number | null
): number | null {
  if (!isFiniteNumber(forTotal) || !isFiniteNumber(againstTotal)) return null;
  return ratio(forTotal, forTotal + againstTotal);
}

/**
 * Count columns stored per dated row by the NST team writer
 * (`pages/api/Teams/nst-team-stats.ts`, one regular-season date per row,
 * `toi` in seconds).
 */
export interface NstTeamCountRow {
  gp?: number | null;
  toi?: number | null;
  cf?: number | null;
  ca?: number | null;
  xgf?: number | null;
  xga?: number | null;
  hdcf?: number | null;
  hdca?: number | null;
  scf?: number | null;
  sca?: number | null;
  gf?: number | null;
  ga?: number | null;
  sf?: number | null;
  sa?: number | null;
}

export interface NstTeamShareAggregate {
  games: number | null;
  toiSeconds: number | null;
  goalsFor: number | null;
  goalsAgainst: number | null;
  cfPct: number | null;
  xgfPct: number | null;
  hdcfPct: number | null;
  scfPct: number | null;
  shootingPct: number | null;
  savePct: number | null;
  /** On-ice SH% + SV% on the 1.000 index scale. */
  pdo: number | null;
  xgfPerGame: number | null;
  xgaPerGame: number | null;
}

/**
 * Aggregates NST team rows with matching numerators and exposure
 * (ratio of sums), never a mean of per-row percentages. Known zero-game rows
 * are excluded; unknown game exposure invalidates the sample. Each metric
 * requires all of its count fields across that same sample.
 */
export function aggregateNstTeamCounts(
  rows: readonly NstTeamCountRow[]
): NstTeamShareAggregate {
  const played = rows.filter((row) => row.gp !== 0);
  const games = played.length === 0 ? 0 : sumField(played, (row) =>
    isFiniteNumber(row.gp) && row.gp > 0 ? row.gp : null
  );
  const sum = (key: keyof NstTeamCountRow) =>
    games === null ? null : sumField(played, (row) => row[key]);

  const goalsFor = sum("gf");
  const goalsAgainst = sum("ga");
  const shootingPct = ratio(goalsFor, sum("sf"));
  const shotsAgainst = sum("sa");
  const goalsAgainstRate = ratio(goalsAgainst, shotsAgainst);
  const savePct = goalsAgainstRate === null ? null : 1 - goalsAgainstRate;
  const xgf = sum("xgf");
  const xga = sum("xga");

  return {
    games,
    toiSeconds: sum("toi"),
    goalsFor,
    goalsAgainst,
    cfPct: shareOfSums(sum("cf"), sum("ca")),
    xgfPct: shareOfSums(xgf, xga),
    hdcfPct: shareOfSums(sum("hdcf"), sum("hdca")),
    scfPct: shareOfSums(sum("scf"), sum("sca")),
    shootingPct,
    savePct,
    pdo:
      shootingPct === null || savePct === null ? null : shootingPct + savePct,
    xgfPerGame: ratio(xgf, games),
    xgaPerGame: ratio(xga, games)
  };
}

/**
 * Fields stored per dated row by the WGO team writer
 * (`lib/supabase/Upserts/fetchWGOdata.js`, gameDate = row date), so each row
 * is one game and its per-game fields carry that game's count.
 */
export interface WgoTeamGameRow {
  date?: string;
  games_played: number | null;
  shots_for_per_game?: number | null;
  shots_against_per_game?: number | null;
  power_play_goals_for?: number | null;
  pp_opportunities?: number | null;
  pp_goals_against?: number | null;
  times_shorthanded?: number | null;
  sh_goals_for?: number | null;
  sh_goals_against?: number | null;
  faceoffs_won?: number | null;
  faceoffs_lost?: number | null;
}

/** Full-sample totals over WGO game rows; only known zero-game rows are excluded. */
export function aggregateWgoTeamGames(rows: readonly WgoTeamGameRow[]) {
  const played = rows.filter((row) => row.games_played !== 0);
  const games = played.length === 0 ? 0 : sumField(played, (row) =>
    isFiniteNumber(row.games_played) && row.games_played > 0 ? row.games_played : null
  );
  const sum = (read: (row: WgoTeamGameRow) => number | null | undefined) =>
    games === null ? null : sumField(played, read);
  const perGameTotal = (read: (row: WgoTeamGameRow) => number | null | undefined) =>
    sum((row) => {
      const value = read(row);
      return isFiniteNumber(value) ? value * (row.games_played ?? 0) : null;
    });

  const shotsFor = ratio(perGameTotal((row) => row.shots_for_per_game), games);
  const shotsAgainst = ratio(
    perGameTotal((row) => row.shots_against_per_game),
    games
  );
  const ppGoalsFor = sum((row) => row.power_play_goals_for);
  const ppOpportunities = sum((row) => row.pp_opportunities);
  const ppGoalsAgainst = sum((row) => row.pp_goals_against);
  const pkGoalsAgainstRate = ratio(
    ppGoalsAgainst,
    sum((row) => row.times_shorthanded)
  );
  const faceoffsWon = sum((row) => row.faceoffs_won);
  const faceoffsLost = sum((row) => row.faceoffs_lost);

  return {
    games,
    shotsFor,
    shotsAgainst,
    shotDifferential:
      shotsFor === null || shotsAgainst === null ? null : shotsFor - shotsAgainst,
    powerPlayPct: ratio(ppGoalsFor, ppOpportunities),
    penaltyKillPct: pkGoalsAgainstRate === null ? null : 1 - pkGoalsAgainstRate,
    ppOpportunitiesPerGame: ratio(ppOpportunities, games),
    ppGoalsFor,
    ppGoalsAgainst,
    shGoalsFor: sum((row) => row.sh_goals_for),
    shGoalsAgainst: sum((row) => row.sh_goals_against),
    faceoffWinPct:
      faceoffsWon === null || faceoffsLost === null
        ? null
        : ratio(faceoffsWon, faceoffsWon + faceoffsLost)
  };
}
