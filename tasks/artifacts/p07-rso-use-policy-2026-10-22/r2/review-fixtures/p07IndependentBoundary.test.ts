import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { fixture, respond, now } from "./p07ReviewFixture";
import { executeRosterPlanning } from "./executionAdapter";
import { withCurrentPlanningRead, currentBridgeIsAuthorized } from "./currentPlanningRead";
import { currentRsoUsePolicy, restrictRsoForecast } from "../player-forecasts/rsoUsePolicy";
import * as policyModule from "../player-forecasts/rsoUsePolicy";
import { forecastAllows } from "./planning";
import * as candidates from "./candidatePlanMetrics";

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(now)); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it.each([-5000, 5000])("accepts a real current response when browser clock differs by %sms", async skew => {
  const { snapshot, body, intent } = fixture();
  vi.setSystemTime(new Date(Date.parse(now) + skew));
  snapshot.context.asOf = new Date(Date.parse(now) + skew).toISOString();
  // The server response is generated now on the independent server clock.
  // Only the browser clock changes; no forged or stale server values are used.
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respond(body)));
  const value = await executeRosterPlanning(snapshot, intent);
  expect(value.readError).toBeNull();
  expect(value.result.selected.projectedValue).toBe(7);
});

it("binds authority to actual current immutable rows, not transplanted IDs/means/lineage", async () => {
  const { snapshot, body } = fixture(); const policy = currentRsoUsePolicy();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respond(body)));
  let original: typeof snapshot.forecasts[number] | undefined;
  await withCurrentPlanningRead(snapshot, {}, policy.revision, new AbortController().signal, current => {
    original = current.forecasts[0];
    expect(Object.isFrozen(original)).toBe(true); expect(Object.isFrozen(original.stats)).toBe(true);
    expect(currentBridgeIsAuthorized(original, policy.revision)).toBe(true);
    for (const changed of [JSON.parse(JSON.stringify(original)),
      { ...original, playerId: "8" }, { ...original, gameId: "31" },
      { ...original, stats: { GOALS: 999 } }, { ...original, appearanceProbability: 1 },
      { ...original, issuedContext: { ...original.issuedContext!, rosterRevision: "transplant" } }]) {
      expect(currentBridgeIsAuthorized(changed, policy.revision)).toBe(false);
      expect(restrictRsoForecast(changed, current.forecastManifest, now).allowedUses?.totals).toBe(false);
    }
  });
  expect(currentBridgeIsAuthorized(original!, policy.revision)).toBe(false);
});

it("ends authority before asynchronous continuation even if a callback returns a promise", async () => {
  const { snapshot, body } = fixture(); const policy = currentRsoUsePolicy();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respond(body)));
  const permitted = await withCurrentPlanningRead(snapshot, {}, policy.revision, new AbortController().signal,
    async current => { await Promise.resolve(); return currentBridgeIsAuthorized(current.forecasts[0], policy.revision); });
  expect(permitted).toBe(false);
});

it("clears results if source expiry passes during synchronous search", async () => {
  const { snapshot, body, intent } = fixture();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respond(body)));
  const original = candidates.candidatePlanMetrics;
  vi.spyOn(candidates, "candidatePlanMetrics").mockImplementation((...args) => {
    const value = original(...args); vi.setSystemTime(new Date("2026-10-24T00:00:01Z")); return value;
  });
  const value = await executeRosterPlanning(snapshot, intent);
  expect(value.displaySnapshot.forecasts).toEqual([]);
  expect(value.result.selected.forecastInputs).toEqual([]);
});

it("does not publish a synthetic positive native review that expires during computation", async () => {
  const { snapshot, body, intent } = fixture();
  const binding = { component: "review-fixture", modelMode: "baseline", codeVersion: "synthetic-reviewed-native",
    configurationHash: "a".repeat(64), artifactHash: "b".repeat(64), targetKey: "GOALS", horizonGames: 1,
    conditioning: "conditional_playing", participationLineage: "fixture-participation", cutoffAt: now };
  const { cutoffAt: _, ...scope } = binding;
  const policy = { ...currentRsoUsePolicy(), reviews: [{ id: "synthetic-positive-review",
    binding: scope, reviewedAt: "2026-10-21T00:00:00Z", expiresAt: "2026-10-22T12:00:01Z",
    inputCutoffFrom: "2026-10-22T00:00:00Z", inputCutoffUntil: "2026-10-23T00:00:00Z",
    allowedUses: { assignment: true, totals: true, comparison: true, conditionalTieBreak: false } }] };
  vi.spyOn(policyModule, "currentRsoUsePolicy").mockReturnValue(policy);
  body.data.forecasts = [{ ...snapshot.forecasts[0], revisionId: "native-fixture", modelVersion: binding.codeVersion,
    rsoTargetBindings: { GOALS: binding } }];
  body.data.forecastManifest!.issuedRevisionIds = ["native-fixture"];
  body.data.forecastManifest!.rsoUsePolicy!.bridgeRevisionIds = []; body.bridgeForecasts.rows = [];
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respond(body)));
  const original = candidates.candidatePlanMetrics;
  vi.spyOn(candidates, "candidatePlanMetrics").mockImplementation((...args) => {
    const value = original(...args); vi.setSystemTime(new Date("2026-10-22T12:00:02Z")); return value;
  });
  const result = await executeRosterPlanning(snapshot, intent);
  expect(policyModule.resolveRsoTargetUse(binding, new Date().toISOString(), policy).allowedUses.totals).toBe(false);
  expect(result.displaySnapshot.forecasts.every(row => !forecastAllows(row, "GOALS", "totals"))).toBe(true);
  expect(result.result.selected.projectedValue).toBeNull();
});
