import type { Rank } from "./contracts";

export type PoolValue = { playerId: string; value: number | null; state: "valid" | "undefined" | "missing"; definitionKey: string };
export type PoolCoverage = { fullEligiblePopulationVerified: boolean; definitionKey: string };
export type RankResult = { rank: Rank | null; reason?: string };

/** Proposed numeric convention; no GP/TOI/position/active-roster qualifier. */
export function rankMetric(playerId: string, rows: readonly PoolValue[], coverage: PoolCoverage): RankResult {
  if (!coverage.fullEligiblePopulationVerified || rows.some(row => row.state === "missing")) return { rank: null, reason: "League rank unavailable: incomplete coverage" };
  if (rows.some(row => row.definitionKey !== coverage.definitionKey) || new Set(rows.map(row => row.playerId)).size !== rows.length) return { rank: null, reason: "Comparison definitions or player identities do not match" };
  if (rows.some(row => row.state === "valid" && (row.value === null || !Number.isFinite(row.value)))) return { rank: null, reason: "Comparison contains an invalid value" };
  const pool = rows.filter((row): row is PoolValue & { value: number } => row.state === "valid" && row.value !== null && Number.isFinite(row.value));
  const selected = pool.find(row => row.playerId === playerId);
  if (!selected) return { rank: null, reason: "Metric value unavailable" };
  const above = pool.filter(row => row.value > selected.value).length;
  const below = pool.filter(row => row.value < selected.value).length;
  const equal = pool.length - above - below;
  return { rank: { ordinal: above + 1, population: pool.length, percentile: 100 * (below + 0.5 * equal) / pool.length, tied: equal > 1 } };
}

