import { MessageChannel } from "node:worker_threads";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { PlanningSnapshot } from "lib/rosterScheduleOptimizer/planningTypes";
import { readPrivatePlanning } from "lib/rosterScheduleOptimizer/privatePlanningRead";
const mocks = vi.hoisted(() => ({ session: vi.fn(), onAuth: vi.fn(), unsubscribe: vi.fn() }));
vi.mock("lib/supabase/client", () => ({ default: { auth: { getSession: mocks.session, onAuthStateChange: mocks.onAuth } } }));
import { yahooPlanningReadBroker } from "./yahooPlanningReadBroker";
const nonce = "12345678-1234-4123-8123-123456789012";
const context: PlanningSnapshot["context"] = { provider: "yahoo", seasonId: 20262027, teamId: "team", leagueId: "league",
  startDate: "2026-10-23", endDate: "2026-10-24", timeZone: "UTC", asOf: "2026-10-23T12:00:00Z" };
const brokers: ReturnType<typeof yahooPlanningReadBroker>[] = [];
function broker() { const controller = new AbortController(); const value = yahooPlanningReadBroker(context, "owner", controller); brokers.push(value); return { ...value, controller }; }
beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal("MessageChannel", MessageChannel);
  mocks.session.mockResolvedValue({ data: { session: { access_token: "synthetic-token", user: { id: "owner" } } } });
  mocks.onAuth.mockReturnValue({ data: { subscription: { unsubscribe: mocks.unsubscribe } } });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true }) })); });
afterEach(() => { brokers.splice(0).forEach(value => value.close()); vi.unstubAllGlobals(); });
it("owns the exact endpoint, private account/range and headers; tokens and fetch options never cross the port", async () => {
  const b = broker(), result = await readPrivatePlanning(b.port, nonce, b.controller.signal);
  expect(result).toEqual({ ok: true, body: { success: true } }); expect(fetch).toHaveBeenCalledOnce();
  const [url, init] = vi.mocked(fetch).mock.calls[0];
  expect(url).toBe("/api/v1/roster-schedule-optimizer/yahoo-current-data");
  expect(init).toMatchObject({ method: "POST", cache: "no-store", headers: { Authorization: "Bearer synthetic-token" } });
  expect(JSON.parse(init!.body as string)).toEqual({ nonce, teamId: "team", leagueId: "league", seasonId: 20262027,
    startDate: "2026-10-23", endDate: "2026-10-24", timeZone: "UTC" });
  expect(JSON.stringify(result)).not.toContain("synthetic-token");
});
it("ignores duplicate messages and never uses caller URLs or supplied response bodies", async () => {
  const b = broker(); const completed = new Promise(resolve => { b.port.onmessage = resolve; });
  b.port.postMessage({ nonce, url: "https://invalid", body: { success: true }, headers: { Authorization: "forged" } });
  b.port.postMessage({ nonce }); await completed; expect(fetch).toHaveBeenCalledOnce();
  expect(vi.mocked(fetch).mock.calls[0][0]).toBe("/api/v1/roster-schedule-optimizer/yahoo-current-data");
});
it.each(["missing", "other-principal"])("rejects %s session without any fetch", async kind => {
  mocks.session.mockResolvedValue({ data: { session: kind === "missing" ? null : { access_token: "other-token", user: { id: "other" } } } });
  const b = broker(); await expect(readPrivatePlanning(b.port, nonce, b.controller.signal)).rejects.toThrow("unavailable");
  expect(fetch).not.toHaveBeenCalled();
});
it("rejects identity changes during the fetch instead of publishing old-account evidence", async () => {
  mocks.session.mockResolvedValueOnce({ data: { session: { access_token: "synthetic-token", user: { id: "owner" } } } })
    .mockResolvedValueOnce({ data: { session: { user: { id: "other" } } } });
  const b = broker(); await expect(readPrivatePlanning(b.port, nonce, b.controller.signal)).rejects.toThrow("unavailable");
});
it("cancels the actual pending read on logout and closes its subscription", async () => {
  let started!: () => void; const pending = new Promise<void>(resolve => { started = resolve; });
  vi.mocked(fetch).mockImplementation(async (_url, init) => { started(); return new Promise((_resolve, reject) => {
    init!.signal!.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
  }); });
  const b = broker(), read = readPrivatePlanning(b.port, nonce, b.controller.signal);
  const assertion = expect(read).rejects.toThrow("Obsolete"); await pending;
  mocks.onAuth.mock.calls[0][0]("SIGNED_OUT", null); await assertion;
  expect(vi.mocked(fetch).mock.calls[0][1]?.signal?.aborted).toBe(true); expect(mocks.unsubscribe).toHaveBeenCalledOnce();
});
it("propagates the worker read deadline to the pending HTTP request", async () => {
  let started!: () => void; const pending = new Promise<void>(resolve => { started = resolve; });
  let cancelled!: () => void; const cancellation = new Promise<void>(resolve => { cancelled = resolve; });
  vi.mocked(fetch).mockImplementation(async (_url, init) => { started(); return new Promise((_resolve, reject) => {
    init!.signal!.addEventListener("abort", () => { cancelled(); reject(new Error("aborted")); }, { once: true });
  }); });
  const b = broker(), worker = new AbortController(), read = readPrivatePlanning(b.port, nonce, worker.signal);
  const assertion = expect(read).rejects.toThrow("Obsolete"); await pending; worker.abort(); await assertion; await cancellation;
  expect(fetch).toHaveBeenCalledOnce();
});
it("binds context before asynchronous session work and retains logout cancellation through computation", async () => {
  const selected = { ...context }, controller = new AbortController();
  const b = yahooPlanningReadBroker(selected, "owner", controller); brokers.push(b);
  selected.teamId = "changed-after-generation";
  await readPrivatePlanning(b.port, nonce, controller.signal);
  expect(JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string).teamId).toBe("team");
  expect(mocks.unsubscribe).not.toHaveBeenCalled();
  mocks.onAuth.mock.calls[0][0]("SIGNED_OUT", null);
  expect(controller.signal.aborted).toBe(true); expect(mocks.unsubscribe).toHaveBeenCalledOnce();
});
