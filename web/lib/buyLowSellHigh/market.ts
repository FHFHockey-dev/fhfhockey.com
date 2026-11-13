/**
 * Buy Low/Sell High signed-gap lists and market-reference comparability.
 * Consumes Sko Element interpretation records read-only. Nothing here changes a forecast,
 * gap or sign; a market gap exists only for an explicit, comparable reference.
 */
import { TARGET_LABELS, type GapSign, type InterpretationRecord, type Measured, type SkaterTarget } from "lib/skoElement/contract";
import { weightedPointsGap } from "lib/skoElement/interpret";

export type WatchTarget = SkaterTarget | "LEAGUE_POINTS";

export type WatchRow = {
  playerId: string; name: string; team: string | null; modelClass: InterpretationRecord["identity"]["modelClass"];
  target: WatchTarget; observed: Measured; expected: Measured; gap: Measured; gapSign: GapSign; gapLabel: string;
  opportunityLabel: string; evidenceStatus: InterpretationRecord["freshness"]["evidenceStatus"]; sparse: boolean;
  /** Why the row is unranked, if it is. */
  reason: string | null;
};

export type Watchlists = { positive: WatchRow[]; negative: WatchRow[]; zero: WatchRow[]; unranked: WatchRow[] };

/** A signed difference in explicit units, without an alert or recommendation label. */
export function formatForecastGap(gap: Measured, unit: string): string {
  const value = gap.value;
  if (value === null) return `Forecast − recent: unavailable (${(gap.reason ?? "unavailable").replace(/_/g, " ")})`;
  return `Forecast − recent: ${value < 0 ? "−" : value > 0 ? "+" : ""}${Math.abs(value).toFixed(2)} ${unit}`;
}

function rowFor(record: InterpretationRecord, target: WatchTarget, weights: Partial<Record<SkaterTarget, number>>): WatchRow {
  const base = {
    playerId: record.identity.playerId, name: record.identity.name, team: record.identity.team, modelClass: record.identity.modelClass,
    target, evidenceStatus: record.freshness.evidenceStatus,
    opportunityLabel: record.opportunity?.label ?? "Goalie workload context (VuDu pending adapter)",
  };
  if (record.identity.modelClass === "G") {
    const pending = { value: null, reason: "pending_goalie_adapter" };
    return { ...base, observed: pending, expected: pending, gap: pending, gapSign: "unavailable", gapLabel: formatForecastGap(pending, "fantasy points per team game"), sparse: false, reason: "pending_goalie_adapter" };
  }
  if (target === "LEAGUE_POINTS") {
    const view = weightedPointsGap(record, weights);
    return { ...base, observed: view.observed, expected: view.expected, gap: view.gap, gapSign: view.gapSign, gapLabel: formatForecastGap(view.gap, "fantasy points per team game"),
      sparse: record.metrics.some(metric => metric.sparse), reason: view.gap.reason };
  }
  const metric = record.metrics.find(item => item.target === target)!;
  return { ...base, observed: metric.observedPerTeamGame, expected: metric.expectedPerTeamGame, gap: metric.gapPerTeamGame,
    gapSign: metric.gapSign, gapLabel: formatForecastGap(metric.gapPerTeamGame, `${TARGET_LABELS[target].toLowerCase()} per team game`), sparse: metric.sparse, reason: metric.gapPerTeamGame.reason };
}

const byName = (a: WatchRow, b: WatchRow) => a.name.localeCompare(b.name) || a.playerId.localeCompare(b.playerId);

/**
 * Positive = more forecast than recently produced; negative = less forecast than recently produced.
 * Inclusion is by sign only: alert magnitude, duration and hysteresis are undecided.
 * Ties break by name then id; unavailable gaps are listed separately, never ranked as zero.
 */
export function buildWatchlists(records: readonly InterpretationRecord[], target: WatchTarget,
  weights: Partial<Record<SkaterTarget, number>> = {}): Watchlists {
  const rows = records.map(record => rowFor(record, target, weights));
  return {
    positive: rows.filter(row => row.gapSign === "positive").sort((a, b) => b.gap.value! - a.gap.value! || byName(a, b)),
    negative: rows.filter(row => row.gapSign === "negative").sort((a, b) => a.gap.value! - b.gap.value! || byName(a, b)),
    zero: rows.filter(row => row.gapSign === "zero").sort(byName),
    unranked: rows.filter(row => row.gapSign === "unavailable").sort(byName),
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
  if (!Number.isFinite(options.maxAgeHours) || options.maxAgeHours < 0) return unavailable("invalid_freshness_limit");
  if (!reference.source?.trim()) return unavailable("missing_source");
  if (typeof reference.value !== "number" || !Number.isFinite(reference.value)) return unavailable("invalid_value");
  const captured = Date.parse(reference.capturedAt), asOf = Date.parse(options.asOf);
  if (!Number.isFinite(captured) || !Number.isFinite(asOf)) return unavailable("invalid_time");
  if (captured > asOf) return unavailable("future_capture");
  if ((asOf - captured) / 3_600_000 > options.maxAgeHours) return unavailable("stale_reference");
  if (reference.unit !== expected.unit) return unavailable("unit_mismatch");
  if (reference.horizonGames !== expected.horizonGames) return unavailable("horizon_mismatch");
  if (reference.scoringBasis !== expected.scoringBasis) return unavailable("scoring_mismatch");
  if (expected.value === null || !Number.isFinite(expected.value)) return unavailable("expected_unavailable");
  if (!Number.isSafeInteger(expected.horizonGames) || expected.horizonGames <= 0) return unavailable("invalid_horizon");
  if (!expected.scoringBasis.trim()) return unavailable("missing_scoring_basis");
  const gap = expected.value - reference.value;
  if (!Number.isFinite(gap)) return unavailable("invalid_gap");
  const unit = expected.unit === "fantasy_points" ? "fantasy points" : "count";
  return {
    status: "comparable", gap, expected: expected.value, reference,
    label: `Expected ${expected.value.toFixed(2)} vs reference ${reference.value.toFixed(2)} ${unit} over ${expected.horizonGames} team games `
      + `(${reference.source}, captured ${reference.capturedAt.slice(0, 10)}): expected is ${gap >= 0 ? "above" : "below"} the reference by ${Math.abs(gap).toFixed(2)}.`,
  };
}
