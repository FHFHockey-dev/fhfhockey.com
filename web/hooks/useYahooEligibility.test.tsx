import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useYahooEligibility } from "./useYahooEligibility";
const receipt = (seasonId = 20262027) => ({ seasonId, source: "yahoo_players", scope: "Yahoo default positions", status: "partial", expiresAt: "2026-10-14T08:40:00Z", players: [], limitations: [] });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });
it("reads a candidate catalogue in sequential bounded database-cache batches", async () => {
  vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-10-13T12:00:00Z"));
  const ids = Array.from({ length: 180 }, (_, index) => String(20000 + index));
  let active = 0, maxActive = 0;
  const fetch = vi.fn(async (url: string) => {
    active++; maxActive = Math.max(maxActive, active);
    const batch = new URL(url, "http://fixture.invalid").searchParams.get("playerIds")!.split(",");
    await Promise.resolve(); active--;
    return { ok: batch.length <= 60, json: async () => ({ success: batch.length <= 60,
      receipt: { ...receipt(), status: "ready", players: batch.map((playerId, index) => ({ playerId, nhlId: 9000000 + index,
        providerId: `477.p.${playerId}`, positions: ["C"], playerClass: "skater", asOf: "2026-10-13T08:41:00Z" })) } }) };
  });
  vi.stubGlobal("fetch", fetch);
  const { result } = renderHook(() => useYahooEligibility(20262027, ids, true));
  await waitFor(() => expect(result.current.receipt?.players).toHaveLength(180));
  expect(fetch).toHaveBeenCalledTimes(3);
  expect(maxActive).toBe(1);
  expect(fetch.mock.calls.every(([url]) => url.startsWith("/api/v1/roster-schedule-optimizer/eligibility?"))).toBe(true);
});
it.each(["foreign player", "different source cycle"])("rejects a batched receipt with a %s", async invalid => {
  vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-10-13T12:00:00Z"));
  const ids = Array.from({ length: 61 }, (_, index) => String(71000 + index));
  const fetch = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, receipt: receipt() }) })
    .mockResolvedValue({ ok: true, json: async () => ({ success: true, receipt: { ...receipt(),
      ...(invalid === "foreign player" ? { players: [{ playerId: "99999" }] } : { expiresAt: "2026-10-15T08:40:00Z" }) } }) });
  vi.stubGlobal("fetch", fetch);
  const { result } = renderHook(() => useYahooEligibility(20262027, ids, true));
  await waitFor(() => expect(result.current.error).toContain("unavailable"));
  expect(result.current.receipt).toBeNull(); expect(fetch).toHaveBeenCalledTimes(2);
});
it("keeps partial batch coverage partial and deduplicates its limitations", async () => {
  vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-10-13T12:00:00Z"));
  const ids = Array.from({ length: 61 }, (_, index) => String(72000 + index));
  const fetch = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, receipt: { ...receipt(), status: "ready", limitations: ["League availability is unknown."] } }) })
    .mockResolvedValue({ ok: true, json: async () => ({ success: true, receipt: { ...receipt(), limitations: ["League availability is unknown.", "Missing positions."] } }) });
  vi.stubGlobal("fetch", fetch);
  const { result } = renderHook(() => useYahooEligibility(20262027, ids, true));
  await waitFor(() => expect(result.current.receipt?.status).toBe("partial"));
  expect(result.current.receipt?.limitations).toEqual(["League availability is unknown.", "Missing positions."]);
});
it("rejects an oversized scope before making any cache request", async () => {
  const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
  const ids = Array.from({ length: 241 }, (_, index) => String(73000 + index));
  const { result } = renderHook(() => useYahooEligibility(20262027, ids, true));
  await waitFor(() => expect(result.current.error).toContain("unavailable"));
  expect(result.current.receipt).toBeNull(); expect(fetch).not.toHaveBeenCalled();
});
it("deduplicates simultaneous cache reads and rejects a late response for another season", async () => {
  vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-10-13T12:00:00Z"));
  let resolve!: (response: unknown) => void;
  const fetch = vi.fn().mockImplementationOnce(() => new Promise(done => { resolve = done; })).mockResolvedValue({ ok: true, json: async () => ({ success: true, receipt: receipt(20272028) }) });
  vi.stubGlobal("fetch", fetch);
  const first = renderHook(({ season }) => useYahooEligibility(season, ["8157"], true), { initialProps: { season: 20262027 } });
  const second = renderHook(() => useYahooEligibility(20262027, ["8157"], true));
  expect(fetch).toHaveBeenCalledOnce(); expect(first.result.current.loading).toBe(true);
  first.rerender({ season: 20272028 });
  await waitFor(() => expect(first.result.current.receipt?.seasonId).toBe(20272028));
  await act(async () => resolve({ ok: true, json: async () => ({ success: true, receipt: receipt() }) }));
  expect(first.result.current.receipt?.seasonId).toBe(20272028);
  expect(second.result.current.receipt?.seasonId).toBe(20262027);
});
it("does not read for manual/paused or empty rosters and distinguishes a cache error from loading", async () => {
  const fetch = vi.fn().mockRejectedValue(new Error("offline")); vi.stubGlobal("fetch", fetch);
  const { result, rerender } = renderHook(({ enabled, ids }) => useYahooEligibility(20262027, ids, enabled), { initialProps: { enabled: false, ids: ["9711"] } });
  expect(result.current.loading).toBe(false); expect(fetch).not.toHaveBeenCalled();
  rerender({ enabled: true, ids: [] }); expect(fetch).not.toHaveBeenCalled();
  rerender({ enabled: true, ids: ["9711"] });
  await waitFor(() => expect(result.current.error).toContain("unavailable"));
  expect(result.current.loading).toBe(false); expect(result.current.receipt).toBeNull();
  expect(fetch).toHaveBeenCalledOnce();
});
it("expires the admitted cache at the next source cycle and rechecks it once", async () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-14T08:39:59Z"));
  const fetch = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, receipt: receipt() }) })
    .mockResolvedValue({ ok: true, json: async () => ({ success: true, receipt: { ...receipt(), expiresAt: "2026-10-15T08:40:00Z" } }) });
  vi.stubGlobal("fetch", fetch);
  const { result } = renderHook(() => useYahooEligibility(20262027, ["9857"], true));
  await act(async () => { await vi.advanceTimersByTimeAsync(0); }); expect(result.current.receipt).toBeTruthy();
  await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
  expect(fetch).toHaveBeenCalledTimes(2); expect(result.current.receipt?.expiresAt).toBe("2026-10-15T08:40:00Z");
});
it("rechecks a partial or failed source on a completed refresh rather than caching absence until tomorrow", async () => {
  vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-10-13T12:00:00Z"));
  const fetch = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, receipt: { ...receipt(), status: "error" } }) })
    .mockResolvedValue({ ok: true, json: async () => ({ success: true, receipt: { ...receipt(), status: "ready" } }) });
  vi.stubGlobal("fetch", fetch);
  const { result, rerender } = renderHook(({ revision }) => useYahooEligibility(20262027, ["10012"], true, revision), { initialProps: { revision: 0 } });
  await waitFor(() => expect(result.current.receipt?.status).toBe("error"));
  rerender({ revision: 1 }); await waitFor(() => expect(result.current.receipt?.status).toBe("ready"));
  expect(fetch).toHaveBeenCalledTimes(2);
});
