// Executed with nativeProcessCaptureCandidate.vitest.mts, never the frozen client.
import { afterEach, describe, expect, it, vi } from "vitest";
const { local, shared, getCache } = vi.hoisted(() => ({
  local: vi.fn(async (_url, control, start) => { control.attemptsStarted++; return start(); }),
  shared: vi.fn(async (_deadline, dispatch) => dispatch()), getCache: vi.fn(() => "old cache"),
}));
vi.mock("../../../web/lib/nst/requestBudget", () => ({ NstExecutionLimitError: class extends Error {}, withNstRequestBudget: local }));
vi.mock("../../../web/lib/nst/sharedAdmission", () => ({ NstSharedAdmissionError: class extends Error {}, admitSharedNstAttempt: shared }));
vi.mock("../../../web/lib/nst/jobLifecycle.server", () => ({ NstJobLifecycleError: class extends Error {} }));
vi.mock("memory-cache", () => ({ default: { get: getCache, put: vi.fn() } }));
import { fetchNstTextByUrl, fetchNstTextWithCacheByUrl } from "../../../web/lib/nst/client";
const url = "https://data.naturalstattrick.com/playerteams.php?stdoi=std";
const control = () => ({ deadlineAt: Date.now() + 120_000, maxAttempts: 2, attemptsStarted: 0, minIntervalMs: 21_000, plannedRequestCount: 2 });
const options = (maxResponseBytes: number) => ({ maxResponseBytes, retries: 0, requestControl: control() });
const mockResponse = (response: Response) => { vi.stubEnv("NST_KEY", "synthetic-only"); const fetcher = vi.fn(async () => response); vi.stubGlobal("fetch", fetcher); return fetcher; };
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); vi.restoreAllMocks(); vi.clearAllMocks(); });
describe("isolated authenticated client bounded body patch", () => {
  it("consumes exact-bound UTF-8 bytes without cloning, retaining auth/admission and redaction", async () => {
    const text = "é🏒&key=synthetic&rate=n", body = new TextEncoder().encode(text);
    const response = new Response(new ReadableStream({ start(c) { c.enqueue(body.slice(0, 3)); c.enqueue(body.slice(3)); c.close(); } }));
    const clone = vi.spyOn(response, "clone"), fetcher = mockResponse(response), opts = options(body.length);
    const result = await fetchNstTextByUrl(url, opts);
    expect(result.text).toBe("é🏒&key=[REDACTED]&rate=n"); expect(clone).not.toHaveBeenCalled(); expect(response.bodyUsed).toBe(true);
    expect(local).toHaveBeenCalledTimes(1); expect(shared).toHaveBeenCalledTimes(1); expect(opts.requestControl.attemptsStarted).toBe(1);
    expect(fetcher).toHaveBeenCalledWith(url, expect.objectContaining({ redirect: "error", headers: expect.objectContaining({ "nst-key": "synthetic-only" }) }));
  });
  it("aborts and cancels on overflow without retry even when retries were requested", async () => {
    const cancel = vi.fn(), body = new ReadableStream({ start(c) { c.enqueue(new Uint8Array(5)); }, cancel });
    const response = new Response(body), clone = vi.spyOn(response, "clone"), fetcher = mockResponse(response);
    await expect(fetchNstTextByUrl(url, { ...options(4), retries: 3 })).rejects.toThrow("NST response byte limit reached");
    expect(fetcher).toHaveBeenCalledTimes(1); expect(clone).not.toHaveBeenCalled(); expect(cancel).toHaveBeenCalledTimes(1);
    expect((fetcher.mock.calls[0] as unknown as [string, RequestInit])[1].signal?.aborted).toBe(true);
  });
  it.each([0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])("rejects invalid limit %s before admission", async max => {
    const fetcher = mockResponse(new Response("unused")); await expect(fetchNstTextByUrl(url, options(max))).rejects.toThrow("positive safe integer");
    expect(local).not.toHaveBeenCalled(); expect(shared).not.toHaveBeenCalled(); expect(fetcher).not.toHaveBeenCalled();
  });
  it("rejects cumulative overflow regardless of a misleading Content-Length", async () => {
    const response = new Response(new ReadableStream({ start(c) { c.enqueue(new Uint8Array(3)); c.enqueue(new Uint8Array(3)); c.close(); } }), { headers: { "Content-Length": "1", "Content-Encoding": "gzip" } });
    mockResponse(response); await expect(fetchNstTextByUrl(url, options(5))).rejects.toThrow("byte limit");
  });
  it("keeps the deadline timer through bounded consumption", async () => {
    vi.useFakeTimers(); vi.stubEnv("NST_KEY", "synthetic-only");
    vi.stubGlobal("fetch", vi.fn(async (_url, init: RequestInit) => new Response(new ReadableStream({ start(c) { init.signal!.addEventListener("abort", () => c.error(new Error("synthetic aborted body"))); } }))));
    const pending = fetchNstTextByUrl(url, { ...options(5), timeoutMs: 50 }).catch(error => error);
    await vi.runAllTimersAsync(); expect(await pending).toBeInstanceOf(Error); expect(fetch).toHaveBeenCalledTimes(1); expect(vi.getTimerCount()).toBe(0);
  });
  it("propagates body stream failure with no retry in the capture options", async () => {
    const fetcher = mockResponse(new Response(new ReadableStream({ start(c) { c.error(new Error("synthetic body error")); } })));
    await expect(fetchNstTextByUrl(url, options(5))).rejects.toThrow("synthetic body error"); expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("leaves the unbounded default clone behavior and cache behavior unchanged", async () => {
    const response = new Response("default"), clone = vi.spyOn(response, "clone"), fetcher = mockResponse(response);
    expect((await fetchNstTextByUrl(url, { retries: 0 })).text).toBe("default"); expect(clone).toHaveBeenCalledTimes(1); expect(response.bodyUsed).toBe(false);
    expect((await fetchNstTextWithCacheByUrl(url, { retries: 0 })).text).toBe("old cache"); expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("bypasses cached text only for explicit bounded requests", async () => {
    const fetcher = mockResponse(new Response("fresh")); expect((await fetchNstTextWithCacheByUrl(url, options(5))).text).toBe("fresh");
    expect(getCache).not.toHaveBeenCalled(); expect(fetcher).toHaveBeenCalledTimes(1); expect(shared).toHaveBeenCalledTimes(1);
  });
  it("preserves non-success rejection and empty-body handling", async () => {
    mockResponse(new Response("denied", { status: 403 })); await expect(fetchNstTextByUrl(url, options(5))).rejects.toThrow("status 403");
    mockResponse(new Response(null, { status: 204 })); expect((await fetchNstTextByUrl(url, options(5))).text).toBe("");
  });
});
