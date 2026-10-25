/**
 * Buy Low/Sell High watchlists and market-reference comparability.
 * Consumes Sko Element interpretation records read-only. Nothing here changes a forecast,
 * gap or sign; a market gap exists only for an explicit, comparable reference.
 */
import type { GapDirection, InterpretationRecord, Measured, SkaterTarget } from "lib/skoElement/contract";
import { weightedPointsGap } from "lib/skoElement/interpret";

export type WatchTarget = SkaterTarget | "LEAGUE_POINTS";

export type WatchRow = {
  playerId: string; name: string; team: string | null; modelClass: InterpretationRecord["identity"]["modelClass"];
  target: WatchTarget; observed: Measured; expected: Measured; gap: Measured; direction: GapDirection;
  opportunityLabel: string; evidenceStatus: InterpretationRecord["freshness"]["evidenceStatus"]; sparse: boolean;
  /** Why the row is unranked, if it is. */
  reason: string | null;
};

export type Watchlists = { rebound: WatchRow[]; cooling: WatchRow[]; level: WatchRow[]; unranked: WatchRow[] };

function rowFor(record: InterpretationRecord, target: WatchTarget, weights: Partial<Record<SkaterTarget, number>>): WatchRow {
  const base = {
    playerId: record.identity.playerId, name: record.identity.name, team: record.identity.team, modelClass: record.identity.modelClass,
    target, evidenceStatus: record.freshness.evidenceStatus,
    opportunityLabel: record.opportunity?.label ?? "Goalie workload context (VuDu pending adapter)",
  };
  if (record.identity.modelClass === "G") {
    const pending = { value: null, reason: "pending_goalie_adapter" };
    return { ...base, observed: pending, expected: pending, gap: pending, direction: "unavailable", sparse: false, reason: "pending_goalie_adapter" };
  }
  if (target === "LEAGUE_POINTS") {
    const view = weightedPointsGap(record, weights);
    return { ...base, observed: view.observed, expected: view.expected, gap: view.gap, direction: view.direction,
      sparse: record.metrics.some(metric => metric.sparse), reason: view.gap.reason };
  }
  const metric = record.metrics.find(item => item.target === target)!;
  return { ...base, observed: metric.observedPerTeamGame, expected: metric.expectedPerTeamGame, gap: metric.gapPerTeamGame,
    direction: metric.direction, sparse: metric.sparse, reason: metric.gapPerTeamGame.reason };
}

const byName = (a: WatchRow, b: WatchRow) => a.name.localeCompare(b.name) || a.playerId.localeCompare(b.playerId);

/**
 * Rebound = positive signed gap (more expected than recently produced), Cooling = negative.
 * Inclusion is by sign only: alert magnitude, duration and hysteresis are undecided.
 * Ties break by name then id; unavailable gaps are listed separately, never ranked as zero.
 */
export function buildWatchlists(records: readonly InterpretationRecord[], target: WatchTarget,
  weights: Partial<Record<SkaterTarget, number>> = {}): Watchlists {
  const rows = records.map(record => rowFor(record, target, weights));
  return {
    rebound: rows.filter(row => row.direction === "rebound").sort((a, b) => b.gap.value! - a.gap.value! || byName(a, b)),
    cooling: rows.filter(row => row.direction === "cooling").sort((a, b) => a.gap.value! - b.gap.value! || byName(a, b)),
    level: rows.filter(row => row.direction === "level").sort(byName),
    unranked: rows.filter(row => row.direction === "unavailable").sort(byName),
  };
}

// ---------------------------------------------------------------------------
// Market reference
// ---------------------------------------------------------------------------

export type MarketUnit = "fantasy_points" | "count";

/** An explicit comparable reference supplied by the manager (or, later, a reviewed source). */
export type MarketReference = {
  source: string;
  kind: "manager_entered" | "external";
  capturedAt: string;
  horizonGames: number;
  /** e.g. "points:fixture-league" or "category:POINTS". */
  scoringBasis: string;
  unit: MarketUnit;
  value: number;
  note?: string;
};

export type MarketExpectation = { value: number | null; unit: MarketUnit; horizonGames: number; scoringBasis: string };

export type MarketComparison =
  | { status: "comparable"; gap: number; expected: number; reference: MarketReference; label: string }
  | { status: "unavailable"; reason: string; label: "Market reference unavailable" };

const UNAVAILABLE = "Market reference unavailable" as const;

/**
 * A market gap is shown only when the reference shares unit, horizon and scoring basis with the
 * expectation and is dated, sourced and fresh. Otherwise: "Market reference unavailable",
 * never an implied undervaluation. Ownership or popularity is not accepted as a reference.
 */
export function compareMarketReference(expected: MarketExpectation, reference: MarketReference | null | undefined,
  options: { asOf: string; maxAgeHours: number }): MarketComparison {
  const unavailable = (reason: string): MarketComparison => ({ status: "unavailable", reason, label: UNAVAILABLE });
  if (!reference) return unavailable("no_reference");
  if (!reference.source?.trim()) return unavailable("missing_source");
  if (typeof reference.value !== "number" || !Number.isFinite(reference.value)) return unavailable("invalid_value");
  const captured = Date.parse(reference.capturedAt), asOf = Date.parse(options.asOf);
  if (!Number.isFinite(captured) || !Number.isFinite(asOf)) return unavailable("invalid_time");
  if (captured > asOf) return unavailable("future_capture");
  if ((asOf - captured) / 3_600_000 > options.maxAgeHours) return unavailable("stale_reference");
  if (reference.unit !== expected.unit) return unavailable("unit_mismatch");
  if (reference.horizonGames !== expected.horizonGames) return unavailable("horizon_mismatch");
  if (reference.scoringBasis !== expected.scoringBasis) return unavailable("scoring_mismatch");
  if (expected.value === null) return unavailable("expected_unavailable");
  const gap = expected.value - reference.value;
  const unit = expected.unit === "fantasy_points" ? "fantasy points" : "count";
  return {
    status: "comparable", gap, expected: expected.value, reference,
    label: `Expected ${expected.value.toFixed(2)} vs reference ${reference.value.toFixed(2)} ${unit} over ${expected.horizonGames} team games `
      + `(${reference.source}, captured ${reference.capturedAt.slice(0, 10)}): expected is ${gap >= 0 ? "above" : "below"} the reference by ${Math.abs(gap).toFixed(2)}.`,
  };
}
