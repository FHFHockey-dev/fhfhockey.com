import { afterEach, describe, expect, it, vi } from "vitest";
import { createTrendRequestCache } from "./trendRequestCache";
afterEach(() => vi.useRealTimers());
describe("public trend request cache", () => {
  it("shares concurrent reads and reuses completed reads until expiry", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const cache = createTrendRequestCache<number>(60_000, 2);
    let complete!: (value: number) => void;
    const load = vi.fn(() => new Promise<number>((resolve) => { complete = resolve; }));
    const first = cache.get("ownership", load);
    const second = cache.get("ownership", load);
    await Promise.resolve();
    expect(load).toHaveBeenCalledTimes(1);
    complete(7);
    expect(await Promise.all([first, second])).toEqual([7, 7]);
    expect(await cache.get("ownership", load)).toBe(7);
    vi.setSystemTime(Date.now() + 60_001);
    expect(await cache.get("ownership", async () => 8)).toBe(8);
  });
  it("does not cache failures or reads older than their freshness budget", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const cache = createTrendRequestCache<number>(100, 2);
    await expect(cache.get("one", async () => { throw new Error("unavailable"); })).rejects.toThrow("unavailable");
    expect(await cache.get("one", async () => 1)).toBe(1);
    expect(await cache.get("slow", async () => { vi.setSystemTime(Date.now() + 101); return 2; })).toBe(2);
    expect(await cache.get("slow", async () => 3)).toBe(3);
  });
  it("separates keys and bounds retained responses", async () => {
    const cache = createTrendRequestCache<number>(60_000, 2);
    await cache.get("one", async () => 1);
    await cache.get("two", async () => 2);
    await cache.get("three", async () => 3);
    expect(await cache.get("one", async () => 4)).toBe(4);
    cache.clear();
    expect(await cache.get("one", async () => 5)).toBe(5);
  });
});
