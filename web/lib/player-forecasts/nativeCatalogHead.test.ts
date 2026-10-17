import { describe, expect, it, vi } from "vitest";
import { NATIVE_CATALOG_PIN_KEYS, prepareNativeCatalogObservation, resolveNativeCatalogEnvironment } from "./nativeCatalogHead";
import { playerForecastSourcePayloadHash as hash, type PlannedSourceObservation } from "./sourceSnapshot";

// Serving-side head resolution only; publication and CAS stay with nativeBaselinePublication.test.ts.
const now = new Date("2026-10-15T12:00:00Z");
const ids = [1, 2, 3, 4].map(n => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`);
const seasonId = 20262027;

function release(id: string, dataset: string, expiresAt: string): PlannedSourceObservation {
  const payload = { manifest: { expiresAt } };
  return { id, provider: "fhfh", dataset_key: dataset, entity_kind: "bundle", entity_key: String(seasonId), source_url: null,
    source_revision_key: null, observed_at: "2026-10-15T10:00:00Z", available_at: "2026-10-15T10:00:00Z",
    payload_hash: hash(payload), payload, metadata: {} };
}

function database(tables: Record<string, Record<string, unknown>[]>) {
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

function selectedCatalog() {
  const baseline = release(ids[2], "contribution-bundle-v1", "2026-10-15T18:00:00.000Z");
  const skaters = release(ids[3], "skater-roster-observation-participation-bundle-v1", "2026-10-15T22:59:59.999Z");
  const observation = prepareNativeCatalogObservation({ plan: { seasonId, rows: [baseline, skaters] }, observationId: ids[1],
    issuedAt: now.toISOString(), pins: { PLAYER_FORECAST_BASELINE_RELEASE_IDS: baseline.id,
      PLAYER_FORECAST_ROSTER_OBSERVATION_SKATER_PARTICIPATION_RELEASES: `${skaters.id}:${skaters.payload_hash}` } });
  const head = { id: ids[0], season_id: seasonId, revision: 1, observation_id: observation.id,
    payload_hash: observation.payload_hash, selected_at: now.toISOString() };
  return { observation, ...database({ native_forecast_catalog_heads: [head],
    player_forecast_source_observations: [observation, baseline, skaters] }) };
}

describe("native catalog head resolution", () => {
  it("admits a selected catalog strictly before its earliest release expiry and fails closed exactly at and after it", async () => {
    const { db, observation } = selectedCatalog();
    const expiresAt = Date.parse((observation.payload as { expiresAt: string }).expiresAt);
    expect(expiresAt).toBe(Date.parse("2026-10-15T18:00:00.000Z"));
    const environment = { PLAYER_FORECAST_NATIVE_CATALOG_HEAD_ID: ids[0], PLAYER_FORECAST_ROSTER_OBSERVATION_GOALIE_START_RELEASES: "stale" };
    const at = (ms: number) => resolveNativeCatalogEnvironment(db, seasonId, new Date(ms), environment);
    const admitted = await at(expiresAt - 1);
    expect(admitted.selection?.revision).toBe(1);
    expect(admitted.environment.PLAYER_FORECAST_BASELINE_RELEASE_IDS).toBe(ids[2]);
    expect(admitted.environment.PLAYER_FORECAST_ROSTER_OBSERVATION_GOALIE_START_RELEASES).toBe("");
    for (const ms of [expiresAt, expiresAt + 1]) {
      const resolved = await at(ms);
      expect(resolved.selection).toBeNull(); expect(resolved.limitation).toBeTruthy();
      for (const key of NATIVE_CATALOG_PIN_KEYS) expect(resolved.environment[key]).toBe("");
    }
    // A clock before issuance never admits a future-issued selection.
    expect((await at(now.getTime() - 1)).selection).toBeNull();
  });

  it("clears every pin for a head from another season instead of keeping stale environment pins", async () => {
    const { db } = selectedCatalog();
    const mismatched = await resolveNativeCatalogEnvironment(db, 20252026, now,
      { PLAYER_FORECAST_NATIVE_CATALOG_HEAD_ID: ids[0], PLAYER_FORECAST_BASELINE_RELEASE_IDS: "stale" });
    expect(mismatched.selection).toBeNull();
    for (const key of NATIVE_CATALOG_PIN_KEYS) expect(mismatched.environment[key]).toBe("");
  });

  it("keeps head selection default-off without a lookup", async () => {
    const { db, from } = selectedCatalog(), environment = { PLAYER_FORECAST_BASELINE_RELEASE_IDS: "unchanged" };
    expect(await resolveNativeCatalogEnvironment(db, seasonId, now, environment)).toMatchObject({ environment, selection: null, limitation: null });
    expect(from).not.toHaveBeenCalled();
  });
});
