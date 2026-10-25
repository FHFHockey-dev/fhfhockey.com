import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearClientFetchCache, fetchCachedJson } from "./clientFetchCache";

beforeEach(() => { clearClientFetchCache(); vi.useFakeTimers(); vi.setSystemTime(0); });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const response = (value: unknown) => ({ ok: true, json: async () => value }) as Response;

describe("browser response cache retention", () => {
  it("removes expired payloads when a different URL is read", async () => {
    const deleted = vi.spyOn(Map.prototype, "delete");
    vi.stubGlobal("fetch", vi.fn(async () => response({ fixture: "x".repeat(1024) })));
    for (let i = 0; i < 100; i++) await fetchCachedJson(`/fixture/expired/${i}`, { ttlMs: 10 });
    deleted.mockClear();
    vi.setSystemTime(11);
    await fetchCachedJson("/fixture/fresh");
    expect(deleted.mock.calls.filter(([key]) => String(key).startsWith("/fixture/expired/")).length).toBe(64);
  });

  it("caps retained responses at 64, refreshes recency on hits and preserves pending coalescing", async () => {
    let finish!: (value: Response) => void;
    const fetch = vi.fn(async (url: string) => url === "/fixture/pending"
      ? new Promise<Response>(resolve => { finish = resolve; }) : response(url));
    vi.stubGlobal("fetch", fetch);
    const first = fetchCachedJson("/fixture/pending");
    for (let i = 0; i < 64; i++) await fetchCachedJson(`/fixture/cap/${i}`);
    await fetchCachedJson("/fixture/cap/0");
    await fetchCachedJson("/fixture/cap/64");
    await fetchCachedJson("/fixture/cap/0");
    expect(fetch.mock.calls.filter(([url]) => url === "/fixture/cap/0")).toHaveLength(1);
    await fetchCachedJson("/fixture/cap/1");
    expect(fetch.mock.calls.filter(([url]) => url === "/fixture/cap/1")).toHaveLength(2);
    const second = fetchCachedJson("/fixture/pending");
    expect(fetch.mock.calls.filter(([url]) => url === "/fixture/pending")).toHaveLength(1);
    finish(response({ shared: true }));
    expect(await first).toEqual({ shared: true });
    expect(await second).toEqual({ shared: true });
  });

  it("does not cache failed requests or responses that outlive their TTL", async () => {
    let finish!: (value: Response) => void;
    const fetch = vi.fn().mockRejectedValueOnce(new Error("fixture failure"))
      .mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }))
      .mockResolvedValue(response({ fresh: true }));
    vi.stubGlobal("fetch", fetch);
    await expect(fetchCachedJson("/fixture/retry")).rejects.toThrow("fixture failure");
    const slow = fetchCachedJson("/fixture/retry", { ttlMs: 10 });
    vi.setSystemTime(11);
    finish(response({ old: true }));
    await slow;
    expect(await fetchCachedJson("/fixture/retry")).toEqual({ fresh: true });
    expect(fetch).toHaveBeenCalledTimes(3);
  });
});
