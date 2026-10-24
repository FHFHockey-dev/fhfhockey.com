import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { fixture, now } from "./p07ReviewFixture";
import { executeRosterPlanning } from "./executionAdapter";
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(now)); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
const response = (body: unknown) => ({ ok: true, json: async () => structuredClone(body) }) as Response;
it("rejects an exact previously accepted response when a new read has a new nonce", async () => {
  const { snapshot, body, intent } = fixture(); let captured: unknown;
  const fetcher = vi.fn(async (_url: string, init: RequestInit) => {
    captured ??= { ...body, read: { nonce: (init.headers as Record<string,string>)["X-RSO-Read-Nonce"], evaluatedAt: now } };
    return response(captured);
  });
  vi.stubGlobal("fetch", fetcher);
  const first = await executeRosterPlanning(snapshot, intent);
  expect(first.result.selected.projectedValue).toBe(7);
  const second = await executeRosterPlanning(snapshot, { ...intent, revision: intent.revision + 1 });
  expect(second.readError).toBe("Current read does not match this planning generation.");
  expect(second.data).toBeNull(); expect(second.displaySnapshot.forecasts).toEqual([]);
  expect(second.result.selected.projectedValue).toBeNull();
  expect(fetcher).toHaveBeenCalledTimes(2);
});
it("rejects a changed manifest timestamp despite a correctly echoed current nonce", async () => {
  const { snapshot, body, intent } = fixture(); body.data.forecastManifest!.asOf = "2026-10-21T12:00:00Z";
  vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => response({ ...body,
    read: { nonce: (init.headers as Record<string,string>)["X-RSO-Read-Nonce"], evaluatedAt: now } })));
  const result = await executeRosterPlanning(snapshot, intent);
  expect(result.data).toBeNull(); expect(result.displaySnapshot.forecasts).toEqual([]);
});
it("a fresh correctly correlated response cannot retain a revoked bridge permission", async () => {
  const { snapshot, body, intent } = fixture(); let reads = 0;
  vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => {
    const current = structuredClone(body); if (++reads === 2) current.data.forecastManifest!.rsoUsePolicy!.bridgeRevisionIds = [];
    return response({ ...current, read: { nonce: (init.headers as Record<string,string>)["X-RSO-Read-Nonce"], evaluatedAt: now } });
  }));
  expect((await executeRosterPlanning(snapshot, intent)).result.selected.projectedValue).toBe(7);
  const revoked = await executeRosterPlanning(snapshot, { ...intent, revision: intent.revision + 1 });
  expect(revoked.readError).toBeNull(); expect(revoked.result.selected.projectedValue).toBeNull();
  expect(revoked.displaySnapshot.forecasts[0].stats.GOALS).toBeNull(); expect(reads).toBe(2);
});
