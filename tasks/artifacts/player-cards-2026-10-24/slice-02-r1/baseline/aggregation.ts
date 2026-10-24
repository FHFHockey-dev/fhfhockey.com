import type { MetricDefinition, MetricId, Strength } from "./contracts";
import { METRICS } from "./registry";
import { instant, type WindowSelection } from "./windows";

type IndividualField = "toi" | "shots" | "icf" | "iscfs" | "ixg" | "total_points" | "goals";
type OnIceField = "toi" | "cf" | "scf" | "xgf" | "xga" | "gf" | "sf";
export type Components = {
  toiUnit: "seconds";
  individual: Partial<Record<IndividualField, number | null>>;
  onIce: Partial<Record<OnIceField, number | null>>;
};
export type GameMetricRecord = Components & {
  playerId: number; gameId: number; season: number; date: string; strength: Strength;
  sourceDefinition: string; sourceVersion: string; capturedAt: string;
  state: "ready" | "stale" | "source-error" | "null-overwrite";
};
export type SourceIdentity = { definition: string; version: string; capturedAt: string };
export type PooledValue = { value: number | null; state: "valid" | "undefined" | "missing"; reason?: string; numerator: number | null; denominator: number | null };
export type AggregatedWindow = { values: Record<MetricId, PooledValue>; toiSeconds: number | null; matchedGames: number };

function component(record: Components, path: string): number | null {
  const [table, field] = path.split(".");
  const values = table === "individual" ? record.individual : table === "onIce" ? record.onIce : undefined;
  const value = values?.[field as keyof typeof values];
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}
function sum(records: readonly Components[], expression: string): number | null {
  let total = 0;
  for (const record of records) {
    if (record.toiUnit !== "seconds") return null;
    for (const path of expression.split(" + ")) {
      const value = component(record, path);
      if (value === null) return null;
      total += value;
    }
  }
  return Number.isFinite(total) ? total : null;
}
const missing = (reason: string): PooledValue => ({ value: null, state: "missing", reason, numerator: null, denominator: null });

/** Arithmetic only; this function makes no source, window or league-coverage claim. */
export function pooledMetric(metric: MetricDefinition, records: readonly Components[], gp: number): PooledValue {
  if (!Number.isSafeInteger(gp) || gp < 0 || records.length !== gp) return missing("Metric rows do not match actual appearances");
  const numerator = sum(records, metric.numerator);
  const denominator = metric.formula === "atoi" ? gp : sum(records, metric.denominator);
  if (numerator === null || denominator === null) return missing("Required component is missing, invalid or has incompatible TOI units");
  if (denominator === 0) return { value: null, state: "undefined", reason: "Zero denominator: metric undefined", numerator, denominator };
  if (metric.formula === "percentage" && numerator > denominator) return missing("Ratio numerator exceeds its compatible denominator");
  const value = metric.formula === "atoi" ? numerator / denominator / 60 : (metric.formula === "per60" ? 3600 : 100) * numerator / denominator;
  if (!Number.isFinite(value)) return missing("Pooled metric exceeds finite numeric range");
  return { value, state: "valid", numerator, denominator };
}

/** Join to the selected official appearance identities; never select source rows independently. */
export function aggregateWindow(selection: WindowSelection, records: readonly GameMetricRecord[], source: SourceIdentity): AggregatedWindow {
  const allUnavailable = (state: "missing" | "undefined", reason: string): AggregatedWindow => ({ values: Object.fromEntries(METRICS.map(metric => [metric.id, { ...missing(reason), state }])) as Record<MetricId, PooledValue>, toiSeconds: null, matchedGames: 0 });
  if (selection.state !== "ready") return allUnavailable(selection.state, selection.reason || "Appearance window unavailable");
  const snapshotTime = instant(source.capturedAt);
  if (!source.definition.trim() || !source.version.trim() || snapshotTime === null) return allUnavailable("missing", "Source snapshot identity is incomplete");
  const joined: GameMetricRecord[] = [];
  for (const game of selection.games) {
    const rows = records.filter(row => row.playerId === selection.playerId && row.gameId === game.gameId);
    if (rows.length !== 1) return allUnavailable("missing", "Missing or duplicate source row for a selected appearance");
    const row = rows[0];
    const captured = instant(row.capturedAt);
    const completed = game.completion.status === "verified-final" ? instant(game.completion.completedAt) : null;
    if (row.season !== selection.settings.season || row.date !== game.date || row.strength !== selection.settings.strength || row.sourceDefinition !== source.definition || row.sourceVersion !== source.version || row.state !== "ready" || captured === null || captured > snapshotTime || completed === null || captured < completed || row.toiUnit !== "seconds") return allUnavailable("missing", "Source identity, strength, freshness or selected-game alignment is unverified");
    joined.push(row);
  }
  return { values: Object.fromEntries(METRICS.map(metric => [metric.id, pooledMetric(metric, joined, selection.actualGp)])) as Record<MetricId, PooledValue>, toiSeconds: sum(joined, "individual.toi"), matchedGames: joined.length };
}

