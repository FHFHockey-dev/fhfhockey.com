import { afterEach, describe, expect, it, vi } from "vitest";
import { forecastSourceSummary, selectForecastServingSource } from "./forecastServingSource";
import { NATIVE_CATALOG_PIN_KEYS, prepareNativeCatalogObservation } from "./nativeCatalogHead";
import { playerForecastSourcePayloadHash as hash, type PlannedSourceObservation } from "./sourceSnapshot";

// Same synthetic catalog shape as nativeCatalogHead.test.ts; selection only, no publication.
const now = new Date("2026-10-15T12:00:00Z");
const ids = [1, 2, 3, 4].map(n => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`);
const seasonId = 20262027;
const expiresAt = "2026-10-15T18:00:00.000Z";

function release(id: string, dataset: string, expiry: string): PlannedSourceObservation {
  const payload = { manifest: { expiresAt: expiry } };
  return { id, provider: "fhfh", dataset_key: dataset, entity_kind: "bundle", entity_key: String(seasonId), source_url: null,
    source_revision_key: null, observed_at: "2026-10-15T10:00:00Z", available_at: "2026-10-15T10:00:00Z",
    payload_hash: hash(payload), payload, metadata: {} };
}

function selectedCatalog() {
  const baseline = release(ids[2], "contribution-bundle-v1", expiresAt);
  const skaters = release(ids[3], "skater-roster-observation-participation-bundle-v1", "2026-10-15T22:59:59.999Z");
  const observation = prepareNativeCatalogObservation({ plan: { seasonId, rows: [baseline, skaters] }, observationId: ids[1],
    issuedAt: now.toISOString(), pins: { PLAYER_FORECAST_BASELINE_RELEASE_IDS: baseline.id,
      PLAYER_FORECAST_ROSTER_OBSERVATION_SKATER_PARTICIPATION_RELEASES: `${skaters.id}:${skaters.payload_hash}` } });
  const head = { id: ids[0], season_id: seasonId, revision: 4, observation_id: observation.id,
    payload_hash: observation.payload_hash, selected_at: now.toISOString() };
  const tables: Record<string, Record<string, unknown>[]> = { native_forecast_catalog_heads: [head],
    player_forecast_source_observations: [observation, baseline, skaters] };
  const from = vi.fn((table: string) => {
    let rows = [...(tables[table] ?? [])];
    const query: any = {
      select: () => query,
      eq: (column: string, value: unknown) => { rows = rows.filter(row => row[column] === value); return query; },
      in: (column: string, values: unknown[]) => { rows = rows.filter(row => values.includes(row[column])); return query; },
      limit: (count: number) => { rows = rows.slice(0, count); return query; },
      abortSignal: () => query,
      then: (resolve: (value: unknown) => unknown, reject?: (error: unknown) => unknown) =>
        Promise.resolve({ data: structuredClone(rows), error: null }).then(resolve, reject),
    };
    return query;
  });
  return { db: { from } as never, from };
}

const stalePins = { PLAYER_FORECAST_BASELINE_RELEASE_IDS: "stale-process-pin", PLAYER_FORECAST_PARTICIPATION_RELEASES: "stale-legacy-pin" };
const fallbacks = [undefined, "empty", "legacy_flagged", "LEGACY_FLAGGED", "legacy"] as const;
const env = (headId: string | undefined, fallback: string | undefined) => ({ ...stalePins,
  ...(headId === undefined ? {} : { PLAYER_FORECAST_NATIVE_CATALOG_HEAD_ID: headId }),
  ...(fallback === undefined ? {} : { FORGE_NATIVE_SERVING_FALLBACK: fallback }) });
const fallbackKind = (fallback: string | undefined) => fallback === "legacy_flagged" ? "legacy_flagged" : "empty";

afterEach(() => vi.useRealTimers());

describe("forecast serving source selection", () => {
  it.each(fallbacks)("selects legacy with the process pins and no lookup while the head env is unset (fallback=%s)", async fallback => {
    const { db, from } = selectedCatalog(), environment = env(undefined, fallback);
    const source = await selectForecastServingSource(db, seasonId, now, environment);
    expect(source).toEqual({ kind: "legacy", reason: "native_not_activated", environment });
    expect(from).not.toHaveBeenCalled();
  });

  it("never resolves a lazy season before activation", async () => {
    const { db } = selectedCatalog(), season = vi.fn(async () => seasonId);
    expect((await selectForecastServingSource(db, season, now, env(undefined, undefined))).kind).toBe("legacy");
    expect(season).not.toHaveBeenCalled();
  });

  it.each(fallbacks)("selects native from the head's pins only, whatever the fallback (fallback=%s)", async fallback => {
    const { db } = selectedCatalog();
    const source = await selectForecastServingSource(db, async () => seasonId, now, env(ids[0], fallback));
    expect(source).toMatchObject({ kind: "native", headId: ids[0], headRevision: 4, issuedAt: now.toISOString(), expiresAt });
    expect(source.environment.PLAYER_FORECAST_BASELINE_RELEASE_IDS).toBe(ids[2]);
    expect(source.environment.PLAYER_FORECAST_PARTICIPATION_RELEASES).toBe("");
    expect(forecastSourceSummary(source)).toEqual({ kind: "native", headRevision: 4, expiresAt, reason: null });
  });

  it.each(fallbacks.flatMap(fallback => [Date.parse(expiresAt), Date.parse(expiresAt) + 1].map(at => [fallback, at] as const)))(
    "falls back with native_catalog_expired at and after expiry (fallback=%s, clock=%s)", async (fallback, at) => {
      const { db } = selectedCatalog();
      const source = await selectForecastServingSource(db, seasonId, new Date(at), env(ids[0], fallback));
      expect(source.kind).toBe(fallbackKind(fallback));
      expect(forecastSourceSummary(source)).toEqual({ kind: fallbackKind(fallback), headRevision: null, expiresAt: null, reason: "native_catalog_expired" });
      for (const key of NATIVE_CATALOG_PIN_KEYS) expect(source.environment[key]).toBe("");
      expect(source.environment.PLAYER_FORECAST_PARTICIPATION_RELEASES).toBe("");
    });

  it.each(fallbacks.flatMap(fallback => [["missing head", ids[3]], ["malformed head ID", "not-a-uuid"], ["other season", ids[0]]]
    .map(([label, headId]) => [fallback, label, headId] as const)))(
    "falls back with head_unavailable_or_invalid, never keeping process pins (fallback=%s, %s)", async (fallback, label, headId) => {
      const { db } = selectedCatalog();
      const source = await selectForecastServingSource(db, label === "other season" ? 20252026 : seasonId, now, env(headId, fallback));
      expect(source).toMatchObject({ kind: fallbackKind(fallback), reason: "native_catalog_head_unavailable_or_invalid" });
      for (const key of NATIVE_CATALOG_PIN_KEYS) expect(source.environment[key]).toBe("");
    });

  it.each([undefined, "legacy_flagged"])("counts an 8 s deadline miss as unavailable (fallback=%s)", async fallback => {
    vi.useFakeTimers();
    const hung = { from: () => { const query: any = { select: () => query, eq: () => query, in: () => query, limit: () => query,
      abortSignal: () => query, then: () => undefined }; return query; } } as never;
    const pending = selectForecastServingSource(hung, seasonId, now, env(ids[0], fallback));
    await vi.advanceTimersByTimeAsync(7999);
    let settled = false; void pending.then(() => { settled = true; });
    await Promise.resolve(); expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await pending).toMatchObject({ kind: fallbackKind(fallback), reason: "native_catalog_head_unavailable_or_invalid" });
  });

  it("falls back when the season itself cannot be resolved", async () => {
    const { db } = selectedCatalog();
    const source = await selectForecastServingSource(db, async () => { throw new Error("no season"); }, now, env(ids[0], undefined));
    expect(source).toMatchObject({ kind: "empty", reason: "native_catalog_head_unavailable_or_invalid" });
  });
});
