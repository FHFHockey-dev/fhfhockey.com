import { afterEach, describe, expect, it, vi } from "vitest";
import { createSharedReadCache } from "./sharedRead";
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe("bounded shared public reads", () => {
  it("expires payloads and evicts the least recently used completed entry", async () => {
    vi.useFakeTimers(); vi.setSystemTime(0);
    const cache = createSharedReadCache<number>(10, 2);
    const load = vi.fn(async () => 1);
    await cache.read("a", load); await cache.read("b", load);
    await cache.read("a", load); await cache.read("c", load);
    expect(cache.has("a")).toBe(true);
    expect(cache.has("b")).toBe(false);
    vi.setSystemTime(10);
    expect(cache.has("a")).toBe(false);
    expect(cache.has("c")).toBe(false);
    await cache.read("a", load);
    expect(load).toHaveBeenCalledTimes(4);
  });

  it("keeps pending reads shared across completed-entry eviction and retries failures", async () => {
    const cache = createSharedReadCache<number>(30_000, 1);
    let finish!: (value: number) => void;
    const load = vi.fn(() => new Promise<number>(resolve => { finish = resolve; }));
    const first = cache.read("pending", load);
    await cache.read("a", async () => 1); await cache.read("b", async () => 2);
    const second = cache.read("pending", load);
    finish(3);
    expect(await first).toBe(3); expect(await second).toBe(3);
    expect(load).toHaveBeenCalledTimes(1);
    await expect(cache.read("failure", async () => { throw new Error("fixture error"); })).rejects.toThrow("fixture error");
    expect(cache.has("failure")).toBe(false);
    expect(await cache.read("failure", async () => 4)).toBe(4);
  });

  it("does not start reads for pre-cancelled subscribers or retain late cancelled results", async () => {
    const cache = createSharedReadCache<number>();
    const controller = new AbortController(); controller.abort();
    const load = vi.fn(async () => 1);
    await expect(cache.read("a", load, controller.signal)).rejects.toMatchObject({ name: "AbortError" });
    expect(load).not.toHaveBeenCalled();
    const active = new AbortController();
    let finish!: (value: number) => void;
    const pending = cache.read("b", () => new Promise<number>(resolve => { finish = resolve; }), active.signal);
    const rejected = expect(pending).rejects.toMatchObject({ name: "AbortError" });
    await Promise.resolve(); active.abort(); await rejected;
    finish(2); await Promise.resolve(); await Promise.resolve();
    expect(cache.has("b")).toBe(false);
  });
});
