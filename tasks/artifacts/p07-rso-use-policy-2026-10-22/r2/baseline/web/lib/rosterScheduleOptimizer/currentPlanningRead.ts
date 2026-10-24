import { decodePlanningDataTransport } from "../rosterScheduleData/planningDataTransport";
import { expandBridgeForecasts, jsonUtf8Bytes, PLANNING_RESPONSE_BYTE_BUDGET } from "../rosterScheduleData/bridgeForecastWire";
import type { GameForecast, PlanningData, PlanningSnapshot, StatLine } from "./planningTypes";
import { cachedYahooPlayer, type YahooEligibilityReceipt } from "./yahooEligibility";

export type CurrentPlanningOptions = { allowRead?: boolean; publicContext?: boolean; refreshKey?: string;
  yahooEligibility?: YahooEligibilityReceipt | null };
type BridgeScope = { rows: ReadonlyMap<StatLine, string>; policyRevision: string; expiresAt: number };
let activeBridgeScope: BridgeScope | null = null;
const fingerprint = (row: GameForecast) => JSON.stringify(row, (key, value) => key === "powerPlayRole" ? undefined
  : value && typeof value === "object" && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b))) : value);

/** A synchronous, realm-local read capability. Neither JSON nor a worker message
 * can mint it. Copies must retain the immutable current stats object and lineage. */
export function currentBridgeIsAuthorized(row: GameForecast, policyRevision: string): boolean {
  return activeBridgeScope !== null && activeBridgeScope.policyRevision === policyRevision
    && Date.now() < activeBridgeScope.expiresAt
    && activeBridgeScope.rows.get(row.stats) === fingerprint(row);
}

function freeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze); Object.freeze(value);
  }
  return value;
}

export function capacityPlanningSnapshot(snapshot: PlanningSnapshot, reason = "Current forecast permissions are unavailable; schedule planning remains available."): PlanningSnapshot {
  const evidence = { ...snapshot.evidence };
  for (const key of ["forecasts", "baselines", "participation"]) evidence[key] = {
    source: "Current forecast read unavailable", asOf: null, seasonId: snapshot.context.seasonId,
    completeness: "unknown", limitations: [reason],
  };
  return { ...snapshot, forecasts: [], baselineSources: [], participationSources: [],
    forecastManifest: undefined, forecastInputExclusions: undefined, evidence };
}

export function forecastInputExpiry(snapshot: Pick<PlanningSnapshot, "forecasts" | "baselineSources" | "participationSources">): number | null {
  const values = [...snapshot.forecasts.map(row => row.expiresAt),
    ...(snapshot.baselineSources ?? []).flatMap(row => [row.expiresAt, row.catalogExpiresAt]),
    ...(snapshot.participationSources ?? []).map(row => row.expiresAt)]
    .map(value => Date.parse(value ?? "")).filter(Number.isFinite);
  return values.length ? Math.min(...values) : null;
}

/** The only authority constructor owns the actual same-origin GET. `run` must be
 * synchronous; authority ends before any result crosses JSON/worker transport. */
export async function withCurrentPlanningRead<T>(snapshot: PlanningSnapshot, options: CurrentPlanningOptions,
  expectedPolicyRevision: string, signal: AbortSignal, run: (input: PlanningSnapshot, data: PlanningData | null, readError: string | null) => T): Promise<T> {
  let data: PlanningData | null = null;
  let readError: string | null = null;
  let input = capacityPlanningSnapshot(snapshot);
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(abort, 20000); // same bounded read budget as loadPlanningData
  try {
    if (signal.aborted || options.allowRead === false) throw new Error("Current read suspended.");
    const { seasonId, startDate, endDate, timeZone } = snapshot.context;
    const days = (Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / 86400000;
    if (!Number.isSafeInteger(seasonId) || !Number.isInteger(days) || days < 0 || days > 366) throw new Error("Invalid planning range.");
    new Intl.DateTimeFormat("en", { timeZone });
    const params = new URLSearchParams({ seasonId: String(seasonId), startDate, endDate, timeZone });
    const startedAt = Date.now();
    const response = await fetch(`/api/v1/roster-schedule-optimizer/data?${params}`, {
      method: "GET", cache: "no-store", credentials: "same-origin", signal: controller.signal,
    });
    const body = await response.json();
    if (controller.signal.aborted || jsonUtf8Bytes(body) > PLANNING_RESPONSE_BYTE_BUDGET) throw new Error("Current read unavailable.");
    if (!response.ok || body.success !== true) throw new Error(typeof body.error === "string" ? body.error
      : typeof body.error?.message === "string" ? body.error.message : "Current read unavailable.");
    const decoded = decodePlanningDataTransport(body.data);
    const manifest = decoded.forecastManifest, policy = manifest?.rsoUsePolicy;
    const receivedAt = Date.now(), observedAt = Date.parse(manifest?.asOf ?? "");
    if (!manifest || manifest.seasonId !== seasonId || !Number.isFinite(observedAt)
      || observedAt < startedAt || observedAt > receivedAt || observedAt < Date.parse(snapshot.context.asOf)
      || policy?.version !== "rso-target-use-v1" || policy.revision !== expectedPolicyRevision
      || decoded.games.some(game => game.date < startDate || game.date > endDate)) throw new Error("Current read does not match this planning generation.");
    data = { ...decoded, forecasts: [...decoded.forecasts, ...expandBridgeForecasts(body.bridgeForecasts, decoded)] };
    // Private/provider identities and schedule are never restamped to match a
    // forecast. Only an explicit current public workspace bootstraps those inputs.
    const publicPlayers = new Map(data.players.map(row => [row.id, row]));
    const players = options.publicContext ? [...new Map([...data.players, ...snapshot.players].map(row => [row.id, row])).values()]
      .map(row => {
        const canonical = publicPlayers.get(row.id);
        const sameTeam = canonical?.nhlId === row.nhlId && canonical?.teamAbbreviation === row.teamAbbreviation;
        const current = { ...row, eligibilityVerified: row.eligibilityVerified ?? canonical?.eligibilityVerified,
          nhlTeamId: canonical ? sameTeam ? canonical.nhlTeamId : undefined : row.nhlTeamId,
          rosterRevision: canonical ? sameTeam ? canonical.rosterRevision : undefined : row.rosterRevision };
        return snapshot.context.provider === "manual"
          ? snapshot.roster.some(entry => entry.playerId === row.id) ? { ...current, availability: "rostered" as const } : current
          : cachedYahooPlayer({ ...current, availability: "unknown", canDrop: null, reserveEligibility: [] },
            options.yahooEligibility ?? null, seasonId);
      }) : snapshot.players;
    input = { ...input, context: { ...snapshot.context, asOf: new Date(receivedAt).toISOString() },
      players, games: options.publicContext ? data.games : snapshot.games,
      forecasts: data.forecasts, baselineSources: data.baselineSources ?? [], participationSources: data.participationSources ?? [],
      forecastManifest: manifest, forecastInputExclusions: undefined,
      evidence: { ...(options.publicContext ? { ...data.evidence, ...snapshot.evidence } : snapshot.evidence),
        forecasts: data.evidence.forecasts ?? input.evidence.forecasts,
        baselines: data.evidence.baselines ?? input.evidence.baselines,
        participation: data.evidence.participation ?? input.evidence.participation } };
    freeze(data);
  } catch (error) {
    readError = error instanceof Error ? error.message : "Current read unavailable.";
    data = null; input = capacityPlanningSnapshot(snapshot, readError);
  } finally {
    clearTimeout(timer); signal.removeEventListener("abort", abort);
  }
  if (signal.aborted) throw new DOMException("Obsolete planning generation", "AbortError");
  const previous = activeBridgeScope;
  const bridgeIds = new Set(data?.forecastManifest?.rsoUsePolicy?.bridgeRevisionIds ?? []);
  activeBridgeScope = data ? { policyRevision: expectedPolicyRevision,
    expiresAt: forecastInputExpiry(input) ?? Date.now(),
    rows: new Map(data.forecasts.filter(row => !row.rsoTargetBindings && bridgeIds.has(row.revisionId))
      .map(row => [row.stats, fingerprint(row)])) } : null;
  try { return run(input, data, readError); }
  finally { activeBridgeScope = previous; }
}
