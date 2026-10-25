import type { CardSettings, MetricId, MetricReading } from "./contracts";
import { METRICS, REGISTRY_VERSION } from "./registry";
import { rankMetric } from "./ranking";
import { aggregateWindow, type GameMetricRecord } from "./aggregation";
import { instant, selectWindow, settingsError, type AppearanceFrame, type WindowSelection } from "./windows";

export type LocalPlayerInput = { frame: AppearanceFrame; records: readonly GameMetricRecord[] };
export type LocalCardInput = {
  id: string; origin: "synthetic" | "local-observed"; capturedAt: string;
  settings: CardSettings;
  source: { definition: string; version: string; definitionReference: string; verifiedMetrics: readonly MetricId[] };
  population: { scope: "all-nhl" | "synthetic-all-values"; complete: boolean; reference: string; expectedPlayerIds: readonly number[] };
  players: readonly LocalPlayerInput[];
};
export type MetricCoverage = {
  expectedPlayers: number; suppliedPlayers: number; valid: number;
  knownUndefined: number; missingIncomplete: number; knownShort: number;
  fullEligiblePopulationVerified: boolean;
};
export type AdaptedCard = {
  state: "ready" | "partial" | "unavailable";
  snapshotId: string; source: LocalCardInput["source"]; origin: LocalCardInput["origin"];
  capturedAt: string; gameCutoff: string; retrospective: boolean; settings: CardSettings;
  selection: WindowSelection; readings: MetricReading[]; coverage: Record<MetricId, MetricCoverage>;
  liveActivation: false; premiumActivation: false;
};
export type AdapterResult = AdaptedCard | { state: "rejected"; reason: string; liveActivation: false; premiumActivation: false };

/** Complete population proof is an explicit input, never inferred from schema or player count. */
function populationVerified(input: LocalCardInput) {
  const expected = input.population.expectedPlayerIds;
  const supplied = input.players.map(player => player.frame.playerId);
  return input.population.complete && !!input.population.reference.trim()
    && input.population.scope === (input.origin === "synthetic" ? "synthetic-all-values" : "all-nhl")
    && expected.length > 0 && expected.every(id => Number.isSafeInteger(id) && id > 0)
    && new Set(expected).size === expected.length && expected.length === supplied.length
    && new Set(supplied).size === supplied.length && supplied.every(id => expected.includes(id));
}

/** Local supplied-data boundary only: no fetch, environment, ingestion or entitlement access. */
export function adaptLocalSnapshot(input: LocalCardInput, playerId: number): AdapterResult {
  const reject = (reason: string): AdapterResult => ({ state: "rejected", reason, liveActivation: false, premiumActivation: false });
  const error = settingsError(input.settings);
  const captured = instant(input.capturedAt);
  if (error) return reject(error);
  if (!input.id.trim() || captured === null || captured < instant(input.settings.cutoff)!) return reject("Snapshot identity/time does not cover the declared cutoff");
  if (!["synthetic", "local-observed"].includes(input.origin) || !input.source.definition.trim() || !input.source.version.trim()) return reject("Source identity is missing or unsupported");
  const ids = input.players.map(player => player.frame.playerId);
  if (!Number.isSafeInteger(playerId) || playerId <= 0 || new Set(ids).size !== ids.length || !ids.includes(playerId)) return reject("Selected player is missing or player identities conflict");
  const prepared = input.players.map(player => {
    const selection = selectWindow(player.frame, input.settings);
    const aggregated = aggregateWindow(selection, player.records, { definition: input.source.definition, version: input.source.version, capturedAt: input.capturedAt });
    for (const metric of METRICS) {
      if (!input.source.definitionReference.trim() || !input.source.verifiedMetrics.includes(metric.id)) aggregated.values[metric.id] = { value: null, state: "missing", reason: "Metric provider/model definition is unverified", numerator: null, denominator: null };
    }
    return { selection, aggregated };
  });
  const selected = prepared.find(player => player.selection.playerId === playerId)!;
  const fullPopulation = populationVerified(input);
  const coverage = {} as Record<MetricId, MetricCoverage>;
  const readings = METRICS.map(metric => {
    const values = prepared.map(player => ({ playerId: String(player.selection.playerId), ...player.aggregated.values[metric.id] }));
    const missingPlayers = Math.max(0, input.population.expectedPlayerIds.length - input.players.length);
    const missingIncomplete = values.filter(value => value.state === "missing").length + missingPlayers;
    coverage[metric.id] = { expectedPlayers: input.population.expectedPlayerIds.length, suppliedPlayers: input.players.length, valid: values.filter(value => value.state === "valid").length, knownUndefined: values.filter(value => value.state === "undefined").length, missingIncomplete, knownShort: prepared.filter(player => player.selection.knownShort).length, fullEligiblePopulationVerified: fullPopulation && missingIncomplete === 0 };
    const definitionKey = JSON.stringify({ registry: REGISTRY_VERSION, source: input.source.definition, sourceVersion: input.source.version, settings: input.settings, metric: metric.id });
    const ranking = rankMetric(String(playerId), values.map(value => ({ ...value, definitionKey })), { fullEligiblePopulationVerified: fullPopulation, definitionKey });
    const value = selected.aggregated.values[metric.id];
    return { id: metric.id, value: value.value, state: value.state, ...(value.reason ? { reason: value.reason } : {}), rank: ranking.rank, ...(ranking.reason ? { rankReason: ranking.reason } : {}) };
  });
  const valid = readings.filter(reading => reading.state === "valid").length;
  return {
    state: valid === readings.length ? "ready" : valid ? "partial" : "unavailable",
    snapshotId: input.id, origin: input.origin, source: { ...input.source, verifiedMetrics: [...input.source.verifiedMetrics] },
    capturedAt: input.capturedAt, gameCutoff: input.settings.cutoff, retrospective: captured > instant(input.settings.cutoff)!, settings: input.settings,
    selection: selected.selection, readings, coverage, liveActivation: false, premiumActivation: false,
  };
}

